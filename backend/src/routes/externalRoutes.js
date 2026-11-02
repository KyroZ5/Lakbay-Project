import { Router } from 'express';
import {
  autocompleteLocation,
  geocodeLocation,
  getWeather,
  getWeatherForecast,
} from '../controllers/externalController.js';

const router = Router();

// Location APIs (Geoapify Proxy)
router.get('/location/autocomplete', autocompleteLocation);
router.get('/location/geocode', geocodeLocation);

// Weather APIs (OpenWeather Proxy)
router.get('/weather/current', getWeather);
router.get('/weather/forecast', getWeatherForecast);

export default router;
