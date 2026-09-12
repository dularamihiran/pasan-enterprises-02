import React, { useState, useEffect, useCallback } from 'react';
import {
  MagnifyingGlassIcon,
  XMarkIcon,
  PlusIcon,
  MinusIcon,
  PhotoIcon,
  DocumentArrowDownIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  TrashIcon
} from '@heroicons/react/24/outline';
import { generateQuotationPDF } from '../services/quotationService';
import { machineAPI, customerAPI, handleApiError } from '../services/apiService';

const Quotation = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [machines, setMachines] = useState([]);
  const [categories, setCategories] = useState([]);
  const [quotationItems, setQuotationItems] = useState([]);
  const [extras, setExtras] = useState([]);
  const [customerInfo, setCustomerInfo] = useState({
    name: '',
    email: '',
    phone: '',
    nic: '',
    address: ''
  });
  const [customerSearchResults, setCustomerSearchResults] = useState([]);
  const [showCustomerDropdown, setShowCustomerDropdown] = useState(false);
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalMachines, setTotalMachines] = useState(0);
  const itemsPerPage = 5;

  const [discountAmount, setDiscountAmount] = useState(0);

  const fetchMachines = useCallback(async (page = currentPage, category = selectedCategory, search = searchTerm) => {
    try {
      setLoading(true);
      const params = {
        page,
        limit: itemsPerPage,
        inStock: true
      };

      if (category !== 'all') {
        params.category = category;
      }

      if (search.trim()) {
        params.search = search.trim();
      }

      const response = await machineAPI.getAll(params);
      if (response.data.success) {
        setMachines(response.data.data);
        setTotalPages(response.data.pages || 1);
        setTotalMachines(response.data.total || 0);
      }
    } catch (err) {
      const errorInfo = handleApiError(err);
      setError(errorInfo.message);
    } finally {
      setLoading(false);
    }
  }, [currentPage, selectedCategory, searchTerm, itemsPerPage]);

  useEffect(() => {
    fetchMachines();
    fetchCategories();
  }, [fetchMachines]);

  useEffect(() => {
    fetchMachines();
  }, [fetchMachines]);

  useEffect(() => {
    return () => {
      if (window.customerSearchTimeout) {
        clearTimeout(window.customerSearchTimeout);
      }
    };
  }, []);

  const fetchCategories = async () => {
    try {
      const response = await machineAPI.getCategories();
      if (response.data.success) {
        setCategories(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  const searchCustomers = async (searchTerm) => {
    if (!searchTerm.trim()) {
      setCustomerSearchResults([]);
      setShowCustomerDropdown(false);
      return;
    }

    try {
      setCustomerSearchLoading(true);
      const response = await customerAPI.getAll({ search: searchTerm, limit: 10 });
      
      if (response.data && response.data.success && Array.isArray(response.data.data)) {
        setCustomerSearchResults(response.data.data);
        setShowCustomerDropdown(true);
      }
    } catch (err) {
      console.error('Error searching customers:', err);
      setCustomerSearchResults([]);
    } finally {
      setCustomerSearchLoading(false);
    }
  };

  const handleCustomerNameChange = (value) => {
    setCustomerInfo({...customerInfo, name: value});
    
    if (window.customerSearchTimeout) {
      clearTimeout(window.customerSearchTimeout);
    }
    
    window.customerSearchTimeout = setTimeout(() => {
      searchCustomers(value);
    }, 300);
    
    if (value.trim()) {
      setShowCustomerDropdown(true);
    }
  };

  const handleCustomerSelect = (customer) => {
    setCustomerInfo({
      name: customer.name || '',
      email: customer.email || '',
      phone: customer.phone || '',
      nic: customer.nic || '',
      address: customer.address || ''
    });
    setShowCustomerDropdown(false);
  };

  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  const handleCategoryChange = (category) => {
    setSelectedCategory(category);
    setCurrentPage(1);
  };

  const handleSearchChange = (search) => {
    setSearchTerm(search);
    setCurrentPage(1);
  };

  const addToQuotation = (machine) => {
    const existing = quotationItems.find(item => item.machineId === machine._id);
    
    if (existing) {
      setError('This machine is already in the quotation');
      setTimeout(() => setError(''), 3000);
      return;
    }

    const newItem = {
      machineId: machine._id,
      name: machine.name,
      itemId: machine.itemId,
      quantity: 1,
      unitPrice: machine.price,
      vatPercentage: 18,
      warrantyMonths: 12,
      extraDescription: machine.description || '',
      images: []
    };

    setQuotationItems([...quotationItems, newItem]);
    setSuccessMessage(`${machine.name} added to quotation`);
    setTimeout(() => setSuccessMessage(''), 3000);
  };

  const updateQuotationItem = (machineId, field, value) => {
    setQuotationItems(quotationItems.map(item =>
      item.machineId === machineId ? { ...item, [field]: value } : item
    ));
  };

  const removeFromQuotation = (machineId) => {
    setQuotationItems(quotationItems.filter(item => item.machineId !== machineId));
  };

  const handleImageUpload = (machineId, files) => {
    const item = quotationItems.find(item => item.machineId === machineId);
    if (!item) return;

    const currentImages = item.images || [];
    const remainingSlots = 1 - currentImages.length;

    if (remainingSlots <= 0) {
      setError('Maximum 1 image allowed per machine');
      setTimeout(() => setError(''), 3000);
      return;
    }

    const filesToAdd = Array.from(files).slice(0, remainingSlots);
    const newImages = [];

    filesToAdd.forEach(file => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
          newImages.push({
            name: file.name,
            data: e.target.result
          });

          if (newImages.length === filesToAdd.length) {
            updateQuotationItem(machineId, 'images', [...currentImages, ...newImages]);
          }
        };
        reader.readAsDataURL(file);
      }
    });
  };

  const removeImage = (machineId, imageIndex) => {
    const item = quotationItems.find(item => item.machineId === machineId);
    if (!item) return;

    const newImages = item.images.filter((_, index) => index !== imageIndex);
    updateQuotationItem(machineId, 'images', newImages);
  };

  const addExtra = () => {
    setExtras([...extras, { description: '', amount: 0 }]);
  };

  const updateExtra = (index, field, value) => {
    const newExtras = [...extras];
    newExtras[index] = { ...newExtras[index], [field]: value };
    setExtras(newExtras);
  };

  const removeExtra = (index) => {
    setExtras(extras.filter((_, i) => i !== index));
  };

  const getItemBasePriceWithoutVAT = (item) => {
    const vatMultiplier = 1 + (parseFloat(item.vatPercentage) || 0) / 100;
    return item.unitPrice / vatMultiplier;
  };

  const getItemVATAmount = (item) => {
    const basePrice = getItemBasePriceWithoutVAT(item);
    return (item.unitPrice - basePrice) * item.quantity;
  };

  const getItemTotalWithVAT = (item) => {
    return item.unitPrice * item.quantity;
  };

  const getSubtotal = () => {
    return quotationItems.reduce((sum, item) => {
      const basePrice = getItemBasePriceWithoutVAT(item);
      return sum + (basePrice * item.quantity);
    }, 0);
  };

  const getVATAmount = () => {
    return quotationItems.reduce((sum, item) => sum + getItemVATAmount(item), 0);
  };

  const getTotalBeforeDiscount = () => {
    return getSubtotal() + getVATAmount();
  };

  const getDiscountAmount = () => {
    // Cap discount to not exceed totalBeforeDiscount
    const totalBefore = getTotalBeforeDiscount();
    const requestedDiscount = parseFloat(discountAmount) || 0;
    return Math.min(requestedDiscount, totalBefore);
  };

  const getExtrasTotal = () => {
    return extras.reduce((sum, extra) => sum + (parseFloat(extra.amount) || 0), 0);
  };

  const getFinalTotal = () => {
    return getTotalBeforeDiscount() - getDiscountAmount() + getExtrasTotal();
  };

  const handleGenerateQuotation = async () => {
    if (quotationItems.length === 0) {
      setError('Please add at least one machine to the quotation');
      setTimeout(() => setError(''), 3000);
      return;
    }

    if (!customerInfo.name.trim()) {
      setError('Please enter customer name');
      setTimeout(() => setError(''), 3000);
      return;
    }

    if (!customerInfo.phone.trim()) {
      setError('Please enter customer phone number');
      setTimeout(() => setError(''), 3000);
      return;
    }

    try {
      setProcessing(true);

      const quotationData = {
        items: quotationItems,
        extras: extras.filter(extra => extra.description && extra.amount > 0),
        customerInfo,
        subtotal: getSubtotal(),
        vatAmount: getVATAmount(),
        discountAmount: getDiscountAmount(),
        finalTotal: getFinalTotal()
      };

      const result = await generateQuotationPDF(quotationData);

      if (result.success) {
        setSuccessMessage('Quotation generated successfully!');
        
        // Reset form after successful generation
        setTimeout(() => {
          setQuotationItems([]);
          setExtras([]);
          setCustomerInfo({
            name: '',
            email: '',
            phone: '',
            nic: '',
            address: ''
          });
          setDiscountAmount(0);
          setSuccessMessage('');
        }, 2000);
      } else {
        setError(result.message || 'Failed to generate quotation');
        setTimeout(() => setError(''), 5000);
      }
    } catch (err) {
      console.error('Error generating quotation:', err);
      setError('Error generating quotation. Please try again.');
      setTimeout(() => setError(''), 5000);
    } finally {
      setProcessing(false);
    }
  };

  const clearMessages = () => {
    setError('');
    setSuccessMessage('');
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8">
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-indigo-800 to-indigo-600 bg-clip-text text-transparent">
          Create Quotation
        </h1>
        <p className="text-slate-600 mt-2 text-sm sm:text-base">Generate quotations for customers</p>
      </div>

      {error && (
        <div className="mb-4 sm:mb-6 bg-red-50 border border-red-200 text-red-800 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg flex items-start sm:items-center justify-between">
          <div className="flex items-start sm:items-center flex-1 min-w-0">
            <ExclamationTriangleIcon className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5 sm:mt-0" />
            <span className="text-sm sm:text-base break-words">{error}</span>
          </div>
          <button onClick={clearMessages} className="text-red-600 hover:text-red-800 ml-2 flex-shrink-0">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
      )}

      {successMessage && (
        <div className="mb-4 sm:mb-6 bg-green-50 border border-green-200 text-green-800 px-3 sm:px-4 py-2.5 sm:py-3 rounded-lg flex items-start sm:items-center justify-between">
          <div className="flex items-start sm:items-center flex-1 min-w-0">
            <CheckCircleIcon className="w-5 h-5 mr-2 flex-shrink-0 mt-0.5 sm:mt-0" />
            <span className="text-sm sm:text-base break-words">{successMessage}</span>
          </div>
          <button onClick={clearMessages} className="text-green-600 hover:text-green-800 ml-2 flex-shrink-0">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
        {/* Available Machines Panel */}
        <div className="lg:col-span-1">
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-200/50 p-4 sm:p-6 h-full">
            <h3 className="text-lg sm:text-xl font-bold text-slate-800 mb-3 sm:mb-4">Available Machines</h3>
            
            <div className="flex flex-col md:flex-row gap-3 sm:gap-4 mb-4 sm:mb-6">
              <div className="relative flex-1">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search machines..."
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white/50"
                />
              </div>
              <select
                value={selectedCategory}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white/50"
              >
                <option value="all">All Categories</option>
                {categories.map((category) => (
                  <option key={category.name} value={category.name}>
                    {category.name} ({category.count})
                  </option>
                ))}
              </select>
            </div>

            {loading && (
              <div className="text-center py-8">
                <div className="animate-spin-fast rounded-full h-12 w-12 border-b-2 border-indigo-500 mx-auto"></div>
                <p className="text-slate-600 mt-4">Loading machines...</p>
              </div>
            )}

            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-slate-600">
                Showing page {currentPage} of {totalPages} ({totalMachines} total items)
              </p>
            </div>

            {!loading && (
              <div className="space-y-4">
                {machines.length === 0 ? (
                  <div className="col-span-full text-center py-8">
                    <p className="text-slate-600">No machines found matching your criteria.</p>
                  </div>
                ) : (
                  machines.map((machine) => (
                    <div key={machine._id} className="border border-slate-200 rounded-lg p-3 hover:shadow-md transition-all duration-200 bg-white/50">
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-semibold text-slate-800 text-sm">{machine.name}</h4>
                            <span className="text-xs text-slate-500 bg-slate-100 px-2 py-1 rounded">ID: {machine.itemId}</span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-base font-bold text-slate-800">Rs. {machine.price.toFixed(2)}</span>
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              machine.quantity >= 15 ? 'bg-green-100 text-green-600' :
                              machine.quantity >= 3 ? 'bg-yellow-100 text-yellow-600' :
                              'bg-red-100 text-red-600'
                            }`}>
                              Stock: {machine.quantity}
                            </span>
                          </div>
                        </div>
                        <div className="ml-3">
                          <button
                            onClick={() => addToQuotation(machine)}
                            className="px-3 py-2 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-lg hover:scale-105 transition-all duration-200 text-sm whitespace-nowrap"
                          >
                            Add
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {!loading && totalPages > 1 && (
              <div className="mt-4 flex items-center justify-center space-x-2">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="px-3 py-1 text-sm border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                
                {(() => {
                  const pageNumbers = [];
                  const maxVisiblePages = 5;
                  let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
                  let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
                  
                  if (endPage - startPage + 1 < maxVisiblePages) {
                    startPage = Math.max(1, endPage - maxVisiblePages + 1);
                  }
                  
                  for (let i = startPage; i <= endPage; i++) {
                    pageNumbers.push(
                      <button
                        key={i}
                        onClick={() => handlePageChange(i)}
                        className={`px-3 py-1 text-sm border rounded ${
                          currentPage === i
                            ? 'bg-indigo-500 text-white border-indigo-500'
                            : 'border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        {i}
                      </button>
                    );
                  }
                  return pageNumbers;
                })()}
                
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="px-3 py-1 text-sm border border-slate-300 rounded hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Quotation Items Panel */}
        <div className="lg:col-span-1">
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-200/50 p-6">
            <h3 className="text-xl font-bold text-slate-800 mb-4">
              Quotation Items ({quotationItems.length})
            </h3>
            
            {quotationItems.length === 0 ? (
              <p className="text-slate-500 text-center py-8">No items in quotation</p>
            ) : (
              <div className="space-y-6">
                {quotationItems.map((item) => (
                  <div key={item.machineId} className="border border-slate-200 rounded-lg p-4 bg-white/50">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <h5 className="font-medium text-slate-800 text-sm">{item.name}</h5>
                        <p className="text-xs text-slate-600">ID: {item.itemId}</p>
                      </div>
                      <button
                        onClick={() => removeFromQuotation(item.machineId)}
                        className="text-red-500 hover:text-red-700 text-xs"
                      >
                        <TrashIcon className="w-5 h-5" />
                      </button>
                    </div>
                    
                    {/* Quantity and Price Controls */}
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Quantity</label>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => updateQuotationItem(item.machineId, 'quantity', Math.max(1, item.quantity - 1))}
                            className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center hover:bg-slate-300"
                          >
                            <MinusIcon className="w-3 h-3" />
                          </button>
                          <input
                            type="number"
                            min="1"
                            value={item.quantity}
                            onChange={(e) => updateQuotationItem(item.machineId, 'quantity', Math.max(1, parseInt(e.target.value) || 1))}
                            className="w-16 px-2 py-1 text-xs text-center border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500"
                          />
                          <button
                            onClick={() => updateQuotationItem(item.machineId, 'quantity', item.quantity + 1)}
                            className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center hover:bg-slate-300"
                          >
                            <PlusIcon className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Unit Price (Rs.)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unitPrice}
                          onChange={(e) => updateQuotationItem(item.machineId, 'unitPrice', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    {/* VAT and Warranty */}
                    <div className="grid grid-cols-2 gap-3 mb-3">
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">VAT %</label>
                        <input
                          type="number"
                          min="0"
                          max="100"
                          step="0.1"
                          value={item.vatPercentage}
                          onChange={(e) => updateQuotationItem(item.machineId, 'vatPercentage', parseFloat(e.target.value) || 0)}
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-slate-700 mb-1">Warranty (months)</label>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={item.warrantyMonths}
                          onChange={(e) => updateQuotationItem(item.machineId, 'warrantyMonths', parseInt(e.target.value) || 0)}
                          className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>

                    {/* Extra Description */}
                    <div className="mb-3">
                      <label className="block text-xs font-medium text-slate-700 mb-1">Extra Description</label>
                      <textarea
                        value={item.extraDescription}
                        onChange={(e) => updateQuotationItem(item.machineId, 'extraDescription', e.target.value)}
                        placeholder="Add any additional details or specifications..."
                        className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-indigo-500"
                        rows="5"
                      />
                    </div>

                    {/* Image Upload */}
                    <div className="mb-3">
                      <label className="block text-xs font-medium text-slate-700 mb-1">
                        Images ({item.images?.length || 0}/1)
                      </label>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleImageUpload(item.machineId, e.target.files)}
                        className="hidden"
                        id={`image-upload-${item.machineId}`}
                        disabled={(item.images?.length || 0) >= 1}
                      />
                      <label
                        htmlFor={`image-upload-${item.machineId}`}
                        className={`flex items-center justify-center px-3 py-2 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                          (item.images?.length || 0) >= 1
                            ? 'border-slate-300 bg-slate-100 cursor-not-allowed'
                            : 'border-indigo-300 bg-indigo-50 hover:bg-indigo-100'
                        }`}
                      >
                        <PhotoIcon className="w-5 h-5 mr-2 text-indigo-600" />
                        <span className="text-xs text-slate-700">
                          {(item.images?.length || 0) >= 1 ? 'Remove the image below to add a different image' : 'Upload Image'}
                        </span>
                      </label>
                      
                      {item.images && item.images.length > 0 && (
                        <div className="grid grid-cols-5 gap-2 mt-2">
                          {item.images.map((image, index) => (
                            <div key={index} className="relative group">
                              <img
                                src={image.data}
                                alt={`Machine ${index + 1}`}
                                className="w-full h-16 object-cover rounded border border-slate-300"
                              />
                              <button
                                onClick={() => removeImage(item.machineId, index)}
                                className="absolute top-0 right-0 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <XMarkIcon className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Price Summary */}
                    <div className="space-y-1 bg-slate-50 p-2 rounded text-xs">
                      <div className="flex justify-between">
                        <span className="text-slate-600">Base Price (excl. VAT):</span>
                        <span className="font-medium">Rs. {(getItemBasePriceWithoutVAT(item) * item.quantity).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">VAT ({item.vatPercentage}%):</span>
                        <span className="font-medium text-blue-600">Rs. {getItemVATAmount(item).toFixed(2)}</span>
                      </div>
                      <div className="flex justify-between font-bold border-t border-slate-200 pt-1">
                        <span className="text-slate-700">Total:</span>
                        <span className="text-green-600">Rs. {getItemTotalWithVAT(item).toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Extra Charges and Discount Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-6">
        {/* Extra Charges Section */}
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-200/50 p-6">
          <div className="flex justify-between items-center mb-3">
            <h3 className="text-lg font-bold text-slate-800">Extra Charges</h3>
            <button
              onClick={addExtra}
              className="text-sm bg-indigo-500 text-white px-3 py-1 rounded-lg hover:bg-indigo-600 flex items-center"
            >
              <PlusIcon className="w-4 h-4 mr-1" />
              Add
            </button>
          </div>
          
          {extras.length === 0 ? (
            <p className="text-slate-500 text-center py-3 text-sm">No extra charges</p>
          ) : (
            <div className="space-y-3">
              {extras.map((extra, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Description"
                    value={extra.description}
                    onChange={(e) => updateExtra(index, 'description', e.target.value)}
                    className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white/50"
                  />
                  <input
                    type="number"
                    placeholder="Amount"
                    value={extra.amount || ''}
                    onChange={(e) => updateExtra(index, 'amount', parseFloat(e.target.value) || 0)}
                    className="w-32 px-2 py-2 border border-slate-300 rounded-lg text-sm bg-white/50"
                  />
                  <button
                    onClick={() => removeExtra(index)}
                    className="text-red-500 hover:text-red-700 p-2"
                  >
                    <XMarkIcon className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Discount Section */}
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-200/50 p-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Discount</h3>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Discount Amount (Rs.)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={discountAmount}
              onChange={(e) => {
                const value = parseFloat(e.target.value) || 0;
                setDiscountAmount(Math.max(0, value));
              }}
              onBlur={() => {
                const totalBefore = getTotalBeforeDiscount();
                if (discountAmount > totalBefore) {
                  setDiscountAmount(totalBefore);
                }
              }}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white/50 text-sm"
              placeholder="Enter discount amount in Rs."
            />
            {discountAmount > getTotalBeforeDiscount() && (
              <p className="text-xs text-amber-600 mt-1">⚠️ Discount will be capped to total (Rs. {getTotalBeforeDiscount().toFixed(2)})</p>
            )}
          </div>
        </div>
      </div>

      {/* Order Summary */}
      {quotationItems.length > 0 && (
        <div className="bg-white/60 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-200/50 p-6 mb-6">
          <h3 className="text-lg font-bold text-slate-800 mb-4">Order Summary</h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-slate-600">
              <span>Subtotal (Machine Prices):</span>
              <span>Rs. {getSubtotal().toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-blue-600">
              <span>Total VAT:</span>
              <span>Rs. {getVATAmount().toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm font-medium text-slate-700">
              <span>Total Before Discount:</span>
              <span>Rs. {getTotalBeforeDiscount().toFixed(2)}</span>
            </div>
            {getDiscountAmount() > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Discount Amount:</span>
                <span>-Rs. {getDiscountAmount().toFixed(2)}</span>
              </div>
            )}
            {getExtrasTotal() > 0 && (
              <div className="flex justify-between text-sm text-slate-600">
                <span>Extra Charges:</span>
                <span>Rs. {getExtrasTotal().toFixed(2)}</span>
              </div>
            )}
            <div className="border-t border-slate-200 pt-2">
              <div className="flex justify-between items-center text-xl font-bold text-slate-800">
                <span>Final Total:</span>
                <span className="text-green-600">Rs. {getFinalTotal().toFixed(2)}</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Customer Information */}
      <div className="bg-white/60 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-200/50 p-6 mb-6">
        <h3 className="text-xl font-bold text-slate-800 mb-6">Customer Information</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div className="relative">
            <label className="block text-sm font-medium text-slate-700 mb-2">Customer Name *</label>
            <input
              type="text"
              placeholder="Enter customer name"
              value={customerInfo.name}
              onChange={(e) => handleCustomerNameChange(e.target.value)}
              onFocus={() => {
                if (customerInfo.name.trim()) {
                  setShowCustomerDropdown(true);
                }
              }}
              onBlur={(e) => {
                setTimeout(() => {
                  setShowCustomerDropdown(false);
                }, 200);
              }}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white/50"
              required
              autoComplete="off"
            />
            
            {showCustomerDropdown && (
              <div className="customer-dropdown absolute z-50 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {customerSearchLoading ? (
                  <div className="px-4 py-3 text-center text-slate-500">
                    <div className="animate-spin inline-block w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full mr-2"></div>
                    Searching customers...
                  </div>
                ) : customerSearchResults && customerSearchResults.length > 0 ? (
                  customerSearchResults.map((customer) => (
                    <div
                      key={customer._id}
                      className="px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-b-0"
                      onClick={() => handleCustomerSelect(customer)}
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      <div className="font-medium text-slate-800">{customer.name}</div>
                      <div className="text-sm text-slate-500">
                        {customer.phone}
                        {customer.email && ` • ${customer.email}`}
                      </div>
                    </div>
                  ))
                ) : customerInfo.name.trim() && (
                  <div>
                    <div className="px-4 py-3 text-center text-slate-500">
                      No customers found matching "{customerInfo.name}"
                    </div>
                    <div 
                      className="px-4 py-3 hover:bg-indigo-50 cursor-pointer border-t border-slate-200 text-indigo-600 font-medium"
                      onClick={() => {
                        setShowCustomerDropdown(false);
                      }}
                      onMouseDown={(e) => e.preventDefault()}
                    >
                      <div className="flex items-center">
                        <PlusIcon className="w-4 h-4 mr-2" />
                        Continue with "{customerInfo.name}" as new customer
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Phone Number *</label>
            <input
              type="tel"
              placeholder="Enter phone number"
              value={customerInfo.phone}
              onChange={(e) => setCustomerInfo({...customerInfo, phone: e.target.value})}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white/50"
              required
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Email (Optional)</label>
            <input
              type="email"
              placeholder="Enter email address"
              value={customerInfo.email}
              onChange={(e) => setCustomerInfo({...customerInfo, email: e.target.value})}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white/50"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">NIC (Optional)</label>
            <input
              type="text"
              placeholder="Enter NIC number"
              value={customerInfo.nic}
              onChange={(e) => setCustomerInfo({...customerInfo, nic: e.target.value})}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white/50"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">Address (Optional)</label>
          <textarea
            placeholder="Enter customer address"
            value={customerInfo.address}
            onChange={(e) => setCustomerInfo({...customerInfo, address: e.target.value})}
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white/50"
            rows="2"
          />
        </div>
      </div>

      {/* Generate Quotation Button */}
      <div className="flex justify-center">
        <button
          onClick={handleGenerateQuotation}
          disabled={quotationItems.length === 0 || processing}
          className="px-8 py-4 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white rounded-xl font-bold text-lg hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-lg"
        >
          {processing ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
              Generating Quotation...
            </>
          ) : (
            <>
              <DocumentArrowDownIcon className="w-6 h-6 mr-2" />
              Generate Quotation
            </>
          )}
        </button>
      </div>
    </div>
  );
};

export default Quotation;
