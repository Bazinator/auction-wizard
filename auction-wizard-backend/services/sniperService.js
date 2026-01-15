const { MongoClient } = require('mongodb');
const Redis = require('ioredis');
const telegramService = require('./telegramService');
require('dotenv').config({ path: '../.env' });

class SniperService {
  constructor() {
    this.mongoClient = new MongoClient(process.env.MONGODB_URI);
    this.dbName = process.env.DB_NAME;
    this.isRunning = false;
    this.redisConnected = false;
  }

  async connect() {
    try {
      await this.mongoClient.connect();
      this.db = this.mongoClient.db(this.dbName);
      console.log('SniperService connected to MongoDB');

      // Skip Redis initialization for now
      this.redisConnected = false;
      console.log('Redis connection skipped - running without Redis');

    } catch (error) {
      console.error('Failed to connect to databases:', error);
      throw error;
    }
  }

  async start() {
    if (this.isRunning) return;
    
    try {
      await this.connect();
      this.isRunning = true;
      this.startProcessing();
      console.log('SniperService started successfully');
    } catch (error) {
      console.error('Failed to start SniperService:', error);
      this.isRunning = false;
    }
  }

  async stop() {
    this.isRunning = false;
    await this.mongoClient.close();
    if (this.redisConnected) {
      await this.redis.quit();
    }
    console.log('SniperService stopped');
  }
  // Main function that is called when the service begins
  async startProcessing() {
    while (this.isRunning) {
      try {
        await this.processMarketItems();
        await this.processAuctionItems();
        await new Promise(resolve => setTimeout(resolve, 30000));
      } catch (error) {
        console.error('Error in sniper processing:', error);
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait before retrying
      }
    }
  }

  /**
   * Builds a MongoDB query object from sniper criteria
   * @param {Object} sniper - Sniper criteria object
   * @returns {Object} MongoDB query object
   */
  buildSniperQuery(sniper) {
    const query = {};

    // Name matching using regex (case-insensitive)
    if (sniper.marketName) {
      query.name = { $regex: sniper.marketName, $options: 'i' };
    }

    // Price range filtering
    if (sniper.minPrice !== undefined && sniper.minPrice !== null) {
      query.price = { ...query.price, $gte: parseFloat(sniper.minPrice) };
    }
    if (sniper.maxPrice !== undefined && sniper.maxPrice !== null) {
      query.price = { ...query.price, $lte: parseFloat(sniper.maxPrice) };
    }

    // Float range filtering
    if (sniper.minFloat !== undefined && sniper.minFloat !== null) {
      query.float = { ...query.float, $gte: parseFloat(sniper.minFloat) };
    }
    if (sniper.maxFloat !== undefined && sniper.maxFloat !== null) {
      query.float = { ...query.float, $lte: parseFloat(sniper.maxFloat) };
    }

    return query;
  }

  async processMarketItems() {
    try {
      // Fetch all snipers once
      const snipers = await this.db.collection('snipers').find().toArray();
      
      if (snipers.length === 0) {
        return; // No snipers to process
      }

      // Process all snipers in parallel
      const matchPromises = snipers.map(async (sniper) => {
        try {
          // Build MongoDB query for this sniper
          const query = this.buildSniperQuery(sniper);
          
          // Query database directly - only get matching items
          const matchingItems = await this.db.collection('marketitems')
            .find(query)
            .toArray();

          // Handle each matching item
          for (const item of matchingItems) {
            await this.handleMatch(item, sniper, 'market');
          }
        } catch (error) {
          console.error(`Error processing sniper ${sniper._id} for market items:`, error);
        }
      });

      // Wait for all sniper queries to complete
      await Promise.all(matchPromises);
    } catch (error) {
      console.error('Error in processMarketItems:', error);
      throw error;
    }
  }

  async processAuctionItems() {
    try {
      // Fetch all snipers once
      const snipers = await this.db.collection('snipers').find().toArray();
      
      if (snipers.length === 0) {
        return; // No snipers to process
      }

      // Process all snipers in parallel
      const matchPromises = snipers.map(async (sniper) => {
        try {
          // Build MongoDB query for this sniper
          const query = this.buildSniperQuery(sniper);
          
          // Query database directly - only get matching items
          const matchingItems = await this.db.collection('liveitems')
            .find(query)
            .toArray();

          // Handle each matching item
          for (const item of matchingItems) {
            await this.handleMatch(item, sniper, 'auction');
          }
        } catch (error) {
          console.error(`Error processing sniper ${sniper._id} for auction items:`, error);
        }
      });

      // Wait for all sniper queries to complete
      await Promise.all(matchPromises);
    } catch (error) {
      console.error('Error in processAuctionItems:', error);
      throw error;
    }
  }

  /**
   * Static method to check if an item matches sniper criteria
   * Can be used for in-memory filtering when needed
   * @param {Object} item - Item object
   * @param {Object} sniper - Sniper criteria object
   * @returns {boolean} True if item matches sniper criteria
   */
  static matchesSniper(item, sniper) {
    return (
      item.name.includes(sniper.marketName) &&
      (!sniper.maxPrice || item.price <= sniper.maxPrice) &&
      (!sniper.minFloat || item.float >= sniper.minFloat) &&
      (!sniper.maxFloat || item.float <= sniper.maxFloat)
    );
  }

  matchesSniper(item, sniper) {
    return SniperService.matchesSniper(item, sniper);
  }

  async handleMatch(item, sniper, type) {
    try {
      // Simplified version without Redis
      await this.sendNotification(item, type);

      // Queue auto-actions if enabled
      if (sniper.autoAction) {
        await this.handleAutoAction(item, sniper, type);
      }
    } catch (error) {
      console.error('Error handling match:', error);
    }
  }

  async sendNotification(item, type) {
    console.log("Skipping telegram message for " + item);
    // try {
    //   await telegramService.sendSniperNotification(item, type);
    // } catch (error) {
    //   console.error('Failed to send notification:', error);
    // }
  }

  async handleAutoAction(item, sniper, type) {
    console.log(`Auto-action skipped for ${type} item ${item.id} (Redis not connected)`);
  }
}

// Export singleton instance
const sniperServiceInstance = new SniperService();

// Export static method for use in other modules
module.exports = sniperServiceInstance;
module.exports.matchesSniper = SniperService.matchesSniper; 