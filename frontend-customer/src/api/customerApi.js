import axiosClient from './axiosClient';

export const customerApi = {
  getProfile: () => axiosClient.get('/customers/profile'),
  updateProfile: (data) => axiosClient.put('/customers/profile', data),
  deactivateAccount: () => axiosClient.post('/customers/deactivate'),

  // Co-Travelers
  getCoTravelers: () => axiosClient.get('/customers/co-travelers'),
  createCoTraveler: (data) => axiosClient.post('/customers/co-travelers', data),
  updateCoTraveler: (id, data) => axiosClient.put(`/customers/co-travelers/${id}`, data),
  deleteCoTraveler: (id) => axiosClient.delete(`/customers/co-travelers/${id}`),

  // Notifications
  getNotifications: () => axiosClient.get('/customers/notifications'),
  markNotificationRead: (id) => axiosClient.patch(`/customers/notifications/${id}/read`),
};
