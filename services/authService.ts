
const AUTH_URL = 'http://localhost:5000/auth';

export const loginWithGoogle = () => {
  window.location.href = `${AUTH_URL}/google`;
};

export const logout = () => {
  localStorage.removeItem('medisense_auth_token');
  window.location.reload();
};

export const isAuthenticated = () => {
  return !!localStorage.getItem('medisense_auth_token');
};

export const handleAuthCallback = () => {
  const urlParams = new URLSearchParams(window.location.search);
  const token = urlParams.get('token');
  if (token) {
    localStorage.setItem('medisense_auth_token', token);
    window.history.replaceState({}, document.title, window.location.pathname);
    return true;
  }
  return false;
};
