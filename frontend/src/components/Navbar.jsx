import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getStoredAdmin, adminLogout } from '../services/api';
import { Flame, Shield, Trophy, PhoneCall, LogIn, LogOut, Menu, X, Swords } from 'lucide-react';

export default function Navbar() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const admin = getStoredAdmin();

  const handleLogout = () => {
    adminLogout();
    navigate('/admin/login');
  };

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/';
    return location.pathname.startsWith(path);
  };

  const navLinks = [
    { name: 'HOME', path: '/', icon: Flame },
    { name: 'TOURNAMENTS', path: '/tournaments', icon: Trophy },
    { name: 'RULES', path: '/rules', icon: Shield },
    { name: 'CONTACT', path: '/contact', icon: PhoneCall },
  ];

  return (
    <nav style={{
      position: 'sticky',
      top: 0,
      zIndex: 1000,
      background: 'rgba(11, 12, 18, 0.92)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--border-subtle)',
    }}>
      <div className="container" style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        height: '75px',
      }}>
        {/* Brand Logo */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #ff5500, #ff2a4b)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 15px rgba(255, 85, 0, 0.4)',
          }}>
            <Flame color="#ffffff" size={24} />
          </div>
          <div>
            <div style={{
              fontFamily: 'var(--font-heading)',
              fontSize: '20px',
              fontWeight: 900,
              letterSpacing: '1.5px',
              color: '#ffffff',
              lineHeight: 1.1,
            }}>
              FREE FIRE <span style={{ color: 'var(--accent-orange)' }}>ARENA</span>
            </div>
            <div style={{
              fontSize: '10px',
              letterSpacing: '2px',
              color: 'var(--text-dim)',
              textTransform: 'uppercase',
              fontWeight: 700,
            }}>
              BR ESPORTS TOURNAMENTS
            </div>
          </div>
        </Link>

        {/* Desktop Navigation */}
        <div style={{ display: 'none', gap: '8px', alignItems: 'center' }} className="desktop-nav">
          {navLinks.map(link => {
            const Icon = link.icon;
            const active = isActive(link.path);
            return (
              <Link
                key={link.path}
                to={link.path}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontFamily: 'var(--font-heading)',
                  fontSize: '14px',
                  fontWeight: 700,
                  letterSpacing: '1px',
                  padding: '8px 16px',
                  borderRadius: 'var(--radius-sm)',
                  color: active ? '#ffffff' : 'var(--text-muted)',
                  background: active ? 'rgba(255, 85, 0, 0.12)' : 'transparent',
                  border: active ? '1px solid rgba(255, 85, 0, 0.3)' : '1px solid transparent',
                  transition: 'all 0.2s ease',
                }}
              >
                <Icon size={16} color={active ? 'var(--accent-orange)' : 'currentColor'} />
                {link.name}
              </Link>
            );
          })}

          <Link
            to="/tournaments"
            className="btn btn-primary btn-sm"
            style={{ marginLeft: '12px' }}
          >
            <Swords size={16} />
            JOIN MATCH
          </Link>

          {admin ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginLeft: '16px' }}>
              <Link
                to="/admin"
                className="badge badge-gold"
                style={{ padding: '6px 12px', fontSize: '12px' }}
              >
                ADMIN PANEL
              </Link>
              <button
                onClick={handleLogout}
                className="btn btn-secondary btn-sm"
                title="Logout Admin"
              >
                <LogOut size={14} />
              </button>
            </div>
          ) : null}
        </div>

        {/* Mobile Hamburger Toggle */}
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          style={{
            background: 'transparent',
            border: 'none',
            color: '#ffffff',
            cursor: 'pointer',
            padding: '8px',
          }}
          className="mobile-nav-toggle"
          aria-label="Toggle Navigation"
        >
          {mobileMenuOpen ? <X size={26} /> : <Menu size={26} />}
        </button>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div style={{
          background: 'var(--bg-secondary)',
          borderBottom: '1px solid var(--border-card)',
          padding: '20px',
        }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {navLinks.map(link => {
              const Icon = link.icon;
              const active = isActive(link.path);
              return (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setMobileMenuOpen(false)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    fontFamily: 'var(--font-heading)',
                    fontSize: '15px',
                    fontWeight: 700,
                    padding: '12px 16px',
                    borderRadius: 'var(--radius-md)',
                    color: active ? '#ffffff' : 'var(--text-muted)',
                    background: active ? 'rgba(255, 85, 0, 0.15)' : '#141724',
                    border: active ? '1px solid var(--accent-orange)' : '1px solid var(--border-card)',
                  }}
                >
                  <Icon size={18} color={active ? 'var(--accent-orange)' : 'currentColor'} />
                  {link.name}
                </Link>
              );
            })}

            <Link
              to="/tournaments"
              onClick={() => setMobileMenuOpen(false)}
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '5px' }}
            >
              <Swords size={18} />
              JOIN MATCH
            </Link>

            {admin ? (
              <div style={{ marginTop: '15px', display: 'flex', gap: '10px' }}>
                <Link
                  to="/admin"
                  onClick={() => setMobileMenuOpen(false)}
                  className="btn btn-secondary"
                  style={{ flex: 1 }}
                >
                  Admin Panel
                </Link>
                <button
                  onClick={() => { handleLogout(); setMobileMenuOpen(false); }}
                  className="btn btn-secondary"
                >
                  <LogOut size={16} />
                </button>
              </div>
            ) : (
              <Link
                to="/admin/login"
                onClick={() => setMobileMenuOpen(false)}
                style={{
                  marginTop: '10px',
                  textAlign: 'center',
                  fontSize: '12px',
                  color: 'var(--text-dim)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px',
                }}
              >
                <LogIn size={13} /> Admin Login
              </Link>
            )}
          </div>
        </div>
      )}

      <style>{`
        @media (min-width: 850px) {
          .desktop-nav { display: flex !important; }
          .mobile-nav-toggle { display: none !important; }
        }
      `}</style>
    </nav>
  );
}
