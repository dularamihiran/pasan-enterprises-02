const express = require('express');
const cors = require('cors');
require('dotenv').config();

// Import database connection
const connectDB = require('./db');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
// Allow origins from environment variable or defaults
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',').map(origin => origin.trim())
  : [
      'http://localhost:3000',
      process.env.FRONTEND_URL
    ].filter(Boolean);

app.use(cors({
origin: true,
credentials: true
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Connect to MongoDB Atlas
connectDB();

// Basic route
app.get('/', (req, res) => {
  res.json({ 
    message: '🚀 Pasan Enterprises API Server is running!',
    status: 'Active',
    timestamp: new Date().toISOString()
  });
});

// Health check route
app.get('/health', (req, res) => {
  const mongoose = require('mongoose');
  res.json({
    status: 'OK',
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    timestamp: new Date().toISOString()
  });
});

// Import route files
const userRoutes = require('./routes/users');
const productRoutes = require('./routes/products');
const machineRoutes = require('./routes/machines');
const customerRoutes = require('./routes/customers');
const salesRoutes = require('./routes/sales');
const pastOrderRoutes = require('./routes/pastOrders');
const dashboardRoutes = require('./routes/dashboard');
const categoriesRoutes = require('./routes/categories');
const refundRoutes = require('./routes/refunds');

// Use routes
app.use('/api/users', userRoutes);
app.use('/api/products', productRoutes);
app.use('/api/machines', machineRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/sales', salesRoutes);
app.use('/api/past-orders', pastOrderRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/refunds', refundRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : {}
  });
});

// Start HTTP server (plain, Nginx will handle HTTPS)
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Node server running on port ${PORT}`);
  console.log(`🌐 API available at http://localhost:${PORT}`);
  console.log(`📚 Health check: http://localhost:${PORT}/health`);
  
  // Log schema information for debugging
  try {
    const Machine = require('./models/Machine');
    const categoryEnums = Machine.schema.path('category').enumValues;
    console.log('\n📋 Machine Category Enum Values:');
    console.log(`   Count: ${categoryEnums ? categoryEnums.length : 0}`);
    console.log(`   Values:`, categoryEnums);
  } catch (error) {
    console.error('⚠️  Error loading Machine schema:', error.message);
  }
});

module.exports = app;
