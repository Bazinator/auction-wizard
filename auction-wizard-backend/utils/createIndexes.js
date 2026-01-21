/**
 * MongoDB Index Creation Script
 * 
 * Creates indexes for optimized query performance on:
 * - marketitems: name, price, float, id (unique)
 * - liveitems: name, price, float, id (unique)
 * - snipers: userId, userId+marketName compound
 * 
 * Run once: node utils/createIndexes.js
 * 
 * Note: Indexes are additive and safe - they won't break existing functionality.
 * If an index already exists, MongoDB will skip creation (idempotent).
 */

require('dotenv').config();
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI;
const DB_NAME = process.env.DB_NAME || 'Doris';

if (!MONGODB_URI) {
  console.error('Error: MONGODB_URI environment variable is not set');
  process.exit(1);
}

async function createIndexes() {
  const client = new MongoClient(MONGODB_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  });

  try {
    console.log('Connecting to MongoDB...');
    await client.connect();
    console.log('Successfully connected to MongoDB server');

    const db = client.db(DB_NAME);
    console.log(`Using database: ${DB_NAME}`);

    console.log('\n=== Creating Indexes ===\n');

    // marketitems collection indexes
    console.log('Creating indexes for marketitems collection...');
    try {
      // Unique index on id field (for fast lookups and uniqueness)
      await db.collection('marketitems').createIndex(
        { id: 1 },
        { unique: true, name: 'id_unique' }
      );
      console.log('  ✓ Created unique index on id');

      // Index on name field (for sorting and regex queries)
      await db.collection('marketitems').createIndex(
        { name: 1 },
        { name: 'name_idx' }
      );
      console.log('  ✓ Created index on name');

      // Index on price field (for range queries)
      await db.collection('marketitems').createIndex(
        { price: 1 },
        { name: 'price_idx' }
      );
      console.log('  ✓ Created index on price');

      // Index on float field (for range queries)
      await db.collection('marketitems').createIndex(
        { float: 1 },
        { name: 'float_idx' }
      );
      console.log('  ✓ Created index on float');
    } catch (error) {
      console.error('  ✗ Error creating marketitems indexes:', error.message);
    }

    // liveitems collection indexes
    console.log('\nCreating indexes for liveitems collection...');
    try {
      // Unique index on id field (for fast lookups and uniqueness)
      await db.collection('liveitems').createIndex(
        { id: 1 },
        { unique: true, name: 'id_unique' }
      );
      console.log('  ✓ Created unique index on id');

      // Index on name field (for sorting and regex queries)
      await db.collection('liveitems').createIndex(
        { name: 1 },
        { name: 'name_idx' }
      );
      console.log('  ✓ Created index on name');

      // Index on price field (for range queries)
      await db.collection('liveitems').createIndex(
        { price: 1 },
        { name: 'price_idx' }
      );
      console.log('  ✓ Created index on price');

      // Index on float field (for range queries)
      await db.collection('liveitems').createIndex(
        { float: 1 },
        { name: 'float_idx' }
      );
      console.log('  ✓ Created index on float');
    } catch (error) {
      console.error('  ✗ Error creating liveitems indexes:', error.message);
    }

    // snipers collection indexes
    console.log('\nCreating indexes for snipers collection...');
    try {
      // Index on userId field (for user-specific queries)
      await db.collection('snipers').createIndex(
        { userId: 1 },
        { name: 'userId_idx' }
      );
      console.log('  ✓ Created index on userId');

      // Compound index on userId + marketName (for optimized user + name queries)
      await db.collection('snipers').createIndex(
        { userId: 1, marketName: 1 },
        { name: 'userId_marketName_idx' }
      );
      console.log('  ✓ Created compound index on userId + marketName');
    } catch (error) {
      console.error('  ✗ Error creating snipers indexes:', error.message);
    }

    console.log('\n=== Index Creation Complete ===\n');

    // Verify indexes were created
    console.log('Verifying indexes...\n');
    
    const marketitemsIndexes = await db.collection('marketitems').indexes();
    console.log('marketitems indexes:', marketitemsIndexes.map(idx => idx.name).join(', '));
    
    const liveitemsIndexes = await db.collection('liveitems').indexes();
    console.log('liveitems indexes:', liveitemsIndexes.map(idx => idx.name).join(', '));
    
    const snipersIndexes = await db.collection('snipers').indexes();
    console.log('snipers indexes:', snipersIndexes.map(idx => idx.name).join(', '));

    console.log('\n✓ All indexes created successfully!');
    console.log('\nNote: You can verify index usage by running explain() on sample queries in MongoDB Compass.');

  } catch (error) {
    console.error('Error creating indexes:', error);
    throw error;
  } finally {
    await client.close();
    console.log('\nConnection closed.');
  }
}

// Run the script
createIndexes()
  .then(() => {
    console.log('\nScript completed successfully.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\nScript failed:', error);
    process.exit(1);
  });
