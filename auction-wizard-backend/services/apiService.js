const express = require('express');
const mongodb = require('mongodb');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const axios = require('axios');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sniperService = require('./sniperService');
const { buildSniperQuery } = require('../utils/sniperQueryBuilder');

const app = express();
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN || true,
  allowedHeaders: ['Content-Type', 'Authorization'],
}));
app.use(express.json());


// Environment Variables
const url = process.env.MONGODB_URI;
const dbName = process.env.DB_NAME;
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_ISSUER = process.env.JWT_ISSUER || 'auction-wizard';
const JWT_AUDIENCE = process.env.JWT_AUDIENCE || 'auction-wizard-users';
const ACCESS_TOKEN_TTL = process.env.ACCESS_TOKEN_TTL || '15m';
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12', 10);
const REFRESH_TOKEN_TTL = process.env.REFRESH_TOKEN_TTL || '30d';

if (!JWT_SECRET) {
  console.error('Missing required env: JWT_SECRET');
  process.exit(1);
}

const generateJti = () => crypto.randomUUID ? crypto.randomUUID() : crypto.randomBytes(16).toString('hex');

const signAccessToken = (userId) =>
  jwt.sign({ userId }, JWT_SECRET, {
    expiresIn: ACCESS_TOKEN_TTL,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });

const signRefreshToken = (userId, jti) =>
  jwt.sign({ userId, jti }, JWT_SECRET, {
    expiresIn: REFRESH_TOKEN_TTL,
    issuer: JWT_ISSUER,
    audience: JWT_AUDIENCE,
  });

// Validation helpers
const isValidEmail = (email) => {
  const re = /^(?:[a-zA-Z0-9_'^&+\-])+(?:\.(?:[a-zA-Z0-9_'^&+\-])+)*@(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}$/;
  return re.test(String(email).toLowerCase());
};

const isStrongPassword = (password) => {
  if (typeof password !== 'string' || password.length < 8) return false;
  const hasUpper = /[A-Z]/.test(password);
  const hasLower = /[a-z]/.test(password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(password);
  return hasUpper && hasLower && hasSpecial;
};

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access denied' });

  try {
    const verified = jwt.verify(token, JWT_SECRET, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    });
    req.userId = verified.userId;
    next();
  } catch (err) {
    res.status(403).json({ error: 'Invalid token' });
  }
};

async function startServer() {
  const client = new mongodb.MongoClient(url, { useUnifiedTopology: true });

  try {
    await client.connect();
    console.log("Connected successfully to server");

    const db = client.db(dbName);

    // Start the sniper service
    await sniperService.start();

    // Ensure indexes
    try {
      await db.collection('users').createIndexes([
        { key: { email: 1 }, unique: true, name: 'email_unique' },
      ]);
      await db.collection('refreshTokens').createIndexes([
        { key: { jti: 1 }, unique: true, name: 'jti_unique' },
        { key: { userId: 1 }, name: 'userId_idx' },
        { key: { createdAt: 1 }, name: 'createdAt_idx' },
      ]);
    } catch (e) {
      console.error('Index creation error:', e);
    }

    // User authentication endpoints
    const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 100 });
    const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10 });

    app.post('/api/signup', authLimiter, async (req, res) => {
      const { email, password } = req.body;

      const emailNorm = String(email || '').trim().toLowerCase();

      if (!emailNorm || !password) {
        return res.status(400).json({ error: 'Email and password are required' });
      }

      if (!isValidEmail(emailNorm)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }

      if (!isStrongPassword(password)) {
        return res.status(400).json({ error: 'Password does not meet requirements' });
      }
      
      try {
        const existingUser = await db.collection('users').findOne({ email: emailNorm });
        if (existingUser) {
          return res.status(400).json({ error: 'Unable to create account' });
        }

        const salt = await bcrypt.genSalt(BCRYPT_ROUNDS);
        const hashedPassword = await bcrypt.hash(password, salt);

        const result = await db.collection('users').insertOne({
          email: emailNorm,
          password: hashedPassword,
          createdAt: new Date(),
          failedLoginAttempts: 0,
          lockUntil: null,
        });

        // Issue tokens
        const accessToken = signAccessToken(result.insertedId);
        const jti = generateJti();
        const refreshToken = signRefreshToken(result.insertedId, jti);

        // Store hashed refresh token
        const refreshHash = await bcrypt.hash(refreshToken, await bcrypt.genSalt(BCRYPT_ROUNDS));
        await db.collection('refreshTokens').insertOne({
          userId: result.insertedId,
          jti,
          tokenHash: refreshHash,
          revoked: false,
          createdAt: new Date(),
        });

        res.status(201).json({ token: accessToken, refreshToken });
      } catch (err) {
        console.error('Signup error:', err);
        res.status(500).json({ error: 'Failed to create user' });
      }
    });

    // Refresh token rotation
    app.post('/api/token/refresh', authLimiter, async (req, res) => {
      const { refreshToken } = req.body || {};
      if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token required' });
      }

      try {
        const decoded = jwt.verify(refreshToken, JWT_SECRET, {
          issuer: JWT_ISSUER,
          audience: JWT_AUDIENCE,
        });

        const { userId, jti } = decoded;
        const record = await db.collection('refreshTokens').findOne({ jti, userId: new mongodb.ObjectId(userId) });

        if (!record || record.revoked) {
          // Possible reuse — revoke all tokens for user
          await db.collection('refreshTokens').updateMany(
            { userId: new mongodb.ObjectId(userId), revoked: { $ne: true } },
            { $set: { revoked: true, revokedAt: new Date(), reason: 'reuse_suspected' } }
          );
          return res.status(401).json({ error: 'Invalid refresh token' });
        }

        const matches = await bcrypt.compare(refreshToken, record.tokenHash);
        if (!matches) {
          // Reuse attempt with different token string
          await db.collection('refreshTokens').updateMany(
            { userId: new mongodb.ObjectId(userId), revoked: { $ne: true } },
            { $set: { revoked: true, revokedAt: new Date(), reason: 'reuse_detected' } }
          );
          return res.status(401).json({ error: 'Invalid refresh token' });
        }

        // Rotate: revoke old, issue new
        await db.collection('refreshTokens').updateOne({ _id: record._id }, { $set: { revoked: true, usedAt: new Date() } });

        const newJti = generateJti();
        const newAccessToken = signAccessToken(record.userId);
        const newRefreshToken = signRefreshToken(record.userId, newJti);
        const newHash = await bcrypt.hash(newRefreshToken, await bcrypt.genSalt(BCRYPT_ROUNDS));
        await db.collection('refreshTokens').insertOne({
          userId: record.userId,
          jti: newJti,
          tokenHash: newHash,
          revoked: false,
          createdAt: new Date(),
        });

        return res.json({ token: newAccessToken, refreshToken: newRefreshToken });
      } catch (err) {
        console.error('Refresh error:', err);
        return res.status(401).json({ error: 'Invalid refresh token' });
      }
    });

    // Logout: revoke provided refresh token
    app.post('/api/logout', authLimiter, async (req, res) => {
      const { refreshToken } = req.body || {};
      if (!refreshToken) {
        return res.status(400).json({ error: 'Refresh token required' });
      }

      try {
        const decoded = jwt.verify(refreshToken, JWT_SECRET, {
          issuer: JWT_ISSUER,
          audience: JWT_AUDIENCE,
        });

        const { userId, jti } = decoded;
        await db.collection('refreshTokens').updateOne(
          { jti, userId: new mongodb.ObjectId(userId) },
          { $set: { revoked: true, revokedAt: new Date(), reason: 'logout' } }
        );
        return res.json({ success: true });
      } catch (err) {
        console.error('Logout error:', err);
        return res.status(400).json({ error: 'Invalid refresh token' });
      }
    });

    app.post('/api/login', loginLimiter, async (req, res) => {
      const { email, password } = req.body;

      const emailNorm = String(email || '').trim().toLowerCase();

      try {
        const user = await db.collection('users').findOne({ email: emailNorm });
        if (!user) {
          return res.status(400).json({ error: 'Invalid email or password' });
        }

        if (user.lockUntil && new Date(user.lockUntil) > new Date()) {
          return res.status(429).json({ error: 'Too many attempts. Try again later.' });
        }

        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
          const attempts = (user.failedLoginAttempts || 0) + 1;
          const update = { $set: { failedLoginAttempts: attempts } };
          const MAX_ATTEMPTS = 5;
          if (attempts >= MAX_ATTEMPTS) {
            update.$set.lockUntil = new Date(Date.now() + 15 * 60 * 1000);
            update.$set.failedLoginAttempts = 0;
          }
          await db.collection('users').updateOne({ _id: user._id }, update);
          return res.status(400).json({ error: 'Invalid email or password' });
        }

        // reset attempts on success
        await db.collection('users').updateOne(
          { _id: user._id },
          { $set: { failedLoginAttempts: 0, lockUntil: null } }
        );

        const accessToken = signAccessToken(user._id);
        const jti = generateJti();
        const refreshToken = signRefreshToken(user._id, jti);

        const refreshHash = await bcrypt.hash(refreshToken, await bcrypt.genSalt(BCRYPT_ROUNDS));
        await db.collection('refreshTokens').insertOne({
          userId: user._id,
          jti,
          tokenHash: refreshHash,
          revoked: false,
          createdAt: new Date(),
        });

        res.json({ token: accessToken, refreshToken });
      } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'An error occurred during login' });
      }
    });

    // Sniper endpoints
    app.post('/api/snipers', authenticateToken, async (req, res) => {
      const { marketName, minPrice, maxPrice, minFloat, maxFloat } = req.body;

      if (!marketName) {
        return res.status(400).json({ error: 'Market Name is required' });
      }

      const sniperCriteria = {
        userId: new mongodb.ObjectId(req.userId),
        marketName,
        minPrice: parseFloat(minPrice),
        maxPrice: parseFloat(maxPrice),
        minFloat: parseFloat(minFloat),
        maxFloat: parseFloat(maxFloat),
        createdAt: new Date()
      };

      try {
        const result = await db.collection('snipers').insertOne(sniperCriteria);
        res.status(201).json({ message: 'Sniper registered successfully', id: result.insertedId });
      } catch (err) {
        res.status(500).json({ error: 'Failed to register sniper' });
      }
    });

    app.get('/api/snipers', authenticateToken, async (req, res) => {
      try {
        const snipers = await db.collection('snipers')
          .find({ userId: new mongodb.ObjectId(req.userId) })
          .toArray();
        res.json(snipers);
      } catch (err) {
        res.status(500).json({ error: 'Failed to fetch snipers' });
      }
    });

    app.delete('/api/snipers/:id', authenticateToken, async (req, res) => {
      try {
        const result = await db.collection('snipers').deleteOne({
          _id: new mongodb.ObjectId(req.params.id),
          userId: new mongodb.ObjectId(req.userId)
        });

        if (result.deletedCount === 0) {
          return res.status(404).json({ error: 'Sniper not found' });
        }

        res.json({ message: 'Sniper deleted successfully' });
      } catch (err) {
        res.status(500).json({ error: 'Failed to delete sniper' });
      }
    });

    app.get('/api/items', async (req, res) => {
      const { marketName, minPrice, maxPrice, minFloat, maxFloat, itemType, page = 1, limit = 10 } = req.query;
      
      console.log('Pagination params:', { page, limit });
      console.log('Query params:', { itemType, marketName, minPrice, maxPrice });

      const query = {};
      const options = {
        skip: (parseInt(page) - 1) * parseInt(limit),
        limit: parseInt(limit),
        sort: { name: 1 }
      };

      console.log('MongoDB options:', options);

      try {
        let items = [];

        if (itemType === 'auction') {
          items = await db.collection('liveitems').find(query).sort(options.sort).skip(options.skip).limit(options.limit).toArray();
        } else if (itemType === 'market') {
          items = await db.collection('marketitems').find(query).sort(options.sort).skip(options.skip).limit(options.limit).toArray();
        } else {
          // Use aggregation pipeline to merge collections before pagination
          // This eliminates in-memory merging and improves performance
          const pipeline = [
            { $match: query },
            { $unionWith: { coll: 'liveitems', pipeline: [{ $match: query }] } },
            { $sort: { name: 1 } },
            { $skip: options.skip },
            { $limit: parseInt(limit) }
          ];
          items = await db.collection('marketitems').aggregate(pipeline).toArray();
        }

        console.log('Items returned:', items.length);
        res.json(items);
      } catch (err) {
        console.error('Error in /api/items:', err);
        res.status(500).json({ error: 'Failed to fetch items' });
      }
    });

    // Endpoint to fetch matching items for a user
    app.post('/api/user-matches', authenticateToken, async (req, res) => {
      const { marketName, maxPrice, minFloat, maxFloat } = req.body;

      try {
        // Build MongoDB query from criteria - eliminates loading all items into memory
        const query = buildSniperQuery({ marketName, maxPrice, minFloat, maxFloat });
        
        // Query database directly - only fetch matching items
        const matchingItems = await db.collection('marketitems')
          .find(query)
          .toArray();

        res.json(matchingItems);
      } catch (error) {
        console.error('Error fetching matching items:', error);
        res.status(500).json({ error: 'Failed to fetch matching items' });
      }
    });

    async function checkSnipers(newItems) {
      const snipers = await db.collection('snipers').find().toArray();

      snipers.forEach(sniper => {
        newItems.forEach(item => {
          if (
            item.name.includes(sniper.marketName) &&
            item.price >= sniper.minPrice &&
            item.price <= sniper.maxPrice &&
            item.float >= sniper.minFloat &&
            item.float <= sniper.maxFloat
          ) {
            console.log(`Notify user ${sniper.userId} about item ${item.name}`);
          }
        });
      });
    }

    const fetchItems = async () => {
      const apiUrl = process.env.API_URL || 'http://localhost:4000';
      const res = await axios.get(`${apiUrl}/api/items`);
      const data = res.data;

      // Check new items against sniper criteria
      checkSnipers(data);
    };

    const port = process.env.API_PORT || 4000;
    app.listen(port, () => console.log(`Server is running on port ${port}`));
  } catch (err) {
    console.error('Server startup error:', err);
    process.exit(1);
  }
}

startServer();