import axiosClient from './axiosClient';

export const adminApi = {
  // Dashboard Metrics
  getDashboardMetrics: () => axiosClient.get('/admin/dashboard'),

  // Destinations Management
  getDestinations: (params) => axiosClient.get('/destinations', { params }),
  getDestinationById: (id) => axiosClient.get(`/destinations/${id}`),
  createDestination: (data) => axiosClient.post('/destinations', data),
  updateDestination: (id, data) => axiosClient.put(`/destinations/${id}`, data),
  deleteDestination: (id) => axiosClient.delete(`/destinations/${id}`),

  // Packages Management
  getPackages: (params) => axiosClient.get('/packages', { params }),
  getPackageById: (id) => axiosClient.get(`/packages/${id}`),
  createPackage: (data) => axiosClient.post('/packages', data),
  updatePackage: (id, data) => axiosClient.put(`/packages/${id}`, data),
  deletePackage: (id) => axiosClient.delete(`/packages/${id}`),
  approvePackage: (id) => axiosClient.patch(`/packages/${id}/approve`),
  rejectPackage: (id, reason) => axiosClient.patch(`/packages/${id}/reject`, { reason }),

  // Departures Management
  getDepartures: (params) => axiosClient.get('/departures', { params }),
  getDepartureById: (id) => axiosClient.get(`/departures/${id}`),
  createDeparture: (data) => axiosClient.post('/departures', data),
  updateDeparture: (id, data) => axiosClient.put(`/departures/${id}`, data),
  cancelDeparture: (id, reason) => axiosClient.post(`/departures/${id}/cancel`, { reason }),

  // Bookings Management
  getAllBookings: (params) => axiosClient.get('/bookings', { params }),
  getBookingById: (id) => axiosClient.get(`/bookings/${id}`),
  supportUpdateBooking: (id, data) => axiosClient.patch(`/bookings/${id}`, data),
  approveReschedule: (id) => axiosClient.post(`/bookings/${id}/approve-reschedule`),
  rejectReschedule: (id, reviewNotes) => axiosClient.post(`/bookings/${id}/reject-reschedule`, { reviewNotes }),
  processExceptionRefund: (id, exceptionReason) =>
    axiosClient.post(`/bookings/${id}/exception-refund`, { exceptionReason }),

  // Tour Guide Operations
  getAssignedDepartures: () => axiosClient.get('/guide/departures'),
  getDepartureManifest: (id) => axiosClient.get(`/guide/departures/${id}/manifest`),
  updatePassengerCheckIn: (departureId, { bookingId, travelerIndex, isCheckedIn }) =>
    axiosClient.patch(`/guide/departures/${departureId}/checkin`, {
      bookingId,
      travelerIndex,
      isCheckedIn,
    }),
  completeDeparture: (departureId) =>
    axiosClient.post(`/guide/departures/${departureId}/complete`),

  // Users & Staff IAM
  getUsers: (params) => axiosClient.get('/admin/users', { params }),
  createStaffAccount: (data) => axiosClient.post('/admin/users', data),
  setUserAccountStatus: (uid, accountStatus) =>
    axiosClient.patch(`/admin/users/${uid}/status`, { accountStatus }),
  setUserRole: (uid, role) => axiosClient.patch(`/admin/users/${uid}/role`, { role }),

  // Staff Profile & Settings
  getStaffProfile: () => axiosClient.get('/admin/profile'),
  updateStaffProfile: (data) => axiosClient.patch('/admin/profile', data),

  // Operator Applications & Management
  getOperatorApplications: (params) => axiosClient.get('/operators/admin/applications', { params }),
  approveOperatorApplication: (id) => axiosClient.patch(`/operators/admin/applications/${id}/approve`),
  rejectOperatorApplication: (id, reason) => axiosClient.patch(`/operators/admin/applications/${id}/reject`, { reason }),
  getAllOperators: () => axiosClient.get('/operators/admin/all'),
  setOperatorStatus: (uid, accountStatus) => axiosClient.patch(`/operators/admin/${uid}/status`, { accountStatus }),
  getOperatorDashboardMetrics: () => axiosClient.get('/operators/dashboard'),

  // Reports
  getReports: (params) => axiosClient.get('/admin/reports', { params }),

  // Reviews & Feedback Moderation
  getReviews: (params) => axiosClient.get('/reviews/admin', { params }),
  moderateReview: (id, data) => axiosClient.patch(`/reviews/${id}/moderate`, data),
  deleteReview: (id) => axiosClient.delete(`/reviews/${id}`),

  // Promotions & Campaign Banners Management (Step 6)
  getPromotions: () => axiosClient.get('/promotions/admin/all'),
  createPromotion: (data) => axiosClient.post('/promotions/admin', data),
  updatePromotion: (id, data) => axiosClient.put(`/promotions/admin/${id}`, data),
  togglePromotion: (id) => axiosClient.patch(`/promotions/admin/${id}/toggle`),
  deletePromotion: (id) => axiosClient.delete(`/promotions/admin/${id}`),

  // Location & Weather Proxies
  autocompleteLocation: (text) =>
    axiosClient.get('/external/location/autocomplete', { params: { text } }),
  geocodeLocation: (text) =>
    axiosClient.get('/external/location/geocode', { params: { text } }),
  getWeather: (lat, lon) =>
    axiosClient.get('/external/weather/current', { params: { lat, lon } }),
};
