import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import '../styles/auth.css';

const Login = () => {
  const { login, error: authError, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await login(email, password);
    } catch (err) {
      setError(authError || err.message);
    }
  };

  return (
    <div className="main-container">
      <div className="container-columns">
        <div className="switch-login-signup">
          <h1><Link to="/signup">Sign Up</Link></h1>
          <h1>Log In</h1>
        </div>
        <div className="login-info">
          <p>Please enter your email and password to log in</p>
          {(error || authError) && <p className="error-message">{error || authError}</p>}
        </div>
        <form onSubmit={handleSubmit} className="input-container">
          <div className="email-input">
            <p>Email Address</p>
            <input
              type="email"
              placeholder="auctionwizard@gmail.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="password-input">
            <p>Password</p>
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="submit-form-button" disabled={loading}>
            <p>{loading ? 'Logging in...' : 'Log In'}</p>
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
