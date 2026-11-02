import axios from 'axios';

// In-memory cache with TTL (20 minutes)
const cache = new Map();
const CACHE_TTL_MS = 20 * 60 * 1000;

const getCached = (key) => {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    cache.delete(key);
    return null;
  }
  return item.data;
};

const setCache = (key, data) => {
  cache.set(key, { data, expiresAt: Date.now() + CACHE_TTL_MS });
};

/**
 * Generate fallback mock weather data for Philippine destinations
 */
const getFallbackCurrentWeather = (lat, lng) => ({
  temp: 29.5,
  feelsLike: 33.2,
  tempMin: 26.0,
  tempMax: 32.0,
  humidity: 78,
  condition: 'Partly Cloudy',
  description: 'scattered clouds with warm tropical breeze',
  icon: '02d',
  iconUrl: 'https://openweathermap.org/img/wn/02d@2x.png',
  windSpeed: 3.6,
  isMock: true,
  updatedAt: new Date().toISOString(),
});

const getFallbackForecast = () => {
  const forecast = [];
  const today = new Date();

  for (let i = 0; i < 7; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    const dateStr = d.toISOString().split('T')[0];

    forecast.push({
      date: dateStr,
      temp: 29.0 + (i % 3) * 0.8,
      tempMin: 25.5,
      tempMax: 32.5,
      condition: i % 4 === 0 ? 'Light Rain' : (i % 2 === 0 ? 'Clear' : 'Partly Cloudy'),
      description: i % 4 === 0 ? 'light tropical shower' : 'warm and pleasant',
      icon: i % 4 === 0 ? '10d' : (i % 2 === 0 ? '01d' : '02d'),
      iconUrl: `https://openweathermap.org/img/wn/${i % 4 === 0 ? '10d' : (i % 2 === 0 ? '01d' : '02d')}@2x.png`,
    });
  }

  return forecast;
};

/**
 * Fetch current weather by coordinates
 */
export const getCurrentWeather = async (lat, lng) => {
  if (lat === undefined || lng === undefined) {
    return getFallbackCurrentWeather(14.5995, 120.9842);
  }

  const roundedLat = Number(lat).toFixed(2);
  const roundedLng = Number(lng).toFixed(2);
  const cacheKey = `weather:current:${roundedLat},${roundedLng}`;

  const cached = getCached(cacheKey);
  if (cached) return cached;

  const apiKey = process.env.OPENWEATHER_API_KEY;

  if (apiKey && !apiKey.toLowerCase().includes('placeholder')) {
    try {
      const response = await axios.get('https://api.openweathermap.org/data/2.5/weather', {
        params: {
          lat: roundedLat,
          lon: roundedLng,
          units: 'metric',
          appid: apiKey,
        },
        timeout: 5000,
      });

      const data = response.data;
      const weatherResult = {
        temp: Math.round(data.main.temp * 10) / 10,
        feelsLike: Math.round(data.main.feels_like * 10) / 10,
        tempMin: Math.round(data.main.temp_min * 10) / 10,
        tempMax: Math.round(data.main.temp_max * 10) / 10,
        humidity: data.main.humidity,
        condition: data.weather[0]?.main || 'Clear',
        description: data.weather[0]?.description || '',
        icon: data.weather[0]?.icon || '01d',
        iconUrl: `https://openweathermap.org/img/wn/${data.weather[0]?.icon || '01d'}@2x.png`,
        windSpeed: data.wind?.speed || 0,
        isMock: false,
        updatedAt: new Date().toISOString(),
      };

      setCache(cacheKey, weatherResult);
      return weatherResult;
    } catch (error) {
      console.warn('[WeatherService] OpenWeather request failed, using fallback:', error.message);
    }
  }

  const fallback = getFallbackCurrentWeather(roundedLat, roundedLng);
  setCache(cacheKey, fallback);
  return fallback;
};

/**
 * Fetch 5-day / 7-day forecast by coordinates
 */
export const getForecast = async (lat, lng) => {
  if (lat === undefined || lng === undefined) {
    return getFallbackForecast();
  }

  const roundedLat = Number(lat).toFixed(2);
  const roundedLng = Number(lng).toFixed(2);
  const cacheKey = `weather:forecast:${roundedLat},${roundedLng}`;

  const cached = getCached(cacheKey);
  if (cached) return cached;

  const apiKey = process.env.OPENWEATHER_API_KEY;

  if (apiKey && !apiKey.toLowerCase().includes('placeholder')) {
    try {
      const response = await axios.get('https://api.openweathermap.org/data/2.5/forecast', {
        params: {
          lat: roundedLat,
          lon: roundedLng,
          units: 'metric',
          appid: apiKey,
        },
        timeout: 5000,
      });

      // Aggregate 3-hour forecast intervals into daily summaries
      const dailyMap = new Map();

      for (const item of response.data.list || []) {
        const dateStr = item.dt_txt.split(' ')[0];
        if (!dailyMap.has(dateStr)) {
          dailyMap.set(dateStr, {
            date: dateStr,
            temps: [],
            conditions: [],
            icons: [],
            descriptions: [],
          });
        }
        const entry = dailyMap.get(dateStr);
        entry.temps.push(item.main.temp);
        entry.conditions.push(item.weather[0]?.main);
        entry.icons.push(item.weather[0]?.icon);
        entry.descriptions.push(item.weather[0]?.description);
      }

      const forecast = Array.from(dailyMap.values()).slice(0, 7).map((entry) => {
        const avgTemp = entry.temps.reduce((a, b) => a + b, 0) / entry.temps.length;
        const minTemp = Math.min(...entry.temps);
        const maxTemp = Math.max(...entry.temps);
        // Midday condition approximation
        const midIdx = Math.floor(entry.conditions.length / 2);

        return {
          date: entry.date,
          temp: Math.round(avgTemp * 10) / 10,
          tempMin: Math.round(minTemp * 10) / 10,
          tempMax: Math.round(maxTemp * 10) / 10,
          condition: entry.conditions[midIdx] || 'Clear',
          description: entry.descriptions[midIdx] || '',
          icon: entry.icons[midIdx] || '01d',
          iconUrl: `https://openweathermap.org/img/wn/${entry.icons[midIdx] || '01d'}@2x.png`,
        };
      });

      setCache(cacheKey, forecast);
      return forecast;
    } catch (error) {
      console.warn('[WeatherService] OpenWeather forecast failed, using fallback:', error.message);
    }
  }

  const fallback = getFallbackForecast();
  setCache(cacheKey, fallback);
  return fallback;
};
