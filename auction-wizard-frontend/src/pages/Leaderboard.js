import React, { useEffect, useState } from 'react';
import axios from 'axios';
import '../styles/ImportingItems.css';

// Access environment variable
const apiUrl = process.env.REACT_APP_API_URL;

function ItemLeaderboard() {
  const [items, setItems] = useState([]);
  const [originalItems, setOriginalItems] = useState([]);
  const [filter, setFilter] = useState(null);
  const [search, setSearch] = useState('');
  const [maxPrice, setMaxPrice] = useState('');

  useEffect(() => {
    const fetchItems = async () => {
      const res = await axios.get(apiUrl + '/items/highest');
      const data = res.data;
      console.log(data);
      const now = new Date().getTime();

      const newItems = data
        .map((item) => {
          const nameParts = item.name ? item.name.split(' | ') : [null, null];
          const itemPart = nameParts[0] ? nameParts[0] : 'Unknown Item';

          let skinName = null;
          let wearName = null;

          if (nameParts[1]) {
            const skinWearParts = nameParts[1].split('(');
            skinName = skinWearParts[0] ? skinWearParts[0].trim() : 'Unknown Skin';
            wearName = (skinWearParts[1] ? skinWearParts[1].replace(')', '') : null) || '';
          } else {
            skinName = '';
            wearName = '';
          }
          return {
            ...item,
            itemPart,
            skinName,
            wearName,
          };
        })
        .filter((item) => item != null); // This will remove null items from newItems

      if (filter === 'profit') {
        newItems.sort((a, b) => b.profit - a.profit);
      } else if (filter === 'price') {
        newItems.sort((a, b) => b.price - a.price);
      }

      setItems(newItems);
      setOriginalItems(newItems);
    };

    fetchItems();
    const intervalId = setInterval(fetchItems, 5000); // fetch every 0.5 seconds

    // Cleanup function to clear the interval when the component unmounts
    return () => clearInterval(intervalId);
  }, [filter, maxPrice]); // The effect re-runs when 'filter' changes

  const sortByProfit = () => {
    setFilter('profit');
  };

  const sortByPrice = () => {
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
  return (
    <div className="app">
      <header className="app-header">
        <img src={process.env.PUBLIC_URL + '/logo.png'} className="header-logo" />
        <h1>Auction Wizard</h1>
      </header>

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
        <button onClick={sortByProfit}>Current Leaderboard</button>
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
          .map((item) => (
            <div key={item.id} className="card">
              <div className="card-image-container">
                {item.float && <p className="float-info">Float: {item.float}</p>}
                <h5 className="card-itemname">{item.wearName}</h5>
                <img
                  src={item.imglink.replace(/['"]+/g, '')}
                  alt={item.name}
                  className="card-img"
                />
              </div>

              <h4 className="card-itemwearname">{item.itemPart}</h4>
              <h5 className="card-title">{item.skinName}</h5>

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
                        <div class="image-caption">CS:GO Empire </div>
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
                        <div class="image-caption">Buff163</div>
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
                        <div class="image-caption">Buff163</div>
                      </div>
                      <span className="card-info-label">Buy Order:</span>{' '}
                      <strong>${item.buffbuyorder}</strong>
                    </div>

                    <div className="card-info-container">
                      <div className="card-info">
                        {/* Wrap the content in a ternary operator */}
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

                <div className="card-info-timer"></div>
                <div className="card-info-profit">
                  <span className="card-info-label">Profit: </span>
                  <span className={`card-price ${item.profit >= 0 ? 'positive' : 'negative'}`}>
                    {item.profit >= 0 ? '$' + item.profit : '- $' + Math.abs(item.profit)}
                  </span>
                </div>
                <div className="card-info-profit">
                  <span className="card-info-label">Buy Order Profit: </span>
                  <span
                    className={`card-price ${item.buyorderprofit >= 0 ? 'positive' : 'negative'}`}
                  >
                    {item.buyorderprofit >= 0
                      ? '$' + item.buyorderprofit
                      : '- $' + Math.abs(item.buyorderprofit)}
                  </span>
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}

export default ItemLeaderboard;
