import axiosClient from './axiosClient';

export const promotionsApi = {
  getPublished: () => axiosClient.get('/promotions'),
};
