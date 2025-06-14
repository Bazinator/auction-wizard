// Imports
const io = require('socket.io-client');
const axios = require('axios');
const { MongoClient} = require('mongodb');
const fs = require('fs');
const dotenv = require('dotenv');
const { exec }  = require('child_process');
const path = require('path');

// Load the .env file
dotenv.config({ path: path.join(__dirname, '..', '.env') });


// Set Enviroment Variables
const coinsToUSD = parseFloat(process.env.COINS_TO_USD_RATE);
const AUCTION_DURATION_MS = parseInt(process.env.AUCTION_DURATION_MS);
const BEST_ITEMS_FILE = process.env.BEST_ITEMS_FILE;


const { red, green, yellow } = require('colorette');

// API Key
const csgoempireApiKey = process.env.CSGOEMPIRE_API_KEY;

// Sockets and Url's for MongoDB
const domain = process.env.CSGOEMPIRE_DOMAIN;
const socketEndpoint = process.env.CSGOEMPIRE_SOCKET_ENDPOINT;
const uri = process.env.MONGODB_URI;



// Set the authorization header for all axios requests to the CSGOEmpire API Key
axios.defaults.headers.common['Authorization'] = `Bearer ${csgoempireApiKey}`;

// Set up the javascript object with keys as price ranges and values as arrays of items
const bestItems = {
    '0-500': [],
    '500-1000': [],
    '1000-2000': [],
    '2000+': []
};
try {
    Object.assign(bestItems, JSON.parse(fs.readFileSync(BEST_ITEMS_FILE)));
} catch (err) {
    console.log('No existing best_items file found.');
}

// Not using this function until prices.json is updated
async function checkIfItemIsARecord(db, item) {
    // Determine the price tier
    let tier;
    const price = item.price;

    //Change this to switch statement
    switch (true) {
        case price < 500:
            tier = '0-500';
            break;
        case price < 1000:
            tier = '500-1000';
            break;
        case price < 2000:
            tier = '1000-2000';
            break;
        default:
            tier = '2000+';
            break;
    }
    

    // Check if the incoming item's profit is among the top three for the tier
    if (bestItems[tier].length < 3 || item.buyorderprofit > bestItems[tier][2].buyorderprofit) {
        
        // Insert the new item and sort
        bestItems[tier].push(item);


        // TIP / TODO
        // Sorting after every insert is inefficient, change this if leaderboard size increases significantly
        bestItems[tier].sort((a, b) => b.buyorderprofit - a.buyorderprofit);

        if (bestItems[tier].length > 3) {
            bestItems[tier].pop(); // Keep only the top 3 items
        }

        // Assign IDs based on tier and position
        bestItems[tier].forEach((item, index) => {
            item._id = `${tier}-${index + 1}`;
        });

        // Update the JSON file
        fs.writeFileSync(BEST_ITEMS_FILE, JSON.stringify(bestItems));

        const collection = db.collection('best_items');
        for (const item of bestItems[tier]) {
            try {
                const filter = { _id: item._id };
                const update = { $set: item };
                const options = { upsert: true }; // This will insert the document if it does not exist

                await collection.updateOne(filter, update, options);
                console.log(`Item updated in the database with _id: ${item._id}`);

                //This is not an error it just means it is not in the database

            } catch (err) {
            }
        }
    }
}

// Function to connect to the database
async function connectDB() {
    try {
        console.log("Attempting to connect to MongoDB with URI:", uri);
        
        if (!uri) {
            throw new Error("MONGODB_URI is not defined in environment variables");
        }

        const client = new MongoClient(uri, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        await client.connect();
        console.log("Successfully connected to MongoDB server");

        const db = client.db('Doris');
        console.log("Successfully connected to Doris database");

        // Create a new index with the new option
        await db.collection('liveitems').createIndex({ "auto_delete": 1 }, { expireAfterSeconds: 2 });
        console.log("Successfully created index on liveitems collection");
        
        return db;
    } catch (err) {
        console.error("Error connecting to the database:");
        console.error("Error message:", err.message);
        console.error("Full error:", err);
        return null;
    }
}

//Function to start code, connect to database and websocket
async function init() {
    console.log("Current working directory:", process.cwd());
    console.log("Starting...");
    
    // Connect to the database
    const db = await connectDB();
    if (!db) {
        console.error("Error connecting to the database");
        return;
    }
    console.log("Connected to the database");

    // Clear the live items collection
    await db.collection('liveitems').deleteMany({});
    await db.collection('marketitems').deleteMany({});
    console.log("Cleared the liveitems collection and marketitems collection");

    // Start the websocket connection
    console.log("Starting websocket connection...");
        
    await WebSocket(db);
}

// Function to connect to websocket
async function WebSocket(db) {
    console.log("Connecting to websocket...");
    let reconnectAttempts = 0;

    const reconnect = async () => {
        if (reconnectAttempts >= 10) {
            console.error('Max reconnection attempts reached');
            return;
        }


        // Exponential backoff with custom delays
        const delay = [5000, 10000, 30000, 60000][reconnectAttempts] || 60000;
        console.log(`Reconnecting in ${delay / 1000} seconds...`);



        setTimeout(() => {
            console.log("Attempting to reconnect...");
            reconnectAttempts++;
            WebSocket(db); // Recursively reconnecting using WebSocket function
        }, delay);
    };

    try {
        // Get the user data from the socket
        const userData = (await axios.get(`https://${domain}/api/v2/metadata/socket`)).data;

        // Initalize socket connection
        const socket = io(
            socketEndpoint,
            {
                transports: ["websocket"],
                path: "/s/",
                secure: true,
                rejectUnauthorized: false,
                reconnect: true,
                extraHeaders: { 'User-agent': `${userData.user.id} API Bot` }
            }
        );

        socket.on('connect', async () => {

            // Log when connected
            console.log(`Connected to websocket`);

            // Handle the Init event
            socket.on('init', (data) => {
                if (data && data.authenticated) {
                    console.log(`Successfully authenticated as ${data.name}`);

                    // Emit the default filters to ensure we receive events
                    socket.emit('filters', {
                        price_max: 9999999
                    });

                } else {
                    // When the server asks for it, emit the data we got earlier to the socket to identify this client as the user
                    socket.emit('identify', {
                        uid: userData.user.id,
                        model: userData.user,
                        authorizationToken: userData.socket_token,
                        signature: userData.socket_signature
                    });
                }
            });
            socket.on('new_item', async (data) => {

                if (Array.isArray(data)) {
                    try {
                        // Iterate through the array of new items
                        for (let items of data) {

                            const createdAt = new Date();
                            //items.auction_ends_at & items.above_recommended_price < 7
                            if (items.auction_ends_at) {
                                await OnSocketNewAuctionItem(items, createdAt, db);
                            } else {
                                await OnSocketNewMarketItem(items, db);
                            }
                        }
                    } catch (err) {
                        console.error(yellow(`Error inserting or deleting document: ${err}`));
                    }
                } else {
                    console.error('data[1] is not an array');
                }
            });
            socket.on('auction_update', async (data) => {
                if (Array.isArray(data)) {
                    for (let update of data) {
                        try {
                            // Check if the update has an id
                            if (!update || !update.id) {
                                console.error('Invalid data received for auction update');
                                break;
                            }


                            // Call our function
                            await onSocketNewAuctionUpdate(update, db);


                        } catch (err) {
                            console.error(`Error updating document: ${err}`);
                        }
                    }
                } else {
                    console.error('auction_update event data is not an array');
                }
            });

            // Print the updated_item event data to console for now
            socket.on('updated_item', async (data) => {
                if (Array.isArray(data)) {
                    for (let update of data) {
                        try {
                            
                            await onSocketItemUpdate(update, db);


                        } catch (err) {
                            console.error(`Error updating document: ${err}`);
                        }
                    }
                } else {
                    console.error('updated_item event data is not an array');
                }
            });

            socket.on('deleted_item', async (data) => {
                if (Array.isArray(data)) {
                    try {
                        console.log(`Attempting to delete ${data.length} items:`, data);
                        
                        // Delete from liveitems collection
                        const liveItemsResult = await db.collection('liveitems').deleteMany({
                            id: { $in: data }
                        });
                        
                        // Delete from marketitems collection
                        const marketItemsResult = await db.collection('marketitems').deleteMany({
                            id: { $in: data }
                        });
                        
                        console.log(`Deletion results:
                            - Live items deleted: ${liveItemsResult.deletedCount}
                            - Market items deleted: ${marketItemsResult.deletedCount}
                            - Total items wanting to be deleted: ${data.length}`);

                         if (liveItemsResult.deletedCount + marketItemsResult.deletedCount < data.length) {
                            console.warn('Some items were not found for deletion. This might indicate stale data in the database.');
                        }
                    } catch (err) {
                        console.error(`Error during item deletion:`, err);
                        console.error(`Failed to delete items:`, data);
                    }
                } else {
                    console.error('deleted_item event data is not an array:', data);
                }
            });
            
            // Add these listeners to handle reconnection logic
            socket.on("close", (reason) => {
                console.log(`Socket closed: ${reason}`);
                reconnect();
            });

            socket.on('error', (data) => {
                console.log(`WS Error: ${data}`);
                reconnect();
            });

            socket.on('connect_error', (data) => {
                console.log(`Connect Error: ${data}`);
                reconnect();
            });
        });
    } catch (e) {
        console.log(`Error while initializing the WebSocket to Csgoempire. Error: ${e}`);
    }
};

async function onSocketItemUpdate(updateData, db) {
    const { id, auction_ends_at, market_value, market_name, wear, stickers, icon_url, above_recommended_price, blue_percentage, fade_percentage } = updateData;

    // Define the item object with calculated fields
    const price = parseFloat(((market_value / 100) * coinsToUSD).toFixed(2));
    const item = {
        website: "CSGO Empire",
        name: market_name,
        coins: (market_value / 100),
        price: price,
        id: id,
        float: wear,
        stickers: stickers,
        imglink: `https://community.akamai.steamstatic.com/economy/image/${icon_url}`,
        createdAt: new Date(),
        above_recommended_price: above_recommended_price,
        blue_percentage: blue_percentage,
        fade_percentage: fade_percentage,
    };

    try {
        // Check both collections for the item by ID
        const liveItem = await db.collection('liveitems').findOne({ id });
        const marketItem = await db.collection('marketitems').findOne({ id });

        if (!liveItem && !marketItem) {
            // If item doesn't exist in either collection
            if (auction_ends_at) {
                // Insert into liveitems if it's an auction item
                item.market_type = "auction";
                item.auction_ends_at = auction_ends_at;
                await db.collection('liveitems').insertOne(item);
                console.log(`Inserted auction item with ID ${id} into liveitems.`);
            } else {
                // Insert into marketitems if it's not an auction item
                item.market_type = "market";
                await db.collection('marketitems').insertOne(item);
                console.log(`Inserted market item with ID ${id} into marketitems.`);
            }
        } else if (liveItem) {
            // Update liveitems entry if it already exists
            await db.collection('liveitems').updateOne(
                { id },
                { $set: { ...updateData, updatedAt: new Date() } }
            );
            console.log(`Updated auction item with ID ${id} in liveitems.`);
        } else if (marketItem) {
            // Update marketitems entry if it already exists
            await db.collection('marketitems').updateOne(
                { id },
                { $set: { ...updateData, updatedAt: new Date() } }
            );
            console.log(`Updated market item with ID ${id} in marketitems.`);
        }
    } catch (error) {
        console.error(`Error processing item update: ${error.message}`);
    }
}



//Function to handle new item event
async function OnSocketNewAuctionItem(items, createdAt, db) {

    //Deal with fade items
    if (items.market_name.includes('fade') && items.preview_id !== null) {
        // Print the 'preview_id' to the console
        console.log(items.preview_id);
    }



    // Calculate the auction end time
    const auction_ends_t = new Date(createdAt.getTime() + AUCTION_DURATION_MS);  // Add auction duration from .env to createdAt
    const auction_ends_t_unix = auction_ends_t.getTime();  // Convert to Unix timestamp (milliseconds since epoch)
    const expirationTimestampInSeconds = Math.floor(auction_ends_t_unix / 1000); // Convert to Unix timestamp in seconds


    console.log(red(`Processing new auction item: ${items.market_name}`));

    // Calculate the price of the item

    //0.61 here represent the current market rate of coins to USD
    const price = parseFloat(((items.market_value / 100) * coinsToUSD).toFixed(2));

    // Create the item object
    const item = {
        website: "CSGOEmpire",
        websiteUrl: "https://csgoempire.gg",
        itemUrl: `https://csgoempire.gg/item/${items.id}`,
        name: items.market_name,
        coins: (items.market_value / 100),
        price: price,
        id: items.id,
        float: items.wear,
        imglink: `https://community.akamai.steamstatic.com/economy/image/${items.icon_url}`,
        createdAt: new Date(),
        auction_ends_at: auction_ends_t_unix,
        auto_delete: expirationTimestampInSeconds,
        stickers: items.stickers,
        above_recommended_price: items.above_recommended_price,
        blue_percentage: items.blue_percentage,
        fade_percentage: items.fade_percentage,
    };

    
    
    // Insert the item into the database
    await db.collection('liveitems').insertOne(item);
    
    // const pythonScriptPath = path.resolve(__dirname, 'Scrapers', 'Scrapebuff.py');
    // console.log(`Running python script: ${pythonScriptPath}`);
    // const pythonScript = `py ${pythonScriptPath} ${item.id}`;

    
    // exec(pythonScript, (error, stdout, stderr) => {
    //     if (error) {
    //         console.error(`Error executing script: ${error.message}`);
    //         return;
    //     }
    //     if (stderr) {
    //         console.error(`Script stderr: ${stderr}`);
    //         return;
    //     }
    //     console.log(`Script output: ${stdout}`);
    // });

    // Now, process storing of these into our price trend database

}

async function OnSocketNewMarketItem(items, db){
    
    //console.log(red(`Processing new market item: ${items.market_name}`));


    //0.61 here represent the current market rate of coins to USD
    const price = parseFloat(((items.market_value / 100) * coinsToUSD).toFixed(2));


    //
    // Create the item object
    // Now calculating the profit in scraper script
    const item = {
        website: "CSGOEmpire",
        websiteUrl: "https://csgoempire.gg",
        itemUrl: `https://csgoempire.gg/item/${items.id}`,
        name: items.market_name,
        coins: (items.market_value / 100),
        price: price,
        id: items.id,
        float: items.wear,
        stickers: items.stickers,
        imglink: `https://community.akamai.steamstatic.com/economy/image/${items.icon_url}`,
        createdAt: new Date(),
        above_recommended_price: items.above_recommended_price,
        blue_percentage: items.blue_percentage,
        fade_percentage: items.fade_percentage,
    };

    
    
    // Insert the item into the database
    await db.collection('marketitems').insertOne(item);
 
}

// Function to handle auction update event
async function onSocketNewAuctionUpdate(updateData, db) {
    
    // Retrieve the current item from the DB to get its buffsaleprice
    const itemId = updateData.id;
    const currentItem = await db.collection('liveitems').findOne({ id: itemId });

                            
    if (currentItem) {
        // Calculate the new price
        const newPrice = parseFloat(((updateData.auction_highest_bid / 100) * coinsToUSD).toFixed(2));

        // Calculate the new profit
        const newProfit = currentItem.buffsaleprice ? parseFloat((currentItem.buffsaleprice - newPrice).toFixed(2)) : null;

        // Update the item in the database
        await db.collection('liveitems').updateOne(
            { id: itemId},
            { $set: { price: newPrice, profit: newProfit } } // Update profit here
        );

        console.log(`Document ${currentItem.name} updated to new price: ${newPrice} from old price: ${currentItem.price}`);
    }



}






init()

