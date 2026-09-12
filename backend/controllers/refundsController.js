const Refund = require('../models/Refund');
const PastOrder = require('../models/PastOrder');
const Customer = require('../models/Customer');

// @desc    Get all refunds with pagination and filtering
// @route   GET /api/refunds
// @access  Public
const getAllRefunds = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      status,
      startDate,
      endDate,
      customerId,
      orderId
    } = req.query;

    // Build query
    const query = {};
    
    if (status) {
      query.refundStatus = status;
    }
    
    if (customerId) {
      query.customerId = customerId;
    }
    
    if (orderId) {
      query.orderId = orderId;
    }
    
    if (startDate || endDate) {
      query.refundDate = {};
      if (startDate) query.refundDate.$gte = new Date(startDate);
      if (endDate) query.refundDate.$lte = new Date(endDate);
    }

    // Calculate pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);

    // Execute query with pagination
    const refunds = await Refund.find(query)
      .populate('customerId', 'name phone email')
      .populate('orderId', 'orderId finalTotal createdAt')
      .sort({ refundDate: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Get total count for pagination
    const totalRefunds = await Refund.countDocuments(query);
    const totalPages = Math.ceil(totalRefunds / parseInt(limit));

    // Calculate summary statistics
    const summaryStats = await Refund.aggregate([
      { $match: query },
      {
        $group: {
          _id: null,
          totalRefundAmount: { $sum: '$refundAmount' },
          averageRefundAmount: { $avg: '$refundAmount' },
          pendingRefunds: {
            $sum: { $cond: [{ $eq: ['$refundStatus', 'pending'] }, 1, 0] }
          },
          approvedRefunds: {
            $sum: { $cond: [{ $eq: ['$refundStatus', 'approved'] }, 1, 0] }
          },
          completedRefunds: {
            $sum: { $cond: [{ $eq: ['$refundStatus', 'completed'] }, 1, 0] }
          }
        }
      }
    ]);

    const stats = summaryStats[0] || {
      totalRefundAmount: 0,
      averageRefundAmount: 0,
      pendingRefunds: 0,
      approvedRefunds: 0,
      completedRefunds: 0
    };

    res.json({
      success: true,
      data: refunds,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalRefunds,
        limit: parseInt(limit),
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
      },
      stats
    });

  } catch (error) {
    console.error('Error fetching refunds:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching refunds',
      error: error.message
    });
  }
};

// @desc    Get single refund by ID
// @route   GET /api/refunds/:id
// @access  Public
const getRefundById = async (req, res) => {
  try {
    const refund = await Refund.findById(req.params.id)
      .populate('customerId', 'name phone email address nic')
      .populate('orderId')
      .lean();

    if (!refund) {
      return res.status(404).json({
        success: false,
        message: 'Refund not found'
      });
    }

    res.json({
      success: true,
      data: refund
    });

  } catch (error) {
    console.error('Error fetching refund:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching refund',
      error: error.message
    });
  }
};

// @desc    Create new refund
// @route   POST /api/refunds
// @access  Public
const createRefund = async (req, res) => {
  try {
    const {
      orderId,
      customerId,
      refundAmount,
      refundReason,
      refundDate,
      refundStatus,
      processedBy,
      notes
    } = req.body;

    // Validate required fields
    if (!orderId || !customerId || !refundAmount) {
      return res.status(400).json({
        success: false,
        message: 'Order ID, Customer ID, and Refund Amount are required'
      });
    }

    // Fetch order details
    const order = await PastOrder.findById(orderId);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: 'Order not found'
      });
    }

    // Fetch customer details
    const customer = await Customer.findById(customerId);
    if (!customer) {
      return res.status(404).json({
        success: false,
        message: 'Customer not found'
      });
    }

    // Validate refund amount doesn't exceed order total
    if (refundAmount > order.finalTotal) {
      return res.status(400).json({
        success: false,
        message: 'Refund amount cannot exceed order total'
      });
    }

    // Check if refund already exists for this order
    const existingRefund = await Refund.findOne({ orderId });
    if (existingRefund) {
      return res.status(400).json({
        success: false,
        message: 'A refund already exists for this order. Please update the existing refund instead.'
      });
    }

    // Create refund record
    const refund = new Refund({
      orderId,
      customerId,
      customerInfo: {
        name: customer.name,
        phone: customer.phone,
        email: customer.email || ''
      },
      orderInfo: {
        orderId: order.orderId,
        originalTotal: order.finalTotal
      },
      originalAmount: order.finalTotal,
      refundAmount,
      refundReason: refundReason || '',
      refundDate: refundDate || new Date(),
      refundStatus: refundStatus || 'pending',
      processedBy: processedBy || 'System',
      notes: notes || ''
    });

    await refund.save();

    // Populate the refund before returning
    const populatedRefund = await Refund.findById(refund._id)
      .populate('customerId', 'name phone email')
      .populate('orderId', 'orderId finalTotal')
      .lean();

    res.status(201).json({
      success: true,
      message: 'Refund created successfully',
      data: populatedRefund
    });

  } catch (error) {
    console.error('Error creating refund:', error);
    res.status(500).json({
      success: false,
      message: 'Error creating refund',
      error: error.message
    });
  }
};

// @desc    Update refund
// @route   PUT /api/refunds/:id
// @access  Public
const updateRefund = async (req, res) => {
  try {
    const {
      refundAmount,
      refundReason,
      refundDate,
      refundStatus,
      processedBy,
      notes
    } = req.body;

    // Find existing refund
    const refund = await Refund.findById(req.params.id);
    if (!refund) {
      return res.status(404).json({
        success: false,
        message: 'Refund not found'
      });
    }

    // If updating refund amount, validate it
    if (refundAmount !== undefined) {
      if (refundAmount > refund.originalAmount) {
        return res.status(400).json({
          success: false,
          message: 'Refund amount cannot exceed original amount'
        });
      }
      refund.refundAmount = refundAmount;
    }

    // Update other fields if provided
    if (refundReason !== undefined) refund.refundReason = refundReason;
    if (refundDate !== undefined) refund.refundDate = refundDate;
    if (refundStatus !== undefined) refund.refundStatus = refundStatus;
    if (processedBy !== undefined) refund.processedBy = processedBy;
    if (notes !== undefined) refund.notes = notes;

    await refund.save();

    // Populate and return updated refund
    const updatedRefund = await Refund.findById(refund._id)
      .populate('customerId', 'name phone email')
      .populate('orderId', 'orderId finalTotal')
      .lean();

    res.json({
      success: true,
      message: 'Refund updated successfully',
      data: updatedRefund
    });

  } catch (error) {
    console.error('Error updating refund:', error);
    res.status(500).json({
      success: false,
      message: 'Error updating refund',
      error: error.message
    });
  }
};

// @desc    Delete refund
// @route   DELETE /api/refunds/:id
// @access  Public
const deleteRefund = async (req, res) => {
  try {
    const refund = await Refund.findById(req.params.id);

    if (!refund) {
      return res.status(404).json({
        success: false,
        message: 'Refund not found'
      });
    }

    await refund.deleteOne();

    res.json({
      success: true,
      message: 'Refund deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting refund:', error);
    res.status(500).json({
      success: false,
      message: 'Error deleting refund',
      error: error.message
    });
  }
};

// @desc    Get refund statistics for current month and year
// @route   GET /api/refunds/stats/summary
// @access  Public
const getRefundStats = async (req, res) => {
  try {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);
    const startOfYear = new Date(today.getFullYear(), 0, 1);
    const endOfYear = new Date(today.getFullYear(), 11, 31, 23, 59, 59);

    // Get monthly stats
    const monthlyStats = await Refund.getTotalRefundsForPeriod(startOfMonth, endOfMonth);

    // Get yearly stats
    const yearlyStats = await Refund.getTotalRefundsForPeriod(startOfYear, endOfYear);

    // Get all-time stats
    const allTimeStats = await Refund.aggregate([
      {
        $match: {
          refundStatus: { $in: ['approved', 'completed'] }
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

    const allTime = allTimeStats[0] || { totalRefundAmount: 0, refundCount: 0 };

    res.json({
      success: true,
      data: {
        monthly: {
          totalRefundAmount: monthlyStats.totalRefundAmount,
          refundCount: monthlyStats.refundCount,
          month: today.toLocaleString('en-US', { month: 'long' }),
          year: today.getFullYear()
        },
        yearly: {
          totalRefundAmount: yearlyStats.totalRefundAmount,
          refundCount: yearlyStats.refundCount,
          year: today.getFullYear()
        },
        allTime: {
          totalRefundAmount: allTime.totalRefundAmount,
          refundCount: allTime.refundCount
        }
      }
    });

  } catch (error) {
    console.error('Error fetching refund stats:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching refund statistics',
      error: error.message
    });
  }
};

// @desc    Get orders that need refunds (returned items with overpayment)
// @route   GET /api/refunds/orders-needing-refunds
// @access  Public
const getOrdersNeedingRefunds = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20
    } = req.query;

    console.log('🔍 Fetching orders needing refunds...');

    // Get all orders that might need refunds
    const allOrders = await PastOrder.find({})
      .populate('customerId', 'name phone email')
      .lean();

    console.log(`📦 Total orders in database: ${allOrders.length}`);

    // Filter orders that need refunds
    const ordersNeedingRefunds = allOrders.filter(order => {
      // Check if order has any returned items
      const hasReturnedItems = order.items.some(item => 
        (item.returnedQuantity && item.returnedQuantity > 0) || item.returned
      );

      if (!hasReturnedItems) return false;

      // Calculate if refund is needed
      const finalTotal = order.finalTotal || order.total || 0;
      const paidAmount = order.paidAmount || 0;
      const remainingAmount = order.remainingAmount || 0;
      const calculatedRemaining = finalTotal - paidAmount;
      const isRefundNeeded = calculatedRemaining < 0 || remainingAmount < 0;

      console.log(`📋 Order ${order.orderId}:`);
      console.log(`   Has Returned Items: ${hasReturnedItems}`);
      console.log(`   Final Total: ${finalTotal}`);
      console.log(`   Paid Amount: ${paidAmount}`);
      console.log(`   Remaining Amount (stored): ${remainingAmount}`);
      console.log(`   Calculated Remaining: ${calculatedRemaining}`);
      console.log(`   Refund Needed: ${isRefundNeeded}`);

      return isRefundNeeded;
    });

    console.log(`💰 Orders needing refunds: ${ordersNeedingRefunds.length}`);

    // Calculate refund details for each order
    const ordersWithRefundDetails = await Promise.all(
      ordersNeedingRefunds.map(async (order) => {
        const finalTotal = order.finalTotal || order.total || 0;
        const paidAmount = order.paidAmount || 0;
        const refundAmount = Math.abs(finalTotal - paidAmount);

        // Check if refund record already exists
        const existingRefund = await Refund.findOne({ orderId: order._id }).lean();

        // Calculate returned items details
        const returnedItems = order.items.filter(item => 
          (item.returnedQuantity && item.returnedQuantity > 0) || item.returned
        ).map(item => ({
          name: item.name,
          returnedQuantity: item.returnedQuantity || item.quantity,
          originalQuantity: item.quantity
        }));

        return {
          _id: order._id,
          orderId: order.orderId,
          customerInfo: {
            name: order.customerInfo?.name || order.customerId?.name || 'Unknown',
            phone: order.customerInfo?.phone || order.customerId?.phone || '',
            email: order.customerInfo?.email || order.customerId?.email || ''
          },
          originalAmount: paidAmount,
          newTotal: finalTotal,
          refundAmount: refundAmount,
          returnedItems: returnedItems,
          hasRefundRecord: !!existingRefund,
          refundRecord: existingRefund,
          orderDate: order.createdAt,
          paymentStatus: order.paymentStatus
        };
      })
    );

    // Pagination
    const skip = (parseInt(page) - 1) * parseInt(limit);
    const paginatedOrders = ordersWithRefundDetails.slice(skip, skip + parseInt(limit));
    const totalOrders = ordersWithRefundDetails.length;
    const totalPages = Math.ceil(totalOrders / parseInt(limit));

    // Calculate total refund amount needed
    const totalRefundNeeded = ordersWithRefundDetails.reduce((sum, order) => 
      sum + order.refundAmount, 0
    );

    res.json({
      success: true,
      data: paginatedOrders,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalOrders,
        limit: parseInt(limit),
        hasNextPage: parseInt(page) < totalPages,
        hasPrevPage: parseInt(page) > 1
      },
      stats: {
        totalRefundNeeded,
        ordersNeedingRefund: totalOrders,
        ordersWithRefundRecord: ordersWithRefundDetails.filter(o => o.hasRefundRecord).length,
        ordersWithoutRefundRecord: ordersWithRefundDetails.filter(o => !o.hasRefundRecord).length
      }
    });

  } catch (error) {
    console.error('Error fetching orders needing refunds:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching orders needing refunds',
      error: error.message
    });
  }
};

module.exports = {
  getAllRefunds,
  getRefundById,
  createRefund,
  updateRefund,
  deleteRefund,
  getRefundStats,
  getOrdersNeedingRefunds
};
