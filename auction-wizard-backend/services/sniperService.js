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

  async processMarketItems() {
    const marketItems = await this.db.collection('marketitems').find().toArray();
    const snipers = await this.db.collection('snipers').find().toArray();

    for (const item of marketItems) {
      for (const sniper of snipers) {
        if (this.matchesSniper(item, sniper)) {
          await this.handleMatch(item, sniper, 'market');
        }
      }
    }
  }

  async processAuctionItems() {
    const auctionItems = await this.db.collection('liveitems').find().toArray();
    const snipers = await this.db.collection('snipers').find().toArray();

    for (const item of auctionItems) {
      for (const sniper of snipers) {
        if (this.matchesSniper(item, sniper)) {
          await this.handleMatch(item, sniper, 'auction');
        }
      }
    }
  }

  matchesSniper(item, sniper) {
    return (
      item.name.includes(sniper.marketName) &&
      (!sniper.maxPrice || item.price <= sniper.maxPrice) &&
      (!sniper.minFloat || item.float >= sniper.minFloat) &&
      (!sniper.maxFloat || item.float <= sniper.maxFloat)
    );
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

module.exports = new SniperService(); 