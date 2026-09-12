const PastOrder = require('../models/PastOrder');
const Machine = require('../models/Machine');
const Refund = require('../models/Refund');

// @desc    Get all past orders
// @route   GET /api/past-orders
// @access  Public
const getAllOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const customerId = req.query.customerId;
    const startDate = req.query.startDate;
    const endDate = req.query.endDate;
    const status = req.query.status;
    const search = req.query.search;
    const fromDate = req.query.fromDate;
    const toDate = req.query.toDate;
    const paymentFilter = req.query.paymentFilter;

    // Build query
    let query = {};
    
    if (customerId) {
      query.customerId = customerId;
    }
    
    // Handle date range (support both old and new parameter names)
    const dateStart = fromDate || startDate;
    const dateEnd = toDate || endDate;
    
    if (dateStart || dateEnd) {
      query.createdAt = {};
      if (dateStart) {
        const fromDateTime = new Date(dateStart);
        fromDateTime.setHours(0, 0, 0, 0);
        query.createdAt.$gte = fromDateTime;
      }
      if (dateEnd) {
        const toDateTime = new Date(dateEnd);
        toDateTime.setHours(23, 59, 59, 999);
        query.createdAt.$lte = toDateTime;
      }
    }
    
    if (status && status !== 'all') {
      query.orderStatus = status;
    }
    
    if (search) {
      query.$or = [
        { orderId: { $regex: search, $options: 'i' } },
        { 'customerInfo.name': { $regex: search, $options: 'i' } },
        { 'customerInfo.phone': { $regex: search, $options: 'i' } },
        { 'items.name': { $regex: search, $options: 'i' } }
      ];
    }

    // Calculate skip for pagination
    const skip = (page - 1) * limit;

    // Execute query with pagination and populate customer
    let orders = await PastOrder.find(query)
      .populate('customerId', 'name phone email vatNo')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    // Apply payment filter if specified (processing or completed)
    if (paymentFilter && paymentFilter !== 'all') {
      // For payment filtering, we need to fetch more orders and filter them
      // So let's re-query without pagination first
      const allMatchingOrders = await PastOrder.find(query)
        .populate('customerId', 'name phone email vatNo')
        .sort({ createdAt: -1 });
      
      // Filter based on payment status
      const filteredOrders = allMatchingOrders.filter(order => {
        const paidAmount = Number(order.paidAmount || order.paid_amount || 0);
        const finalTotal = order.finalTotal || order.total || 0;
        const remainingAmount = finalTotal - paidAmount;
        
        // Check if all items are returned
        const allItemsReturned = order.items && order.items.length > 0 && 
          order.items.every(item => {
            const originalQty = Number(item.original_quantity ?? item.quantity ?? item.originalQuantity ?? 0);
            const returnedQty = Number(item.returned_quantity ?? item.returnedQuantity ?? 0);
            const isFullyReturned = item.returned === true || returnedQty >= originalQty;
            return isFullyReturned;
          });
        
        if (paymentFilter === 'processing') {
          // Processing: NOT fully paid AND items still active (not all returned)
          return remainingAmount > 0 && !allItemsReturned;
        } else if (paymentFilter === 'completed') {
          // Completed: full payment OR all items returned (order is effectively closed)
          return remainingAmount <= 0 || allItemsReturned;
        }
        
        return true;
      });
      
      // Apply pagination to filtered results
      const total = filteredOrders.length;
      orders = filteredOrders.slice(skip, skip + limit);
      
      // Correct orderStatus based on payment status for each order
      const correctedOrders = orders.map(order => {
        const orderObj = order.toObject ? order.toObject() : order;
        
        // If order has remaining amount but status is 'Completed', change to 'Processing'
        if (orderObj.orderStatus === 'Completed' && 
            orderObj.remainingAmount && 
            orderObj.remainingAmount > 0) {
          orderObj.orderStatus = 'Processing';
        }
        
        // If order has no remaining amount but status is 'Processing', change to 'Completed'
        if (orderObj.orderStatus === 'Processing' && 
            (!orderObj.remainingAmount || orderObj.remainingAmount === 0)) {
          orderObj.orderStatus = 'Completed';
        }
        
        return orderObj;
      });
      
      return res.json({
        success: true,
        count: correctedOrders.length,
        total,
        page,
        pages: Math.ceil(total / limit),
        data: correctedOrders
      });
    }

    // Correct orderStatus based on payment status for each order
    const correctedOrders = orders.map(order => {
      const orderObj = order.toObject();
      
      // If order has remaining amount but status is 'Completed', change to 'Processing'
      if (orderObj.orderStatus === 'Completed' && 
          orderObj.remainingAmount && 
          orderObj.remainingAmount > 0) {
        orderObj.orderStatus = 'Processing';
      }
      
      // If order has no remaining amount but status is 'Processing', change to 'Completed'
      if (orderObj.orderStatus === 'Processing' && 
          (!orderObj.remainingAmount || orderObj.remainingAmount === 0)) {
        orderObj.orderStatus = 'Completed';
      }
      
      return orderObj;
    });

    // Get total count for pagination info
    const total = await PastOrder.countDocuments(query);

    res.json({
      success: true,
      count: correctedOrders.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: correctedOrders
    });
  } catch (error) {
    console.error('Error fetching orders:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Get single order by ID
// @route   GET /api/past-orders/:id
// @access  Public
const getOrderById = async (req, res) => {
  try {
    const order = await PastOrder.findById(req.params.id)
      .populate('customerId', 'name phone email nic totalOrders totalSpent')
      .populate('items.machineId', 'itemId name category');
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Correct orderStatus based on payment status
    const orderObj = order.toObject();
    
    // If order has remaining amount but status is 'Completed', change to 'Processing'
    if (orderObj.orderStatus === 'Completed' && 
        orderObj.remainingAmount && 
        orderObj.remainingAmount > 0) {
      orderObj.orderStatus = 'Processing';
    }
    
    // If order has no remaining amount but status is 'Processing', change to 'Completed'
    if (orderObj.orderStatus === 'Processing' && 
        (!orderObj.remainingAmount || orderObj.remainingAmount === 0)) {
      orderObj.orderStatus = 'Completed';
    }

    res.json({
      success: true,
      data: orderObj
    });
  } catch (error) {
    console.error('Error fetching order:', error);
    
    if (error.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Get order by order ID
// @route   GET /api/past-orders/order/:orderId
// @access  Public
const getOrderByOrderId = async (req, res) => {
  try {
    const order = await PastOrder.findOne({ orderId: req.params.orderId })
      .populate('customerId', 'name phone email nic')
      .populate('items.machineId', 'itemId name category');
    
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Correct orderStatus based on payment status
    const orderObj = order.toObject();
    
    // If order has remaining amount but status is 'Completed', change to 'Processing'
    if (orderObj.orderStatus === 'Completed' && 
        orderObj.remainingAmount && 
        orderObj.remainingAmount > 0) {
      orderObj.orderStatus = 'Processing';
    }
    
    // If order has no remaining amount but status is 'Processing', change to 'Completed'
    if (orderObj.orderStatus === 'Processing' && 
        (!orderObj.remainingAmount || orderObj.remainingAmount === 0)) {
      orderObj.orderStatus = 'Completed';
    }

    res.json({
      success: true,
      data: orderObj
    });
  } catch (error) {
    console.error('Error fetching order by orderId:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Update order status
// @route   PATCH /api/past-orders/:id/status
// @access  Public
const updateOrderStatus = async (req, res) => {
  try {
    const { orderStatus, paymentStatus, notes } = req.body;

    const updateData = {};
    if (orderStatus) updateData.orderStatus = orderStatus;
    if (paymentStatus) updateData.paymentStatus = paymentStatus;
    if (notes !== undefined) updateData.notes = notes;

    const order = await PastOrder.findByIdAndUpdate(
      req.params.id,
      updateData,
      { new: true, runValidators: true }
    ).populate('customerId', 'name phone email');

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.json({
      success: true,
      message: 'Order updated successfully',
      data: order
    });
  } catch (error) {
    console.error('Error updating order:', error);
    
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation Error',
        errors
      });
    }
    
    if (error.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Get orders statistics
// @route   GET /api/past-orders/stats
// @access  Public
const getOrderStats = async (req, res) => {
  try {
    const today = new Date();
    const startOfDay = new Date(today.setHours(0, 0, 0, 0));
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const startOfYear = new Date(today.getFullYear(), 0, 1);

    // Total orders and revenue
    const totalOrders = await PastOrder.countDocuments();
    const totalRevenue = await PastOrder.aggregate([
      { $group: { _id: null, total: { $sum: "$total" } } }
    ]);

    // Today's stats
    const todayOrders = await PastOrder.countDocuments({
      createdAt: { $gte: startOfDay }
    });
    const todayRevenue = await PastOrder.aggregate([
      { $match: { createdAt: { $gte: startOfDay } } },
      { $group: { _id: null, total: { $sum: "$total" } } }
    ]);

    // This month's stats
    const monthOrders = await PastOrder.countDocuments({
      createdAt: { $gte: startOfMonth }
    });
    const monthRevenue = await PastOrder.aggregate([
      { $match: { createdAt: { $gte: startOfMonth } } },
      { $group: { _id: null, total: { $sum: "$total" } } }
    ]);

    // Top selling items
    const topItems = await PastOrder.aggregate([
      { $unwind: "$items" },
      { 
        $group: { 
          _id: "$items.name", 
          totalSold: { $sum: "$items.quantity" },
          revenue: { $sum: "$items.subtotal" }
        } 
      },
      { $sort: { totalSold: -1 } },
      { $limit: 10 }
    ]);

    // Recent orders
    const recentOrders = await PastOrder.find()
      .sort({ createdAt: -1 })
      .limit(5)
      .select('orderId customerInfo.name total orderStatus createdAt');

    res.json({
      success: true,
      data: {
        overview: {
          totalOrders,
          totalRevenue: totalRevenue[0]?.total || 0,
          todayOrders,
          todayRevenue: todayRevenue[0]?.total || 0,
          monthOrders,
          monthRevenue: monthRevenue[0]?.total || 0
        },
        topItems,
        recentOrders
      }
    });
  } catch (error) {
    console.error('Error fetching order stats:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Get orders by date range
// @route   GET /api/past-orders/range
// @access  Public
const getOrdersByDateRange = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    
    if (!startDate || !endDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date and end date are required'
      });
    }

    const orders = await PastOrder.getOrdersByDateRange(startDate, endDate)
      .populate('customerId', 'name phone')
      .select('orderId customerInfo total orderStatus createdAt');

    const stats = await PastOrder.aggregate([
      {
        $match: {
          createdAt: {
            $gte: new Date(startDate),
            $lte: new Date(endDate)
          }
        }
      },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: "$total" },
          averageOrderValue: { $avg: "$total" }
        }
      }
    ]);

    res.json({
      success: true,
      count: orders.length,
      data: orders,
      stats: stats[0] || { totalOrders: 0, totalRevenue: 0, averageOrderValue: 0 }
    });
  } catch (error) {
    console.error('Error fetching orders by date range:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Delete order (soft delete by changing status)
// @route   DELETE /api/past-orders/:id
// @access  Public
const deleteOrder = async (req, res) => {
  try {
    const order = await PastOrder.findByIdAndUpdate(
      req.params.id,
      { orderStatus: 'Cancelled' },
      { new: true }
    );

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    res.json({
      success: true,
      message: 'Order cancelled successfully',
      data: order
    });
  } catch (error) {
    console.error('Error deleting order:', error);
    
    if (error.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Return an item from an order
// @route   PUT /api/past-orders/return-item/:orderId
// @access  Public
const returnItem = async (req, res) => {
  try {
    const { machineId, returnQuantity } = req.body;
    const { orderId } = req.params;

    // Validate request body
    if (!machineId) {
      return res.status(400).json({
        success: false,
        message: 'Machine ID is required'
      });
    }

    if (!returnQuantity || returnQuantity < 1) {
      return res.status(400).json({
        success: false,
        message: 'Return quantity must be at least 1'
      });
    }

    // Find the order
    const order = await PastOrder.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Find the item in the order
    const itemIndex = order.items.findIndex(
      item => item.machineId.toString() === machineId.toString()
    );

    if (itemIndex === -1) {
      return res.status(404).json({
        success: false,
        message: 'Item not found in this order'
      });
    }

    // Get the item details
    const returnedItem = order.items[itemIndex];
    
    // Calculate available quantity to return
    const currentReturnedQty = returnedItem.returnedQuantity || 0;
    const availableToReturn = returnedItem.quantity - currentReturnedQty;

    // Validate return quantity
    if (returnQuantity > availableToReturn) {
      return res.status(400).json({
        success: false,
        message: `Cannot return ${returnQuantity} units. Only ${availableToReturn} units available to return.`
      });
    }

    // ===== CALCULATE REFUND AMOUNT (for display purposes) =====
    // Calculate the price per unit (including VAT)
    const pricePerUnit = returnedItem.unitPrice; // This already includes VAT
    
    // Calculate the total refund amount for returned quantity (before discount)
    const returnAmountBeforeDiscount = pricePerUnit * returnQuantity;
    
    // Apply order discount if present - use direct discount amount
    // Calculate what percentage of the order this return represents
    const orderOriginalTotal = order.totalBeforeDiscount || (order.subtotal + order.vatAmount);
    const orderDiscountAmount = order.discountAmount || 0;
    const returnDiscountPortion = orderOriginalTotal > 0 ? (returnAmountBeforeDiscount / orderOriginalTotal) * orderDiscountAmount : 0;
    const returnAmount = returnAmountBeforeDiscount - returnDiscountPortion;
    
    // Calculate VAT amount per unit
    const vatAmountPerUnit = (returnedItem.vatPercentage / 100) * pricePerUnit;
    const basePricePerUnit = pricePerUnit - vatAmountPerUnit;
    
    // Calculate refund breakdown (after discount)
    const refundBaseAmount = (basePricePerUnit * returnQuantity) - (returnDiscountPortion * (basePricePerUnit / pricePerUnit));
    const refundVatAmount = (vatAmountPerUnit * returnQuantity) - (returnDiscountPortion * (vatAmountPerUnit / pricePerUnit));
    
    console.log(`💰 Refund Calculation:`);
    console.log(`   Unit Price (with VAT): ${pricePerUnit}`);
    console.log(`   Base Price per unit: ${basePricePerUnit.toFixed(2)}`);
    console.log(`   VAT per unit: ${vatAmountPerUnit.toFixed(2)}`);
    console.log(`   Return Quantity: ${returnQuantity}`);
    console.log(`   Order Discount Amount: Rs. ${orderDiscountAmount.toFixed(2)}`);
    console.log(`   Return Discount Portion: Rs. ${returnDiscountPortion.toFixed(2)}`);
    console.log(`   Return Amount Before Discount: ${returnAmountBeforeDiscount.toFixed(2)}`);
    console.log(`   Refund Base Amount (after discount): ${refundBaseAmount.toFixed(2)}`);
    console.log(`   Refund VAT Amount (after discount): ${refundVatAmount.toFixed(2)}`);
    console.log(`   Total Return Amount (after discount): ${returnAmount.toFixed(2)}`);

    // Store old final total for logging
    const oldFinalTotal = order.finalTotal;

    // Update returned quantity
    const newReturnedQuantity = currentReturnedQty + returnQuantity;
    order.items[itemIndex].returnedQuantity = newReturnedQuantity;
    
    // Mark as fully returned if all units are returned
    if (newReturnedQuantity >= returnedItem.quantity) {
      order.items[itemIndex].returned = true;
    }
    
    // Set returnedAt timestamp on first return
    if (!order.items[itemIndex].returnedAt) {
      order.items[itemIndex].returnedAt = new Date();
    }

    // Save the order - pre-save middleware will automatically recalculate totals
    // accounting for returnedQuantity
    await order.save();
    
    console.log(`📊 Order Totals Updated by Pre-Save Middleware:`);
    console.log(`   Old Final Total: ${oldFinalTotal.toFixed(2)}`);
    console.log(`   New Final Total: ${order.finalTotal.toFixed(2)}`);
    console.log(`   Reduction: ${(oldFinalTotal - order.finalTotal).toFixed(2)}`);

    // ===== HANDLE PARTIAL PAYMENT RECALCULATION =====
    const newFinalTotal = order.finalTotal;
    const oldPaidAmount = order.paidAmount || 0;
    const oldRemainingAmount = order.remainingAmount || 0;
    
    let newRemainingAmount = newFinalTotal - oldPaidAmount;
    let refundNeeded = 0;
    
    // If remaining becomes negative, customer overpaid and needs refund
    if (newRemainingAmount < 0) {
      refundNeeded = Math.abs(newRemainingAmount);
      newRemainingAmount = 0;
      
      console.log(`💸 REFUND NEEDED: Customer paid LKR ${oldPaidAmount.toFixed(2)} but new total is LKR ${newFinalTotal.toFixed(2)}`);
      console.log(`   Refund Amount: LKR ${refundNeeded.toFixed(2)}`);
    }
    
    // Update payment fields
    order.remainingAmount = Math.round(newRemainingAmount * 100) / 100;
    
    // Update payment status
    if (newRemainingAmount === 0 && refundNeeded === 0) {
      order.paymentStatus = 'full';
      order.orderStatus = 'Completed';
    } else if (oldPaidAmount > 0) {
      order.paymentStatus = 'partial';
      order.orderStatus = 'Processing';
    } else {
      order.paymentStatus = 'pending';
      order.orderStatus = 'Processing';
    }
    
    // Save payment updates
    await order.save();
    
    console.log(`💰 Payment Recalculated:`);
    console.log(`   Old Total: LKR ${oldFinalTotal.toFixed(2)}`);
    console.log(`   New Total: LKR ${newFinalTotal.toFixed(2)}`);
    console.log(`   Paid Amount: LKR ${oldPaidAmount.toFixed(2)}`);
    console.log(`   Old Remaining: LKR ${oldRemainingAmount.toFixed(2)}`);
    console.log(`   New Remaining: LKR ${newRemainingAmount.toFixed(2)}`);
    console.log(`   Refund Needed: LKR ${refundNeeded.toFixed(2)}`);
    console.log(`   Payment Status: ${order.paymentStatus}`);
    console.log(`   Order Status: ${order.orderStatus}`);

    // Update the machine stock - increase quantity
    const machine = await Machine.findById(machineId);

    if (!machine) {
      // Rollback the order change if machine not found
      order.items[itemIndex].returnedQuantity = currentReturnedQty;
      order.items[itemIndex].returned = false;
      order.items[itemIndex].returnedAt = undefined;
      
      // Restore old totals
      order.subtotal = oldSubtotal;
      order.vatAmount = oldVatAmount;
      order.totalBeforeDiscount = oldTotalBeforeDiscount;
      order.discountAmount = oldDiscountAmount;
      order.finalTotal = oldFinalTotal;
      order.total = oldSubtotal + order.extrasTotal;
      
      await order.save();
      
      return res.status(404).json({
        success: false,
        message: 'Machine not found in inventory'
      });
    }

    // Increase machine stock by the returned quantity
    machine.quantity += returnQuantity;
    await machine.save();

    console.log(`✅ Item returned: ${returnedItem.name} (Qty: ${returnQuantity} of ${returnedItem.quantity + newReturnedQuantity})`);
    console.log(`📦 Machine stock updated: ${machine.name} - New quantity: ${machine.quantity}`);

    // ===== CREATE REFUND RECORD (Status: Pending) =====
    // Refund is created for EVERY item return (not just when overpaid)
    // Revenue is NOT affected until refund is approved/completed in Refunds page
    let refundRecord = null;
    let isRefundUpdated = false;
    const refundAmountToCreate = returnAmount; // Use the actual item return value
    
    if (refundAmountToCreate > 0) {
      try {
        console.log(`\n💰 Creating refund record for returned items...`);
        console.log(`   Return Amount: LKR ${refundAmountToCreate.toFixed(2)}`);
        
        // Check if refund already exists for this order
        const existingRefund = await Refund.findOne({ orderId: order._id });
        
        if (existingRefund) {
          console.log(`ℹ️  Refund already exists for this order (ID: ${existingRefund._id})`);
          console.log(`   Existing Amount: LKR ${existingRefund.refundAmount.toFixed(2)}`);
          console.log(`   Adding new return amount: LKR ${refundAmountToCreate.toFixed(2)}`);
          
          // Update existing refund with additional return amount
          existingRefund.refundAmount += refundAmountToCreate;
          existingRefund.refundReason += `\n+ Item return - ${returnedItem.name} (${returnQuantity} units returned)`;
          existingRefund.notes = (existingRefund.notes || '') + `\nUpdated: ${new Date().toLocaleString()} - Additional return`;
          await existingRefund.save();
          
          refundRecord = existingRefund;
          isRefundUpdated = true;
          console.log(`✅ Updated existing refund. New total: LKR ${existingRefund.refundAmount.toFixed(2)}`);
        } else {
          // Create new refund record with PENDING status
          console.log(`   Creating NEW refund record...`);
          
          const newRefund = new Refund({
            orderId: order._id,
            customerId: order.customerId,
            customerInfo: {
              name: order.customerInfo?.name || 'Unknown',
              phone: order.customerInfo?.phone || '',
              email: order.customerInfo?.email || ''
            },
            orderInfo: {
              orderId: order.orderId,
              originalTotal: oldFinalTotal
            },
            originalAmount: oldFinalTotal,
            refundAmount: refundAmountToCreate,
            refundReason: `Item return - ${returnedItem.name} (${returnQuantity} units returned)`,
            refundDate: new Date(),
            refundStatus: 'pending', // PENDING - does not affect dashboard revenue yet
            processedBy: 'System',
            notes: `Auto-created from item return. Awaiting approval to affect revenue.`
          });
          
          await newRefund.save();
          refundRecord = newRefund;
          isRefundUpdated = false;
          console.log(`✅ Created PENDING refund record ID: ${newRefund._id}`);
          console.log(`   Amount: LKR ${refundAmountToCreate.toFixed(2)}`);
          console.log(`   Status: pending (revenue NOT affected yet)`);
        }
      } catch (refundError) {
        console.error('❌ Error creating refund record:', refundError);
        console.error('   Error details:', refundError.message);
        // Don't fail the return operation if refund creation fails
      }
    } else {
      console.log(`⚠️  No refund created (return amount is 0)`);
    }

    // Fetch updated order with populated data
    const updatedOrder = await PastOrder.findById(orderId)
      .populate('customerId', 'name phone email')
      .populate('items.machineId', 'itemId name category');

    res.json({
      success: true,
      message: refundRecord 
        ? `Item returned successfully. Refund record ${isRefundUpdated ? 'updated' : 'created'} (LKR ${refundRecord.refundAmount.toFixed(2)} - pending approval).` 
        : 'Item returned successfully.',
      data: {
        order: updatedOrder,
        returnedItem: {
          name: returnedItem.name,
          returnedQuantity: returnQuantity,
          totalReturnedSoFar: newReturnedQuantity,
          originalQuantity: returnedItem.quantity,
          refundAmount: returnAmount.toFixed(2),
          refundBreakdown: {
            baseAmount: refundBaseAmount.toFixed(2),
            vatAmount: refundVatAmount.toFixed(2)
          }
        },
        updatedStock: {
          machineName: machine.name,
          newQuantity: machine.quantity
        },
        orderTotals: {
          oldFinalTotal: oldFinalTotal.toFixed(2),
          newFinalTotal: order.finalTotal.toFixed(2),
          totalReduction: (oldFinalTotal - order.finalTotal).toFixed(2)
        },
        paymentInfo: {
          paidAmount: (order.paidAmount || 0).toFixed(2),
          remainingAmount: (order.remainingAmount || 0).toFixed(2),
          refundNeeded: refundNeeded.toFixed(2),
          paymentStatus: order.paymentStatus,
          orderStatus: order.orderStatus,
          note: refundRecord 
            ? `Refund record ${isRefundUpdated ? 'updated' : 'created'} with PENDING status. Go to Refunds page to process.` 
            : null
        },
        refundRecord: refundRecord ? {
          id: refundRecord._id,
          amount: refundRecord.refundAmount,
          status: refundRecord.refundStatus,
          created: !isRefundUpdated,
          message: isRefundUpdated 
            ? `Existing refund updated. Total refund amount: LKR ${refundRecord.refundAmount.toFixed(2)}` 
            : `New refund created. Amount: LKR ${refundRecord.refundAmount.toFixed(2)}. Go to Refunds page to process.`
        } : null
      }
    });
  } catch (error) {
    console.error('❌ Error returning item:', error);
    
    if (error.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        message: 'Invalid order or machine ID'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Update/Edit an order
// @route   PUT /api/past-orders/:orderId
// @access  Public
const updateOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    const updateData = req.body;

    // Find the order
    const order = await PastOrder.findById(orderId);

    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Update customer info if provided
    if (updateData.customerInfo) {
      order.customerInfo = {
        ...order.customerInfo,
        ...updateData.customerInfo
      };
    }

    // Update items if provided
    if (updateData.items) {
      order.items = updateData.items;
    }

    // Update extras if provided
    if (updateData.extras !== undefined) {
      order.extras = updateData.extras;
    }

    // Update discount if provided
    if (updateData.discountAmount !== undefined) {
      order.discountAmount = updateData.discountAmount;
    }

    // Update status fields if provided
    if (updateData.orderStatus) {
      order.orderStatus = updateData.orderStatus;
    }

    if (updateData.paymentStatus) {
      order.paymentStatus = updateData.paymentStatus;
    }

    // Update notes if provided
    if (updateData.notes !== undefined) {
      order.notes = updateData.notes;
    }

    // Update processed by if provided
    if (updateData.processedBy) {
      order.processedBy = updateData.processedBy;
    }

    // Save the order (pre-save middleware will recalculate totals)
    await order.save();

    console.log(`✅ Order updated: ${order.orderId}`);

    // Fetch updated order with populated data
    const updatedOrder = await PastOrder.findById(orderId)
      .populate('customerId', 'name phone email')
      .populate('items.machineId', 'itemId name category');

    res.json({
      success: true,
      message: 'Order updated successfully',
      data: updatedOrder
    });
  } catch (error) {
    console.error('❌ Error updating order:', error);
    
    if (error.kind === 'ObjectId') {
      return res.status(404).json({
        success: false,
        message: 'Invalid order ID'
      });
    }

    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        success: false,
        message: 'Validation Error',
        errors
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Get sales statistics for a specific machine
// @desc    Get sales statistics for a specific machine
// @route   GET /api/past-orders/machine-stats/:machineId
// @access  Public
const getMachineSalesStats = async (req, res) => {
  try {
    const { machineId } = req.params;
    const mongoose = require('mongoose');

    // Aggregate sales data for this machine
    const salesData = await PastOrder.aggregate([
      // Unwind items array to work with individual items
      { $unwind: '$items' },
      
      // Match items with the specified machineId
      { 
        $match: { 
          'items.machineId': new mongoose.Types.ObjectId(machineId)
        } 
      },
      
      // Group to calculate total sold (quantity - returned quantity)
      {
        $group: {
          _id: '$items.machineId',
          totalSold: { 
            $sum: { 
              $subtract: [
                '$items.quantity', 
                { $ifNull: ['$items.returnedQuantity', 0] }
              ] 
            } 
          }
        }
      }
    ]);

    // If no sales found, return zero
    if (salesData.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          machineId,
          totalSold: 0
        }
      });
    }

    res.status(200).json({
      success: true,
      data: {
        machineId,
        totalSold: salesData[0].totalSold
      }
    });

  } catch (error) {
    console.error('Error getting machine sales stats:', error);
    res.status(500).json({
      success: false,
      message: 'Server Error',
      error: error.message
    });
  }
};

// @desc    Update payment for an order (add payment towards partial)
// @route   PATCH /api/past-orders/:id/payment
// @access  Public
const updatePayment = async (req, res) => {
  try {
    const orderId = req.params.id;
    const { newPaidAmount } = req.body; // amount to add to paidAmount

    if (newPaidAmount === undefined || newPaidAmount <= 0) {
      return res.status(400).json({ success: false, message: 'newPaidAmount must be provided and > 0' });
    }

    const order = await PastOrder.findById(orderId);
    if (!order) return res.status(404).json({ success: false, message: 'Order not found' });

    // Update paid amount and remaining
    const currentPaid = Number(order.paidAmount || 0);
    const total = Number(order.finalTotal || order.total || 0);
    const added = Number(newPaidAmount);

    // Prevent overpayment
    if (added > Math.max(0, total - currentPaid)) {
      return res.status(400).json({ success: false, message: 'Payment exceeds remaining amount' });
    }

    const updatedPaid = Math.round((currentPaid + added) * 100) / 100;
    const updatedRemaining = Math.round(Math.max(0, total - updatedPaid) * 100) / 100;

    order.paidAmount = updatedPaid;
    order.remainingAmount = updatedRemaining;

    // Append to payment history
    order.paymentHistory = order.paymentHistory || [];
    order.paymentHistory.push({ amount: Math.round(added * 100) / 100, updatedBy: req.user?.name || 'System' });

    // Update paymentStatus
    order.paymentStatus = (updatedRemaining === 0) ? 'full' : 'partial';

    // Update orderStatus based on payment
    order.orderStatus = (updatedRemaining === 0) ? 'Completed' : 'Processing';

    // If fully paid, clear dueDate
    if (updatedRemaining === 0) {
      order.dueDate = undefined;
    }

    await order.save();

    const populatedOrder = await PastOrder.findById(orderId).populate('customerId', 'name phone email');

    res.json({
      success: true,
      message: 'Payment updated successfully',
      data: { order: populatedOrder }
    });
  } catch (error) {
    console.error('Error updating payment:', error);
    res.status(500).json({ success: false, message: 'Server Error', error: error.message });
  }
};

module.exports = {
  getAllOrders,
  getOrderById,
  getOrderByOrderId,
  updateOrderStatus,
  getOrderStats,
  getOrdersByDateRange,
  deleteOrder,
  returnItem,
  updateOrder,
  getMachineSalesStats,
  updatePayment
};