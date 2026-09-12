import React, { useState, useEffect, useCallback } from 'react';
import { 
  ShoppingCartIcon, 
  MagnifyingGlassIcon, 
  PlusIcon, 
  MinusIcon, 
  CreditCardIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  XMarkIcon,
  ReceiptPercentIcon
} from '@heroicons/react/24/outline';
import { machineAPI, salesAPI, customerAPI, handleApiError } from '../services/apiService';
import { generateInvoice } from '../services/invoiceService';

const SellItem = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [machines, setMachines] = useState([]);
  const [categories, setCategories] = useState([]);
  const [cart, setCart] = useState([]);
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
  const itemsPerPage = 3;
  
  // VAT is now handled per-item in cart, this is kept for reference only
  const vatRate = 15; // Default reference VAT rate
  const [discountAmount, setDiscountAmount] = useState(0);
  // Payment fields
  const [paymentType, setPaymentType] = useState('full');
  const [paidAmount, setPaidAmount] = useState(0);
  const [paymentPeriodDays, setPaymentPeriodDays] = useState(60);
    const [paymentMethod, setPaymentMethod] = useState('cash');
    const [chequeNumber, setChequeNumber] = useState('');
  // Customer VAT Number (UI only - not stored in database)
  const [customerVatNumber, setCustomerVatNumber] = useState('');

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

  // Fetch machines and categories on component mount
  useEffect(() => {
    fetchMachines();
    fetchCategories();
  }, [fetchMachines]);

  // Fetch machines when page, category, or search changes
  useEffect(() => {
    fetchMachines();
  }, [fetchMachines]);

  // Cleanup timeout on component unmount
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

  // Customer search function
  const searchCustomers = async (searchTerm) => {
    if (!searchTerm.trim()) {
      setCustomerSearchResults([]);
      setShowCustomerDropdown(false);
      return;
    }

    try {
      setCustomerSearchLoading(true);
      const response = await customerAPI.getAll({
        search: searchTerm.trim(),
        limit: 10 // Limit results for dropdown
      });
      
      if (response.data.success) {
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

  // Handle customer name input change
  const handleCustomerNameChange = (value) => {
    setCustomerInfo({...customerInfo, name: value});
    
    // If input is cleared, hide dropdown immediately
    if (!value.trim()) {
      setCustomerSearchResults([]);
      setShowCustomerDropdown(false);
      return;
    }
    
    // Debounce the search to avoid too many API calls
    clearTimeout(window.customerSearchTimeout);
    window.customerSearchTimeout = setTimeout(() => {
      searchCustomers(value);
    }, 300);
  };

  // Handle customer selection from dropdown
  const handleCustomerSelect = (customer) => {
    setCustomerInfo({
      name: customer.name,
      email: customer.email || '',
      phone: customer.phone || '',
      nic: customer.nic || '',
      address: customer.address || ''
    });
    setCustomerVatNumber(customer.vatNo || '');
    setShowCustomerDropdown(false);
    setCustomerSearchResults([]);
  };

  // Pagination functions
  const handlePageChange = (newPage) => {
    setCurrentPage(newPage);
  };

  const handleCategoryChange = (category) => {
    setSelectedCategory(category);
    setCurrentPage(1); // Reset to first page when filtering
  };

  const handleSearchChange = (search) => {
    setSearchTerm(search);
    setCurrentPage(1); // Reset to first page when searching
  };

  const addToCart = (machine) => {
    const existingItem = cart.find(item => item.machineId === machine._id);
    if (existingItem) {
      if (existingItem.quantity < machine.quantity) {
        setCart(cart.map(item =>
          item.machineId === machine._id
            ? { ...item, quantity: item.quantity + 1 }
            : item
        ));
      } else {
        setError('Cannot add more items than available in stock');
        setTimeout(() => setError(''), 3000);
      }
    } else {
      setCart([...cart, {
        machineId: machine._id,
        itemId: machine.itemId,
        name: machine.name,
        category: machine.category,
        unitPrice: machine.price,
        quantity: 1,
        vatPercentage: 0, // Default 0% VAT per item
        warrantyMonths: 12, // Default 12 months warranty
        availableStock: machine.quantity,
        note: machine.description || '' // Use machine's existing description as note
      }]);
    }
  };

  const updateCartQuantity = (machineId, change) => {
    setCart(cart.map(item => {
      if (item.machineId === machineId) {
        const newQuantity = item.quantity + change;
        if (newQuantity <= 0) {
          return null;
        }
        if (newQuantity > item.availableStock) {
          setError('Cannot exceed available stock');
          setTimeout(() => setError(''), 3000);
          return item;
        }
        return { ...item, quantity: newQuantity };
      }
      return item;
    }).filter(Boolean));
  };

  const removeFromCart = (machineId) => {
    setCart(cart.filter(item => item.machineId !== machineId));
  };

  // Update VAT percentage for individual cart item
  const updateCartItemVAT = (machineId, vatPercentage) => {
    const newVat = parseFloat(vatPercentage) || 0;
    if (newVat < 0 || newVat > 100) {
      setError('VAT percentage must be between 0 and 100');
      setTimeout(() => setError(''), 3000);
      return;
    }
    setCart(cart.map(item =>
      item.machineId === machineId
        ? { ...item, vatPercentage: newVat }
        : item
    ));
  };

  // Update warranty months for individual cart item
  const updateCartItemWarranty = (machineId, warrantyMonths) => {
    const newWarranty = parseInt(warrantyMonths) || 0;
    if (newWarranty < 0) {
      setError('Warranty months cannot be negative');
      setTimeout(() => setError(''), 3000);
      return;
    }
    setCart(cart.map(item =>
      item.machineId === machineId
        ? { ...item, warrantyMonths: newWarranty }
        : item
    ));
  };

  // Update description/note for individual cart item
  const updateCartItemNote = (machineId, note) => {
    setCart(cart.map(item =>
      item.machineId === machineId
        ? { ...item, note }
        : item
    ));
  };

  // Calculate base price (price without VAT) for a cart item
  const getItemBasePriceWithoutVAT = (item) => {
    // The unitPrice already includes VAT
    // Base price = unitPrice / (1 + VAT% / 100)
    // Example: if unitPrice = 100,000 and VAT = 18%
    // Base price = 100,000 / 1.18 = 84,745.76
    return item.unitPrice / (1 + item.vatPercentage / 100);
  };

  // Calculate VAT amount for a specific cart item
  const getItemVATAmount = (item) => {
    // First get the base price (without VAT)
    const basePrice = getItemBasePriceWithoutVAT(item);
    // VAT = base price × VAT% × quantity
    // Example: 84,745.76 × 0.18 × 1 = 15,254.24
    return basePrice * (item.vatPercentage / 100) * item.quantity;
  };

  // Calculate total with VAT for a specific cart item (this is just unitPrice * quantity)
  const getItemTotalWithVAT = (item) => {
    return item.unitPrice * item.quantity;
  };

  const addExtra = () => {
    setExtras([...extras, { description: '', amount: 0 }]);
  };

  const updateExtra = (index, field, value) => {
    setExtras(extras.map((extra, i) => {
      if (i === index) {
        return { ...extra, [field]: field === 'amount' ? parseFloat(value) || 0 : value };
      }
      return extra;
    }));
  };

  const removeExtra = (index) => {
    setExtras(extras.filter((_, i) => i !== index));
  };

  // Calculate subtotal (machine prices without VAT)
  const getSubtotal = () => {
    return cart.reduce((total, item) => {
      const basePriceWithoutVAT = getItemBasePriceWithoutVAT(item);
      return total + (basePriceWithoutVAT * item.quantity);
    }, 0);
  };

  // Calculate total VAT from all items (extracted from prices)
  const getVATAmount = () => {
    return cart.reduce((total, item) => total + getItemVATAmount(item), 0);
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
    return extras.reduce((total, extra) => total + (extra.amount || 0), 0);
  };

  const getFinalTotal = () => {
    return getTotalBeforeDiscount() - getDiscountAmount() + getExtrasTotal();
  };

  const validateSale = async () => {
    try {
      const saleData = {
        customerInfo,
        items: cart.map(item => ({
          machineId: item.machineId,
          quantity: item.quantity,
          vatPercentage: item.vatPercentage,
          warrantyMonths: item.warrantyMonths
        })),
        extras: extras.filter(extra => extra.description && extra.amount > 0)
      };

      console.log('Validating sale with data:', saleData);
      console.log('Customer info:', customerInfo);
      console.log('Cart items:', cart);

      const response = await salesAPI.validate(saleData);
      console.log('Validation response:', response);
      
      if (response.data && response.data.success) {
        // If validation failed, show specific errors
        if (!response.data.data.isValid) {
          const errors = response.data.data.errors || [];
          console.log('Validation errors:', errors);
          setError(`Validation failed: ${errors.join(', ')}`);
        }
        
        return response.data.data.isValid;
      } else {
        console.error('Validation response not successful:', response);
        setError(`Validation failed: ${response.data?.message || 'Unknown error'}`);
        return false;
      }
    } catch (err) {
      console.error('Validation error details:', err);
      console.error('Error response:', err.response?.data);
      
      let errorMessage = 'Unknown validation error';
      if (err.response?.data?.message) {
        errorMessage = err.response.data.message;
      } else if (err.response?.data?.errors) {
        errorMessage = Array.isArray(err.response.data.errors) 
          ? err.response.data.errors.join(', ')
          : err.response.data.errors;
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(`Validation Error: ${errorMessage}`);
      return false;
    }
  };

  const handleSale = async () => {
    // Clear previous errors
    setError('');
    
    if (cart.length === 0) {
      setError('Please add items to cart before processing sale.');
      setTimeout(() => setError(''), 5000);
      return;
    }

    if (!customerInfo.name?.trim()) {
      setError('Customer name is required.');
      setTimeout(() => setError(''), 5000);
      return;
    }

    if (!customerInfo.phone?.trim()) {
      setError('Customer phone number is required.');
      setTimeout(() => setError(''), 5000);
      return;
    }

    try {
      setProcessing(true);

      // Validate sale first
      const isValid = await validateSale();
      if (!isValid) {
        // Error message is already set in validateSale function
        setProcessing(false);
        return;
      }

      const finalTotal = getFinalTotal();

      // Validate payment inputs
      let paidToSend = Number(paidAmount) || 0;
      if (paymentType === 'partial') {
        if (paidToSend < 0) {
          setError('Paid amount must be greater than 0 for partial payments.');
          setProcessing(false);
          return;
        }
        if (paidToSend >= finalTotal) {
          setError('For partial payments the paid amount must be less than the final total. Use Full Payment instead.');
          setProcessing(false);
          return;
        }
      } else {
        // full payment -> mark paid amount as full total
        paidToSend = finalTotal;
      }

      if (paymentMethod === 'cheque' && !chequeNumber.trim()) {
        setError('Cheque number is required when payment method is cheque.');
        setProcessing(false);
        return;
      }

      const saleData = {
        customerInfo: {
          name: customerInfo.name.trim(),
          phone: customerInfo.phone.trim(),
          email: customerInfo.email?.trim() || '',
          nic: customerInfo.nic?.trim() || '',
          address: customerInfo.address?.trim() || '',
          vatNo: customerVatNumber?.trim() || ''
        },
        items: cart.map(item => ({
          machineId: item.machineId,
          quantity: item.quantity,
          vatPercentage: item.vatPercentage,
          warrantyMonths: item.warrantyMonths
        })),
        extras: extras.filter(extra => extra.description && extra.amount > 0),
        vatRate: vatRate, // Keep for reference
        discountAmount: getDiscountAmount(),
        notes: '',
        processedBy: 'Admin',
        // Payment metadata
        paymentType: paymentType,
        paidAmount: Math.round(paidToSend * 100) / 100,
        paymentPeriodDays: paymentType === 'partial' ? (Number(paymentPeriodDays) || 60) : 0,
        remainingAmount: Math.round((finalTotal - paidToSend) * 100) / 100,
        paymentMethod,
        chequeNumber: paymentMethod === 'cheque' ? chequeNumber.trim() : ''
      };

      console.log('Processing sale with data:', saleData);
      const response = await salesAPI.process(saleData);
      
      if (response.data.success) {
        const orderData = response.data.data.orderSummary;
        setSuccessMessage(`Sale processed successfully! Order ID: ${orderData.orderId}`);
        
        // Generate and download invoice
        try {
          const invoiceData = {
            customerInfo: saleData.customerInfo,
            customerVatNumber: customerVatNumber,
            items: cart.map(item => ({
              machineId: item.machineId,
              name: item.name,
              quantity: item.quantity,
              unitPrice: item.unitPrice,
              vatPercentage: item.vatPercentage,
              vatAmount: getItemVATAmount(item),
              warrantyMonths: item.warrantyMonths,
              totalWithVAT: getItemTotalWithVAT(item),
              note: item.note || '' // Include machine note for invoice
            })),
            cart: cart, // Include full cart data for invoice generation
            extras: extras.filter(extra => extra.description && extra.amount > 0),
            subtotal: getSubtotal(),
            vatRate: vatRate,
            vatAmount: getVATAmount(),
            discountAmount: getDiscountAmount(),
            finalTotal: getFinalTotal(),
            // Payment details
            paymentType: paymentType,
            paymentMethod,
            chequeNumber: paymentMethod === 'cheque' ? chequeNumber.trim() : '',
            paidAmount: paymentType === 'partial' ? paidToSend : getFinalTotal(),
            remainingAmount: paymentType === 'partial' ? Math.round((finalTotal - paidToSend) * 100) / 100 : 0
          };

          const invoiceResult = await generateInvoice(invoiceData, orderData);
          if (invoiceResult.success) {
            setSuccessMessage(`Sale processed successfully! Order ID: ${orderData.orderId}. Invoice downloaded as ${invoiceResult.filename}`);
          } else {
            setSuccessMessage(`Sale processed successfully! Order ID: ${orderData.orderId}. Note: Invoice generation failed - ${invoiceResult.message}`);
          }
        } catch (invoiceError) {
          console.error('Invoice generation error:', invoiceError);
          setSuccessMessage(`Sale processed successfully! Order ID: ${orderData.orderId}. Note: Invoice generation failed.`);
        }
        
        // Reset form
        setCart([]);
        setExtras([]);
        setCustomerInfo({ name: '', email: '', phone: '', nic: '', address: '' });
        setCustomerSearchResults([]);
        setShowCustomerDropdown(false);
        setCustomerVatNumber(''); // Reset customer VAT number

        setDiscountAmount(0);
        
        // Reset payment fields to default
        setPaymentType('full');
        setPaidAmount(0);
        setPaymentPeriodDays(60);
        setPaymentMethod('cash');
        setChequeNumber('');
        
        // Refresh machines to get updated stock
        await fetchMachines();
        
        // Clear success message after 8 seconds (longer due to invoice message)
        setTimeout(() => setSuccessMessage(''), 8000);
      } else {
        setError(`Sale processing failed: ${response.data.message || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Sale processing error:', err);
      const errorInfo = handleApiError(err);
      setError(`Sale Error: ${errorInfo.message}`);
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
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent">
          Sell Item
        </h1>
        <p className="text-slate-600 mt-2 text-sm sm:text-base">Process sales and manage customer orders</p>
      </div>

      {/* Alert Messages */}
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

      {/* First Row: Items and Cart Side by Side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 mb-4 sm:mb-6">
        {/* Product Selection */}
        <div className="lg:col-span-1">
          <div className="bg-white/60 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-200/50 p-4 sm:p-6 h-full">
            <h3 className="text-lg sm:text-xl font-bold text-slate-800 mb-3 sm:mb-4">Available Machines</h3>
            
            {/* Search and Filter */}
            <div className="flex flex-col md:flex-row gap-3 sm:gap-4 mb-4 sm:mb-6">
              <div className="relative flex-1">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search machines..."
                  value={searchTerm}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white/50"
                />
              </div>
              <select
                value={selectedCategory}
                onChange={(e) => handleCategoryChange(e.target.value)}
                className="px-4 py-3 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white/50"
              >
                <option value="all">All Categories</option>
                {categories.map((category) => (
                  <option key={category.name} value={category.name}>
                    {category.name} ({category.count})
                  </option>
                ))}
              </select>
            </div>

            {/* Loading State */}
            {loading && (
              <div className="text-center py-8">
                <div className="animate-spin-fast rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto"></div>
                <p className="text-slate-600 mt-4">Loading machines...</p>
              </div>
            )}

            {/* Pagination Info */}
            <div className="flex justify-between items-center mb-4">
              <p className="text-sm text-slate-600">
                Showing page {currentPage} of {totalPages} ({totalMachines} total items)
              </p>
            </div>

            {/* Items Grid */}
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
                            onClick={() => addToCart(machine)}
                            disabled={machine.quantity === 0}
                            className="px-3 py-2 bg-gradient-to-r from-blue-500 to-blue-600 text-white rounded-lg hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed text-sm whitespace-nowrap"
                          >
                            Add to Cart
                          </button>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Pagination Controls */}
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
                  const pages = [];
                  const maxPagesToShow = 5;
                  let startPage = Math.max(1, currentPage - Math.floor(maxPagesToShow / 2));
                  let endPage = Math.min(totalPages, startPage + maxPagesToShow - 1);
                  
                  if (endPage - startPage < maxPagesToShow - 1) {
                    startPage = Math.max(1, endPage - maxPagesToShow + 1);
                  }
                  
                  for (let i = startPage; i <= endPage; i++) {
                    pages.push(i);
                  }
                  
                  return pages.map((page) => (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page)}
                      className={`px-3 py-1 text-sm rounded ${
                        currentPage === page
                          ? 'bg-blue-500 text-white'
                          : 'border border-slate-300 hover:bg-slate-50'
                      }`}
                    >
                      {page}
                    </button>
                  ));
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

        {/* Cart Section with VAT/Discount and Extra Charges */}
        <div className="lg:col-span-1">
          <div className="space-y-4 h-full">
            {/* Cart */}
            <div className="bg-white/60 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-200/50 p-6">
                <h3 className="text-xl font-bold text-slate-800 mb-4 flex items-center">
                  <ShoppingCartIcon className="w-6 h-6 mr-2" />
                  Cart ({cart.length})
                </h3>
                
                {cart.length === 0 ? (
                  <p className="text-slate-500 text-center py-8">No items in cart</p>
                ) : (
                  <div className="space-y-4">
                    {cart.map((item) => (
                      <div key={item.machineId} className="border border-slate-200 rounded-lg p-4 bg-white/50">
                        <div className="flex justify-between items-start mb-3">
                          <div>
                            <h5 className="font-medium text-slate-800 text-sm">{item.name}</h5>
                            <p className="text-xs text-slate-600">ID: {item.itemId}</p>
                          </div>
                          <button
                            onClick={() => removeFromCart(item.machineId)}
                            className="text-red-500 hover:text-red-700 text-xs"
                          >
                            <XMarkIcon className="w-4 h-4" />
                          </button>
                        </div>
                        
                        {/* Quantity Controls */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            <button
                              onClick={() => updateCartQuantity(item.machineId, -1)}
                              className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center hover:bg-slate-300"
                            >
                              <MinusIcon className="w-3 h-3" />
                            </button>
                            <span className="text-sm font-medium">Qty: {item.quantity}</span>
                            <button
                              onClick={() => updateCartQuantity(item.machineId, 1)}
                              className="w-6 h-6 rounded-full bg-slate-200 flex items-center justify-center hover:bg-slate-300"
                            >
                              <PlusIcon className="w-3 h-3" />
                            </button>
                          </div>
                          <span className="text-xs text-slate-500">Stock: {item.availableStock}</span>
                        </div>

                        {/* Price Breakdown */}
                        <div className="space-y-2 mb-3 bg-slate-50 p-2 rounded">
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-600">Unit Price (incl. VAT):</span>
                            <span className="font-medium">Rs. {item.unitPrice.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-600">Machine Price ({item.quantity}x):</span>
                            <span className="font-medium">Rs. {(getItemBasePriceWithoutVAT(item) * item.quantity).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-xs">
                            <span className="text-slate-600">VAT ({item.vatPercentage}%):</span>
                            <span className="font-medium text-blue-600">Rs. {getItemVATAmount(item).toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-xs font-bold border-t border-slate-200 pt-2">
                            <span className="text-slate-700">Total with VAT:</span>
                            <span className="text-green-600">Rs. {getItemTotalWithVAT(item).toFixed(2)}</span>
                          </div>
                        </div>

                        {/* Editable VAT and Warranty */}
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">VAT %</label>
                            <input
                              type="number"
                              min="0"
                              max="100"
                              step="0.1"
                              value={item.vatPercentage}
                              onChange={(e) => updateCartItemVAT(item.machineId, e.target.value)}
                              className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-slate-700 mb-1">Warranty (months)</label>
                            <input
                              type="number"
                              min="0"
                              step="1"
                              value={item.warrantyMonths}
                              onChange={(e) => updateCartItemWarranty(item.machineId, e.target.value)}
                              className="w-full px-2 py-1 text-xs border border-slate-300 rounded focus:ring-1 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                        
                        {/* Editable machine description/note */}
                        <div className="mt-2 pt-2 border-t border-slate-200">
                          <label className="block text-xs font-medium text-slate-700 mb-1">Machine Description:</label>
                          <textarea
                            value={item.note || ''}
                            onChange={(e) => updateCartItemNote(item.machineId, e.target.value)}
                            rows="2"
                            maxLength={1200}
                            placeholder="Add or edit machine description"
                            className="w-full px-2 py-1 text-xs text-slate-700 border border-slate-300 rounded bg-white/70 focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                      </div>
                    ))}
                    
                    {/* Cart Totals */}
                    <div className="border-t border-slate-200 pt-4 space-y-3">
                      <div className="space-y-2">
                        <div className="flex justify-between text-sm text-slate-600">
                          <span>Subtotal (Machine Prices):</span>
                          <span>Rs. {getSubtotal().toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between text-sm text-blue-600">
                          <span>Total VAT (Per-Item):</span>
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
                      </div>
                      <div className="border-t border-slate-200 pt-2">
                        <div className="flex justify-between items-center text-xl font-bold text-slate-800">
                          <span>Final Total:</span>
                          <span className="text-green-600">Rs. {getFinalTotal().toFixed(2)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

            {/* Discount */}
            <div className="bg-white/60 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-200/50 p-6">
              <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
                <ReceiptPercentIcon className="w-5 h-5 mr-2" />
                Discount
              </h3>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Discount Amount (Rs.)</label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={discountAmount}
                  onChange={(e) => {
                    const value = parseFloat(e.target.value) || 0;
                    // Allow user to input any value, but it will be capped in calculations
                    setDiscountAmount(Math.max(0, value));
                  }}
                  onBlur={() => {
                    // On blur, cap the discount to totalBeforeDiscount if it exceeds
                    const totalBefore = getTotalBeforeDiscount();
                    if (discountAmount > totalBefore) {
                      setDiscountAmount(totalBefore);
                    }
                  }}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white/50 text-sm"
                  placeholder="Enter discount amount in Rs."
                />
                {discountAmount > getTotalBeforeDiscount() && (
                  <p className="text-xs text-amber-600 mt-1">⚠️ Discount will be capped to total (Rs. {getTotalBeforeDiscount().toFixed(2)})</p>
                )}
              </div>
            </div>

            {/* Extra Charges */}
            <div className="bg-white/60 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-200/50 p-6">
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-lg font-bold text-slate-800 flex items-center">
                  <ReceiptPercentIcon className="w-5 h-5 mr-2" />
                  Extra Charges
                </h3>
                <button
                  onClick={addExtra}
                  className="text-sm bg-blue-500 text-white px-3 py-1 rounded-lg hover:bg-blue-600"
                >
                  <PlusIcon className="w-4 h-4 inline mr-1" />
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
                        onChange={(e) => updateExtra(index, 'amount', e.target.value)}
                        className="w-20 px-2 py-2 border border-slate-300 rounded-lg text-sm bg-white/50"
                      />
                      <button
                        onClick={() => removeExtra(index)}
                        className="text-red-500 hover:text-red-700 p-2"
                      >
                        <XMarkIcon className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Second Row: Customer Information - Full Width */}
      <div className="bg-white/60 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-200/50 p-6">
        <h3 className="text-xl font-bold text-slate-800 mb-6">Customer Information & Complete Sale</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="relative">
            <label className="block text-sm font-medium text-slate-700 mb-2">Customer Name *</label>
            <input
              type="text"
              placeholder="Enter customer name"
              value={customerInfo.name}
              onChange={(e) => handleCustomerNameChange(e.target.value)}
              onFocus={() => {
                if (customerInfo.name.trim()) {
                  searchCustomers(customerInfo.name);
                }
              }}
              onBlur={(e) => {
                // Only hide dropdown if not clicking on dropdown items
                const relatedTarget = e.relatedTarget;
                if (!relatedTarget || !relatedTarget.closest('.customer-dropdown')) {
                  setTimeout(() => setShowCustomerDropdown(false), 150);
                }
              }}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white/50"
              required
              autoComplete="off"
            />
            
            {/* Customer Search Dropdown */}
            {showCustomerDropdown && (
              <div className="customer-dropdown absolute z-50 w-full mt-1 bg-white border border-slate-300 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                {customerSearchLoading ? (
                  <div className="px-4 py-3 text-center text-slate-500">
                    <div className="animate-spin inline-block w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full mr-2"></div>
                    Searching customers...
                  </div>
                ) : customerSearchResults && customerSearchResults.length > 0 ? (
                  customerSearchResults.map((customer) => (
                    <div
                      key={customer._id}
                      className="px-4 py-3 hover:bg-slate-50 cursor-pointer border-b border-slate-100 last:border-b-0"
                      onClick={() => handleCustomerSelect(customer)}
                      onMouseDown={(e) => e.preventDefault()} // Prevent input blur
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
                      className="px-4 py-3 hover:bg-blue-50 cursor-pointer border-t border-slate-200 text-blue-600 font-medium"
                      onClick={() => {
                        // Keep the current name and hide dropdown, user can fill other fields manually
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
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white/50"
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
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white/50"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Customer VAT Number (Optional)</label>
            <input
              type="text"
              placeholder="e.g., VAT123456789"
              value={customerVatNumber}
              onChange={(e) => setCustomerVatNumber(e.target.value)}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white/50"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">NIC (Optional)</label>
            <input
              type="text"
              placeholder="Enter NIC number"
              value={customerInfo.nic}
              onChange={(e) => setCustomerInfo({...customerInfo, nic: e.target.value})}
              className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white/50"
            />
          </div>
        </div>

        {/* Address Field - Full Width */}
        <div className="mb-6">
          <label className="block text-sm font-medium text-slate-700 mb-2">Address (Optional)</label>
          <textarea
            placeholder="Enter customer address"
            value={customerInfo.address}
            onChange={(e) => setCustomerInfo({...customerInfo, address: e.target.value})}
            className="w-full px-4 py-3 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white/50"
            rows="2"
          />
        </div>

        {/* Payment Options (above action buttons) */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
          <div className="md:col-span-1">
            <label className="block text-sm font-medium text-slate-700 mb-2">Payment Type</label>
            <select value={paymentType} onChange={(e) => setPaymentType(e.target.value)} className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white/50">
              <option value="full">Full Payment</option>
              <option value="partial">Partial Payment</option>
            </select>
          </div>

          {paymentType === 'partial' && (
            <>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Paid Amount</label>
                <input type="number" min="0" value={paidAmount} onChange={(e) => setPaidAmount(Number(e.target.value) || 0)} className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white/50" />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Payment Period (days)</label>
                <input type="number" min="0" value={paymentPeriodDays} onChange={(e) => setPaymentPeriodDays(parseInt(e.target.value) || 0)} className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white/50" />
              </div>
            </>
          )}

          {paymentType === 'partial' && (
            <div className="md:col-span-3 text-sm text-slate-600">
              <div className="flex items-center justify-between">
                <div>Remaining Amount:</div>
                <div className="font-semibold">Rs. {(getFinalTotal() - (paidAmount || 0)).toFixed(2)}</div>
              </div>
            </div>
          )}

          <div className="md:col-span-1">
            <label className="block text-sm font-medium text-slate-700 mb-2">Payment Method</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white/50"
            >
              <option value="cash">Cash</option>
              <option value="bank transfer">Bank Transfer</option>
              <option value="cheque">Cheque</option>
            </select>
          </div>

          {paymentMethod === 'cheque' && (
            <div className="md:col-span-1">
              <label className="block text-sm font-medium text-slate-700 mb-2">Cheque Number</label>
              <input
                type="text"
                value={chequeNumber}
                onChange={(e) => setChequeNumber(e.target.value)}
                placeholder="Enter cheque number"
                className="w-full px-3 py-2 border border-slate-300 rounded-lg bg-white/50"
              />
            </div>
          )}

        </div>

        {/* Complete Sale Button */}
        <div className="flex justify-center">
          <button
            onClick={handleSale}
            disabled={cart.length === 0 || processing}
            className="px-8 py-4 bg-gradient-to-r from-green-500 to-green-600 text-white rounded-xl font-bold text-lg hover:scale-105 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center shadow-lg"
          >
            {processing ? (
              <>
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Processing Sale...
              </>
            ) : (
              <>
                <CreditCardIcon className="w-6 h-6 mr-2" />
                Complete Sale & Generate Invoice - Rs. {getFinalTotal().toFixed(2)}
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default SellItem;
