const fs = require('fs');
const logger = require('./logger');

// Initialize tiers for the leaderboard
const bestItems = {
  '0-500': [],
  '500-1000': [],
  '1000-2000': [],
  '2000+': []
};

// Load existing best items
try {
  const filePath = process.env.BEST_ITEMS_FILE || 'data/best_items.json';
  const fileData = fs.readFileSync(filePath, 'utf8');
  const loaded = JSON.parse(fileData);
  Object.assign(bestItems, loaded);
  logger.info('Loaded existing best_items.json file');
} catch (err) {
  logger.info('No existing best_items.json file found, using empty structure');
}

async function handleNewItem(db, item) {
  // Determine the price tier
  let tier;
  const price = item.price;
  if (price < 500) tier = '0-500';
  else if (price < 1000) tier = '500-1000';
  else if (price < 2000) tier = '1000-2000';
  else tier = '2000+';

  // Check if the incoming item's profit is among the top three for the tier
  if (bestItems[tier].length < 3 || item.profit > bestItems[tier][2].profit) {
    // Insert the new item and sort
    bestItems[tier].push(item);
    bestItems[tier] = bestItems[tier].sort((a, b) => b.profit - a.profit).slice(0, 3);

    // Assign IDs based on tier and position
    bestItems[tier].forEach((item, index) => {
      item._id = `${tier}-${index + 1}`;
    });

    // Update the JSON file
    fs.writeFileSync('best_items.json', JSON.stringify(bestItems));

    const collection = db.collection('best_items');
    try {
      for (const tier of Object.keys(bestItems)) {
        // Delete the existing items in the specified tier
        await collection.deleteMany({ _id: { $regex: `^${tier}` } });

        // Insert the new best items for the tier
        await collection.insertMany(bestItems[tier]);
        console.log(`Items updated for tier ${tier} in the database.`);
      }
    } catch (err) {
      console.error('Error updating items:', err);
    }
  }
}