import React from 'react';
import '../styles/LandingPage.css';
import { Link } from 'react-router-dom';
import { FaFilter, FaRobot, FaChartLine, FaBell } from 'react-icons/fa';

const LandingPage = () => {
  return (
    <div className="landing-page">
      <header className="landing-header">
        <div className="header-container">
          <Link to="/" className="logo">
            Auction <b>Wizard</b>
          </Link>
          <ul className="nav-links">
            <li><Link to="/login" className="nav-link">Log In</Link></li>
            <li><Link to="/signup" className="nav-link-primary">Get Started</Link></li>
          </ul>
        </div>
      </header>

      <section className="hero-section">
        <div className="container">
          <div className="hero-content">
            <h1>Automate Your CS:GO Trading</h1>
            <p className="hero-subtitle">
              Stop missing out on profitable trades. Let Auction Wizard find and secure the best deals for you 24/7.
            </p>
            <Link to="/signup" className="cta-button">Start Trading Smarter</Link>
          </div>
        </div>
      </section>

      <section className="features-section">
        <div className="container">
          <h2>Why Choose Auction Wizard?</h2>
          <div className="features-grid">
            <div className="feature-card">
              <div className="feature-icon">
                <FaFilter />
              </div>
              <h3>Smart Filters</h3>
              <p>Set up custom filters for specific items, float values, and price ranges. Never miss a deal that matches your criteria.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <FaRobot />
              </div>
              <h3>Automated Sniping</h3>
              <p>Our advanced sniping system monitors the market 24/7, ready to catch underpriced items the moment they're listed.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <FaBell />
              </div>
              <h3>Instant Alerts</h3>
              <p>Receive immediate notifications when profitable opportunities match your criteria. Stay ahead of the competition.</p>
            </div>
            <div className="feature-card">
              <div className="feature-icon">
                <FaChartLine />
              </div>
              <h3>Market Analysis</h3>
              <p>Real-time price comparisons between CS:GO Empire and Buff163 to identify the most profitable trades.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="how-it-works">
        <div className="container">
          <h2>How It Works</h2>
          <div className="steps-container">
            <div className="step">
              <div className="step-number">1</div>
              <h3>Set Your Filters</h3>
              <p>Define your preferred items, float values, and price ranges in our intuitive interface.</p>
            </div>
            <div className="step">
              <div className="step-number">2</div>
              <h3>Activate Sniping</h3>
              <p>Let our automated system monitor the market and identify profitable opportunities.</p>
            </div>
            <div className="step">
              <div className="step-number">3</div>
              <h3>Get Notified</h3>
              <p>Receive instant alerts when items matching your criteria are found.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="cta-section">
        <div className="container">
          <div className="cta-content">
            <h2>Ready to Start Profiting?</h2>
            <p>Join our community of traders who are already using Auction Wizard to maximize their profits.</p>
            <Link to="/signup" className="cta-button">Get Started Now</Link>
          </div>
        </div>
      </section>

      <footer className="landing-footer">
        <div className="container">
          <div className="footer-content">
            <div className="footer-logo">
              Auction <b>Wizard</b>
            </div>
            <p className="footer-text">© 2024 Auction Wizard. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
