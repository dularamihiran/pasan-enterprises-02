import React, { useState, useEffect } from 'react';
import { 
  MagnifyingGlassIcon, 
  FunnelIcon, 
  EyeIcon, 
  PencilIcon, 
  TrashIcon,
  XMarkIcon,
  ShoppingCartIcon
} from '@heroicons/react/24/outline';
import { machineService } from '../services/machineService';
import { pastOrdersAPI } from '../services/apiService';

const ViewInventory = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [machines, setMachines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedMachine, setSelectedMachine] = useState(null);
  const [salesStats, setSalesStats] = useState(null);
  const [loadingStats, setLoadingStats] = useState(false);
  // Server-side pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalMachines, setTotalMachines] = useState(0);
  const itemsPerPage = 20;
  const [editFormData, setEditFormData] = useState({
    itemId: '',
    name: '',
    category: '',
    description: '',
    price: '',
    quantity: ''
  });

  const categories = ['all', 'Packing Machine', 'Filling Machine', 'Sealing Machine', 'Capping Machine', 'Date Coding Machine', 'Dehydrator Machine', 'Optional Line Equipment', 'Mixing Machine', 'Labelling Machine', 'Grinding Machine', 'Food machine', 'Other'];
  const statusOptions = ['all', 'in-stock', 'low-stock', 'out-of-stock'];

  // Fetch machines from database with pagination
  useEffect(() => {
    fetchMachines();
  }, [currentPage, searchTerm, filterCategory, filterStatus]); // Reload when filters change

  const fetchMachines = async () => {
    try {
      setLoading(true);
      
      const params = {
        page: currentPage,
        limit: itemsPerPage
      };
      
      // Add search parameter if search term exists
      if (searchTerm.trim()) {
        params.search = searchTerm.trim();
      }
      
      // Add category filter if not 'all'
      if (filterCategory !== 'all') {
        params.category = filterCategory;
      }
      
      // Add status filter if not 'all'
      if (filterStatus !== 'all') {
        params.status = filterStatus;
        console.log('Adding status filter:', filterStatus); // Debug log
      }
      
      const response = await machineService.getAllMachines(params);
      console.log('API Request params:', params); // Debug log
      console.log('API Response:', response); // Debug log
      console.log('Current filterStatus:', filterStatus); // Debug log
      
      if (response?.success) {
        // Backend returns paginated response
        setMachines(response.data || []);
        setTotalPages(response.pages || 1);
        setTotalMachines(response.total || 0);
      } else {
        // Fallback for non-paginated response
        const machinesData = response?.data || [];
        setMachines(machinesData);
        setTotalPages(1);
        setTotalMachines(machinesData.length);
      }
      setError(null);
    } catch (err) {
      setError('Failed to fetch machines. Please try again.');
      setMachines([]);
      setTotalPages(1);
      setTotalMachines(0);
      console.error('Error fetching machines:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatus = (quantity) => {
    if (quantity === 0) return 'Out of Stock';
    if (quantity <= 2) return 'Low Stock';
    return 'In Stock';
  };

  const getStatusColor = (quantity) => {
    const status = getStatus(quantity);
    switch (status) {
      case 'In Stock': return 'bg-green-100 text-green-800';
      case 'Low Stock': return 'bg-orange-100 text-orange-800';
      case 'Out of Stock': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Handle search and filter changes
  const handleSearchChange = (value) => {
    setSearchTerm(value);
    setCurrentPage(1); // Reset to first page when searching
  };

  const handleCategoryChange = (category) => {
    setFilterCategory(category);
    setCurrentPage(1); // Reset to first page when filtering
  };

  const handleStatusChange = (status) => {
    setFilterStatus(status);
    setCurrentPage(1); // Reset to first page when filtering
  };

  // Server-side pagination means we display what we receive
  let displayedMachines = Array.isArray(machines) ? machines : [];
  
  // Temporary client-side filtering as fallback (remove this after debugging)
  if (filterStatus !== 'all' && displayedMachines.length > 0) {
    console.log('Applying client-side status filter as fallback:', filterStatus);
    displayedMachines = displayedMachines.filter(machine => {
      const status = getStatus(machine.quantity);
      switch (filterStatus) {
        case 'in-stock':
          return status === 'In Stock';
        case 'low-stock':
          return status === 'Low Stock';
        case 'out-of-stock':
          return status === 'Out of Stock';
        default:
          return true;
      }
    });
    console.log('Filtered machines count:', displayedMachines.length);
  }
  
  // Pagination calculations for display
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = Math.min(startIndex + itemsPerPage, totalMachines);

  const handlePageChange = (pageNumber) => {
    if (pageNumber >= 1 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  const handlePrevPage = () => {
    setCurrentPage(prev => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage(prev => Math.min(prev + 1, totalPages));
  };



  const handleViewDetails = async (machine) => {
    setSelectedMachine(machine);
    setShowDetailsModal(true);
    setSalesStats(null);
    
    // Fetch sales statistics with timeout
    try {
      setLoadingStats(true);
      
      // Create a timeout promise
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Request timeout')), 15000)
      );
      
      // Race between the API call and timeout
      const response = await Promise.race([
        pastOrdersAPI.getMachineSalesStats(machine._id),
        timeoutPromise
      ]);
      
      if (response.data.success) {
        setSalesStats(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching sales stats:', err);
      // Set to zero instead of null to show "No sales" rather than error
      setSalesStats({ totalSold: 0 });
    } finally {
      setLoadingStats(false);
    }
  };

  const handleEdit = (machine) => {
    setSelectedMachine(machine);
    setEditFormData({
      itemId: machine.itemId,
      name: machine.name,
      category: machine.category,
      description: machine.description,
      price: machine.price.toString(),
      quantity: machine.quantity.toString()
    });
    setShowEditModal(true);
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    try {
      const updatedData = {
        ...editFormData,
        price: parseFloat(editFormData.price),
        quantity: parseInt(editFormData.quantity)
      };
      
      await machineService.updateMachine(selectedMachine._id, updatedData);
      setShowEditModal(false);
      setSelectedMachine(null);
      fetchMachines(); // Refresh the current page
      alert('Machine updated successfully!');
    } catch (err) {
      alert('Failed to update machine. Please try again.');
      console.error('Error updating machine:', err);
    }
  };

  const handleDelete = async (machine) => {
    if (window.confirm(`Are you sure you want to delete ${machine.name}?`)) {
      try {
        await machineService.deleteMachine(machine._id);
        
        // If deleting the last item on current page and we're not on page 1, go to previous page
        if (displayedMachines.length === 1 && currentPage > 1) {
          setCurrentPage(currentPage - 1);
        } else {
          fetchMachines(); // Refresh the current page
        }
        alert('Machine deleted successfully!');
      } catch (err) {
        alert('Failed to delete machine. Please try again.');
        console.error('Error deleting machine:', err);
      }
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-GB', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
          View Inventory
        </h1>
        <p className="text-slate-600 mt-2 text-sm sm:text-base">Manage and monitor your machinery inventory</p>
      </div>

      {/* Search and Filter Bar */}
      <div className="bg-white/60 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-200/50 p-4 sm:p-6 mb-4 sm:mb-6">
        <div className="flex flex-col md:flex-row gap-3 sm:gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
            <input
              type="text"
              placeholder="Search by item name or ID..."
              value={searchTerm}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="w-full pl-9 sm:pl-10 pr-4 py-2.5 sm:py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white/50 text-sm sm:text-base"
            />
          </div>

          {/* Category Filter */}
          <div className="relative">
            <FunnelIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
            <select
              value={filterCategory}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="w-full md:w-auto pl-9 sm:pl-10 pr-8 py-2.5 sm:py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white/50 text-sm sm:text-base"
            >
              {categories.map(category => (
                <option key={category} value={category}>
                  {category === 'all' ? 'All Categories' : category}
                </option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div className="relative">
            <FunnelIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-slate-400" />
            <select
              value={filterStatus}
              onChange={(e) => handleStatusChange(e.target.value)}
              className="pl-10 pr-8 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white/50"
            >
              {statusOptions.map(status => (
                <option key={status} value={status}>
                  {status === 'all' ? 'All Status' : 
                   status === 'in-stock' ? 'In Stock' :
                   status === 'low-stock' ? 'Low Stock' :
                   status === 'out-of-stock' ? 'Out of Stock' : status}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-200/50 p-12">
          <div className="text-center">
            <div className="animate-spin-fast rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-slate-600">Loading machines...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-2xl p-6 mb-6">
          <p className="text-red-600">{error}</p>
          <button 
            onClick={fetchMachines}
            className="mt-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {/* Inventory Table */}
      {!loading && !error && (
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-200/50 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50/80">
                <tr>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-800">Item ID</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-800">Name</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-800">Category</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-800">Quantity</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-800">Price</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-800">Status</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-800">Last Updated</th>
                  <th className="px-6 py-4 text-left text-sm font-semibold text-slate-800">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {displayedMachines.map((item) => (
                  <tr key={item._id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-sm font-medium text-slate-800">{item.itemId}</td>
                    <td className="px-6 py-4 text-sm text-slate-800">{item.name}</td>
                    <td className="px-6 py-4 text-sm text-slate-600">{item.category}</td>
                    <td className="px-6 py-4 text-sm text-slate-800 font-medium">{item.quantity}</td>
                    <td className="px-6 py-4 text-sm text-slate-800">Rs. {item.price.toFixed(2)}</td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(item.quantity)}`}>
                        {getStatus(item.quantity)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600">{formatDate(item.updatedAt)}</td>
                    <td className="px-6 py-4">
                      <div className="flex space-x-2">
                        <button 
                          onClick={() => handleViewDetails(item)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                          title="View Details"
                        >
                          <EyeIcon className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleEdit(item)}
                          className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition-colors"
                          title="Edit"
                        >
                          <PencilIcon className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(item)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Delete"
                        >
                          <TrashIcon className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {displayedMachines.length === 0 && !loading && (
            <div className="text-center py-12">
              <p className="text-slate-500 text-lg">
                {searchTerm || filterCategory !== 'all' || filterStatus !== 'all' 
                  ? 'No items found matching your criteria.' 
                  : 'No machines found in inventory.'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Pagination */}
      {!loading && !error && totalMachines > 0 && (
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-200/50 p-6 mt-6">
          <div className="flex flex-col sm:flex-row justify-between items-center space-y-4 sm:space-y-0">
            {/* Results Info */}
            <div className="text-sm text-slate-600">
              Showing {startIndex + 1} to {endIndex} of {totalMachines} results
            </div>

            {/* Pagination Controls */}
            <div className="flex items-center space-x-2">
              {/* Previous Button */}
              <button
                onClick={handlePrevPage}
                disabled={currentPage === 1}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  currentPage === 1
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
              >
                Previous
              </button>

              {/* Page Numbers */}
              <div className="flex space-x-1">
                {Array.from({ length: totalPages }, (_, index) => {
                  const pageNumber = index + 1;
                  const isCurrentPage = pageNumber === currentPage;
                  
                  // Show first page, last page, current page, and pages around current page
                  const showPage = 
                    pageNumber === 1 ||
                    pageNumber === totalPages ||
                    (pageNumber >= currentPage - 1 && pageNumber <= currentPage + 1);

                  if (!showPage) {
                    // Show ellipsis for gaps
                    if (pageNumber === currentPage - 2 || pageNumber === currentPage + 2) {
                      return (
                        <span key={pageNumber} className="px-2 py-1 text-slate-400">
                          ...
                        </span>
                      );
                    }
                    return null;
                  }

                  return (
                    <button
                      key={pageNumber}
                      onClick={() => handlePageChange(pageNumber)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                        isCurrentPage
                          ? 'bg-blue-600 text-white'
                          : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                      }`}
                    >
                      {pageNumber}
                    </button>
                  );
                })}
              </div>

              {/* Next Button */}
              <button
                onClick={handleNextPage}
                disabled={currentPage === totalPages}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  currentPage === totalPages
                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                    : 'bg-slate-200 text-slate-700 hover:bg-slate-300'
                }`}
              >
                Next
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Details Modal */}
      {showDetailsModal && selectedMachine && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-slate-800">Machine Details</h2>
              <button 
                onClick={() => setShowDetailsModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <XMarkIcon className="w-6 h-6 text-slate-500" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Item ID</label>
                  <p className="text-slate-800 bg-slate-50 p-3 rounded-lg">{selectedMachine.itemId}</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Category</label>
                  <p className="text-slate-800 bg-slate-50 p-3 rounded-lg">{selectedMachine.category}</p>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Name</label>
                <p className="text-slate-800 bg-slate-50 p-3 rounded-lg">{selectedMachine.name}</p>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Description</label>
                <p className="text-slate-800 bg-slate-50 p-3 rounded-lg">{selectedMachine.description}</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Price</label>
                  <p className="text-slate-800 bg-slate-50 p-3 rounded-lg">Rs. {selectedMachine.price.toFixed(2)}</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Quantity</label>
                  <p className="text-slate-800 bg-slate-50 p-3 rounded-lg">{selectedMachine.quantity}</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Status</label>
                  <span className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedMachine.quantity)}`}>
                    {getStatus(selectedMachine.quantity)}
                  </span>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Date Added</label>
                  <p className="text-slate-800 bg-slate-50 p-3 rounded-lg">{formatDate(selectedMachine.createdAt)}</p>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Last Updated</label>
                  <p className="text-slate-800 bg-slate-50 p-3 rounded-lg">{formatDate(selectedMachine.updatedAt)}</p>
                </div>
              </div>

              {/* Sold Items Count Section */}
              <div className="pt-6 border-t border-slate-200">
                <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
                  <ShoppingCartIcon className="w-6 h-6 mr-2 text-blue-600" />
                  Sold Items Count
                </h3>
                
                {loadingStats ? (
                  <div className="text-center py-6">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2"></div>
                    <p className="text-slate-500 text-sm">Loading...</p>
                  </div>
                ) : salesStats ? (
                  <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-6 rounded-xl border border-blue-200">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-blue-600 mb-1">TOTAL SOLD</p>
                        <p className="text-4xl font-bold text-blue-900">{salesStats.totalSold || 0}</p>
                        <p className="text-sm text-blue-700 mt-2">Units sold</p>
                      </div>
                      <ShoppingCartIcon className="w-16 h-16 text-blue-300" />
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8 bg-slate-50 rounded-lg">
                    <ShoppingCartIcon className="w-12 h-12 text-slate-300 mx-auto mb-2" />
                    <p className="text-slate-500">No sales data available</p>
                    <p className="text-sm text-slate-400 mt-1">This item hasn't been sold yet</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && selectedMachine && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-2xl font-bold text-slate-800">Edit Machine</h2>
              <button 
                onClick={() => setShowEditModal(false)}
                className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
              >
                <XMarkIcon className="w-6 h-6 text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Item ID</label>
                  <input
                    type="text"
                    value={editFormData.itemId}
                    onChange={(e) => setEditFormData({...editFormData, itemId: e.target.value})}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Category</label>
                  <select
                    value={editFormData.category}
                    onChange={(e) => setEditFormData({...editFormData, category: e.target.value})}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                  >
                    {categories.filter(cat => cat !== 'all').map(category => (
                      <option key={category} value={category}>{category}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Name</label>
                <input
                  type="text"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({...editFormData, name: e.target.value})}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Description</label>
                <textarea
                  value={editFormData.description}
                  onChange={(e) => setEditFormData({...editFormData, description: e.target.value})}
                  className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  rows="3"
                  required
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Price (Rs.)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editFormData.price}
                    onChange={(e) => setEditFormData({...editFormData, price: e.target.value})}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Quantity</label>
                  <input
                    type="number"
                    value={editFormData.quantity}
                    onChange={(e) => setEditFormData({...editFormData, quantity: e.target.value})}
                    className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    required
                    min="0"
                  />
                </div>
              </div>
              <div className="flex justify-end space-x-4 pt-4">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-6 py-3 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Update Machine
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default ViewInventory;
