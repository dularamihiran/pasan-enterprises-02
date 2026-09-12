const mongoose = require('mongoose');
const { MACHINE_CATEGORIES } = require('../constants/categories');

const machineSchema = new mongoose.Schema({
  itemId: {
    type: String,
    required: [true, 'Item ID is required'],
    unique: true,
    trim: true
  },
  name: {
    type: String,
    required: [true, 'Machine name is required'],
    trim: true
  },
  category: {
    type: String,
    required: [true, 'Category is required'],
    trim: true,
    enum: {
      values: MACHINE_CATEGORIES,
      message: 'Category must be one of the predefined values. Received: {VALUE}'
    }
  },
  description: {
    type: String,
    required: [true, 'Description is required'],
    trim: true
  },
  dateAdded: {
    type: Date,
    default: Date.now
  },
  price: {
    type: Number,
    required: [true, 'Price is required'],
    min: [0, 'Price cannot be negative']
  },
  quantity: {
    type: Number,
    required: [true, 'Quantity is required'],
    min: [0, 'Quantity cannot be negative'],
    default: 0
  }
}, {
  timestamps: true // This adds createdAt and updatedAt fields automatically
});

// Index for better query performance
// Note: itemId index is automatically created due to unique: true
machineSchema.index({ category: 1 });
machineSchema.index({ name: 'text', description: 'text' });

// Virtual for stock status
machineSchema.virtual('stockStatus').get(function() {
  if (this.quantity === 0) return 'Out of Stock';
  if (this.quantity <= 5) return 'Low Stock';
  return 'In Stock';
});

// Ensure virtual fields are serialized
machineSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('Machine', machineSchema);