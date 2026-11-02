import axiosClient from './axiosClient';

export const operatorsApi = {
  apply: (data) => axiosClient.post('/operators/apply', data),
  getMyApplication: () => axiosClient.get('/operators/my-application'),
};
