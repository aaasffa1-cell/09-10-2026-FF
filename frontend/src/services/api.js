// Dynamic API Base URL supporting custom Vercel backend deployment
const DEPLOYED_BACKEND_URL = 'https://aaasffa1-j9um8q5g0-bharathnaidu050-1211s-projects.vercel.app/api';

let rawApiBase = (import.meta.env.VITE_API_URL || import.meta.env.VITE_API_BASE || '').trim();

if (!rawApiBase) {
  // If running locally in development, default to /api (Vite dev proxy)
  if (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
    rawApiBase = '/api';
  } else {
    rawApiBase = DEPLOYED_BACKEND_URL;
  }
} else {
  if (rawApiBase.endsWith('/')) {
    rawApiBase = rawApiBase.slice(0, -1);
  }
  if (!rawApiBase.endsWith('/api') && !rawApiBase.includes('/api/')) {
    rawApiBase = `${rawApiBase}/api`;
  }
}

const API_BASE = rawApiBase;

// Helper for HTTP requests
async function request(endpoint, options = {}) {
  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_BASE}${normalizedEndpoint}`;
  
  const headers = {
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };

  // Attach Admin Token if available
  const adminToken = localStorage.getItem('ffa_admin_token');
  if (adminToken && !headers['Authorization']) {
    headers['Authorization'] = `Bearer ${adminToken}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const errorMsg = data.error || data.message || `Request failed with status ${response.status}`;
    const err = new Error(errorMsg);
    err.status = response.status;
    err.data = data;
    throw err;
  }

  return data;
}

// ---------------- PUBLIC APIS ----------------
export async function fetchTournaments() {
  const data = await request('/tournaments');
  return data.tournaments || [];
}

export async function fetchTournamentById(id) {
  const data = await request(`/tournaments/${id}`);
  return data.tournament;
}

export async function submitSquadRegistration(payload) {
  return request('/registrations', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function resendOtp(registrationId) {
  return request(`/registrations/${registrationId}/send-otp`, {
    method: 'POST',
  });
}

export async function verifyOtp(registrationId, otp) {
  return request(`/registrations/${registrationId}/verify-otp`, {
    method: 'POST',
    body: JSON.stringify({ otp }),
  });
}

export async function getRegistrationStatus(registrationId) {
  const data = await request(`/registrations/${registrationId}/status`);
  return data.registration;
}

export async function createPaymentOrder(registrationId) {
  return request('/payments/create-order', {
    method: 'POST',
    body: JSON.stringify({ registrationId }),
  });
}

export async function verifyPayment(payload) {
  return request('/payments/verify', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

// ---------------- ADMIN APIS ----------------
export async function adminLogin(email, password) {
  const data = await request('/admin/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  if (data.token) {
    localStorage.setItem('ffa_admin_token', data.token);
    localStorage.setItem('ffa_admin_user', JSON.stringify(data.admin));
  }
  return data;
}

export function adminLogout() {
  localStorage.removeItem('ffa_admin_token');
  localStorage.removeItem('ffa_admin_user');
  return request('/admin/logout', { method: 'POST' }).catch(() => {});
}

export function getStoredAdmin() {
  const token = localStorage.getItem('ffa_admin_token');
  const userStr = localStorage.getItem('ffa_admin_user');
  if (!token || !userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch {
    return null;
  }
}

export async function fetchAdminProfile() {
  const data = await request('/admin/me');
  return data.admin;
}

export async function fetchAdminStats() {
  const data = await request('/admin/stats');
  return data.stats;
}

export async function fetchAdminTournaments() {
  const data = await request('/admin/tournaments');
  return data.tournaments || [];
}

export async function createAdminTournament(payload) {
  return request('/admin/tournaments', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateAdminTournament(id, payload) {
  return request(`/admin/tournaments/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}

export async function deleteAdminTournament(id) {
  return request(`/admin/tournaments/${id}`, {
    method: 'DELETE',
  });
}

export async function fetchAdminRegistrations(filters = {}) {
  const queryParams = new URLSearchParams();
  if (filters.tournamentId) queryParams.append('tournamentId', filters.tournamentId);
  if (filters.status) queryParams.append('status', filters.status);
  if (filters.paymentStatus) queryParams.append('paymentStatus', filters.paymentStatus);
  if (filters.search) queryParams.append('search', filters.search);

  const queryStr = queryParams.toString() ? `?${queryParams.toString()}` : '';
  const data = await request(`/admin/registrations${queryStr}`);
  return data.registrations || [];
}

export async function fetchRoomCredentials(tournamentId) {
  const data = await request(`/admin/tournaments/${tournamentId}/room`);
  return data.roomCredentials;
}

export async function saveRoomCredentials(tournamentId, payload) {
  return request(`/admin/tournaments/${tournamentId}/room`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function triggerRoomEmails(tournamentId) {
  return request(`/admin/tournaments/${tournamentId}/send-room-emails`, {
    method: 'POST',
  });
}
