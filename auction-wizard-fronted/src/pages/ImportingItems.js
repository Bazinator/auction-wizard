import React, { useEffect, useState } from 'react';
import axios from 'axios';
import '../styles/ImportingItems.css';
const CountdownTimer = ({ endTime, onTimeElapsed, itemId }) => {
  const calculateRemainingTime = () => {
    const now = new Date().getTime(); // convert to seconds
    const distance = endTime - now;

    // Calculate days, hours, minutes, and seconds
    const days = Math.floor(distance / (1000 * 60 * 60 * 24));
    const hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((distance % (1000 * 60)) / 1000);

    return {
      days,
      hours,
      minutes,
      seconds,
    };
  };

  const [remainingTime, setRemainingTime] = useState(calculateRemainingTime());

  useEffect(() => {
    const timer = setInterval(() => {
      const newRemainingTime = calculateRemainingTime();
      setRemainingTime(calculateRemainingTime());

      // If the time has elapsed, invoke the callback function
      if (
        newRemainingTime.days <= 0 &&
        newRemainingTime.hours <= 0 &&
        newRemainingTime.minutes <= 0 &&
        newRemainingTime.seconds <= 0
      ) {
        onTimeElapsed(itemId);
      }
    }, 1000);

    return () => {
      clearInterval(timer);
    };
  }, []);

  return (
    <div className="countdown-timer">
      {remainingTime.days > 0 && <span>{remainingTime.days}d </span>}
      {remainingTime.hours > 0 && <span>{remainingTime.hours}h </span>}
      {remainingTime.minutes > 0 && <span>{remainingTime.minutes}m </span>}
      {remainingTime.seconds}s
    </div>
  );
};

// Access environment variable directly
const apiItemsUrl = process.env.REACT_APP_API_URL + '/items';

function ItemList() {
  const [items, setItems] = useState([]);
  const [page, setPage] = useState(1);
  const [limit] = useState(23);
  const [originalItems, setOriginalItems] = useState([]);
  const [filter, setFilter] = useState(null);
  const [search, setSearch] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [itemType, setItemType] = useState('all');

  const removeItemFromList = (itemId) => {
    setItems((items) => items.filter((item) => item.id !== itemId));
  };

  useEffect(() => {
    const fetchItems = async () => {
      try {
        console.log('Fetching items with params:', {
          itemType,
          maxPrice,
          search,
          page,
          limit,
        });

        const res = await axios.get(apiItemsUrl, {
          params: {
            itemType: itemType,
            maxPrice: maxPrice || undefined,
            search: search || undefined,
            page: parseInt(page),
            limit: parseInt(limit),
          },
        });

        console.log('Response data length:', res.data.length);
        const data = res.data;
        setItems(data);
      } catch (error) {
        console.error('Error fetching items:', error);
      }
    };

    fetchItems();
    const intervalId = setInterval(fetchItems, 5000);

    return () => clearInterval(intervalId);
  }, [filter, maxPrice, itemType, search, page, limit]); // Ensure itemType is included in dependencies

  const sortByProfit = () => {
    setFilter('profit');
  };

  const sortByPrice = () => {
    console.log('Sorting by price');
    setFilter('price');
  };

  const resetSort = () => {
    setFilter(null);
  };

  const handleSearchChange = (event) => {
    setSearch(event.target.value);
  };

  const handleMaxPriceChange = (event) => {
    setMaxPrice(event.target.value);
  };

  const handleItemTypeChange = (type) => {
    console.log(`Changing item type to: ${type}`); // Debug log
    setItemType(type);
  };
  const handleNextPage = () => {
    setPage((prevPage) => prevPage + 1);
  };

  const handlePreviousPage = () => {
    setPage((prevPage) => Math.max(prevPage - 1, 1));
  };

  return (
    <div className="app">
      <header className="app-header">
        <img src={process.env.PUBLIC_URL + '/logo.png'} className="header-logo" />
        <h1>Auction Wizard</h1>
      </header>
      <div className="pagination-controls">
        <button onClick={handlePreviousPage} disabled={page === 1}>
          Previous
        </button>
        <span>Page {page}</span>
        <button onClick={handleNextPage}>Next</button>
      </div>
      <div className="filter-buttons">
        <input
          type="text"
          placeholder="Search items..."
          className="search-bar"
          onChange={handleSearchChange}
          value={search}
        />
        <button onClick={sortByProfit}>Sort by Profit</button>
        <button onClick={sortByPrice}>Sort by Price</button>
        <button onClick={resetSort}>Reset Sort</button>
        <button onClick={() => handleItemTypeChange('auction')}>Auction Items</button>
        <button onClick={() => handleItemTypeChange('market')}>Market Items</button>
        <button onClick={() => handleItemTypeChange('all')}>All Items</button>
        <div className="filter-inputs">
          <label>
            Max Price
            <input type="number" value={maxPrice} onChange={handleMaxPriceChange} />
          </label>
        </div>
      </div>

      <div className="grid">
        {items
          .filter((item) => item.name.includes(search))
          .map((item) => {
            // Default values
            let wearName = 'NO NAME';
            let itemPart = null;
            let wear = null;

            try {
              // Only process if item.name exists and contains '|'
              if (item.name && item.name.includes('|')) {
                const nameParts = item.name.split('|');
                wearName = nameParts[0]?.trim() || 'NO NAME';

                if (nameParts[1]) {
                  const itemPartAndWear = nameParts[1].trim().split('(');
                  itemPart = itemPartAndWear[0]?.trim();
                  wear = itemPartAndWear[1]?.replace(')', '').trim();
                }
              } else {
                // If the name doesn't contain '|', use the whole name as wearName
                wearName = item.name?.trim() || 'NO NAME';
              }
            } catch (error) {
              console.warn('Error parsing item name:', item.name, error);
              wearName = item.name?.trim() || 'NO NAME';
            }

            return (
              <div key={item.id} className="card">
                <div className="card-image-container">
                  {item.float && <p className="float-info">Float: {item.float}</p>}
                  <h5 className="card-itemname">{wearName}</h5>
                  <img
                    src={item.imglink?.replace(/['"]+/g, '')}
                    alt={item.name}
                    className="card-img"
                  />
                </div>
                <div className="card-itemwearname">{itemPart || '\u00A0'}</div>
                <div className="card-title">{wear || '\u00A0'}</div>
                <div className="card-info-timer">
                  {item.auction_ends_at && (
                    <CountdownTimer
                      endTime={item.auction_ends_at}
                      onTimeElapsed={removeItemFromList}
                      itemId={item.id}
                    />
                  )}
                </div>
                <div className="card-body">
                  <div className="row">
                    <div className="card-info-container">
                      <div className="card-info">
                        <div className="image-containter">
                          <img
                            src={process.env.PUBLIC_URL + '/empirelogo.png'}
                            alt="Empire Icon"
                            className="icon-placeholder"
                          />
                          <div className="image-caption">CS:GO Empire </div>
                        </div>
                        <span className="card-info-label">Price:</span> ${item.price}
                      </div>
                    </div>
                    <div className="card-info-container">
                      <div className="card-info">
                        <div className="image-containter">
                          <img
                            src={process.env.PUBLIC_URL + '/bufflogo1.png'}
                            alt="Buff Icon"
                            className="icon-placeholder"
                          />
                          <div className="image-caption">Buff163</div>
                        </div>
                        <span className="card-info-label">Sale Price:</span>{' '}
                        <strong>${item.buffsaleprice}</strong>
                      </div>
                      <div className="card-info">
                        <div className="image-containter">
                          <img
                            src={process.env.PUBLIC_URL + '/bufflogo1.png'}
                            alt="Buff Icon"
                            className="icon-placeholder"
                          />
                          <div className="image-caption">Buff163</div>
                        </div>
                        <span className="card-info-label">Buy Order:</span>{' '}
                        <strong>${item.buffbuyorder}</strong>
                      </div>
                      <div className="card-info-container">
                        <div className="card-info">
                          {item.lowest_float_price ? (
                            <>
                              <div className="image-containter">
                                <img
                                  src={process.env.PUBLIC_URL + 'floatlogo.png'}
                                  alt="Float Icon"
                                  className="icon-placeholder"
                                />
                                <div className="image-caption">CS:GO Float</div>
                              </div>
                              <span className="card-info-label">Float Listing:</span>
                              {`$${item.lowest_float_price}`}
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="card-info-profit">
                    <span className="card-info-label">Profit: </span>
                    <span className={`card-price ${item.profit >= 0 ? 'positive' : 'negative'}`}>
                      {item.profit >= 0 ? '$' + item.profit : '- $' + Math.abs(item.profit)}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
      </div>
    </div>
  );
}

export default ItemList;
