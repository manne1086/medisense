
const API_BASE = import.meta.env.VITE_API_URL?.replace(/\/+$/, '') || 'http://localhost:5000';
const AUTH_URL = `${API_BASE}/auth`;
const AUTH_TOKEN_KEY = 'medisense_auth_token';

export const AUTH_FAILURE_MESSAGE = 'Your sign-in session expired or is invalid. Please sign in again.';

export const getAuthToken = () => {
  return localStorage.getItem(AUTH_TOKEN_KEY);
};

export const clearAuthToken = () => {
  localStorage.removeItem(AUTH_TOKEN_KEY);
};

export const handleAuthFailure = (message = AUTH_FAILURE_MESSAGE) => {
  clearAuthToken();

  window.dispatchEvent(new CustomEvent('medisense-auth-failed', {
    detail: { message }
  }));

  return AUTH_FAILURE_MESSAGE;
};

export const loginWithGoogle = () => {
  window.location.href = `${AUTH_URL}/google`;
};

export const logout = () => {
  clearAuthToken();
  window.location.reload();
};

export const isAuthenticated = () => {
  return !!getAuthToken();
};

export const handleAuthCallback = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');
  if (token) {
    localStorage.setItem(AUTH_TOKEN_KEY, token);
    window.history.replaceState({}, document.title, window.location.pathname);
    return true;
  }
  return false;
};
