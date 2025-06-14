import React, { useState, useEffect } from 'react';
import axios from 'axios';
import buffData from '../buffidsfull.json';
import '../styles/sniper.css';

const apiUrl = process.env.REACT_APP_API_URL;

function SniperSetup() {
  const [marketName, setMarketName] = useState('');
  const [maxPrice, setMaxPrice] = useState('');
  const [minFloat, setMinFloat] = useState(0);
  const [maxFloat, setMaxFloat] = useState(1);
  const [savedSnipers, setSavedSnipers] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [items, setItems] = useState({});
  const [selectedWear, setSelectedWear] = useState('');
  const [isFloatLocked, setIsFloatLocked] = useState(false);
  const [matchingItems, setMatchingItems] = useState([]);
  const [expandedSniperId, setExpandedSniperId] = useState(null);
  const [sniperMatchingItems, setSniperMatchingItems] = useState({});

  const wearLevels = {
    'Factory New': { min: 0, max: 0.07 },
    'Minimal Wear': { min: 0.07, max: 0.15 },
    'Field-Tested': { min: 0.15, max: 0.37 },
    'Well-Worn': { min: 0.37, max: 0.44 },
    'Battle-Scarred': { min: 0.44, max: 1 }
  };

  // Load items data
  useEffect(() => {
    console.log('Loading items from buffData:', Object.keys(buffData.items || {}).length); // Debug log
    setItems(buffData.items || {});
  }, []);

  // Get token from localStorage
  const getAuthToken = () => localStorage.getItem('token');

  // Fetch saved snipers on component mount
  useEffect(() => {
    fetchSavedSnipers();
  }, []);

  const fetchSavedSnipers = async () => {
    try {
      const token = getAuthToken();
      if (!token) {
        console.error('No auth token found');
        return;
      }

      const response = await axios.get(apiUrl + '/snipers', {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setSavedSnipers(response.data);
    } catch (error) {
      console.error('Failed to fetch saved snipers:', error);
    }
  };

  // Fetch matching items
  const fetchMatchingItems = async () => {
    try {
      const token = getAuthToken();
      if (!token) {
        console.error('No auth token found');
        return;
      }

      const response = await axios.post(apiUrl + '/user-matches', {
        marketName,
        maxPrice: parseFloat(maxPrice) || 999999,
        minFloat,
        maxFloat,
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setMatchingItems(response.data);
    } catch (error) {
      console.error('Failed to fetch matching items:', error);
    }
  };

  const fetchMatchingItemsForSniper = async (sniper) => {
    try {
      const token = getAuthToken();
      if (!token) {
        console.error('No auth token found');
        return;
      }

      const response = await axios.post(apiUrl + '/user-matches', {
        marketName: sniper.marketName,
        maxPrice: sniper.maxPrice,
        minFloat: sniper.minFloat,
        maxFloat: sniper.maxFloat,
      }, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      setSniperMatchingItems(prev => ({
        ...prev,
        [sniper._id]: response.data
      }));
    } catch (error) {
      console.error('Failed to fetch matching items:', error);
    }
  };

  // Normalize string for searching
  const normalizeString = (str) => {
    return str.toLowerCase()
      .replace(/[|&]/g, '') // Remove | and &
      .replace(/\s+/g, ' ') // Replace multiple spaces with single space
      .trim();
  };

  // Handle search input changes with improved matching
  const handleSearchChange = (e) => {
    const value = e.target.value;
    setSearchTerm(value);

    if (value.length > 2) {
      const normalizedSearch = normalizeString(value);

      const matches = Object.keys(items)
        .filter(itemName => {
          // Skip sticker items
          if (itemName.toLowerCase().includes('sticker |')) return false;
          
          const normalizedItem = normalizeString(itemName);
          // Split search terms and check if all parts are present
          const searchParts = normalizedSearch.split(' ');
          return searchParts.every(part => normalizedItem.includes(part));
        })
        .sort((a, b) => a.length - b.length) // Sort by name length to show shorter matches first
        .slice(0, 10); // Limit to 10 suggestions
        
      setSuggestions(matches);
    } else {
      setSuggestions([]);
    }
  };

  // Handle suggestion selection with wear restrictions
  const handleSuggestionClick = (itemName) => {
    setSearchTerm(itemName);
    setSuggestions([]);
    
    // Set the full market name including wear
    setMarketName(itemName);
    
    // Extract wear if present
    const wearMatch = itemName.match(/\((.*?)\)$/);
    if (wearMatch) {
      const wear = wearMatch[1];
      setSelectedWear(wear);
      
      // Set float range based on wear
      if (wearLevels[wear]) {
        setMinFloat(wearLevels[wear].min);
        setMaxFloat(wearLevels[wear].max);
      }
    } else {
      setSelectedWear('');
      setMinFloat(0);
      setMaxFloat(1);
    }
  };

  // Handle float range changes with restrictions
  const handleFloatChange = (type, value) => {
    const floatValue = parseFloat(value);
    const currentWearLevels = selectedWear ? wearLevels[selectedWear] : { min: 0, max: 1 };

    if (type === 'min') {
      // If out of range, clamp to min
      if (floatValue < currentWearLevels.min) {
        setMinFloat(currentWearLevels.min);
      } else if (floatValue > maxFloat) {
        setMinFloat(maxFloat);
      } else {
        setMinFloat(floatValue);
      }
    } else {
      // If out of range, clamp to max
      if (floatValue > currentWearLevels.max) {
        setMaxFloat(currentWearLevels.max);
      } else if (floatValue < minFloat) {
        setMaxFloat(minFloat);
      } else {
        setMaxFloat(floatValue);
      }
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    const token = getAuthToken();
    if (!token) {
      console.error('No auth token found');
      return;
    }

    const sniperCriteria = {
      marketName, // This now includes the wear
      maxPrice: parseFloat(maxPrice) || 999999,
      minFloat,
      maxFloat,
    };

    try {
      const response = await axios.post(apiUrl + '/snipers', sniperCriteria, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      console.log(response.data.message);
      fetchSavedSnipers();
      fetchMatchingItems(); // Fetch matching items
      setMarketName('');
      setMaxPrice('');
      setMinFloat(0);
      setMaxFloat(1);
      setSearchTerm('');
      setSelectedWear('');
      setIsFloatLocked(false);
    } catch (error) {
      console.error('Failed to register sniper:', error);
    }
  };

  const handleDelete = async (sniperId) => {
    try {
      const token = getAuthToken();
      if (!token) {
        console.error('No auth token found');
        return;
      }

      await axios.delete(apiUrl + '/snipers/' + sniperId, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      fetchSavedSnipers();
    } catch (error) {
      console.error('Failed to delete sniper:', error);
    }
  };

  const handleExpandSniper = async (sniperId) => {
    if (expandedSniperId === sniperId) {
      setExpandedSniperId(null);
    } else {
      setExpandedSniperId(sniperId);
      const sniper = savedSnipers.find(s => s._id === sniperId);
      if (sniper) {
        await fetchMatchingItemsForSniper(sniper);
      }
    }
  };

  return (
    <div className="sniper-container">
      <h1 className="sniper-title">Item Sniper</h1>
      <p className="sniper-description">
        Set up custom filters to track specific items. Get notified when items matching
        your criteria become available on the CSGO Empire market.
      </p>

      <div className="sniper-form-container">
        <form onSubmit={handleSubmit} className="sniper-form">
          <div className="search-section">
            <input
              type="text"
              placeholder="Search for market items (e.g., 'AWP redline')"
              value={searchTerm}
              onChange={handleSearchChange}
              className="search-input"
            />
            {suggestions.length > 0 && (
              <div className="suggestions-dropdown">
                {suggestions.map((suggestion, index) => (
                  <div
                    key={index}
                    className="suggestion-item"
                    onClick={() => handleSuggestionClick(suggestion)}
                  >
                    {suggestion}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="filters-grid">
            <div className="filter-group">
              <label>Market Name</label>
              <input
                type="text"
                value={marketName}
                onChange={(e) => setMarketName(e.target.value)}
                required
                readOnly
              />
            </div>

            <div className="filter-group">
              <label>Max Price</label>
              <input
                type="number"
                placeholder="Max Price (USD)"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                min="0"
              />
            </div>

            <div className="filter-group float-range-group">
              <label>
                Float Range {selectedWear && `(${selectedWear})`}
              </label>
              <div className="range-inputs">
                <input
                  type="number"
                  value={minFloat}
                  onChange={(e) => handleFloatChange('min', e.target.value)}
                  min={selectedWear ? wearLevels[selectedWear].min : 0}
                  max={selectedWear ? wearLevels[selectedWear].max : 1}
                  step="0.000001"
                />
                <input
                  type="number"
                  value={maxFloat}
                  onChange={(e) => handleFloatChange('max', e.target.value)}
                  min={selectedWear ? wearLevels[selectedWear].min : 0}
                  max={selectedWear ? wearLevels[selectedWear].max : 1}
                  step="0.000001"
                />
              </div>
              <div className="range-slider">
                <div className="slider-track"></div>
                <div 
                  className="slider-track-fill"
                  style={{
                    left: `${(minFloat - (selectedWear ? wearLevels[selectedWear].min : 0)) / (selectedWear ? wearLevels[selectedWear].max - wearLevels[selectedWear].min : 1) * 100}%`,
                    width: `${(maxFloat - minFloat) / (selectedWear ? wearLevels[selectedWear].max - wearLevels[selectedWear].min : 1) * 100}%`
                  }}
                ></div>
                <input
                  type="range"
                  min={selectedWear ? wearLevels[selectedWear].min : 0}
                  max={selectedWear ? wearLevels[selectedWear].max : 1}
                  step="0.000001"
                  value={minFloat}
                  onChange={(e) => handleFloatChange('min', e.target.value)}
                  className="slider"
                />
                <input
                  type="range"
                  min={selectedWear ? wearLevels[selectedWear].min : 0}
                  max={selectedWear ? wearLevels[selectedWear].max : 1}
                  step="0.000001"
                  value={maxFloat}
                  onChange={(e) => handleFloatChange('max', e.target.value)}
                  className="slider"
                />
              </div>
            </div>
          </div>

          <button type="submit" className="submit-button">Create Sniper</button>
        </form>
      </div>


      <div className="saved-snipers-section">
        <h2>Your Active Snipers</h2>
        <div className="snipers-grid">
          {savedSnipers.map((sniper, index) => (
            <div key={index} className="sniper-card">
              <div className="sniper-header">
                <h3>{sniper.marketName}</h3>
                <button 
                  className="expand-button"
                  onClick={() => handleExpandSniper(sniper._id)}
                >
                  {expandedSniperId === sniper._id ? 'Hide Matches' : 'Show Matches'}
                </button>
              </div>
              <p>Price: ${sniper.maxPrice}</p>
              <p>Float: {sniper.minFloat.toFixed(3)} - {sniper.maxFloat.toFixed(3)}</p>
              {expandedSniperId === sniper._id && sniperMatchingItems[sniper._id] && (
                <div className="matching-items">
                  <h4>Matching Items</h4>
                  <div className="items-grid">
                    {sniperMatchingItems[sniper._id].map((item, itemIndex) => (
                      <div key={itemIndex} className="item-card">
                        <h3>{item.name}</h3>
                        <p>Price: ${item.price}</p>
                        <p>Float: {item.float.toFixed(3)}</p>
                        <a 
                          href={item.itemUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="item-link"
                        >
                          View on {item.website}
                        </a>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <button 
                className="delete-button"
                onClick={() => handleDelete(sniper._id)}
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default SniperSetup;