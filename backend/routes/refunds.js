const express = require('express');
const router = express.Router();
const {
  getAllRefunds,
  getRefundById,
  createRefund,
  updateRefund,
  deleteRefund,
  getRefundStats,
  getOrdersNeedingRefunds
} = require('../controllers/refundsController');

// @route   GET /api/refunds/stats/summary
// @desc    Get refund statistics (monthly, yearly, all-time)
// @access  Public
router.get('/stats/summary', getRefundStats);

// @route   GET /api/refunds/orders-needing-refunds
// @desc    Get orders that need refunds (returned items with overpayment)
// @access  Public
router.get('/orders-needing-refunds', getOrdersNeedingRefunds);

// @route   GET /api/refunds
// @desc    Get all refunds with pagination and filtering
// @access  Public
router.get('/', getAllRefunds);

// @route   GET /api/refunds/:id
// @desc    Get single refund by ID
// @access  Public
router.get('/:id', getRefundById);

// @route   POST /api/refunds
// @desc    Create new refund
// @access  Public
router.post('/', createRefund);

// @route   PUT /api/refunds/:id
// @desc    Update refund
// @access  Public
router.put('/:id', updateRefund);

// @route   DELETE /api/refunds/:id
// @desc    Delete refund
// @access  Public
router.delete('/:id', deleteRefund);

module.exports = router;
