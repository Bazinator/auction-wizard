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
const logger = require('../utils/logger');
const { validateEnv } = require('../utils/validateEnv');
const DatabaseConnection = require('../utils/dbConnection');
const { errorHandler, asyncHandler, notFoundHandler } = require('../middleware/errorHandler');
const {
  validatePagination,
  validateNumericParams,
  validateMarketName,
  validateObjectId,
  validateItemType,
  validateSniperCriteria,
} = require('../middleware/validator');

// Validate environment variables at startup
try {
  validateEnv();
} catch (error) {
  logger.error('Environment validation failed', { error: error.message });
  process.exit(1);
}

const app = express();
app.use(helmet());

// CORS configuration - require FRONTEND_ORIGIN (security critical)
const frontendOrigin = process.env.FRONTEND_ORIGIN;
if (!frontendOrigin || frontendOrigin === 'true') {
  logger.error('FRONTEND_ORIGIN must be set to a specific origin for security');
  process.exit(1);
}

app.use(cors({
  origin: frontendOrigin,
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
}));

// Request size limits (DoS protection)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));


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
  logger.error('Missing required env: JWT_SECRET');
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

let server;
let dbConnection;
let db;

async function startServer() {
  try {
    // Create database connection
    dbConnection = new DatabaseConnection(url, dbName);
    db = await dbConnection.connect();

    logger.info("Connected successfully to MongoDB server");

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
      logger.info('Database indexes created/verified');
    } catch (e) {
      logger.error('Index creation error', { error: e.message });
    }

    // Rate limiters
    const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 100 });
    const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10 });
    const itemsLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 100 });
    const userMatchesLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 50 });

    app.post('/api/signup', authLimiter, asyncHandler(async (req, res) => {
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
        logger.error('Signup error', { error: err.message, stack: err.stack });
        res.status(500).json({ error: 'Failed to create user' });
      }
    }));

    // Refresh token rotation
    app.post('/api/token/refresh', authLimiter, asyncHandler(async (req, res) => {
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
        logger.error('Refresh error', { error: err.message, stack: err.stack });
        return res.status(401).json({ error: 'Invalid refresh token' });
      }
    }));

    // Logout: revoke provided refresh token
    app.post('/api/logout', authLimiter, asyncHandler(async (req, res) => {
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
        logger.error('Logout error', { error: err.message, stack: err.stack });
        return res.status(400).json({ error: 'Invalid refresh token' });
      }
    }));

    app.post('/api/login', loginLimiter, asyncHandler(async (req, res) => {
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
        logger.error('Login error', { error: err.message, stack: err.stack });
        res.status(500).json({ error: 'An error occurred during login' });
      }
    }));

    // Sniper endpoints
    app.post('/api/snipers', authenticateToken, validateSniperCriteria, asyncHandler(async (req, res) => {
      const { marketName, minPrice, maxPrice, minFloat, maxFloat } = req.validated;

      const sniperCriteria = {
        userId: new mongodb.ObjectId(req.userId),
        marketName,
        minPrice: minPrice !== undefined ? minPrice : null,
        maxPrice: maxPrice !== undefined ? maxPrice : null,
        minFloat: minFloat !== undefined ? minFloat : null,
        maxFloat: maxFloat !== undefined ? maxFloat : null,
        createdAt: new Date()
      };

      try {
        const result = await db.collection('snipers').insertOne(sniperCriteria);
        logger.info('Sniper registered', { userId: req.userId, sniperId: result.insertedId });
        res.status(201).json({ message: 'Sniper registered successfully', id: result.insertedId });
      } catch (err) {
        logger.error('Failed to register sniper', { error: err.message, userId: req.userId });
        res.status(500).json({ error: 'Failed to register sniper' });
      }
    }));

    app.get('/api/snipers', authenticateToken, asyncHandler(async (req, res) => {
      try {
        const snipers = await db.collection('snipers')
          .find({ userId: new mongodb.ObjectId(req.userId) })
          .toArray();
        res.json(snipers);
      } catch (err) {
        logger.error('Failed to fetch snipers', { error: err.message, userId: req.userId });
        res.status(500).json({ error: 'Failed to fetch snipers' });
      }
    }));

    app.delete('/api/snipers/:id', authenticateToken, validateObjectId, asyncHandler(async (req, res) => {
      try {
        const result = await db.collection('snipers').deleteOne({
          _id: new mongodb.ObjectId(req.params.id),
          userId: new mongodb.ObjectId(req.userId)
        });

        if (result.deletedCount === 0) {
          return res.status(404).json({ error: 'Sniper not found' });
        }

        logger.info('Sniper deleted', { userId: req.userId, sniperId: req.params.id });
        res.json({ message: 'Sniper deleted successfully' });
      } catch (err) {
        logger.error('Failed to delete sniper', { error: err.message, userId: req.userId, sniperId: req.params.id });
        res.status(500).json({ error: 'Failed to delete sniper' });
      }
    }));

    app.get('/api/items', itemsLimiter, validatePagination, validateNumericParams, validateMarketName, validateItemType, asyncHandler(async (req, res) => {
      const { page, limit, skip } = req.validated;
      const { minPrice, maxPrice, minFloat, maxFloat, marketName, itemType } = req.validated || req.query;

      // Build query from validated parameters
      const query = buildSniperQuery({ marketName, minPrice, maxPrice, minFloat, maxFloat });

      const options = {
        skip,
        limit,
        sort: { name: 1 }
      };

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
            { $limit: limit }
          ];
          items = await db.collection('marketitems').aggregate(pipeline).toArray();
        }

        logger.debug('Items fetched', { count: items.length, itemType, page, limit });
        res.json(items);
      } catch (err) {
        logger.error('Error in /api/items', { error: err.message, stack: err.stack });
        res.status(500).json({ error: 'Failed to fetch items' });
      }
    }));

    // Endpoint to fetch matching items for a user
    app.post('/api/user-matches', authenticateToken, userMatchesLimiter, validateSniperCriteria, asyncHandler(async (req, res) => {
      const { marketName, maxPrice, minFloat, maxFloat } = req.validated;

      try {
        // Build MongoDB query from criteria - eliminates loading all items into memory
        const query = buildSniperQuery({ marketName, maxPrice, minFloat, maxFloat });
        
        // Query database directly - only fetch matching items
        const matchingItems = await db.collection('marketitems')
          .find(query)
          .toArray();

        logger.debug('User matches fetched', { userId: req.userId, count: matchingItems.length });
        res.json(matchingItems);
      } catch (error) {
        logger.error('Error fetching matching items', { error: error.message, stack: error.stack, userId: req.userId });
        res.status(500).json({ error: 'Failed to fetch matching items' });
      }
    }));

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
            logger.debug(`Notify user ${sniper.userId} about item ${item.name}`);
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

    // Health check endpoints
    app.get('/health', (req, res) => {
      res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
    });

    app.get('/health/ready', asyncHandler(async (req, res) => {
      try {
        // Check database connection
        await db.admin().ping();
        res.status(200).json({ status: 'ready', database: 'connected' });
      } catch (error) {
        logger.error('Readiness check failed', { error: error.message });
        res.status(503).json({ status: 'not ready', database: 'disconnected' });
      }
    }));

    app.get('/health/live', (req, res) => {
      res.status(200).json({ status: 'alive' });
    });

    // 404 handler
    app.use(notFoundHandler);

    // Global error handler (must be last)
    app.use(errorHandler);

    // Start server
    const port = process.env.API_PORT || 4000;
    server = app.listen(port, () => {
      logger.info(`Server is running on port ${port}`);
    });

    // Graceful shutdown handlers
    const gracefulShutdown = async (signal) => {
      logger.info(`${signal} received, starting graceful shutdown...`);
      
      // Stop accepting new requests
      server.close(async () => {
        logger.info('HTTP server closed');

        try {
          // Stop sniper service
          await sniperService.stop();
          logger.info('SniperService stopped');

          // Close database connection
          if (dbConnection) {
            await dbConnection.close();
            logger.info('Database connection closed');
          }

          logger.info('Graceful shutdown completed');
          process.exit(0);
        } catch (error) {
          logger.error('Error during shutdown', { error: error.message });
          process.exit(1);
        }
      });

      // Force shutdown after 30 seconds
      setTimeout(() => {
        logger.error('Forced shutdown after timeout');
        process.exit(1);
      }, 30000);
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));

    // Handle unhandled promise rejections
    process.on('unhandledRejection', (reason, promise) => {
      logger.error('Unhandled Rejection', { reason, promise });
    });

    // Handle uncaught exceptions
    process.on('uncaughtException', (error) => {
      logger.error('Uncaught Exception', { error: error.message, stack: error.stack });
      gracefulShutdown('uncaughtException');
    });

  } catch (err) {
    logger.error('Server startup error', { error: err.message, stack: err.stack });
    process.exit(1);
  }
}

startServer();