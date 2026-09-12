import React, { useState, useEffect } from 'react';
import api from '../services/apiService';
import { 
  CurrencyDollarIcon, 
  ShoppingCartIcon,
  ExclamationTriangleIcon,
  ChartBarIcon,
  ArchiveBoxIcon,
  CalendarIcon
} from '@heroicons/react/24/outline';

const Dashboard = () => {
  // Dashboard data state
  const [monthlyRevenue, setMonthlyRevenue] = useState(null);
  const [totalOrders, setTotalOrders] = useState(null);
  const [totalItems, setTotalItems] = useState(null);
  const [lowStock, setLowStock] = useState(null);
  const [monthlyGraph, setMonthlyGraph] = useState([]);
  const [bestSellingMachines, setBestSellingMachines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [partialErrors, setPartialErrors] = useState([]);

  // Fetch all dashboard data
  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        setLoading(true);
        setError(null);
        setPartialErrors([]);

        console.log('🔄 Dashboard: Starting to fetch data...');
        console.log('📡 API Base URL:', api.defaults.baseURL);
        console.log('🌍 Environment:', process.env.NODE_ENV);
        console.log('🔗 REACT_APP_API_URL:', process.env.REACT_APP_API_URL);

        const failedRequests = [];

        // Fetch Monthly Revenue
        try {
          const response = await api.get('/dashboard/monthly-revenue');
          console.log('✅ Monthly Revenue loaded:', response.data);
          if (response.data.success) {
            setMonthlyRevenue(response.data.data);
          }
        } catch (err) {
          console.error('❌ Monthly Revenue failed:', err.message);
          console.error('   URL attempted:', err.config?.url);
          console.error('   Status:', err.response?.status);
          failedRequests.push('Monthly Revenue');
        }

        // Fetch Total Orders
        try {
          const response = await api.get('/dashboard/total-orders');
          console.log('✅ Total Orders loaded:', response.data);
          if (response.data.success) {
            setTotalOrders(response.data.data);
            console.log('Total Orders data set:', response.data.data);
          }
        } catch (err) {
          console.error('❌ Total Orders failed:', err.message);
          console.error('   URL attempted:', err.config?.url);
          console.error('   Status:', err.response?.status);
          failedRequests.push('Total Orders');
        }

        // Fetch Low Stock
        try {
          const response = await api.get('/dashboard/low-stock');
          console.log('✅ Low Stock loaded:', response.data);
          if (response.data.success) {
            setLowStock(response.data.data);
          }
        } catch (err) {
          console.error('❌ Low Stock failed:', err.message);
          console.error('   URL attempted:', err.config?.url);
          console.error('   Status:', err.response?.status);
          failedRequests.push('Low Stock');
        }

        // Fetch Total Items
        try {
          const response = await api.get('/dashboard/total-items');
          console.log('✅ Total Items loaded:', response.data);
          if (response.data.success) {
            setTotalItems(response.data.data);
            console.log('Total Items data set:', response.data.data);
          }
        } catch (err) {
          console.error('❌ Total Items failed:', err.message);
          console.error('   URL attempted:', err.config?.url);
          console.error('   Status:', err.response?.status);
          failedRequests.push('Total Items');
        }

        // Fetch Monthly Graph
        try {
          const response = await api.get('/dashboard/monthly-graph');
          console.log('✅ Monthly Graph loaded:', response.data);
          if (response.data.success) {
            setMonthlyGraph(response.data.data);
          }
        } catch (err) {
          console.error('❌ Monthly Graph failed:', err.message);
          console.error('   URL attempted:', err.config?.url);
          console.error('   Status:', err.response?.status);
          failedRequests.push('Monthly Graph');
        }

        // Fetch Best Selling Machines
        try {
          const response = await api.get('/dashboard/best-selling-machines');
          console.log('✅ Best Selling Machines loaded:', response.data);
          if (response.data.success) {
            setBestSellingMachines(response.data.data);
          }
        } catch (err) {
          console.error('❌ Best Selling Machines failed:', err.message);
          console.error('   URL attempted:', err.config?.url);
          console.error('   Status:', err.response?.status);
          failedRequests.push('Best Selling Machines');
        }

        // Set partial errors if any requests failed
        if (failedRequests.length > 0) {
          setPartialErrors(failedRequests);
          console.warn('⚠️ Dashboard loaded with some errors:', failedRequests);
        } else {
          console.log('✅ Dashboard: All data loaded successfully!');
        }

      } catch (err) {
        console.error('❌ Critical Dashboard error:', err);
        console.error('Error details:', {
          message: err.message,
          response: err.response?.data,
          status: err.response?.status,
          config: err.config?.url
        });
        setError(err.response?.data?.message || err.message || 'Failed to fetch dashboard data');
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, []);

  // Format currency as "LKR 123,456.78"
  const formatCurrency = (amount) => {
    if (!amount && amount !== 0) return 'LKR 0.00';
    if (typeof amount !== 'number') return 'LKR 0.00';
    return `LKR ${amount.toLocaleString('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    })}`;
  };

  // Format currency without cents as "LKR 123,456"
  const formatCurrencyNoCents = (amount) => {
    if (!amount && amount !== 0) return 'LKR 0';
    if (typeof amount !== 'number') return 'LKR 0';
    return `LKR ${Math.round(amount).toLocaleString('en-US')}`;
  };

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 sm:p-6 lg:p-8">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 sm:h-16 sm:w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
            <p className="text-sm sm:text-base text-slate-600">Loading dashboard...</p>
          </div>
        </div>
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 sm:p-6 lg:p-8">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 sm:px-6 py-4 rounded-lg">
          <h3 className="font-bold text-base sm:text-lg mb-2">Error loading dashboard</h3>
          <p className="text-sm sm:text-base">{error}</p>
        </div>
      </div>
    );
  }

  // Calculate max revenue for chart scaling
  const maxRevenue = monthlyGraph.length > 0 
    ? Math.max(...monthlyGraph.map(item => item.revenue))
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 sm:p-6 lg:p-8">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Dashboard Overview</h1>
            <p className="text-xs sm:text-sm text-gray-600 flex items-center gap-2">
              <CalendarIcon className="w-4 h-4" />
              {new Date().toLocaleString('en-US', { month: 'long', year: 'numeric' })}
            </p>
          </div>
        </div>
      </div>

      {/* Partial Errors Warning */}
      {partialErrors.length > 0 && (
        <div className="mb-4 sm:mb-6 bg-yellow-50 border border-yellow-200 text-yellow-800 px-4 sm:px-6 py-3 sm:py-4 rounded-lg">
          <div className="flex items-start">
            <ExclamationTriangleIcon className="w-5 h-5 mt-0.5 mr-2 flex-shrink-0" />
            <div>
              <h3 className="font-semibold mb-1 text-sm sm:text-base">Some data could not be loaded</h3>
              <p className="text-xs sm:text-sm">Failed to load: {partialErrors.join(', ')}</p>
            </div>
          </div>
        </div>
      )}

      {/* Compact Stats Cards Grid */}
  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-6 sm:mb-8">
        <StatCard 
          icon={<CurrencyDollarIcon className="w-5 h-5" />} 
          color="emerald"
          title="Monthly Revenue" 
          subtitle={monthlyRevenue && monthlyRevenue.month && monthlyRevenue.year ? `${monthlyRevenue.month} ${monthlyRevenue.year}` : 'This month'}
          value={monthlyRevenue && monthlyRevenue.revenue ? formatCurrencyNoCents(monthlyRevenue.revenue) : 'LKR 0'}
          trend={null}
        />
        <StatCard 
          icon={<ShoppingCartIcon className="w-5 h-5" />} 
          color="indigo"
          title="Total Orders" 
          subtitle="All time orders"
          value={totalOrders && totalOrders.count ? totalOrders.count.toLocaleString() : '0'}
          trend={null}
        />
        <StatCard 
          icon={<ArchiveBoxIcon className="w-5 h-5" />} 
          color="amber"
          title="Available Inventory" 
          subtitle={totalItems && totalItems.inStock !== undefined ? `${totalItems.inStock} items in stock${lowStock && lowStock.count ? ` • ${lowStock.count} low` : ''}` : 'Items available'}
          value={totalItems && totalItems.totalQuantity ? totalItems.totalQuantity.toLocaleString() : '0'}
          trend={null}
        />
      </div>

      {/* Monthly Revenue Chart and Best Selling Machines */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Monthly Revenue Chart - Takes 2/3 of the space */}
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-lg p-4 sm:p-6">
          <div className="flex items-center mb-4 sm:mb-6">
            <ChartBarIcon className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600 mr-2" />
            <h2 className="text-lg sm:text-xl font-bold text-slate-800">
              Monthly Revenue Overview
            </h2>
          </div>

          {/* Chart Legend */}
          <div className="flex items-center justify-end mb-3 sm:mb-4">
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="flex items-center">
                <div className="w-3 h-3 sm:w-4 sm:h-4 bg-blue-500 rounded mr-2"></div>
                <span className="text-xs sm:text-sm text-slate-600">Monthly Revenue</span>
              </div>
            </div>
          </div>

          {/* Bar Chart */}
          <div className="relative">
            {monthlyGraph.length === 0 ? (
              <div className="flex items-center justify-center h-48 sm:h-64 bg-slate-50 rounded-lg">
                <p className="text-sm sm:text-base text-slate-500">No data available</p>
              </div>
            ) : (
              <div className="flex items-end justify-between h-48 sm:h-64 bg-gradient-to-t from-slate-50 to-transparent rounded-lg p-2 sm:p-4 overflow-x-auto">{monthlyGraph.map((data, index) => {
                  // Calculate bar height (percentage of max)
                  const heightPercentage = maxRevenue > 0 ? (data.revenue / maxRevenue) * 100 : 0;
                  const displayHeight = data.revenue > 0 ? Math.max(heightPercentage, 5) : 2;
                  
                  // Check if this is the current month (using backend flag or fallback to last item)
                  const isCurrentMonth = data.isCurrentMonth || index === monthlyGraph.length - 1;

                  return (
                    <div key={index} className="flex flex-col items-center flex-1 group min-w-[30px] sm:min-w-0">
                      {/* Bar Container */}
                      <div className="relative flex items-end mb-2" style={{ height: '160px' }}>
                        <div
                          className={`w-5 sm:w-8 rounded-t transition-all duration-300 group-hover:opacity-80 relative ${
                            data.revenue === 0 
                              ? 'bg-slate-200' 
                              : isCurrentMonth
                              ? 'bg-gradient-to-t from-blue-600 to-blue-500 shadow-lg shadow-blue-500/50'
                              : 'bg-gradient-to-t from-blue-500 to-blue-400'
                          }`}
                          style={{ height: `${displayHeight}%` }}
                          title={`${data.month} ${data.year}: ${formatCurrency(data.revenue)}`}
                        >
                          {/* Current month indicator */}
                          {isCurrentMonth && data.revenue > 0 && (
                            <>
                              <div className="absolute inset-0 bg-blue-400/30 animate-pulse"></div>
                              <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-1.5 h-1.5 sm:w-2 sm:h-2 bg-blue-500 rounded-full"></div>
                            </>
                          )}
                          
                          {/* Tooltip on hover */}
                          <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10 pointer-events-none">
                            <div className="bg-slate-800 text-white text-[10px] sm:text-xs rounded py-1.5 sm:py-2 px-2 sm:px-3 whitespace-nowrap shadow-lg">
                              <div className="font-semibold">{formatCurrency(data.revenue)}</div>
                              <div className="text-slate-300">{data.month} {data.year}</div>
                              {isCurrentMonth && <div className="text-blue-300 text-[8px] sm:text-[10px]">Current Month</div>}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Month Label */}
                      <div className={`text-[10px] sm:text-xs font-medium truncate w-full text-center ${
                        isCurrentMonth ? 'text-blue-600 font-bold' : 'text-slate-600'
                      }`}>
                        {data.month.substring(0, 3)}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Chart Footer */}
          <div className="mt-3 sm:mt-4 text-center">
            <p className="text-[10px] sm:text-xs text-slate-500">
              Last 12 months • Hover over bars to see details • Max: {formatCurrency(maxRevenue)}
            </p>
          </div>
        </div>

        {/* Best Selling Machines - Takes 1/3 of the space */}
        <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6 flex flex-col">
          <div className="flex items-center mb-4">
            <ChartBarIcon className="w-6 h-6 text-green-600 mr-2" />
            <h2 className="text-lg font-bold text-slate-800">
              Best Selling
            </h2>
          </div>
          <p className="text-sm text-slate-600 mb-4">Top 6 machines</p>

          {/* Best Selling Machines List - Fixed height with scroll */}
          <div className="flex-1 overflow-y-auto" style={{ maxHeight: '400px' }}>
            {bestSellingMachines.length === 0 ? (
              <div className="flex items-center justify-center h-32 bg-slate-50 rounded-lg">
                <p className="text-slate-500 text-sm">No sales data available</p>
              </div>
            ) : (
              <div className="space-y-3">
                {bestSellingMachines.map((machine, index) => (
                  <div key={machine._id} className="border rounded-lg p-3 hover:shadow-md transition-shadow">
                    {/* Rank and Item ID */}
                    <div className="flex items-center justify-between mb-2">
                      <div className={`
                        w-7 h-7 rounded-full flex items-center justify-center text-white text-sm font-bold
                        ${index === 0 ? 'bg-yellow-500' : index === 1 ? 'bg-gray-400' : 'bg-orange-500'}
                      `}>
                        {index + 1}
                      </div>
                      <div className="text-xs text-slate-500">
                        #{machine.itemId}
                      </div>
                    </div>

                    {/* Machine Name and Category */}
                    <h3 className="font-semibold text-slate-800 text-sm mb-1 leading-tight overflow-hidden" style={{
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      textOverflow: 'ellipsis'
                    }}>
                      {machine.machineName}
                    </h3>
                    <p className="text-xs text-slate-600 mb-3">
                      {machine.category}
                    </p>

                    {/* Key Stats - Simplified */}
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-500">Sold:</span>
                        <span className="text-sm font-semibold text-slate-700">
                          {machine.totalQuantitySold} units
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-500">Revenue:</span>
                        <span className="text-sm font-semibold text-green-600">
                          {formatCurrencyNoCents(machine.totalRevenue)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-xs text-slate-500">Stock:</span>
                        <span className={`text-sm font-semibold ${
                          machine.currentStock < 3 ? 'text-red-600' : 'text-slate-700'
                        }`}>
                          {machine.currentStock}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Modern Stat Card Component
const StatCard = ({ icon, color, title, subtitle, value, trend }) => {
  const colorClasses = {
    emerald: 'from-emerald-500 to-teal-600',
    blue: 'from-blue-500 to-indigo-600',
    purple: 'from-purple-500 to-pink-600',
    amber: 'from-amber-500 to-orange-600',
    indigo: 'from-indigo-500 to-blue-700',
  };
  const gradient = colorClasses[color] || 'from-slate-500 to-slate-600';

  return (
    <div className="bg-white rounded-xl shadow-md hover:shadow-lg transition-all duration-300 p-4 border border-gray-100 transform hover:-translate-y-0.5">
      <div className="flex items-center justify-between mb-2">
        <div className={`p-2 rounded-lg bg-gradient-to-br ${gradient} shadow-md`}>
          <div className="text-white">{icon}</div>
        </div>
      </div>
      <h3 className="text-2xl font-bold text-gray-900 mb-0.5">{value}</h3>
      <p className="text-gray-800 font-semibold text-xs mb-0.5">{title}</p>
      <p className="text-gray-500 text-[10px]">{subtitle}</p>
      {trend && (
        <div className="mt-2 pt-2 border-t border-gray-100">
          <p className="text-[10px] text-gray-600">{trend}</p>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
