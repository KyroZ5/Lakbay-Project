import axiosClient from './axiosClient';

export const bookingsApi = {
  createCheckout: (bookingData) => axiosClient.post('/bookings/checkout', bookingData),
  getMyBookings: (params) => axiosClient.get('/bookings/my-bookings', { params }),
  getById: (id) => axiosClient.get(`/bookings/${id}`),
  cancelBooking: (id, reason) => axiosClient.post(`/bookings/${id}/cancel`, { reason }),
  requestReschedule: (id, data) => axiosClient.post(`/bookings/${id}/request-reschedule`, data),
  cancelReschedule: (id) => axiosClient.post(`/bookings/${id}/cancel-reschedule`),
};
