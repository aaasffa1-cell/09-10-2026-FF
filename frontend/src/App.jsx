import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';

// Layout Components
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import ProtectedRoute from './components/ProtectedRoute';
import CustomerProtectedRoute from './components/CustomerProtectedRoute';

// Public Pages
import Home from './pages/Home';
import Tournaments from './pages/Tournaments';
import TournamentDetail from './pages/TournamentDetail';
import Register from './pages/Register';
import Rules from './pages/Rules';
import Contact from './pages/Contact';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Results from './pages/Results';

// Admin Pages
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminTournaments from './pages/admin/AdminTournaments';
import AdminRegistrations from './pages/admin/AdminRegistrations';
import AdminRoomCredentials from './pages/admin/AdminRoomCredentials';
import AdminResults from './pages/admin/AdminResults';

export default function App() {
  return (
    <Router>
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Navbar />
        
        <main style={{ flex: 1 }}>
          <Routes>
            {/* Public Routes */}
            <Route path="/" element={<Home />} />
            <Route path="/tournaments" element={<Tournaments />} />
            <Route path="/tournament/:id" element={<TournamentDetail />} />
            <Route path="/rules" element={<Rules />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/login" element={<Login />} />
            <Route path="/results" element={<Results />} />

            <Route element={<CustomerProtectedRoute />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/register/:tournamentId" element={<Register />} />
            </Route>

            {/* Admin Authentication */}
            <Route path="/admin/login" element={<AdminLogin />} />

            {/* Protected Admin Routes */}
            <Route element={<ProtectedRoute />}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/tournaments" element={<AdminTournaments />} />
              <Route path="/admin/registrations" element={<AdminRegistrations />} />
              <Route path="/admin/room-credentials" element={<AdminRoomCredentials />} />
              <Route path="/admin/results" element={<AdminResults />} />
            </Route>

            {/* Fallback 404 */}
            <Route path="*" element={<Home />} />
          </Routes>
        </main>

        <Footer />
      </div>
    </Router>
  );
}
