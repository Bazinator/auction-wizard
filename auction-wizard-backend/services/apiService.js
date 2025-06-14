const express = require('express');
const mongodb = require('mongodb');
const cors = require('cors');
const axios = require('axios');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const sniperService = require('./sniperService');
const { matchesSniper } = require('./sniperService');

const app = express();
app.use(cors());
app.use(express.json());

const url = process.env.MONGODB_URI;
const dbName = process.env.DB_NAME;
const JWT_SECRET = process.env.JWT_SECRET;

// Middleware to verify JWT token
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) return res.status(401).json({ error: 'Access denied' });

  try {
    const verified = jwt.verify(token, JWT_SECRET);
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

    // User authentication endpoints
    app.post('/api/signup', async (req, res) => {
      const { email, password } = req.body;

      try {
        const existingUser = await db.collection('users').findOne({ email });
        if (existingUser) {
          return res.status(400).json({ error: 'Email already registered' });
        }

        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(password, salt);

        const result = await db.collection('users').insertOne({
          email,
          password: hashedPassword,
          createdAt: new Date()
        });

        const token = jwt.sign({ userId: result.insertedId }, JWT_SECRET, { expiresIn: '24h' });
        res.status(201).json({ token });
      } catch (err) {
        console.error('Signup error:', err);
        res.status(500).json({ error: 'Failed to create user' });
      }
    });

    app.post('/api/login', async (req, res) => {
      const { email, password } = req.body;

      try {
        const user = await db.collection('users').findOne({ email });
        if (!user) {
          return res.status(400).json({ error: 'User does not exist' });
        }

        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
          return res.status(400).json({ error: 'Incorrect password' });
        }

        const token = jwt.sign({ userId: user._id }, JWT_SECRET, { expiresIn: '24h' });
        res.json({ token });
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
          const liveItems = await db.collection('liveitems').find(query).sort(options.sort).skip(options.skip).limit(options.limit).toArray();
          const marketItems = await db.collection('marketitems').find(query).sort(options.sort).skip(options.skip).limit(options.limit).toArray();
          items = [...liveItems, ...marketItems].sort((a, b) => a.name.localeCompare(b.name));
          items = items.slice(0, parseInt(limit));
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
        const marketItems = await db.collection('marketitems').find().toArray();
        const matchingItems = marketItems.filter(item =>
          matchesSniper(item, { marketName, maxPrice, minFloat, maxFloat })
        );

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

    const port = process.env.API_PORT;
    app.listen(port, () => console.log(`Server is running on port ${port}`));
  } catch (err) {
    console.error('Server startup error:', err);
    process.exit(1);
  }
}

startServer();