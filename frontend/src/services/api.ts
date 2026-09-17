/// <reference types="vite/client" />
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true, // required for receiving refresh token cookie
});

// Request Interceptor: Attach Access Token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor: Handle 401s and Refresh Token
api.interceptors.response.use(
  (response) => response.data,
  async (error) => {
    const originalRequest = error.config;
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      try {
        const { data } = await axios.post(`${API_URL}/auth/refresh`, {}, { withCredentials: true });
        // The backend returns { success: true, data: { accessToken: "..." } }
        const newAccessToken = data?.data?.accessToken;
        if (!newAccessToken) {
          throw new Error('No access token returned from refresh endpoint');
        }
        localStorage.setItem('accessToken', newAccessToken);
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        return api(originalRequest);
      } catch {
        // Refresh token also expired or missing — clean up and notify the React
        // tree via a CustomEvent so we can show a proper modal instead of a
        // hard browser reload (window.location.href would wipe all React state).
        localStorage.removeItem('accessToken');
        window.dispatchEvent(new CustomEvent('session-expired'));
        // Return a rejected promise so the original caller's catch block also
        // fires (e.g. form submit handlers will stop their loading spinners).
        return Promise.reject(error);
      }
    }
    return Promise.reject(error);
  }
);
