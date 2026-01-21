/**
 * Centralized error handling middleware
 * Provides consistent error responses across the API
 */

const logger = require('../utils/logger');
const mongodb = require('mongodb');

/**
 * Error handler middleware for Express
 * Should be added as the last middleware in the Express app
 */
function errorHandler(err, req, res, next) {
  // Generate error ID for tracking
  const errorId = require('crypto').randomUUID ? require('crypto').randomUUID() : require('crypto').randomBytes(16).toString('hex');

  // Log error with full context
  logger.error('Request error', {
    errorId,
    method: req.method,
    path: req.path,
    error: err.message,
    stack: err.stack,
    body: req.body,
    query: req.query,
    params: req.params,
  });

  // Handle specific error types
  if (err instanceof mongodb.MongoServerError) {
    // MongoDB errors
    if (err.code === 11000) {
      // Duplicate key error
      return res.status(409).json({
        error: 'Resource already exists',
        errorId,
      });
    }
    return res.status(500).json({
      error: 'Database error',
      errorId,
    });
  }

  if (err instanceof mongodb.MongoInvalidArgumentError) {
    // Invalid MongoDB operation
    return res.status(400).json({
      error: 'Invalid request',
      errorId,
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({
      error: 'Invalid or expired token',
      errorId,
    });
  }

  // Validation errors
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      error: err.message || 'Validation error',
      errorId,
    });
  }

  // Default error response
  const statusCode = err.statusCode || err.status || 500;
  const message = process.env.NODE_ENV === 'production' 
    ? 'Internal server error' 
    : err.message;

  res.status(statusCode).json({
    error: message,
    errorId,
    ...(process.env.NODE_ENV !== 'production' && { stack: err.stack }),
  });
}

/**
 * Async handler wrapper to catch errors in async route handlers
 * @param {Function} fn - Async route handler function
 * @returns {Function} Wrapped route handler
 */
function asyncHandler(fn) {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 404 Not Found handler
 */
function notFoundHandler(req, res) {
  const errorId = require('crypto').randomUUID ? require('crypto').randomUUID() : require('crypto').randomBytes(16).toString('hex');
  
  logger.warn('Route not found', {
    errorId,
    method: req.method,
    path: req.path,
  });

  res.status(404).json({
    error: 'Route not found',
    errorId,
  });
}

module.exports = {
  errorHandler,
  asyncHandler,
  notFoundHandler,
};
