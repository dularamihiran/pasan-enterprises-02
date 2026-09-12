import React, { useState, useEffect, lazy } from 'react';
import Sidebar from './components/Sidebar';
import ProtectedRoute from './components/ProtectedRoute';
import { userAPI } from './services/apiService';

// Code splitting: Lazy load pages to reduce initial bundle size
const Dashboard = lazy(() => import('./pages/Dashboard'));
const ViewInventory = lazy(() => import('./pages/ViewInventory'));
const SellItem = lazy(() => import('./pages/SellItem'));
const Quotation = lazy(() => import('./pages/Quotation'));
const PastOrders = lazy(() => import('./pages/PastOrders'));
const Refunds = lazy(() => import('./pages/Refunds'));
const AddInventory = lazy(() => import('./pages/AddInventory'));
const Customers = lazy(() => import('./pages/Customers'));
const Login = lazy(() => import('./pages/auth/Login'));

function App() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true); // Add loading state for initial auth check
  const [currentUser, setCurrentUser] = useState(null);

  useEffect(() => {
    const checkAuthAndFetchUser = async () => {
      // Check authentication state on mount
      const isLoggedIn = sessionStorage.getItem('isLoggedIn') === 'true';
      const authToken = sessionStorage.getItem('authToken');
      const storedUser = sessionStorage.getItem('user');
      
      if (isLoggedIn && authToken) {
        try {
          // First, use stored user data if available
          if (storedUser) {
            const user = JSON.parse(storedUser);
            setCurrentUser(user);
            
            // Set default tab based on user role
            // Only admin users can access dashboard, others start on view-inventory
            if (user.role !== 'admin') {
              setActiveTab('view-inventory');
            }
          }
          
          setIsAuthenticated(true);
          
          // Then try to fetch fresh user data from API
          try {
            const response = await userAPI.getCurrentUser();
            if (response.data.success) {
              const freshUser = response.data.data;
              setCurrentUser(freshUser);
              
              // Update default tab if role changed
              if (freshUser.role !== 'admin') {
                setActiveTab('view-inventory');
              }
            }
          } catch (apiError) {
            console.warn('Could not fetch fresh user data on startup:', apiError);
            // Keep using stored user data, don't logout unless stored data is also missing
            if (!storedUser) {
              handleLogout();
            }
          }
        } catch (error) {
          console.error('Auth check failed:', error);
          handleLogout();
        }
      } else {
        setIsAuthenticated(false);
      }
      
      setIsLoading(false);
    };
    
    checkAuthAndFetchUser();
  }, []);

  const renderPage = () => {
    // Suspense wrapper for lazy-loaded components with loading fallback
    const LoadingFallback = (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-slate-700"></div>
      </div>
    );

    const PageContent = () => {
      switch (activeTab) {
        case 'dashboard':
          // Protected: Only admin can access dashboard
          return (
            <ProtectedRoute allowedRoles={['admin']}>
              <Dashboard />
            </ProtectedRoute>
          );
        case 'view-inventory':
          return <ViewInventory />;
        case 'sell-item':
          return <SellItem />;
        case 'quotation':
          return <Quotation />;
        case 'past-orders':
          return <PastOrders />;
        case 'refunds':
          return <Refunds />;
        case 'add-inventory':
          return <AddInventory />;
        case 'customers':
          return <Customers />;
        default:
          // If user tries to access dashboard by default but isn't authorized,
          // redirect to view-inventory
          if (currentUser && currentUser.role !== 'admin') {
            return <ViewInventory />;
          }
          return (
            <ProtectedRoute allowedRoles={['admin']}>
              <Dashboard />
            </ProtectedRoute>
          );
      }
    };

    return (
      <React.Suspense fallback={LoadingFallback}>
        <PageContent />
      </React.Suspense>
    );
  };

  const handleLogout = () => {
    // Clear all storage items (both sessionStorage and localStorage for cleanup)
    sessionStorage.removeItem('isLoggedIn');
    sessionStorage.removeItem('authToken');
    sessionStorage.removeItem('user');
    localStorage.removeItem('isLoggedIn'); // cleanup old localStorage data
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    localStorage.removeItem('userEmail'); // legacy cleanup
    setIsAuthenticated(false);
    setCurrentUser(null);
    // Reset to a safe default page (view-inventory) instead of dashboard
    // This prevents unauthorized access attempts after logout
    setActiveTab('view-inventory');
  };

  // Provide a function to be called by Login on success.
  const handleLoginSuccess = async () => {
    try {
      // First, try to get user data from sessionStorage (set by authService)
      const storedUser = sessionStorage.getItem('user');
      if (storedUser) {
        setCurrentUser(JSON.parse(storedUser));
      }
      
      setIsAuthenticated(true);
      
      // Optionally fetch fresh user data from API
      try {
        const response = await userAPI.getCurrentUser();
        if (response.data.success) {
          setCurrentUser(response.data.data);
        }
      } catch (apiError) {
        console.warn('Could not fetch fresh user data:', apiError);
        // Keep using stored user data
      }
    } catch (error) {
      console.error('Failed in login success handler:', error);
      setIsAuthenticated(true); // Still authenticate even if user setup fails
    }
  };

  // Show loading spinner while checking auth
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="text-xl text-slate-600">Loading...</div>
      </div>
    );
  }

  // If not authenticated, show Login centered on the screen
  if (!isAuthenticated) {
    return (
      <React.Suspense fallback={
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 to-slate-100">
          <div className="text-xl text-slate-600">Loading...</div>
        </div>
      }>
        <Login onLogin={handleLoginSuccess} />
      </React.Suspense>
    );
  }

  // Authenticated app layout
  return (
    <div className="flex h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - Slide in on mobile */}
      <div className={`
        fixed lg:relative inset-y-0 left-0 z-50 
        transform transition-transform duration-300 ease-in-out
        ${mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
      `}>
        <Sidebar
          isCollapsed={sidebarCollapsed}
          setIsCollapsed={setSidebarCollapsed}
          activeTab={activeTab}
          setActiveTab={(tab) => {
            setActiveTab(tab);
            setMobileMenuOpen(false); // Close mobile menu when selecting a tab
          }}
        />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col w-full lg:w-auto overflow-hidden">
        {/* Header */}
        <header className="bg-white/80 backdrop-blur-sm shadow-sm border-b border-slate-200/50 px-4 sm:px-6 lg:px-8 py-4 lg:py-5">
          <div className="flex items-center justify-between">
            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            </button>

            <h1 className="text-lg sm:text-xl lg:text-2xl font-bold bg-gradient-to-r from-slate-800 to-slate-600 bg-clip-text text-transparent truncate">
              Inventory Management System
            </h1>

            <div className="flex items-center space-x-2 sm:space-x-4">
              <div className="flex items-center space-x-2 sm:space-x-3">
                {currentUser && (
                  <div className="hidden sm:flex items-center space-x-2">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                    <span className="text-xs sm:text-sm text-slate-600 font-medium truncate max-w-[150px]">
                       {currentUser.fullName || currentUser.username}
                    </span>
                  </div>
                )}
                
                <button
                  onClick={handleLogout}
                  className="px-2 sm:px-3 py-1 rounded-md bg-red-500 hover:bg-red-600 text-white text-xs sm:text-sm font-medium transition-colors shadow-sm"
                >
                  Logout
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 overflow-auto p-4 sm:p-6">
          {renderPage()}
        </main>
      </div>
    </div>
  );
}

export default App;
