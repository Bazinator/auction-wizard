import axios from 'axios';
import { getAuthToken, setAuthToken, getRefreshToken, setRefreshToken, handleLogout } from './auth';

console.log('API URL:', process.env.REACT_APP_API_URL);

const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:4000',
});

// Add request interceptor for auth token
api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Add response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const refreshToken = getRefreshToken();
        if (!refreshToken) throw new Error('No refresh token');
        const refreshResponse = await api.post('/api/token/refresh', { refreshToken });
        const { token: newAccessToken, refreshToken: newRefreshToken } = refreshResponse.data || {};
        if (!newAccessToken || !newRefreshToken) throw new Error('Invalid refresh response');
        setAuthToken(newAccessToken);
        setRefreshToken(newRefreshToken);
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch (e) {
        handleLogout();
        return Promise.reject(e);
      }
    }
    return Promise.reject(error);
  }
);

export default api;
