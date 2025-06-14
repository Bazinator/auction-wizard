import os
import sys
import time
from scrapling import Fetcher , StealthyFetcher, PlayWrightFetcher
import json
from dotenv import load_dotenv
from dataclasses import dataclass
from pymongo import MongoClient
from bson.objectid import ObjectId
from bisect import bisect_left
import datetime


# Constants
CACHED_DATA_DAYS = 8


#Load environment variables
load_dotenv()

PROXY_PASSWORD = os.getenv('PROXY_PASSWORD')
PROXY_USERNAME = os.getenv('PROXY_USERNAME')
YUAN_TO_USD = 0.13699967
POSSIBLE_DOPPLER_PHASES = ['Phase 1', 'Phase 2', 'Phase 3', 'Phase 4', 'Ruby', 'Sapphire', 'Black Pearl', 'Emerald']

#Set up class for the item data.
class ItemData:
    def __init__(self, float, name):
        self.profit = None
        self.buyOrderProfit = None
        self.lowest_sale_price = None
        self.for_sale_count = None
        self.highest_buy_order = None
        self.float = float
        self.name = name

#Function to normalize item names removing special characters
def normalize_names(name):
    if name.startswith('★ '):
        name = name[len('★ '):].strip()
    return name.lower()


#Binary search function
def binary_search(sorted_list, target):
    """Perform a binary search for the target in a sorted list."""

    target_normalized = normalize_names(target)
    names = [normalize_names(item[0]) for item in sorted_list]
    # Perform the binary search
    index = bisect_left(names, target_normalized)
    # Check if the target was found
    if index < len(names) and names[index] == target_normalized:
        return sorted_list[index]

    return None



#Get buff id from the item name
def get_buff_id_data(item_name):
    file_path = r'C:\Users\mpete\OneDrive\DocumentsPC\Coding\auction-wizard\AuctionWizard\Website\backend\Scrapers\buffidsfull.json'
    # Step 1: Load and sort JSON data
    with open(file_path, 'r', encoding = 'utf-8') as file:
        data = json.load(file)

    # Convert to list of (name, data) and sort alphabetically
    sorted_items = sorted(data["items"].items(), key=lambda x: normalize_names(x[0]))



    result = binary_search(sorted_items, item_name)
    if result is not None:
        return result
    else:
        print(f'Item "{item_name}" not found in buffids.json')
        return None



#Get full link with buff id
def get_link (item_name, isBuyOrder):
    website = 'https://buff.163.com/api/market/goods/buy_order?game=csgo&goods_id=' if isBuyOrder else 'https://buff.163.com/api/market/goods/sell_order?game=csgo&goods_id='
    
    # Deal with doppler phases. We know that the data from the websocket will look like 
    # ★ Falchion Knife | Doppler (Factory New) - Phase 2
    # If item name contains doppler, we then need to set the phase so we can get the correct buff tag id
    

    
    # Check if the item is a doppler
    isDoppler = False
    item_doppler_phase = None
    if 'Doppler' in item_name:
        print('Doppler in item:', item_name)
        isDoppler = True
        for phrase in POSSIBLE_DOPPLER_PHASES:
            if phrase in item_name:
                item_doppler_phase = phrase
                item_name = item_name.replace(phrase, '')
                # Remove the - from the item name
                item_name = item_name.replace(' - ', '')
                break
    
    
    data = get_buff_id_data(item_name)
    if data is None:
        return None
    BuffIdData = data[1]
    buffId = BuffIdData['buff163_goods_id']


    if isBuyOrder & isDoppler:    # Use our extracted doppler phase to get the correct buff tag id
        tagIds = BuffIdData["buff163_phase_ids"]
        tagId = tagIds.get(item_doppler_phase, None)

    # If the item is a doppler, we need to add the tag id to the buff id


    if 'Doppler' in item_name and isBuyOrder:
        return website + str(buffId) + '&tag_ids=' + str(tagId)
    if buffId is not None and not isDoppler:
        return website + str(buffId)
    else:
        return None
    


#TODO This does not work for dopplers! sell_min_price returns regardless of the phase! Need to change to actually pull the list of items for sale and find the lowest

#Extract the price from the json data
def extract_sell_min_price(page_data):

    # Load the JSON data
    data = json.loads(page_data)


    
    if not data:
        return None
    # Check if the JSON data is valid
    if data['code'] == 'OK' and 'data' in data and 'goods_infos' in data['data']:

        # Extract the sell_min_price
        goods_infos = data['data']['goods_infos']
        for goods_id, info in goods_infos.items():
            if 'sell_min_price' in info:
                # Convert the price from CNY to USD and from string to float
                sell_min_price = float(info['sell_min_price'])
                sell_min_price_usd = round(sell_min_price * YUAN_TO_USD, 2)
                return sell_min_price_usd
    return None

def extract_sale_items(page_data):
    data = json.loads(page_data)

    if not data:
        return None

    if data['code'] == 'OK' and 'data' in data and 'items' in data['data']:

        # Loop through the items
        items = data['data']['items']

#Extract the total items for sale from the json data
def extract_total_items_forsale(page_data):
    data = json.loads(page_data)
    if data['code'] == 'OK' and 'data' in data:
        if 'total_count' in data['data']:
            return data['data']['total_count']
    return None


#Extract the best buyOrder based on item float
def get_best_buy_order(float_value, page_data):


    # Change this so when we call it from the main mainfunction we don't get type error


    data = json.loads(page_data)
    buy_orders = data["data"]["items"]
    best_order = None
    best_price = 0

    for order in buy_orders:
        specific = order.get("specific", [])
        if specific:
            for spec in specific:
                if spec["type"] == "paintwear":
                    min_float, max_float = map(float, spec["values"])
                    if min_float <= float_value <= max_float:
                        price = float(order["price"])
                        if price > best_price:
                            best_price = price
                            best_order = order
    
    if not best_order:
        for order in buy_orders:
            if not order.get("specific"):
                price = float(order["price"])
                if price > best_price:
                    best_price = price
                    best_order = order

    # Best order is the item information and best price is just raw buy order price
    #Check if data is null
    if best_order is None:
        return None
    best_price_usd = round(best_price * YUAN_TO_USD, 2)
    return best_price_usd



#Testing Functions

def test_extracting_data_from_json():
    # Load the JSON data from buffApiData.json
    json_file_path = r'C:\Users\mpete\OneDrive\DocumentsPC\Coding\auction-wizard\AuctionWizard\Scrapers\BuffApiBuyOrdersData.json'
    page_data = load_json_file(json_file_path)

    # Test the functions with the loaded JSON data
    best_buy_order = get_best_buy_order(0.08, page_data)
    print(best_buy_order)

def load_json_file(file_path):
    with open(file_path, 'r', encoding='utf-8') as file:
        return file.read()



#Connecting to databases
def connect_to_liveitem_database():
    client = MongoClient('mongodb://localhost:27017/')
    db = client['Doris']
    collection = db['liveitems']
    return collection

def connect_to_buffprices_database():
    client = MongoClient('mongodb://localhost:27017/')
    db = client['Buffprices']
    collection = db['prices']
    return collection


#Get an item from liveitems database by id
def get_item_by_id(collection, item_id):
    item = collection.find_one({"id": item_id})
    if item:
        return item
    else:
        print('Item not found')
        return None

#Check if the buff prices are cached
def check_cached_buff_prices(item):
    collection = connect_to_buffprices_database()
    item = collection.find_one({"name": item.name})

    #Check how old the data is
    if item is not None:
        time = item['time']
        time = datetime.datetime.now() - time
        if time.days < CACHED_DATA_DAYS:
            return item
        else:
            return None
    else:
        return None
#Update the cached buff prices
def update_cached_buff_prices(item):
    collection = connect_to_buffprices_database()
    time = datetime.datetime.now()
    collection.update_one({"name": item.name}, {"$set": {"lowest_sale_price": item.lowest_sale_price, "for_sale_count": item.for_sale_count, "highest_buy_order": item.highest_buy_order, "time": time}}, upsert=True)

#Main function 
def get_buff_prices (item):
    
    #Set up the fetcher
    proxy_template = f'http://{PROXY_USERNAME}:{PROXY_PASSWORD}@gate.smartproxy.com:7000'
    fetcher = Fetcher()



    #Check if their is a cached version of the prices
    cached_prices = check_cached_buff_prices(item)
    if cached_prices is None:
        #Get the buy page
        buyLink = get_link(item.name, True)
        #Use a for loop to try to get the buy page 5 times
        for attempt in range(5):
            proxy = proxy_template + f'?session={attempt + 5}'
            try:
                buyPage = fetcher.get(buyLink, stealthy_headers=True, proxy=proxy)
                if buyPage.status == 200:
                    break
            #except requests.exceptions.ProxyError as e:
            except Exception as e:
                print(f'Attempt to get buy page {attempt + 1} failed: {e}')
                time.sleep(1)
        else:
            print('Failed to fetch buy page after 5 attempts')
            return

        bestBuyOrder = get_best_buy_order(item.float, buyPage.text)
        item.highest_buy_order = bestBuyOrder


        saleLink = get_link(item.name, False)
        if saleLink is not None:
            #Use a for loop to try to get the sale page 5 times
            for attempt in range(5):
                proxy = proxy_template + f'?session={attempt}'
                try:
                    salePage = fetcher.get(saleLink, stealthy_headers=True, proxy=proxy)
                    if salePage.status == 200:
                        break
                except Exception as e:
                    print(f'Attempt to get sale page {attempt + 1} failed: {e}')
                    #time.sleep(1)
            else:
                print('Failed to fetch sale page after 5 attempts')
                return
            #Extract the price and total items for sale
            salePageText = salePage.text
            price = extract_sell_min_price(salePageText)
            total_sale_count = extract_total_items_forsale(salePageText)
            item.lowest_sale_price = price
            item.for_sale_count = total_sale_count
            
        #Update the cached prices
        update_cached_buff_prices(item)
    else:
        #Use the cached prices
        item.lowest_sale_price = cached_prices['lowest_sale_price']
        item.for_sale_count = cached_prices['for_sale_count']
        item.highest_buy_order = cached_prices['highest_buy_order']
        print('Using cached prices')



#Update the buff prices by item id
def update_buff_prices_by_item_id(item_id):

    collection = connect_to_liveitem_database()
    DatabaseItem = get_item_by_id(collection, item_id)
    if DatabaseItem is None:
        print ("Can't find item with id:", item_id)
        return

    item = ItemData(DatabaseItem['float'], DatabaseItem['name'])
    #Get the buff prices
    get_buff_prices(item)

    #Calculate Profits
    itemAuctionPrice = DatabaseItem['price']


    #Only calculating profits if we have data
    if item.lowest_sale_price is not None:
        itemSaleProfit = round(item.lowest_sale_price - itemAuctionPrice, 2)
    else:
        itemSaleProfit = None
    if item.highest_buy_order is not None:
        itemBuyOrderProfit = round(item.highest_buy_order - itemAuctionPrice, 2)
    else:
        itemBuyOrderProfit = None


    #Update the database
    collection.update_one({"id": item_id}, {"$set": {"buff_for_sale_count": item.for_sale_count, "buffsaleprice": item.lowest_sale_price, "buffbuyorder": item.highest_buy_order,  "profit": itemSaleProfit, "buyorderprofit": itemBuyOrderProfit}})
    return item





update_buff_prices_by_item_id(283974624)







"""
# Code to run the script from terminal
if __name__ == '__main__':
    if len(sys.argv) != 2:
        print ('Usage: python Scrapebuff.py <item_id>')
        sys.exit(1)

    database_id = sys.argv[1]
    database_id = database_id.strip()
    print(database_id)
    update_buff_prices_by_item_id(int(database_id))"""





