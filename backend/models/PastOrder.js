const mongoose = require('mongoose');
const Counter = require('./Counter');

// Uppercase 3-letter month abbreviations for order ID generation
const MONTH_ABBREVIATIONS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
                             'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

// Schema for individual items in an order
const orderItemSchema = new mongoose.Schema({
  machineId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Machine',
    required: true
  },
  itemId: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: [1, 'Quantity must be at least 1']
  },
  unitPrice: {
    type: Number,
    required: true,
    min: [0, 'Unit price cannot be negative']
  },
  // Per-item VAT percentage (default 18%)
  vatPercentage: {
    type: Number,
    default: 18,
    min: [0, 'VAT percentage cannot be negative'],
    max: [100, 'VAT percentage cannot exceed 100']
  },
  // Per-item VAT amount
  vatAmount: {
    type: Number,
    default: 0,
    min: [0, 'VAT amount cannot be negative']
  },
  // Warranty in months (default 12 months)
  warrantyMonths: {
    type: Number,
    default: 12,
    min: [0, 'Warranty months cannot be negative']
  },
  subtotal: {
    type: Number,
    required: true,
    min: [0, 'Subtotal cannot be negative']
  },
  // Total price including VAT for this item
  totalWithVAT: {
    type: Number,
    default: 0,
    min: [0, 'Total with VAT cannot be negative']
  },
  // Return tracking
  returned: {
    type: Boolean,
    default: false
  },
  returnedQuantity: {
    type: Number,
    default: 0,
    min: [0, 'Returned quantity cannot be negative']
  },
  returnedAt: {
    type: Date
  },
  // Per-unit prices (stored to maintain accuracy after returns)
  machine_price_per_unit: {
    type: Number,
    min: [0, 'Machine price per unit cannot be negative']
  },
  vat_per_unit: {
    type: Number,
    min: [0, 'VAT per unit cannot be negative']
  },
  original_quantity: {
    type: Number,
    min: [1, 'Original quantity must be at least 1']
  },
  // Machine note/description (optional)
  note: {
    type: String,
    trim: true,
    maxlength: [1200, 'Note cannot exceed 1200 characters'],
    default: ''
  }
}, { _id: false }); // Don't create separate _id for sub-documents

// Schema for extra charges
const extraChargeSchema = new mongoose.Schema({
  description: {
    type: String,
    required: [true, 'Extra charge description is required'],
    trim: true,
    maxlength: [200, 'Description cannot exceed 200 characters']
  },
  amount: {
    type: Number,
    required: [true, 'Extra charge amount is required'],
    min: [0, 'Extra charge amount cannot be negative']
  }
}, { _id: false });

// Main PastOrder schema
const pastOrderSchema = new mongoose.Schema({
  orderId: {
    type: String,
    unique: true // Index defined here. Generated in pre-save hook (see below).
  },
  customerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Customer',
    required: true
  },
  // Store customer snapshot at time of order (for historical accuracy)
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
    },
    nic: {
      type: String,
      trim: true,
      uppercase: true
    },
    address: {
      type: String,
      trim: true
    }
  },
  items: [orderItemSchema],
  extras: [extraChargeSchema],
  subtotal: {
    type: Number,
    required: true,
    min: 0
  },
  vatRate: {
    type: Number,
    default: 15, // 15% VAT
    min: 0,
    max: 100
  },
  vatAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  totalBeforeDiscount: {
    type: Number,
    default: 0,
    min: 0
  },
  discountAmount: {
    type: Number,
    default: 0,
    min: 0
  },
  extrasTotal: {
    type: Number,
    default: 0,
    min: 0
  },
  total: {
    type: Number,
    required: true,
    min: [0, 'Total amount cannot be negative']
  },
  finalTotal: {
    type: Number,
    required: true,
    min: [0, 'Final total cannot be negative']
  },
  // Payment / financing fields
  paymentType: {
    type: String,
    enum: ['full', 'partial'],
    default: 'full'
  },
  paidAmount: {
    type: Number,
    default: 0,
    min: [0, 'Paid amount cannot be negative']
  },
  remainingAmount: {
    type: Number,
    default: 0,
    min: [0, 'Remaining amount cannot be negative']
  },
  paymentPeriodDays: {
    type: Number,
    default: 60,
    min: [0, 'Payment period cannot be negative']
  },
  dueDate: {
    type: Date
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'partial', 'full'],
    default: 'pending'
  },
  // Payment history to store incremental payments and timestamps
  paymentHistory: [{
    amount: { type: Number, required: true, min: 0 },
    date: { type: Date, default: Date.now },
    updatedBy: { type: String, default: 'System' }
  }],
    // Payment method
    paymentMethod: {
      type: String,
      enum: ['cash', 'bank transfer', 'cheque'],
      default: 'cash'
    },
    // cheque number (only populated if paymentMethod is 'cheque')
    chequeNumber: {
      type: String,
      trim: true,
      sparse: true // Allow null values for non-cheque payments
    },
  orderStatus: {
    type: String,
    enum: ['Completed', 'Processing', 'Cancelled', 'Returned'],
    default: 'Completed'
  },
  notes: {
    type: String,
    trim: true,
    maxlength: [500, 'Notes cannot exceed 500 characters']
  },
  processedBy: {
    type: String,
    trim: true,
    default: 'System'
  }
}, {
  timestamps: true // This adds createdAt and updatedAt fields
});

// Indexes for better query performance
pastOrderSchema.index({ customerId: 1 });
// orderId index is now defined in the schema field itself with unique: true
pastOrderSchema.index({ createdAt: -1 });
pastOrderSchema.index({ 'customerInfo.phone': 1 });
pastOrderSchema.index({ 'customerInfo.name': 'text' });
pastOrderSchema.index({ 'items.machineId': 1 }); // Index for machine sales stats queries

// Pre-save middleware to generate a sequential order ID.
// Format: YYMMM_PEIA_XXXX (e.g. 26JUL_PEIA_0001) where XXXX is a
// per-month sequence that resets at the start of each calendar month.
pastOrderSchema.pre('save', async function(next) {
  if (!this.isNew || this.orderId) {
    return next();
  }

  try {
    const date = this.createdAt || new Date();
    const yy = date.getFullYear().toString().slice(-2);
    const mmm = MONTH_ABBREVIATIONS[date.getMonth()];

    // Counter key is unique per calendar year+month so the sequence
    // resets on the 1st of every month.
    const counterKey = `orderId-${yy}${mmm}`;
    const seq = await Counter.getNextSequence(counterKey, this.$session());

    this.orderId = `${yy}${mmm}_PEIA_${seq.toString().padStart(4, '0')}`;
    next();
  } catch (err) {
    next(err);
  }
});

// Pre-save middleware to calculate totals
pastOrderSchema.pre('save', function(next) {
  console.log(`\n🔄 Pre-Save Middleware Running for Order: ${this.orderId}`);
  
  let currentSubtotal = 0;   // Subtotal after returns
  let currentVatAmount = 0;  // VAT after returns
  let originalSubtotal = 0;  // Original subtotal (before returns)
  let originalVatAmount = 0; // Original VAT (before returns)
  let returnedValue = 0;     // Total value of returned items (incl VAT)
  
  // Calculate per-item VAT and totals
  this.items.forEach((item, index) => {
    // The unitPrice stored already includes VAT
    // Calculate VAT amount: VAT = (VAT% / 100) × Unit Price
    const vatAmountPerUnit = (item.vatPercentage / 100) * item.unitPrice;
    
    // Calculate base price: Base Price = Unit Price - VAT
    const basePricePerUnit = item.unitPrice - vatAmountPerUnit;
    
    // Unit price including VAT
    const unitPriceInclVAT = item.unitPrice;
    
    // Calculate quantities
    const originalQuantity = item.quantity;
    const returnedQuantity = item.returnedQuantity || 0;
    const actualQuantity = originalQuantity - returnedQuantity;
    
    console.log(`   📦 Item ${index + 1}: ${item.machineId}`);
    console.log(`      Original Quantity: ${originalQuantity}`);
    console.log(`      Returned Quantity: ${returnedQuantity}`);
    console.log(`      Actual Quantity: ${actualQuantity}`);
    console.log(`      Unit Price (with VAT): ${unitPriceInclVAT}`);
    console.log(`      Base Price per Unit: ${basePricePerUnit.toFixed(2)}`);
    console.log(`      VAT per Unit: ${vatAmountPerUnit.toFixed(2)}`);
    
    // Calculate ORIGINAL totals (before any returns)
    originalSubtotal += basePricePerUnit * originalQuantity;
    originalVatAmount += vatAmountPerUnit * originalQuantity;
    
    // Calculate CURRENT totals (after returns)
    currentSubtotal += basePricePerUnit * actualQuantity;
    currentVatAmount += vatAmountPerUnit * actualQuantity;
    
    // Calculate RETURNED value (unit price incl VAT × returned quantity)
    returnedValue += unitPriceInclVAT * returnedQuantity;
    
    // Store per-item values for CURRENT state (after returns)
    // NOTE: These represent the current totals, not per-unit values
    item.subtotal = basePricePerUnit * actualQuantity;
    item.vatAmount = vatAmountPerUnit * actualQuantity;
    item.totalWithVAT = unitPriceInclVAT * actualQuantity;
    
    // Store per-unit values (these should NEVER change regardless of returns)
    // This ensures frontend can always calculate correctly
    if (!item.machine_price_per_unit) {
      item.machine_price_per_unit = basePricePerUnit;
    }
    if (!item.vat_per_unit) {
      item.vat_per_unit = vatAmountPerUnit;
    }
    if (!item.original_quantity && !item.returnedQuantity) {
      // First time, store original quantity
      item.original_quantity = item.quantity;
    }
    
    console.log(`      Original Item Total (incl VAT): ${(unitPriceInclVAT * originalQuantity).toFixed(2)}`);
    console.log(`      Returned Value: ${(unitPriceInclVAT * returnedQuantity).toFixed(2)}`);
    console.log(`      Current Item Subtotal: ${item.subtotal.toFixed(2)}`);
    console.log(`      Item VAT Amount: ${item.vatAmount.toFixed(2)}`);
    console.log(`      Stored machine_price_per_unit: ${item.machine_price_per_unit}`);
    console.log(`      Stored vat_per_unit: ${item.vat_per_unit}`);
  });
  
  // STEP 1: Calculate original total before discount
  const originalTotalBeforeDiscount = originalSubtotal + originalVatAmount;
  
  // STEP 2: Use the discount amount directly (no percentage calculation)
  // Cap discount to not exceed the original total before discount
  const discountAmount = Math.min(this.discountAmount || 0, originalTotalBeforeDiscount);
  this.discountAmount = discountAmount;
  
  // Calculate extras total
  this.extrasTotal = this.extras.reduce((sum, extra) => sum + extra.amount, 0);
  
  // STEP 3: Calculate final total (ORIGINAL - keep this as the actual amount customer paid)
  // DO NOT reduce finalTotal for returns - refund system handles revenue reduction
  const finalTotalBeforeReturn = originalTotalBeforeDiscount - discountAmount + this.extrasTotal;
  
  // Keep finalTotal as the original amount (what customer actually paid)
  // This ensures dashboard revenue is accurate (only reduced by approved refunds)
  this.finalTotal = finalTotalBeforeReturn;
  
  // Store current totals in order (for display purposes - shows active order value after returns)
  this.subtotal = currentSubtotal;
  this.vatAmount = currentVatAmount;
  this.totalBeforeDiscount = currentSubtotal + currentVatAmount;
  
  // Calculate total (for backward compatibility)
  this.total = this.subtotal + this.extrasTotal;
  
  console.log(`\n💰 Order Calculation Summary:`);
  console.log(`   ================================`);
  console.log(`   ORIGINAL ORDER (before returns):`);
  console.log(`   Original Subtotal: ${originalSubtotal.toFixed(2)}`);
  console.log(`   Original VAT: ${originalVatAmount.toFixed(2)}`);
  console.log(`   Original Total Before Discount: ${originalTotalBeforeDiscount.toFixed(2)}`);
  console.log(`   Discount Amount: -Rs. ${discountAmount.toFixed(2)}`);
  console.log(`   Extras: +${this.extrasTotal.toFixed(2)}`);
  console.log(`   Final Total Before Return: ${finalTotalBeforeReturn.toFixed(2)}`);
  console.log(`   ================================`);
  console.log(`   RETURNS:`);
  console.log(`   Returned Value: -${returnedValue.toFixed(2)}`);
  console.log(`   ================================`);
  console.log(`   CURRENT ORDER (after returns):`);
  console.log(`   Current Subtotal: ${this.subtotal.toFixed(2)}`);
  console.log(`   Current VAT: ${this.vatAmount.toFixed(2)}`);
  console.log(`   Current Total Before Discount: ${this.totalBeforeDiscount.toFixed(2)}`);
  console.log(`   Discount Amount: -Rs. ${this.discountAmount.toFixed(2)}`);
  console.log(`   Extras: +${this.extrasTotal.toFixed(2)}`);
  console.log(`   ================================`);
  console.log(`   ✅ FINAL TOTAL: ${this.finalTotal.toFixed(2)}`);
  console.log(`   ================================`);
  console.log(`🆔 Order ID: ${this.orderId}\n`);
  
  next();
});

// Virtual for order summary
pastOrderSchema.virtual('orderSummary').get(function() {
  const itemCount = this.items.reduce((sum, item) => sum + item.quantity, 0);
  return {
    itemCount,
    uniqueItems: this.items.length,
    hasExtras: this.extras.length > 0,
    formattedTotal: `Rs. ${this.total.toFixed(2)}`
  };
});

// Virtual for customer display name
pastOrderSchema.virtual('customerDisplay').get(function() {
  return `${this.customerInfo.name} (${this.customerInfo.phone})`;
});

// Static method to get orders by date range
pastOrderSchema.statics.getOrdersByDateRange = function(startDate, endDate) {
  return this.find({
    createdAt: {
      $gte: new Date(startDate),
      $lte: new Date(endDate)
    }
  }).sort({ createdAt: -1 });
};

// Static method to get customer's order history
pastOrderSchema.statics.getCustomerOrders = function(customerId) {
  return this.find({ customerId }).sort({ createdAt: -1 });
};

// Ensure virtual fields are serialized
pastOrderSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('PastOrder', pastOrderSchema);