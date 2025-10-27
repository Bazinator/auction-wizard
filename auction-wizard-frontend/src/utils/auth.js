// Authentication utility functions

export const getAuthToken = () => localStorage.getItem('token');

export const setAuthToken = (token) => localStorage.setItem('token', token);

export const removeAuthToken = () => localStorage.removeItem('token');

export const isAuthenticated = () => !!getAuthToken();

export const handleLogout = () => {
  removeAuthToken();
  window.location.href = '/login';
};
