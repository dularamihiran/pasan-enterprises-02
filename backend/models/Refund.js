const mongoose = require('mongoose');

// Schema for refund records
const refundSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PastOrder',
    required: [true, 'Order ID is required']
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: [true, 'Customer ID is required']
  },
  // Store customer snapshot for historical accuracy
  customerInfo: {
    name: {
      type: String,
      required: true,
      trim: true
    },
    phone: {
      type: String,
      required: true,
      trim: true
    },
    email: {
      type: String,
      trim: true
    }
  },
  // Store order snapshot
  orderInfo: {
    orderId: {
      type: String,
      required: true
    },
    originalTotal: {
      type: Number,
      required: true,
      min: [0, 'Original total cannot be negative']
    }
  },
  originalAmount: {
    type: Number,
    required: [true, 'Original amount is required'],
    min: [0, 'Original amount cannot be negative']
  },
  refundAmount: {
    type: Number,
    required: [true, 'Refund amount is required'],
    min: [0, 'Refund amount cannot be negative']
  },
  refundReason: {
    type: String,
    trim: true,
    maxlength: [500, 'Refund reason cannot exceed 500 characters'],
    default: ''
  },
  refundDate: {
    type: Date,
    default: Date.now,
    required: true
  },
  refundStatus: {
    type: String,
    enum: ['pending', 'refunded', 'approved', 'completed', 'rejected'],
    default: 'pending'
  },
  refundType: {
    type: String,
    enum: ['full', 'partial'],
    default: 'full'
  },
  processedBy: {
    type: String,
    trim: true,
    default: 'System'
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [1000, 'Notes cannot exceed 1000 characters']
  }
}, {
  timestamps: true // Adds createdAt and updatedAt fields
});

// Indexes for better query performance
refundSchema.index({ orderId: 1 });
refundSchema.index({ customerId: 1 });
refundSchema.index({ refundDate: -1 });
refundSchema.index({ refundStatus: 1 });
refundSchema.index({ createdAt: -1 });

// Virtual for refund percentage
refundSchema.virtual('refundPercentage').get(function() {
  if (this.originalAmount === 0) return 0;
  return ((this.refundAmount / this.originalAmount) * 100).toFixed(2);
});

// Pre-save validation to ensure refund amount doesn't exceed original amount
refundSchema.pre('save', function(next) {
  if (this.refundAmount > this.originalAmount) {
    next(new Error('Refund amount cannot exceed original amount'));
  }
  
  // Auto-determine refund type
  if (this.refundAmount === this.originalAmount) {
    this.refundType = 'full';
  } else {
    this.refundType = 'partial';
  }
  
  next();
});

// Static method to get refunds by date range
refundSchema.statics.getRefundsByDateRange = function(startDate, endDate) {
  return this.find({
    refundDate: {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    }
  }).sort({ refundDate: -1 });
};

// Static method to get customer's refund history
refundSchema.statics.getCustomerRefunds = function(customerId) {
  return this.find({ customerId }).sort({ refundDate: -1 });
};

// Static method to calculate total refunds for a period
refundSchema.statics.getTotalRefundsForPeriod = async function(startDate, endDate) {
  const result = await this.aggregate([
    {
      $match: {
        refundDate: {
          $gte: new Date(startDate),
          $lte: new Date(endDate)
        },
        refundStatus: { $in: ['approved', 'completed'] } // Only count approved/completed refunds
      }
    },
    {
      $group: {
        _id: null,
        totalRefundAmount: { $sum: '$refundAmount' },
        refundCount: { $sum: 1 }
      }
    }
  ]);

  return result[0] || { totalRefundAmount: 0, refundCount: 0 };
};

// Ensure virtual fields are serialized
refundSchema.set('toJSON', { virtuals: true });
refundSchema.set('toObject', { virtuals: true });

module.exports = mongoose.model('Refund', refundSchema);
