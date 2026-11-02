import axiosClient from './axiosClient';

export const externalApi = {
  autocompleteLocation: (query) => axiosClient.get('/external/location/autocomplete', { params: { query } }),
  geocodeLocation: (address) => axiosClient.get('/external/location/geocode', { params: { address } }),
  getWeather: (lat, lng) => axiosClient.get('/external/weather/current', { params: { lat, lng } }),
  getForecast: (lat, lng) => axiosClient.get('/external/weather/forecast', { params: { lat, lng } }),
};
