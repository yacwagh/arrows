import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:3001/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add a request interceptor to set the authorization header
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Add a response interceptor to handle common errors
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Handle 401 Unauthorized errors by redirecting to login
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      // Check if we're not already on the login page to avoid redirect loops
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);

export default api;

// Product API functions
export const fetchProducts = async (filters = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value) params.append(key, value);
  });
  return api.get(`/products?${params.toString()}`);
};

export const fetchProductById = async (id) => {
  return api.get(`/products/${id}`);
};

// User API functions
export const fetchUserProfile = async () => {
  return api.get('/user/profile');
};

export const updateUserProfile = async (profileData) => {
  return api.put('/user/profile', profileData);
};

export const changePassword = async (passwordData) => {
  return api.put('/user/password', passwordData);
};

// Order API functions
export const createOrder = async (orderData) => {
  return api.post('/orders', orderData);
};

export const fetchUserOrders = async () => {
  return api.get('/orders');
};

export const fetchOrderById = async (id) => {
  return api.get(`/orders/${id}`);
};

// Payment API functions
export const processPayment = async (paymentData) => {
  return api.post('/payments/process', paymentData);
};

// Shipping API functions
export const calculateShipping = async (shippingData) => {
  return api.post('/shipping/calculate', shippingData);
};