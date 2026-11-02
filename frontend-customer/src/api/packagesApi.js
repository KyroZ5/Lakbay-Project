import axiosClient from './axiosClient';

export const packagesApi = {
  getAll: (params) => axiosClient.get('/packages', { params }),
  getFeatured: () => axiosClient.get('/packages/featured'),
  getById: (id) => axiosClient.get(`/packages/${id}`),
};
