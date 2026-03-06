import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import App from './App';
import './src/index.css';
import { AuthProvider } from './src/auth/AuthProvider';
import ProtectedRoute from './src/components/ProtectedRoute';
import AdminRoute from './src/components/AdminRoute';
import ErrorBoundary from './src/components/ErrorBoundary';
import Login from './src/pages/Login';
import CreateAccount from './src/pages/CreateAccount';
import PendingApproval from './src/pages/PendingApproval';
import AdminDashboard from './src/pages/AdminDashboard';
import AdminCreateJob from './src/pages/AdminCreateJob';
import AdminPayouts from './src/pages/AdminPayouts';
import AdminLeads from './src/pages/AdminLeads';
import AdminSettings from './src/pages/AdminSettings';
import UnifiedDashboard from './src/pages/UnifiedDashboard';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ErrorBoundary>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="/create-account" element={<CreateAccount />} />
            <Route path="/pending-approval" element={<PendingApproval />} />
            <Route path="/admin" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
            <Route path="/admin/create-job" element={<AdminRoute><AdminCreateJob /></AdminRoute>} />
            <Route path="/admin/payouts" element={<AdminRoute><AdminPayouts /></AdminRoute>} />
            <Route path="/admin/leads" element={<AdminRoute><AdminLeads /></AdminRoute>} />
            <Route path="/admin/settings" element={<AdminRoute><AdminSettings /></AdminRoute>} />
            <Route path="/admin/unified" element={<AdminRoute><UnifiedDashboard /></AdminRoute>} />
            <Route path="/app" element={<ProtectedRoute><App /></ProtectedRoute>} />
            <Route path="*" element={<Navigate to="/app" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
