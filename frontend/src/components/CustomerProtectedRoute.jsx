import React, { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { getUserProfile } from '../services/api';
import LoadingSpinner from './LoadingSpinner';

export default function CustomerProtectedRoute() {
  const [state, setState] = useState({ loading: true, authenticated: false, error: '' });
  const location = useLocation();

  useEffect(() => {
    let active = true;
    getUserProfile()
      .then(() => active && setState({ loading: false, authenticated: true, error: '' }))
      .catch((error) => active && setState({
        loading: false,
        authenticated: false,
        error: error.status === 401 ? '' : error.message || 'Unable to verify your session.',
      }));
    return () => { active = false; };
  }, []);

  if (state.loading) return <LoadingSpinner message="Checking your sign-in..." fullScreen />;
  if (state.error) {
    return <div className="container" style={{ padding: '60px 20px', color: '#fff' }}>{state.error}</div>;
  }
  if (!state.authenticated) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  }
  return <Outlet />;
}
