import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { setAuthToken, removeAuthToken, isAuthenticated } from '../utils/auth';

export const useAuth = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    try {
      setLoading(true);
      setError('');
      const response = await api.post('/login', { email, password });
      setAuthToken(response.data.token);
      navigate('/sniper');
    } catch (err) {
      setError(err.response?.data?.error || 'Login failed');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const signup = async (email, password) => {
    try {
      setLoading(true);
      setError('');
      const response = await api.post('/signup', { email, password });
      setAuthToken(response.data.token);
      navigate('/sniper');
    } catch (err) {
      setError(err.response?.data?.error || 'Signup failed');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    removeAuthToken();
    navigate('/login');
  };

  return {
    loading,
    error,
    isAuthenticated: isAuthenticated(),
    login,
    signup,
    logout,
  };
};
