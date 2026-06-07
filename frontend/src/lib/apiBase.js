export function getApiBaseUrl() {
  if (window.location.hostname === 'localhost') {
    return 'http://localhost:5000/api';
  }
  return 'https://abhide-cloud-ide.onrender.com/api';
}

export function getSocketBaseUrl() {
  return getApiBaseUrl().replace(/^http/, 'ws').replace(/\/api$/, '');
}
