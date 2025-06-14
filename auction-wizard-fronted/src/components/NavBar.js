import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import '../styles/NavBar.css';

const NavBar = () => {
  const location = useLocation();

  return (
    <nav className="nav-bar">
      <div className="nav-logo">
        <img src={process.env.PUBLIC_URL + '/logo.png'} alt="Auction Wizard" className="nav-logo-img" />
        <span className="nav-logo-text">Auction <b>Wizard</b></span>
      </div>
      <div className="nav-links">
        <Link 
          to="/items" 
          className={`nav-link ${location.pathname === '/items' ? 'active' : ''}`}
        >
          Items
        </Link>
        <Link 
          to="/sniper" 
          className={`nav-link ${location.pathname === '/sniper' ? 'active' : ''}`}
        >
          Sniper
        </Link>
      </div>
    </nav>
  );
};

export default NavBar; 