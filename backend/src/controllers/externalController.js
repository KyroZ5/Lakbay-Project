import { searchPlaces, geocodeAddress } from '../services/locationService.js';
import { getCurrentWeather, getForecast } from '../services/weatherService.js';
import { sendSuccess, sendError } from '../utils/apiResponse.js';

export const autocompleteLocation = async (req, res, next) => {
  try {
    const { query } = req.query;
    if (!query) {
      return sendSuccess(res, []);
    }

    const places = await searchPlaces(query);
    return sendSuccess(res, places);
  } catch (error) {
    next(error);
  }
};

export const geocodeLocation = async (req, res, next) => {
  try {
    const { address } = req.query;
    if (!address) {
      return sendError(res, 'Address query parameter is required', 400);
    }

    const coords = await geocodeAddress(address);
    return sendSuccess(res, coords);
  } catch (error) {
    next(error);
  }
};

export const getWeather = async (req, res, next) => {
  try {
    const { lat, lng } = req.query;
    if (lat === undefined || lng === undefined) {
      return sendError(res, 'lat and lng query parameters are required', 400);
    }

    const weather = await getCurrentWeather(lat, lng);
    return sendSuccess(res, weather);
  } catch (error) {
    next(error);
  }
};

export const getWeatherForecast = async (req, res, next) => {
  try {
    const { lat, lng } = req.query;
    if (lat === undefined || lng === undefined) {
      return sendError(res, 'lat and lng query parameters are required', 400);
    }

    const forecast = await getForecast(lat, lng);
    return sendSuccess(res, forecast);
  } catch (error) {
    next(error);
  }
};
