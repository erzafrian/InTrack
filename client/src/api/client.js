import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

let isRefreshing = false;

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const originalRequest = error.config;

    // Skip refresh for auth endpoints to prevent infinite loop
    if (originalRequest.url?.includes('/auth/')) {
      return Promise.reject(error);
    }

    if (error.response?.status === 401 && !originalRequest._retry && !isRefreshing) {
      originalRequest._retry = true;
      isRefreshing = true;
      try {
        const refreshUrl = (import.meta.env.VITE_API_URL || '/api') + '/auth/refresh';
        await axios.post(refreshUrl, {}, { withCredentials: true });
        isRefreshing = false;
        return api(originalRequest);
      } catch {
        isRefreshing = false;
        window.location.href = '/login';
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

export default api;
