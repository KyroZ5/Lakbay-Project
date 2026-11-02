import axiosClient from './axiosClient';

export const reviewsApi = {
  createReview: (data) => axiosClient.post('/reviews', data),
  getPackageReviews: (packageId) => axiosClient.get(`/reviews/package/${packageId}`),
  getMyReviews: () => axiosClient.get('/reviews/my-reviews'),
};
