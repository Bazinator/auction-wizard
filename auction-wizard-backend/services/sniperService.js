const { MongoClient } = require('mongodb');
const Redis = require('ioredis');
const telegramService = require('./telegramService');
const { buildSniperQuery: buildSniperQueryUtil } = require('../utils/sniperQueryBuilder');
const logger = require('../utils/logger');
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
      logger.info('SniperService connected to MongoDB');

      // Skip Redis initialization for now
      this.redisConnected = false;
      logger.info('Redis connection skipped - running without Redis');

    } catch (error) {
      logger.error('Failed to connect to databases', { error: error.message, stack: error.stack });
      throw error;
    }
  }

  async start() {
    if (this.isRunning) return;
    
    try {
      await this.connect();
      this.isRunning = true;
      this.startProcessing();
      logger.info('SniperService started successfully');
    } catch (error) {
      logger.error('Failed to start SniperService', { error: error.message, stack: error.stack });
      this.isRunning = false;
    }
  }

  async stop() {
    logger.info('Stopping SniperService...');
    this.isRunning = false;
    
    try {
      if (this.mongoClient) {
        await this.mongoClient.close();
        logger.info('SniperService MongoDB connection closed');
      }
      if (this.redisConnected && this.redis) {
        await this.redis.quit();
        logger.info('SniperService Redis connection closed');
      }
      logger.info('SniperService stopped');
    } catch (error) {
      logger.error('Error stopping SniperService', { error: error.message, stack: error.stack });
      throw error;
    }
  }
  // Main function that is called when the service begins
  async startProcessing() {
    while (this.isRunning) {
      try {
        await this.processMarketItems();
        await this.processAuctionItems();
        await new Promise(resolve => setTimeout(resolve, 30000));
      } catch (error) {
        logger.error('Error in sniper processing', { error: error.message, stack: error.stack });
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait before retrying
      }
    }
  }

  /**
   * Builds a MongoDB query object from sniper criteria
   * Delegates to shared utility for consistency across the codebase
   * @param {Object} sniper - Sniper criteria object
   * @returns {Object} MongoDB query object
   */
  buildSniperQuery(sniper) {
    return buildSniperQueryUtil(sniper);
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
          logger.error(`Error processing sniper for market items`, { sniperId: sniper._id, error: error.message, stack: error.stack });
        }
      });

      // Wait for all sniper queries to complete
      await Promise.all(matchPromises);
    } catch (error) {
      logger.error('Error in processMarketItems', { error: error.message, stack: error.stack });
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
          logger.error(`Error processing sniper for auction items`, { sniperId: sniper._id, error: error.message, stack: error.stack });
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
      logger.error('Error handling match', { error: error.message, stack: error.stack });
    }
  }

  async sendNotification(item, type) {
    logger.debug("Skipping telegram message", { itemId: item.id, itemName: item.name, type });
    // try {
    //   await telegramService.sendSniperNotification(item, type);
    // } catch (error) {
    //   logger.error('Failed to send notification', { error: error.message, stack: error.stack });
    // }
  }

  async handleAutoAction(item, sniper, type) {
    logger.debug(`Auto-action skipped for ${type} item`, { itemId: item.id, reason: 'Redis not connected' });
  }
}

// Export singleton instance
const sniperServiceInstance = new SniperService();

// Export static method for use in other modules
module.exports = sniperServiceInstance;
module.exports.matchesSniper = SniperService.matchesSniper; 