import axios from 'axios';

// Determine the API base URL based on environment
const getBaseURL = () => {
  // Use environment variable if available, otherwise fallback to defaults
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  
  // Check if running on localhost (development)
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    return 'http://localhost:5000/api';
  }
  // Production URL fallback
  return 'https://pasan-enterprises-whk8.onrender.com/api';
};

// Create axios instance with base configuration
const api = axios.create({
  baseURL: getBaseURL(),
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 90000, // 90 seconds timeout to handle Render cold starts (free tier can take 60+ seconds)
});

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = sessionStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    // Handle timeout errors (server cold start)
    if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
      console.error('Request timeout - Server may be waking up from sleep');
      error.userMessage = 'Server is starting up. Please try again in a moment.';
    }
    
    // Handle network errors (server offline)
    if (!error.response && error.message === 'Network Error') {
      console.error('Network error - Server may be offline');
      error.userMessage = 'Unable to connect to server. Please check your internet connection.';
    }
    
    // Handle common errors
    if (error.response?.status === 401) {
      // Handle unauthorized access
      sessionStorage.removeItem('authToken');
      sessionStorage.removeItem('user');
      sessionStorage.removeItem('isLoggedIn');
      window.location.href = '/login';
    }
    
    // Handle server errors
    if (error.response?.status >= 500) {
      console.error('Server error:', error.response.status);
      error.userMessage = 'Server error. Please try again later.';
    }
    
    return Promise.reject(error);
  }
);

// Machine API
export const machineAPI = {
  // Get all machines with optional filters
  getAll: (params = {}) => api.get('/machines', { params }),
  
  // Get single machine by ID
  getById: (id) => api.get(`/machines/${id}`),
  
  // Create new machine
  create: (data) => api.post('/machines', data),
  
  // Update machine
  update: (id, data) => api.put(`/machines/${id}`, data),
  
  // Delete machine
  delete: (id) => api.delete(`/machines/${id}`),
  
  // Get machine categories
  getCategories: () => api.get('/machines/categories'),
};

// Customer API
export const customerAPI = {
  // Get all customers with optional filters
  getAll: (params = {}) => api.get('/customers', { params }),
  
  // Get single customer by ID
  getById: (id) => api.get(`/customers/${id}`),
  
  // Create new customer
  create: (data) => api.post('/customers', data),
  
  // Update customer
  update: (id, data) => api.put(`/customers/${id}`, data),
  
  // Delete customer
  delete: (id) => api.delete(`/customers/${id}`),
  
  // Get customer statistics
  getStats: () => api.get('/customers/stats'),
};

// Sales API
export const salesAPI = {
  // Process a sale
  process: (data) => api.post('/sales', data),
  
  // Validate sale data
  validate: (data) => api.post('/sales/validate', data),
  
  // Get sales statistics
  getStats: () => api.get('/sales/stats'),
};

// Past Orders API
export const pastOrdersAPI = {
  // Get all past orders with optional filters
  getAll: (params = {}) => api.get('/past-orders', { params }),
  
  // Get single order by ID
  getById: (id) => api.get(`/past-orders/${id}`),
  
  // Get order by order ID
  getByOrderId: (orderId) => api.get(`/past-orders/order/${orderId}`),
  
  // Update order status
  updateStatus: (id, data) => api.patch(`/past-orders/${id}/status`, data),
  
  // Get order statistics
  getStats: () => api.get('/past-orders/stats'),
  
  // Get orders by date range
  getByDateRange: (params) => api.get('/past-orders/range', { params }),
  
  // Get machine sales statistics
  getMachineSalesStats: (machineId) => api.get(`/past-orders/machine-stats/${machineId}`),
  
  // Cancel order
  cancel: (id) => api.delete(`/past-orders/${id}`),
  
  // Return item from order
  returnItem: (orderId, data) => api.put(`/past-orders/return-item/${orderId}`, data),
  
  // Update/Edit order
  update: (orderId, data) => api.put(`/past-orders/${orderId}`, data),
  // Update payment for an order
  updatePayment: (orderId, data) => api.patch(`/past-orders/${orderId}/payment`, data),
};

// Refund API
export const refundAPI = {
  // Get all refunds with optional filters
  getAll: (params = {}) => api.get('/refunds', { params }),
  
  // Get single refund by ID
  getById: (id) => api.get(`/refunds/${id}`),
  
  // Create new refund
  create: (data) => api.post('/refunds', data),
  
  // Update refund
  update: (id, data) => api.put(`/refunds/${id}`, data),
  
  // Delete refund
  delete: (id) => api.delete(`/refunds/${id}`),
  
  // Get refund statistics
  getStats: () => api.get('/refunds/stats/summary'),
};

// User API
export const userAPI = {
  // Login user
  login: (data) => api.post('/users/login', data),
  
  // Get current user profile
  getCurrentUser: () => api.get('/users/me'),
  
  // Get all users
  getAll: (params = {}) => api.get('/users', { params }),
  
  // Get single user by ID
  getById: (id) => api.get(`/users/${id}`),
  
  // Create new user
  create: (data) => api.post('/users', data),
  
  // Update user
  update: (id, data) => api.put(`/users/${id}`, data),
  
  // Delete user
  delete: (id) => api.delete(`/users/${id}`),
};

// Dashboard API
export const dashboardAPI = {
  // Get monthly revenue
  getMonthlyRevenue: () => api.get('/dashboard/monthly-revenue'),
  
  // Get total orders
  getTotalOrders: () => api.get('/dashboard/total-orders'),
  
  // Get low stock items
  getLowStock: () => api.get('/dashboard/low-stock'),
  
  // Get total items
  getTotalItems: () => api.get('/dashboard/total-items'),
  
  // Get monthly graph data
  getMonthlyGraph: () => api.get('/dashboard/monthly-graph'),
};

// Error handler utility
export const handleApiError = (error) => {
  if (error.response) {
    // Server responded with error status
    const message = error.response.data?.message || 'An error occurred';
    const errors = error.response.data?.errors || [];
    
    return {
      message,
      errors,
      status: error.response.status,
      data: error.response.data
    };
  } else if (error.request) {
    // Request made but no response received
    return {
      message: 'Network error - please check your connection',
      errors: [],
      status: null,
      data: null
    };
  } else {
    // Something else happened
    return {
      message: error.message || 'An unexpected error occurred',
      errors: [],
      status: null,
      data: null
    };
  }
};

export default api;