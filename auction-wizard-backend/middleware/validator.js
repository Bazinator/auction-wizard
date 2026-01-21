/**
 * Input validation and sanitization middleware
 * Provides validation for common request parameters
 */

const logger = require('../utils/logger');
const mongodb = require('mongodb');

/**
 * Validates pagination parameters
 */
function validatePagination(req, res, next) {
  const page = parseInt(req.query.page) || 1;
  const limit = parseInt(req.query.limit) || 10;

  // Validate page
  if (page < 1 || page > 1000) {
    return res.status(400).json({
      error: 'Page must be between 1 and 1000',
    });
  }

  // Validate limit
  if (limit < 1 || limit > 100) {
    return res.status(400).json({
      error: 'Limit must be between 1 and 100',
    });
  }

  // Attach validated values to request
  req.validated = req.validated || {};
  req.validated.page = page;
  req.validated.limit = limit;
  req.validated.skip = (page - 1) * limit;

  next();
}

/**
 * Validates numeric query parameters (price, float ranges)
 */
function validateNumericParams(req, res, next) {
  const errors = [];

  // Validate minPrice
  if (req.query.minPrice !== undefined) {
    const minPrice = parseFloat(req.query.minPrice);
    if (isNaN(minPrice) || minPrice < 0) {
      errors.push('minPrice must be a non-negative number');
    } else {
      req.validated = req.validated || {};
      req.validated.minPrice = minPrice;
    }
  }

  // Validate maxPrice
  if (req.query.maxPrice !== undefined) {
    const maxPrice = parseFloat(req.query.maxPrice);
    if (isNaN(maxPrice) || maxPrice < 0) {
      errors.push('maxPrice must be a non-negative number');
    } else {
      req.validated = req.validated || {};
      req.validated.maxPrice = maxPrice;
    }
  }

  // Validate minFloat
  if (req.query.minFloat !== undefined) {
    const minFloat = parseFloat(req.query.minFloat);
    if (isNaN(minFloat) || minFloat < 0 || minFloat > 1) {
      errors.push('minFloat must be a number between 0 and 1');
    } else {
      req.validated = req.validated || {};
      req.validated.minFloat = minFloat;
    }
  }

  // Validate maxFloat
  if (req.query.maxFloat !== undefined) {
    const maxFloat = parseFloat(req.query.maxFloat);
    if (isNaN(maxFloat) || maxFloat < 0 || maxFloat > 1) {
      errors.push('maxFloat must be a number between 0 and 1');
    } else {
      req.validated = req.validated || {};
      req.validated.maxFloat = maxFloat;
    }
  }

  // Validate price range logic
  if (req.validated?.minPrice !== undefined && req.validated?.maxPrice !== undefined) {
    if (req.validated.minPrice > req.validated.maxPrice) {
      errors.push('minPrice cannot be greater than maxPrice');
    }
  }

  // Validate float range logic
  if (req.validated?.minFloat !== undefined && req.validated?.maxFloat !== undefined) {
    if (req.validated.minFloat > req.validated.maxFloat) {
      errors.push('minFloat cannot be greater than maxFloat');
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Validation error',
      details: errors,
    });
  }

  next();
}

/**
 * Validates and sanitizes marketName parameter
 */
function validateMarketName(req, res, next) {
  if (req.query.marketName !== undefined || req.body.marketName !== undefined) {
    const marketName = (req.query.marketName || req.body.marketName || '').trim();
    
    if (marketName.length === 0) {
      return res.status(400).json({
        error: 'marketName cannot be empty',
      });
    }

    if (marketName.length > 200) {
      return res.status(400).json({
        error: 'marketName must be 200 characters or less',
      });
    }

    // Sanitize: remove potentially dangerous characters
    const sanitized = marketName.replace(/[<>\"']/g, '');
    
    req.validated = req.validated || {};
    req.validated.marketName = sanitized;
  }

  next();
}

/**
 * Validates MongoDB ObjectId in route parameters
 */
function validateObjectId(req, res, next) {
  const idParam = req.params.id;
  
  if (idParam && !mongodb.ObjectId.isValid(idParam)) {
    return res.status(400).json({
      error: 'Invalid ID format',
    });
  }

  next();
}

/**
 * Validates itemType parameter
 */
function validateItemType(req, res, next) {
  if (req.query.itemType !== undefined) {
    const itemType = req.query.itemType.toLowerCase();
    
    if (!['auction', 'market'].includes(itemType)) {
      return res.status(400).json({
        error: 'itemType must be either "auction" or "market"',
      });
    }

    req.validated = req.validated || {};
    req.validated.itemType = itemType;
  }

  next();
}

/**
 * Validates sniper criteria in request body
 */
function validateSniperCriteria(req, res, next) {
  const { marketName, minPrice, maxPrice, minFloat, maxFloat } = req.body;
  const errors = [];

  // Market name is required
  if (!marketName || typeof marketName !== 'string' || marketName.trim().length === 0) {
    errors.push('marketName is required and must be a non-empty string');
  } else if (marketName.length > 200) {
    errors.push('marketName must be 200 characters or less');
  }

  // Validate numeric fields if provided
  if (minPrice !== undefined && (isNaN(parseFloat(minPrice)) || parseFloat(minPrice) < 0)) {
    errors.push('minPrice must be a non-negative number');
  }

  if (maxPrice !== undefined && (isNaN(parseFloat(maxPrice)) || parseFloat(maxPrice) < 0)) {
    errors.push('maxPrice must be a non-negative number');
  }

  if (minPrice !== undefined && maxPrice !== undefined && parseFloat(minPrice) > parseFloat(maxPrice)) {
    errors.push('minPrice cannot be greater than maxPrice');
  }

  if (minFloat !== undefined && (isNaN(parseFloat(minFloat)) || parseFloat(minFloat) < 0 || parseFloat(minFloat) > 1)) {
    errors.push('minFloat must be a number between 0 and 1');
  }

  if (maxFloat !== undefined && (isNaN(parseFloat(maxFloat)) || parseFloat(maxFloat) < 0 || parseFloat(maxFloat) > 1)) {
    errors.push('maxFloat must be a number between 0 and 1');
  }

  if (minFloat !== undefined && maxFloat !== undefined && parseFloat(minFloat) > parseFloat(maxFloat)) {
    errors.push('minFloat cannot be greater than maxFloat');
  }

  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Validation error',
      details: errors,
    });
  }

  // Sanitize and attach validated values
  req.validated = req.validated || {};
  req.validated.marketName = (marketName || '').trim().replace(/[<>\"']/g, '');
  if (minPrice !== undefined) req.validated.minPrice = parseFloat(minPrice);
  if (maxPrice !== undefined) req.validated.maxPrice = parseFloat(maxPrice);
  if (minFloat !== undefined) req.validated.minFloat = parseFloat(minFloat);
  if (maxFloat !== undefined) req.validated.maxFloat = parseFloat(maxFloat);

  next();
}

module.exports = {
  validatePagination,
  validateNumericParams,
  validateMarketName,
  validateObjectId,
  validateItemType,
  validateSniperCriteria,
};
