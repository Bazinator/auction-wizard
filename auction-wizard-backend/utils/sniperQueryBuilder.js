/**
 * Utility module for building MongoDB queries from sniper criteria
 * Used by both SniperService and API endpoints for consistent query logic
 */

/**
 * Builds a MongoDB query object from sniper criteria
 * @param {Object} criteria - Sniper criteria object
 * @param {string} [criteria.marketName] - Item name to match (case-insensitive regex)
 * @param {number} [criteria.minPrice] - Minimum price filter
 * @param {number} [criteria.maxPrice] - Maximum price filter
 * @param {number} [criteria.minFloat] - Minimum float value filter
 * @param {number} [criteria.maxFloat] - Maximum float value filter
 * @returns {Object} MongoDB query object
 */
function buildSniperQuery(criteria) {
  const query = {};

  // Name matching using regex (case-insensitive)
  if (criteria.marketName) {
    query.name = { $regex: criteria.marketName, $options: 'i' };
  }

  // Price range filtering
  if (criteria.minPrice !== undefined && criteria.minPrice !== null) {
    query.price = { ...query.price, $gte: parseFloat(criteria.minPrice) };
  }
  if (criteria.maxPrice !== undefined && criteria.maxPrice !== null) {
    query.price = { ...query.price, $lte: parseFloat(criteria.maxPrice) };
  }

  // Float range filtering
  if (criteria.minFloat !== undefined && criteria.minFloat !== null) {
    query.float = { ...query.float, $gte: parseFloat(criteria.minFloat) };
  }
  if (criteria.maxFloat !== undefined && criteria.maxFloat !== null) {
    query.float = { ...query.float, $lte: parseFloat(criteria.maxFloat) };
  }

  return query;
}

module.exports = {
  buildSniperQuery
};
