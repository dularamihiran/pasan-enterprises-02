import React, { useState, useEffect } from 'react';
import { 
  BanknotesIcon,
  MagnifyingGlassIcon,
  CalendarDaysIcon,
  DocumentTextIcon,
  PencilIcon,
  XMarkIcon,
  CheckCircleIcon,
  ClockIcon,
  PlusIcon
} from '@heroicons/react/24/outline';
import { handleApiError } from '../services/apiService';

const Refunds = () => {
  // State management
  const [refunds, setRefunds] = useState([]);
  const [ordersNeedingRefunds, setOrdersNeedingRefunds] = useState([]);
  const [filteredRefunds, setFilteredRefunds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  
  // Stats state
  const [monthlyRefunds, setMonthlyRefunds] = useState(0);
  const [yearlyRefunds, setYearlyRefunds] = useState(0);
  const [refundCount, setRefundCount] = useState(0);
  
  // Modal state
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedRefund, setSelectedRefund] = useState(null);
  const [editForm, setEditForm] = useState({
    refundAmount: '',
    refundReason: '',
    refundDate: '',
    refundStatus: 'pending',
    notes: ''
  });

  // Helper functions
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-LK', {
      style: 'currency',
      currency: 'LKR',
      minimumFractionDigits: 2
    }).format(amount || 0);
  };

  // Load refunds from API
  const loadRefunds = async (page = 1) => {
    try {
      setLoading(true);
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
      
      // Load both refund records and orders needing refunds with pagination
      const [refundsResponse, ordersResponse] = await Promise.all([
        fetch(`${apiUrl}/refunds?page=${page}&limit=20`),
        fetch(`${apiUrl}/refunds/orders-needing-refunds?page=${page}&limit=20`)
      ]);

      const refundsData = await refundsResponse.json();
      const ordersData = await ordersResponse.json();

      console.log('Refunds data:', refundsData);
      console.log('Orders needing refunds:', ordersData);

      let combinedData = [];
      let totalCombinedCount = 0;

      if (refundsData.success) {
        setRefunds(refundsData.data || []);
        combinedData = [...(refundsData.data || [])];
        totalCombinedCount += refundsData.pagination?.totalRefunds || 0;
      }

      if (ordersData.success) {
        setOrdersNeedingRefunds(ordersData.data || []);
        
        // Add orders without refund records
        const ordersToAdd = (ordersData.data || []).filter(order => !order.hasRefundRecord).map(order => ({
          _id: order._id,
          orderId: order._id,
          orderInfo: { orderId: order.orderId },
          customerInfo: order.customerInfo,
          originalAmount: order.originalAmount,
          refundAmount: order.refundAmount,
          refundDate: order.orderDate,
          refundStatus: 'pending',
          refundType: 'partial',
          refundReason: `Returned items: ${order.returnedItems.map(i => `${i.name} (${i.returnedQuantity})`).join(', ')}`,
          processedBy: 'Pending',
          isOrderNeedingRefund: true,
          returnedItems: order.returnedItems
        }));
        
        combinedData = [...combinedData, ...ordersToAdd];
        totalCombinedCount += ordersData.stats?.ordersWithoutRefundRecord || ordersToAdd.length;
      }
      
      setFilteredRefunds(combinedData);
      setRefundCount(totalCombinedCount);
      setCurrentPage(page);
      
      // Calculate total pages based on combined count (20 items per page)
      const calculatedTotalPages = Math.ceil(totalCombinedCount / 20);
      setTotalPages(calculatedTotalPages || 1);
      
      console.log('Combined data count:', combinedData.length);
      console.log('Total combined count:', totalCombinedCount);
      console.log('Total pages:', calculatedTotalPages);
    } catch (error) {
      console.error('Error loading refunds:', error);
      handleApiError(error);
    } finally {
      setLoading(false);
    }
  };

  // Load refund statistics
  const loadRefundStats = async () => {
    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
      const response = await fetch(`${apiUrl}/refunds/stats/summary`);
      const data = await response.json();

      if (data.success) {
        setMonthlyRefunds(data.data.monthly?.totalRefundAmount || 0);
        setYearlyRefunds(data.data.yearly?.totalRefundAmount || 0);
      }
    } catch (error) {
      console.error('Error loading refund stats:', error);
    }
  };

  // Initial load
  useEffect(() => {
    loadRefunds();
    loadRefundStats();
  }, []);

  // Filter refunds based on search and status
  useEffect(() => {
    const allData = [
      ...refunds,
      ...ordersNeedingRefunds.filter(order => !order.hasRefundRecord).map(order => ({
        _id: order._id,
        orderId: order._id,
        orderInfo: { orderId: order.orderId },
        customerInfo: order.customerInfo,
        originalAmount: order.originalAmount,
        refundAmount: order.refundAmount,
        refundDate: order.orderDate,
        refundStatus: 'pending',
        refundType: 'partial',
        refundReason: `Returned items: ${order.returnedItems.map(i => `${i.name} (${i.returnedQuantity})`).join(', ')}`,
        processedBy: 'Pending',
        isOrderNeedingRefund: true,
        returnedItems: order.returnedItems,
        newTotal: order.newTotal
      }))
    ];

    let filtered = [...allData];

    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(item => item.refundStatus === statusFilter);
    }

    // Apply search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(item => {
        const customerName = item.customerInfo?.name?.toLowerCase() || '';
        const orderId = item.orderInfo?.orderId?.toLowerCase() || '';
        const refundReason = item.refundReason?.toLowerCase() || '';
        return customerName.includes(search) || orderId.includes(search) || refundReason.includes(search);
      });
    }

    setFilteredRefunds(filtered);
  }, [searchTerm, statusFilter, refunds, ordersNeedingRefunds]);

  // Handle edit refund
  const handleEditClick = (refund) => {
    setSelectedRefund(refund);
    setEditForm({
      refundAmount: refund.refundAmount || 0,
      refundReason: refund.refundReason || '',
      refundDate: refund.refundDate ? new Date(refund.refundDate).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
      refundStatus: refund.refundStatus || 'pending',
      notes: refund.notes || ''
    });
    setShowEditModal(true);
  };

  // Handle create refund from order
  const handleCreateRefund = async (order) => {
    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
      
      // Get the actual order to find customer ID
      const orderResponse = await fetch(`${apiUrl}/past-orders/${order._id || order.orderId}`);
      const orderData = await orderResponse.json();
      
      if (!orderData.success) {
        alert('Failed to fetch order details');
        return;
      }

      const actualOrder = orderData.data;
      const customerId = actualOrder.customerId?._id || actualOrder.customerId;
      
      const response = await fetch(`${apiUrl}/refunds`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          orderId: actualOrder._id,
          customerId: customerId,
          refundAmount: order.refundAmount,
          refundReason: order.refundReason || `Returned items: ${order.returnedItems?.map(i => `${i.name} (${i.returnedQuantity})`).join(', ')}`,
          refundStatus: 'approved',
          processedBy: 'Manual',
          notes: 'Created from orders needing refunds'
        })
      });

      const data = await response.json();

      if (data.success) {
        alert('Refund record created successfully!');
        loadRefunds(currentPage);
        loadRefundStats();
      } else {
        alert(data.message || 'Failed to create refund record');
      }
    } catch (error) {
      console.error('Error creating refund:', error);
      alert('Error creating refund: ' + error.message);
    }
  };

  // Handle save refund
  const handleSaveRefund = async () => {
    try {
      const apiUrl = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
      const response = await fetch(`${apiUrl}/refunds/${selectedRefund._id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editForm)
      });

      const data = await response.json();

      if (data.success) {
        alert('Refund updated successfully!');
        setShowEditModal(false);
        setSelectedRefund(null);
        loadRefunds(currentPage);
        loadRefundStats();
      } else {
        alert(data.message || 'Failed to update refund');
      }
    } catch (error) {
      console.error('Error updating refund:', error);
      alert('Error updating refund: ' + error.message);
    }
  };

  // Get status badge
  const getStatusBadge = (status) => {
    const badges = {
      pending: { text: 'Pending', color: 'bg-yellow-100 text-yellow-800', icon: ClockIcon },
      approved: { text: 'Approved', color: 'bg-blue-100 text-blue-800', icon: CheckCircleIcon },
      completed: { text: 'Completed', color: 'bg-green-100 text-green-800', icon: CheckCircleIcon },
      rejected: { text: 'Rejected', color: 'bg-red-100 text-red-800', icon: XMarkIcon }
    };

    const badge = badges[status] || badges.pending;
    const Icon = badge.icon;

    return (
      <span className={`inline-flex items-center gap-1 px-2 sm:px-3 py-1 rounded-full text-xs sm:text-sm font-medium ${badge.color}`}>
        <Icon className="w-3 h-3 sm:w-4 sm:h-4" />
        {badge.text}
      </span>
    );
  };

  // Stats cards
  const currentMonth = new Date().toLocaleString('en-US', { month: 'long' });
  const currentYear = new Date().getFullYear();

  const stats = [
    {
      title: `${currentMonth} Refunds`,
      value: formatCurrency(monthlyRefunds),
      icon: CalendarDaysIcon,
      gradient: 'from-blue-500 to-blue-600'
    },
    {
      title: `${currentYear} Refunds`,
      value: formatCurrency(yearlyRefunds),
      icon: BanknotesIcon,
      gradient: 'from-purple-500 to-purple-600'
    },
    {
      title: 'Total Refunds',
      value: refundCount.toString(),
      icon: DocumentTextIcon,
      gradient: 'from-orange-500 to-orange-600'
    }
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-800">Refunds Management</h2>
          <p className="text-sm text-slate-600 mt-1">
            Refunds are automatically created when items are returned and customers have overpaid
          </p>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        {stats.map((stat, index) => {
          const IconComponent = stat.icon;
          return (
            <div key={index} className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-all duration-300 p-4 sm:p-6 border border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-600 text-xs sm:text-sm font-medium">{stat.title}</p>
                  <p className="text-xl sm:text-2xl font-bold text-slate-800 mt-1">{stat.value}</p>
                </div>
                <div className={`p-2 sm:p-3 rounded-xl bg-gradient-to-r ${stat.gradient}`}>
                  <IconComponent className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl shadow-md p-4 sm:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Search */}
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by customer, order ID, or reason..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 sm:py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
            />
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-4 py-2 sm:py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="completed">Completed</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>
        </div>
      </div>

      {/* Refunds Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center p-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        ) : filteredRefunds.length === 0 ? (
          <div className="text-center py-12">
            <DocumentTextIcon className="mx-auto h-12 w-12 text-slate-400" />
            <h3 className="mt-2 text-sm font-medium text-slate-900">No refunds found</h3>
            <p className="mt-1 text-sm text-slate-500">
              {searchTerm || statusFilter !== 'all' ? 'Try adjusting your filters' : 'No refunds have been created yet'}
            </p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Order ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Customer
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Original Total
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Refund Amount
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Refund Date
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {filteredRefunds.map((refund) => (
                    <tr key={refund._id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-slate-900">
                          {refund.orderInfo?.orderId || 'N/A'}
                        </div>
                        {refund.isOrderNeedingRefund && (
                          <span className="inline-block mt-1 text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                            Needs Refund Record
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-slate-900">{refund.customerInfo?.name || 'N/A'}</div>
                        <div className="text-sm text-slate-500">{refund.customerInfo?.phone || ''}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-900">{formatCurrency(refund.originalAmount)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-red-600">{formatCurrency(refund.refundAmount)}</div>
                        <div className="text-xs text-slate-500">
                          {refund.refundType === 'full' ? 'Full Refund' : 'Partial Refund'}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-slate-900">{formatDate(refund.refundDate)}</div>
                        {refund.processedBy === 'System' && (
                          <div className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded inline-block mt-1">
                            Auto-generated
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(refund.refundStatus)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {refund.isOrderNeedingRefund ? (
                          <button
                            onClick={() => handleCreateRefund(refund)}
                            className="inline-flex items-center px-3 py-1 bg-green-500 hover:bg-green-600 text-white text-sm rounded-lg transition-colors"
                          >
                            <PlusIcon className="w-4 h-4 mr-1" />
                            Create Refund
                          </button>
                        ) : (
                          <button
                            onClick={() => handleEditClick(refund)}
                            className="inline-flex items-center px-3 py-1 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg transition-colors"
                          >
                            <PencilIcon className="w-4 h-4 mr-1" />
                            Edit
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="lg:hidden divide-y divide-slate-200">
              {filteredRefunds.map((refund) => (
                <div key={refund._id} className="p-4 hover:bg-slate-50 transition-colors">
                  <div className="space-y-3">
                    {/* Order ID and Status */}
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="text-sm font-medium text-slate-500">Order ID</div>
                        <div className="text-base font-semibold text-slate-900">
                          {refund.orderInfo?.orderId || 'N/A'}
                        </div>
                        {refund.isOrderNeedingRefund && (
                          <span className="inline-block mt-1 text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">
                            Needs Refund Record
                          </span>
                        )}
                      </div>
                      {getStatusBadge(refund.refundStatus)}
                    </div>

                    {/* Customer */}
                    <div>
                      <div className="text-sm font-medium text-slate-500">Customer</div>
                      <div className="text-base text-slate-900">{refund.customerInfo?.name || 'N/A'}</div>
                      <div className="text-sm text-slate-500">{refund.customerInfo?.phone || ''}</div>
                    </div>

                    {/* Amounts */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm font-medium text-slate-500">Original Total</div>
                        <div className="text-base text-slate-900">{formatCurrency(refund.originalAmount)}</div>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-500">Refund Amount</div>
                        <div className="text-base font-semibold text-red-600">{formatCurrency(refund.refundAmount)}</div>
                      </div>
                    </div>

                    {/* Date and Type */}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <div className="text-sm font-medium text-slate-500">Refund Date</div>
                        <div className="text-base text-slate-900">{formatDate(refund.refundDate)}</div>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-slate-500">Type</div>
                        <div className="text-base text-slate-900">
                          {refund.refundType === 'full' ? 'Full' : 'Partial'}
                        </div>
                      </div>
                    </div>

                    {/* Reason */}
                    {refund.refundReason && (
                      <div>
                        <div className="text-sm font-medium text-slate-500">Reason</div>
                        <div className="text-sm text-slate-700">{refund.refundReason}</div>
                        {refund.processedBy === 'System' && (
                          <span className="inline-block mt-1 text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                            Auto-generated
                          </span>
                        )}
                      </div>
                    )}

                    {/* Action Button */}
                    {refund.isOrderNeedingRefund ? (
                      <button
                        onClick={() => handleCreateRefund(refund)}
                        className="w-full inline-flex items-center justify-center px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm rounded-lg transition-colors"
                      >
                        <PlusIcon className="w-4 h-4 mr-2" />
                        Create Refund Record
                      </button>
                    ) : (
                      <button
                        onClick={() => handleEditClick(refund)}
                        className="w-full inline-flex items-center justify-center px-4 py-2 bg-blue-500 hover:bg-blue-600 text-white text-sm rounded-lg transition-colors"
                      >
                        <PencilIcon className="w-4 h-4 mr-2" />
                        Edit Refund
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="px-4 sm:px-6 py-4 border-t border-slate-200">
                <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="text-sm text-slate-600">
                    Showing {((currentPage - 1) * 20) + 1} to {Math.min(currentPage * 20, refundCount)} of {refundCount} records
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => loadRefunds(currentPage - 1)}
                      disabled={currentPage === 1}
                      className="px-3 sm:px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base transition-colors"
                    >
                      Previous
                    </button>
                    <span className="text-sm font-medium text-slate-600">
                      Page {currentPage} of {totalPages}
                    </span>
                    <button
                      onClick={() => loadRefunds(currentPage + 1)}
                      disabled={currentPage === totalPages}
                      className="px-3 sm:px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm sm:text-base transition-colors"
                    >
                      Next
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Edit Refund Modal */}
      {showEditModal && selectedRefund && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-gradient-to-r from-blue-500 to-blue-600 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="text-xl font-bold">Edit Refund</h3>
              <button
                onClick={() => setShowEditModal(false)}
                className="p-1 hover:bg-white/20 rounded-lg transition-colors"
              >
                <XMarkIcon className="w-6 h-6" />
              </button>
            </div>

            <div className="p-6 space-y-6">
              {/* Order and Customer Info */}
              <div className="bg-slate-50 p-4 rounded-lg space-y-2">
                <div>
                  <span className="text-sm font-medium text-slate-500">Order ID: </span>
                  <span className="text-sm font-semibold text-slate-900">{selectedRefund.orderInfo?.orderId}</span>
                </div>
                <div>
                  <span className="text-sm font-medium text-slate-500">Customer: </span>
                  <span className="text-sm text-slate-900">{selectedRefund.customerInfo?.name}</span>
                </div>
                <div>
                  <span className="text-sm font-medium text-slate-500">Original Amount: </span>
                  <span className="text-sm font-semibold text-slate-900">{formatCurrency(selectedRefund.originalAmount)}</span>
                </div>
              </div>

              {/* Form Fields */}
              <div className="space-y-4">
                {/* Refund Amount */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Refund Amount <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    value={editForm.refundAmount}
                    onChange={(e) => setEditForm({ ...editForm, refundAmount: parseFloat(e.target.value) || 0 })}
                    max={selectedRefund.originalAmount}
                    min={0}
                    step="0.01"
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    Maximum: {formatCurrency(selectedRefund.originalAmount)}
                  </p>
                </div>

                {/* Refund Date */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Refund Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={editForm.refundDate}
                    onChange={(e) => setEditForm({ ...editForm, refundDate: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>

                {/* Refund Status */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Status <span className="text-red-500">*</span>
                  </label>
                  <select
                    value={editForm.refundStatus}
                    onChange={(e) => setEditForm({ ...editForm, refundStatus: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="pending">Pending</option>
                    <option value="approved">Approved</option>
                    <option value="completed">Completed</option>
                    <option value="rejected">Rejected</option>
                  </select>
                </div>

                {/* Refund Reason */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Refund Reason
                  </label>
                  <textarea
                    value={editForm.refundReason}
                    onChange={(e) => setEditForm({ ...editForm, refundReason: e.target.value })}
                    rows={3}
                    maxLength={500}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter reason for refund..."
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    {editForm.refundReason.length}/500 characters
                  </p>
                </div>

                {/* Notes */}
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Additional Notes
                  </label>
                  <textarea
                    value={editForm.notes}
                    onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })}
                    rows={3}
                    maxLength={1000}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter additional notes..."
                  />
                  <p className="mt-1 text-xs text-slate-500">
                    {editForm.notes.length}/1000 characters
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="flex-1 px-4 py-3 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveRefund}
                  className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:from-blue-600 hover:to-blue-700 transition-all font-medium shadow-lg"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Refunds;
