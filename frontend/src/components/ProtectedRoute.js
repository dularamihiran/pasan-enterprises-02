import React from 'react';
import authService from '../services/authService';

/**
 * ProtectedRoute Component
 * Protects routes based on user role/permissions
 * 
 * @param {Object} props
 * @param {React.ReactNode} props.children - The component to render if authorized
 * @param {Array<string>} props.allowedRoles - Array of roles that can access (e.g., ['admin'])
 * @param {React.ReactNode} props.fallback - Component to show if not authorized (optional)
 */
const ProtectedRoute = ({ children, allowedRoles = [], fallback = null }) => {
  // Get current user from session
  const currentUser = authService.getCurrentUser();
  
  // If no user is logged in, don't render anything (handled by App.js)
  if (!currentUser) {
    return null;
  }
  
  // Check if user's role is in the allowed roles list
  const isAuthorized = allowedRoles.length === 0 || allowedRoles.includes(currentUser.role);
  
  // If authorized, render the children; otherwise show fallback or nothing
  if (isAuthorized) {
    return <>{children}</>;
  }
  
  // Not authorized - show fallback or a default message
  if (fallback) {
    return fallback;
  }
  
  return (
    <div className="flex items-center justify-center h-full">
      <div className="text-center p-8 bg-white rounded-lg shadow-lg max-w-md">
        <div className="mb-4">
          <svg className="mx-auto h-16 w-16 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Access Denied</h2>
        <p className="text-gray-600 mb-4">
          You don't have permission to access this page.
        </p>
        <p className="text-sm text-gray-500">
          Your role: <span className="font-semibold">{currentUser.role}</span>
        </p>
        <p className="text-xs text-gray-400 mt-2">
          Contact your administrator if you believe this is an error.
        </p>
      </div>
    </div>
  );
};

export default ProtectedRoute;
