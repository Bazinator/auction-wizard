/**
 * Shared database connection utility
 * Provides consistent MongoDB connection handling across services
 */

const { MongoClient } = require('mongodb');
const logger = require('./logger');

class DatabaseConnection {
  constructor(uri, dbName, options = {}) {
    this.uri = uri;
    this.dbName = dbName;
    this.client = null;
    this.db = null;
    this.isConnected = false;
    this.options = {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      maxPoolSize: options.maxPoolSize || 10,
      minPoolSize: options.minPoolSize || 2,
      maxIdleTimeMS: options.maxIdleTimeMS || 30000,
      serverSelectionTimeoutMS: options.serverSelectionTimeoutMS || 5000,
      ...options,
    };
  }

  /**
   * Connect to MongoDB with retry logic
   * @param {number} maxRetries - Maximum number of retry attempts
   * @param {number} retryDelay - Initial retry delay in milliseconds
   * @returns {Promise<Object>} Database instance
   */
  async connect(maxRetries = 5, retryDelay = 1000) {
    if (this.isConnected && this.db) {
      return this.db;
    }

    let lastError;
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        this.client = new MongoClient(this.uri, this.options);
        await this.client.connect();
        this.db = this.client.db(this.dbName);
        this.isConnected = true;
        logger.info(`Connected to MongoDB database: ${this.dbName}`);
        return this.db;
      } catch (error) {
        lastError = error;
        const delay = retryDelay * Math.pow(2, attempt); // Exponential backoff
        logger.warn(`MongoDB connection attempt ${attempt + 1} failed. Retrying in ${delay}ms...`, {
          error: error.message,
        });

        if (attempt < maxRetries - 1) {
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    logger.error('Failed to connect to MongoDB after all retry attempts', { error: lastError });
    throw lastError;
  }

  /**
   * Close database connection gracefully
   * @returns {Promise<void>}
   */
  async close() {
    if (this.client) {
      try {
        await this.client.close();
        this.isConnected = false;
        this.db = null;
        this.client = null;
        logger.info('MongoDB connection closed');
      } catch (error) {
        logger.error('Error closing MongoDB connection', { error: error.message });
        throw error;
      }
    }
  }

  /**
   * Get database instance (throws if not connected)
   * @returns {Object} Database instance
   */
  getDb() {
    if (!this.isConnected || !this.db) {
      throw new Error('Database not connected. Call connect() first.');
    }
    return this.db;
  }

  /**
   * Check if database is connected
   * @returns {boolean}
   */
  getIsConnected() {
    return this.isConnected;
  }
}

module.exports = DatabaseConnection;
