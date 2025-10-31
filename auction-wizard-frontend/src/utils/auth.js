// Authentication utility functions

export const getAuthToken = () => localStorage.getItem('token');
export const getRefreshToken = () => localStorage.getItem('refreshToken');

export const setAuthToken = (token) => localStorage.setItem('token', token);
export const setRefreshToken = (token) => localStorage.setItem('refreshToken', token);

export const removeAuthToken = () => localStorage.removeItem('token');
export const removeRefreshToken = () => localStorage.removeItem('refreshToken');

export const isAuthenticated = () => !!getAuthToken();

export const handleLogout = () => {
  removeAuthToken();
  removeRefreshToken();
  window.location.href = '/login';
};
