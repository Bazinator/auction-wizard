/**
 * Environment variable validation utility
 * Validates required environment variables at startup
 */

const logger = require('./logger');

const requiredEnvVars = {
  MONGODB_URI: 'MongoDB connection string',
  DB_NAME: 'Database name',
  JWT_SECRET: 'JWT signing secret',
  FRONTEND_ORIGIN: 'Allowed CORS origin (required for security)',
};

const optionalEnvVars = {
  API_PORT: '4000',
  LOG_LEVEL: 'info',
  NODE_ENV: 'development',
  JWT_ISSUER: 'auction-wizard',
  JWT_AUDIENCE: 'auction-wizard-users',
  ACCESS_TOKEN_TTL: '15m',
  REFRESH_TOKEN_TTL: '30d',
  BCRYPT_ROUNDS: '12',
  COINS_TO_USD_RATE: undefined,
  AUCTION_DURATION_MS: undefined,
  BEST_ITEMS_FILE: undefined,
  CSGOEMPIRE_API_KEY: undefined,
  CSGOEMPIRE_DOMAIN: undefined,
  CSGOEMPIRE_SOCKET_ENDPOINT: undefined,
  API_URL: undefined,
};

/**
 * Validates required environment variables
 * @throws {Error} If any required variable is missing
 */
function validateEnv() {
  const missing = [];
  const warnings = [];

  // Check required variables
  for (const [varName, description] of Object.entries(requiredEnvVars)) {
    if (!process.env[varName]) {
      missing.push({ varName, description });
    }
  }

  // Check FRONTEND_ORIGIN specifically (security critical)
  if (!process.env.FRONTEND_ORIGIN || process.env.FRONTEND_ORIGIN === 'true') {
    warnings.push({
      varName: 'FRONTEND_ORIGIN',
      message: 'FRONTEND_ORIGIN must be set to a specific origin (not "true") for security',
    });
  }

  if (missing.length > 0) {
    const errorMsg = `Missing required environment variables:\n${missing
      .map(({ varName, description }) => `  - ${varName}: ${description}`)
      .join('\n')}`;
    logger.error(errorMsg);
    throw new Error(errorMsg);
  }

  if (warnings.length > 0) {
    warnings.forEach(({ varName, message }) => {
      logger.warn(`${varName}: ${message}`);
    });
  }

  logger.info('Environment variables validated successfully');
}

/**
 * Gets an environment variable with optional default
 * @param {string} varName - Environment variable name
 * @param {any} defaultValue - Default value if not set
 * @returns {any} Environment variable value or default
 */
function getEnv(varName, defaultValue) {
  return process.env[varName] !== undefined ? process.env[varName] : defaultValue;
}

module.exports = {
  validateEnv,
  getEnv,
  requiredEnvVars,
  optionalEnvVars,
};
