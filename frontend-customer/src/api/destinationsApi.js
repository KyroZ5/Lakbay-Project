import axiosClient from './axiosClient';

export const destinationsApi = {
  getAll: (params) => axiosClient.get('/destinations', { params }),
  getFeatured: () => axiosClient.get('/destinations/featured'),
  getById: (id) => axiosClient.get(`/destinations/${id}`),
};
