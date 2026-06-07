import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:5000/api',
});

// Attach JWT from the persisted auth store (read directly from
// localStorage to avoid a circular import with authStore)
api.interceptors.request.use((config) => {
  try {
    const raw = localStorage.getItem('webide-auth');
    const token = raw ? JSON.parse(raw)?.state?.token : null;
    if (token) config.headers.Authorization = `Bearer ${token}`;
  } catch {
    // ignore malformed storage
  }
  return config;
});

// On 401, clear auth and send the user to login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !window.location.pathname.startsWith('/login')) {
      localStorage.removeItem('webide-auth');
      window.location.href = '/login';
    }
    return Promise.reject(err);
  }
);

export default api;
