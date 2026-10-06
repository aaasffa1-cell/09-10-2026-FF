import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { getStoredAdmin } from '../services/api';

export default function ProtectedRoute() {
  const admin = getStoredAdmin();

  if (!admin) {
    return <Navigate to="/admin/login" replace />;
  }

  return <Outlet />;
}
