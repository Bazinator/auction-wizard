import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import '../styles/auth.css';

const SignUp = () => {
  const { signup, error: authError, loading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [showPasswordRequirements, setShowPasswordRequirements] = useState(false);
  const [passwordsMatch, setPasswordsMatch] = useState(true);

  const validatePassword = (pass) => {
    const requirements = {
      length: pass.length >= 8,
      uppercase: /[A-Z]/.test(pass),
      lowercase: /[a-z]/.test(pass),
      special: /[!@#$%^&*(),.?":{}|<>]/.test(pass),
    };
    return requirements;
  };

  // Check if all password requirements are met
  const allRequirementsMet = (pass) => {
    return Object.values(validatePassword(pass)).every(Boolean);
  };

  // Check password match
  useEffect(() => {
    if (confirmPassword) {
      setPasswordsMatch(password === confirmPassword);
    }
  }, [password, confirmPassword]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!passwordsMatch) {
      setError('Passwords do not match');
      return;
    }

    if (!allRequirementsMet(password)) {
      setError('Password does not meet requirements');
      return;
    }

    try {
      await signup(email, password);
    } catch (err) {
      setError(authError || err.message);
    }
  };

  const handlePasswordFocus = () => {
    if (!allRequirementsMet(password)) {
      setShowPasswordRequirements(true);
    }
  };

  const handlePasswordChange = (e) => {
    const newPassword = e.target.value;
    setPassword(newPassword);
    if (allRequirementsMet(newPassword)) {
      setShowPasswordRequirements(false);
    } else {
      setShowPasswordRequirements(true);
    }
  };

  return (
    <div className="main-container">
      <div className="container-columns">
        <div className="switch-login-signup">
          <h1>Sign Up</h1>
          <h1><Link to="/login">Log In</Link></h1>
        </div>
        <div className="login-info">
          <p>Please enter your email and password to sign up</p>
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
              onChange={handlePasswordChange}
              onFocus={handlePasswordFocus}
              required
            />
            {showPasswordRequirements && (
              <div className="password-requirements">
                <p className={validatePassword(password).length ? 'valid' : 'invalid'}>
                  ✓ At least 8 characters
                </p>
                <p className={validatePassword(password).uppercase ? 'valid' : 'invalid'}>
                  ✓ One uppercase letter
                </p>
                <p className={validatePassword(password).lowercase ? 'valid' : 'invalid'}>
                  ✓ One lowercase letter
                </p>
                <p className={validatePassword(password).special ? 'valid' : 'invalid'}>
                  ✓ One special character
                </p>
              </div>
            )}
          </div>
          <div className="password-input-repeated">
            <p>Re-Enter Password</p>
            <input
              type="password"
              placeholder="Repeat Password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
            />
            {confirmPassword && !passwordsMatch && (
              <p className="password-match-error">Passwords do not match</p>
            )}
          </div>
          <button type="submit" className="submit-form-button" disabled={loading}>
            <p>{loading ? 'Signing up...' : 'Sign Up'}</p>
          </button>
        </form>
      </div>
    </div>
  );
};

export default SignUp;
