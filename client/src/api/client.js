import axios from 'axios';
const baseURL = import.meta.env.VITE_API_URL || '/api';
const api = axios.create({ baseURL, withCredentials: true, headers: { 'Content-Type': 'application/json', 'X-InTrack-Request': '1' } });
let refreshPromise = null;
api.interceptors.response.use(res => res, async error => {
  const request = error.config;
  if (!request || error.response?.status !== 401 || request._retry || /\/auth\/(login|refresh)(?:$|[?])/.test(request.url || '')) return Promise.reject(error);
  request._retry = true;
  if (!refreshPromise) {
    refreshPromise = axios.post(baseURL + '/auth/refresh', {}, { withCredentials: true, headers: { 'X-InTrack-Request': '1' } }).finally(() => { refreshPromise = null; });
  }
  try { await refreshPromise; } catch (refreshError) {
    if (refreshError.response?.status === 401) window.dispatchEvent(new Event('auth-expired'));
    return Promise.reject(refreshError);
  }
  return api(request);
});
export default api;
