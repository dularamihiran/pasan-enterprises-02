const Machine = require('../models/Machine');
const Customer = require('../models/Customer');
const PastOrder = require('../models/PastOrder');
const Refund = require('../models/Refund');

// @desc    Get monthly revenue for current month
// @route   GET /api/dashboard/monthly-revenue
// @access  Public
const getMonthlyRevenue = async (req, res) => {
  try {
    const today = new Date();
    const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1);
    const endOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59);

    console.log(`\n📊 DASHBOARD: Calculating Monthly Revenue`);
    console.log(`   Period: ${startOfMonth.toLocaleDateString()} to ${endOfMonth.toLocaleDateString()}`);

    // Get all orders from this month
    const monthOrders = await PastOrder.find({
      createdAt: {
        $gte: startOfMonth,
        $lte: endOfMonth
      }
    }).select('finalTotal total orderId').lean();

    console.log(`   Found ${monthOrders.length} orders this month`);

    // Calculate total revenue (use finalTotal which includes VAT, discount, extras)
    const monthlyRevenue = monthOrders.reduce((sum, order) => {
      return sum + (order.finalTotal || order.total || 0);
    }, 0);

    console.log(`   Gross Revenue: LKR ${monthlyRevenue.toFixed(2)}`);

    // Get refunds for this month (only approved/completed refunds)
    const refundStats = await Refund.getTotalRefundsForPeriod(startOfMonth, endOfMonth);
    const monthlyRefunds = refundStats.totalRefundAmount || 0;

    console.log(`   Monthly Refunds: LKR ${monthlyRefunds.toFixed(2)}`);

    // Calculate net revenue (revenue - refunds)
    const netMonthlyRevenue = monthlyRevenue - monthlyRefunds;

    console.log(`   Net Revenue: LKR ${netMonthlyRevenue.toFixed(2)}`);
    console.log(`   ======================================`);

    res.json({
      success: true,
      data: {
        revenue: netMonthlyRevenue,
        grossRevenue: monthlyRevenue,
        refunds: monthlyRefunds,
        orderCount: monthOrders.length,
        month: today.toLocaleString('en-US', { month: 'long' }),
        year: today.getFullYear()
      }
    });

  } catch (error) {
    console.error('Error fetching monthly revenue:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching monthly revenue',
      error: error.message
    });
  }
};

// @desc    Get total revenue from all orders
// @route   GET /api/dashboard/total-orders
// @access  Public
const getTotalOrders = async (req, res) => {
  try {
    // Get count of all orders (not revenue)
    const totalOrdersCount = await PastOrder.countDocuments();

    res.json({
      success: true,
      data: {
        count: totalOrdersCount,
        description: 'All time orders'
      }
    });

  } catch (error) {
    console.error('Error fetching total orders:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching total orders',
      error: error.message
    });
  }
};



// @desc    Get low stock items count (quantity < 3)
// @route   GET /api/dashboard/low-stock
// @access  Public
const getLowStock = async (req, res) => {
  try {
    // Count machines with quantity < 3
    const lowStockCount = await Machine.countDocuments({
      quantity: { $lt: 3 }
    });

    // Optional: Get the actual items for reference
    const lowStockItems = await Machine.find({
      quantity: { $lt: 3 }
    }).select('itemId name quantity').lean();

    res.json({
      success: true,
      data: {
        count: lowStockCount,
        items: lowStockItems,
        threshold: 3
      }
    });

  } catch (error) {
    console.error('Error fetching low stock items:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching low stock items',
      error: error.message
    });
  }
};

// @desc    Get total available inventory items
// @route   GET /api/dashboard/total-items
// @access  Public
const getTotalItems = async (req, res) => {
  try {
    // Calculate total available quantity (sum of all quantities)
    const inventoryStats = await Machine.aggregate([
      {
        $group: {
          _id: null,
          totalQuantity: { $sum: '$quantity' },
          totalItems: { $sum: 1 },
          inStock: {
            $sum: {
              $cond: [{ $gt: ['$quantity', 0] }, 1, 0]
            }
          },
          outOfStock: {
            $sum: {
              $cond: [{ $eq: ['$quantity', 0] }, 1, 0]
            }
          }
        }
      }
    ]);

    const stats = inventoryStats[0] || {
      totalQuantity: 0,
      totalItems: 0,
      inStock: 0,
      outOfStock: 0
    };

    res.json({
      success: true,
      data: {
        totalQuantity: stats.totalQuantity,
        totalItems: stats.totalItems,
        inStock: stats.inStock,
        outOfStock: stats.outOfStock,
        description: 'Available inventory'
      }
    });

  } catch (error) {
    console.error('Error fetching total items:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching total items',
      error: error.message
    });
  }
};

// @desc    Get monthly revenue data for the last 12 months (bar chart)
// @route   GET /api/dashboard/monthly-graph
// @access  Public
const getMonthlyGraph = async (req, res) => {
  try {
    const today = new Date();
    const currentMonth = today.getMonth();
    const currentYear = today.getFullYear();

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Pre-build the 12 month window so we can map revenues onto it later.
    const monthsWindow = [];
    for (let offset = 11; offset >= 0; offset--) {
      let targetYear = currentYear;
      let targetMonth = currentMonth - offset;

      if (targetMonth < 0) {
        targetMonth += 12;
        targetYear -= 1;
      }

      monthsWindow.push({
        label: monthNames[targetMonth],
        year: targetYear,
        monthIndex: targetMonth,
        monthNumber: targetMonth + 1,
        isCurrentMonth: targetMonth === currentMonth && targetYear === currentYear
      });
    }

    const rangeStart = new Date(monthsWindow[0].year, monthsWindow[0].monthIndex, 1);
    const rangeEnd = new Date(currentYear, currentMonth + 1, 0, 23, 59, 59);

    // Get revenue by month
    const revenueByMonth = await PastOrder.aggregate([
      {
        $match: {
          createdAt: {
            $gte: rangeStart,
            $lte: rangeEnd
          }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$createdAt' },
            month: { $month: '$createdAt' }
          },
          totalRevenue: {
            $sum: {
              $ifNull: [
                '$finalTotal',
                { $ifNull: ['$total', 0] }
              ]
            }
          }
        }
      }
    ]);

    // Get refunds by month (use updatedAt - when refund was approved)
    const refundsByMonth = await Refund.aggregate([
      {
        $match: {
          updatedAt: {
            $gte: rangeStart,
            $lte: rangeEnd
          },
          refundStatus: { $in: ['refunded', 'approved', 'completed'] }
        }
      },
      {
        $group: {
          _id: {
            year: { $year: '$updatedAt' },
            month: { $month: '$updatedAt' }
          },
          totalRefunds: { $sum: '$refundAmount' }
        }
      }
    ]);

    const revenueMap = new Map();
    revenueByMonth.forEach((item) => {
      const key = `${item._id.year}-${item._id.month}`;
      revenueMap.set(key, item.totalRevenue || 0);
    });

    const refundsMap = new Map();
    refundsByMonth.forEach((item) => {
      const key = `${item._id.year}-${item._id.month}`;
      refundsMap.set(key, item.totalRefunds || 0);
    });

    const monthlyData = monthsWindow.map((month) => {
      const key = `${month.year}-${month.monthNumber}`;
      const grossRevenue = revenueMap.get(key) || 0;
      const refunds = refundsMap.get(key) || 0;
      const netRevenue = grossRevenue - refunds;
      
      return {
        month: month.label,
        revenue: netRevenue,
        grossRevenue: grossRevenue,
        refunds: refunds,
        year: month.year,
        monthNumber: month.monthNumber,
        isCurrentMonth: month.isCurrentMonth
      };
    });

    res.json({
      success: true,
      data: monthlyData
    });

  } catch (error) {
    console.error('Error fetching monthly graph data:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching monthly graph data',
      error: error.message
    });
  }
};

// @desc    Get top 6 best selling machines (all-time, net of returns)
// @route   GET /api/dashboard/best-selling-machines
// @access  Public
const getBestSellingMachines = async (req, res) => {
  try {
    // Aggregate all valid orders to find best-selling machines.
    // Net sold units = ordered quantity - returned quantity.
    const bestSellingMachines = await PastOrder.aggregate([
      {
        $match: {
          orderStatus: { $ne: 'Cancelled' }
        }
      },
      {
        $unwind: '$items'
      },
      {
        $addFields: {
          itemQuantity: { $ifNull: ['$items.quantity', 0] },
          itemReturnedQuantity: {
            $ifNull: [
              '$items.returnedQuantity',
              { $ifNull: ['$items.returned_quantity', 0] }
            ]
          }
        }
      },
      {
        $addFields: {
          netQuantitySold: {
            $max: [
              { $subtract: ['$itemQuantity', '$itemReturnedQuantity'] },
              0
            ]
          },
          unitRevenue: {
            $ifNull: [
              '$items.unitPrice',
              {
                $ifNull: [
                  { $add: ['$items.machine_price_per_unit', '$items.vat_per_unit'] },
                  0
                ]
              }
            ]
          }
        }
      },
      {
        $match: {
          netQuantitySold: { $gt: 0 }
        }
      },
      {
        $group: {
          _id: '$items.machineId',
          machineName: { $first: '$items.name' },
          category: { $first: '$items.category' },
          itemId: { $first: '$items.itemId' },
          totalQuantitySold: { $sum: '$netQuantitySold' },
          totalRevenue: {
            $sum: {
              $multiply: ['$unitRevenue', '$netQuantitySold']
            }
          },
          orderCount: { $sum: 1 }
        }
      },
      {
        $sort: { totalQuantitySold: -1, totalRevenue: -1 }
      },
      {
        $limit: 6
      },
      {
        $lookup: {
          from: 'machines',
          localField: '_id',
          foreignField: '_id',
          as: 'machineDetails'
        }
      },
      {
        $addFields: {
          currentStock: { $arrayElemAt: ['$machineDetails.quantity', 0] },
          machineItemId: { $arrayElemAt: ['$machineDetails.itemId', 0] }
        }
      },
      {
        $project: {
          _id: 1,
          machineName: 1,
          category: 1,
          itemId: {
            $ifNull: ['$machineItemId', '$itemId']
          },
          totalQuantitySold: 1,
          totalRevenue: { $round: ['$totalRevenue', 2] },
          orderCount: 1,
          currentStock: { $ifNull: ['$currentStock', 0] }
        }
      }
    ]);

    res.json({
      success: true,
      data: bestSellingMachines
    });

  } catch (error) {
    console.error('Error fetching best selling machines:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching best selling machines',
      error: error.message
    });
  }
};

module.exports = {
  getMonthlyRevenue,
  getTotalOrders,
  getLowStock,
  getTotalItems,
  getMonthlyGraph,
  getBestSellingMachines
};