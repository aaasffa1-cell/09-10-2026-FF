const configuredApiBase = (import.meta.env.VITE_API_URL || '').trim();
let rawApiBase = configuredApiBase;

if (rawApiBase) {
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
  if (!API_BASE) {
    throw new Error('VITE_API_URL is not configured. Set it to the backend API URL.');
  }

  const normalizedEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
  const url = `${API_BASE}${normalizedEndpoint}`;
  const adminToken = normalizedEndpoint.startsWith('/admin/')
    ? sessionStorage.getItem('ffa_admin_token')
    : null;
  
  const headers = {
    'Content-Type': 'application/json',
    ...(adminToken ? { Authorization: `Bearer ${adminToken}` } : {}),
    ...(options.headers || {}),
  };

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
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

export async function resendOtp(registrationId, registrationToken) {
  return request(`/registrations/${registrationId}/send-otp`, {
    method: 'POST',
    headers: { 'X-Registration-Token': registrationToken },
  });
}

export async function verifyOtp(registrationId, otp, registrationToken) {
  return request(`/registrations/${registrationId}/verify-otp`, {
    method: 'POST',
    body: JSON.stringify({ otp }),
    headers: { 'X-Registration-Token': registrationToken },
  });
}

export async function getRegistrationStatus(registrationId, registrationToken) {
  const data = await request(`/registrations/${registrationId}/status`, {
    headers: { 'X-Registration-Token': registrationToken },
  });
  return data.registration;
}

export async function startPaymentRequest(registrationId, registrationToken) {
  return request(`/payments/registrations/${registrationId}/start`, {
    method: 'POST',
    headers: { 'X-Registration-Token': registrationToken },
  });
}

export async function submitRegistrationUtr(registrationId, utr, registrationToken) {
  return request(`/payments/registrations/${registrationId}/utr`, {
    method: 'POST',
    body: JSON.stringify({ utr }),
    headers: { 'X-Registration-Token': registrationToken },
  });
}

export async function getRegistrationPaymentStatus(registrationId, registrationToken) {
  const data = await request(`/payments/registrations/${registrationId}/status`, {
    headers: { 'X-Registration-Token': registrationToken },
  });
  return data.payment;
}

export async function submitContactMessage(payload) {
  return request('/contact', {
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
  if (!data.token || !data.admin) {
    throw new Error('Admin authentication is not up to date on the API server. Redeploy the backend, then try again.');
  }

  sessionStorage.setItem('ffa_admin_token', data.token);
  if (data.admin) {
    sessionStorage.setItem('ffa_admin_user', JSON.stringify(data.admin));
  }
  return data;
}

export function adminLogout() {
  return request('/admin/logout', { method: 'POST' }).finally(() => {
    sessionStorage.removeItem('ffa_admin_user');
    sessionStorage.removeItem('ffa_admin_token');
  });
}

export function getStoredAdmin() {
  if (!sessionStorage.getItem('ffa_admin_token')) {
    sessionStorage.removeItem('ffa_admin_user');
    return null;
  }

  const userStr = sessionStorage.getItem('ffa_admin_user');
  if (!userStr) return null;
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

export async function fetchAdminPaymentEvents(paymentId) {
  const data = await request(`/admin/payments/${paymentId}/events`);
  return data.events || [];
}

export async function fetchAdminPayments(filters = {}) {
  const queryParams = new URLSearchParams();
  if (filters.status) queryParams.append('status', filters.status);
  if (filters.search) queryParams.append('search', filters.search);
  if (filters.sort) queryParams.append('sort', filters.sort);
  const queryString = queryParams.toString() ? `?${queryParams.toString()}` : '';
  return request(`/admin/payments${queryString}`);
}

export async function verifyAdminPayment(paymentId) {
  return request(`/admin/payments/${paymentId}/verify`, { method: 'POST' });
}

export async function rejectAdminPayment(paymentId, reason) {
  return request(`/admin/payments/${paymentId}/reject`, {
    method: 'POST',
    body: JSON.stringify({ reason }),
  });
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
