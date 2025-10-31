import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../utils/api';
import { setAuthToken, removeAuthToken, isAuthenticated, setRefreshToken, removeRefreshToken } from '../utils/auth';

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
      const response = await api.post('/api/login', { email, password });
      setAuthToken(response.data.token);
      if (response.data.refreshToken) setRefreshToken(response.data.refreshToken);
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
      const response = await api.post('/api/signup', { email, password });
      setAuthToken(response.data.token);
      if (response.data.refreshToken) setRefreshToken(response.data.refreshToken);
      navigate('/sniper');
    } catch (err) {
      setError(err.response?.data?.error || 'Signup failed');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      const refreshToken = localStorage.getItem('refreshToken');
      if (refreshToken) {
        await api.post('/api/logout', { refreshToken });
      }
    } catch (_) {
      // ignore
    } finally {
      removeAuthToken();
      removeRefreshToken();
      navigate('/login');
    }
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
