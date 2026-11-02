import axios from 'axios';

// In-memory cache with TTL (15 minutes)
const cache = new Map();
const CACHE_TTL_MS = 15 * 60 * 1000;

// Curated Philippine fallback locations if Geoapify key is unavailable
const POPULAR_PH_LOCATIONS = [
  { name: 'El Nido, Palawan, Philippines', lat: 11.1956, lng: 119.4075, region: 'MIMAROPA', country: 'Philippines' },
  { name: 'Coron, Palawan, Philippines', lat: 12.0000, lng: 120.2000, region: 'MIMAROPA', country: 'Philippines' },
  { name: 'Siargao Island, Surigao del Norte, Philippines', lat: 9.8569, lng: 126.0469, region: 'Caraga', country: 'Philippines' },
  { name: 'Boracay, Malay, Aklan, Philippines', lat: 11.9674, lng: 121.9248, region: 'Western Visayas', country: 'Philippines' },
  { name: 'Batanes, Philippines', lat: 20.4485, lng: 121.9708, region: 'Cagayan Valley', country: 'Philippines' },
  { name: 'Bohol, Philippines', lat: 9.8500, lng: 124.1435, region: 'Central Visayas', country: 'Philippines' },
  { name: 'Cebu City, Cebu, Philippines', lat: 10.3157, lng: 123.8854, region: 'Central Visayas', country: 'Philippines' },
  { name: 'Sagada, Mountain Province, Philippines', lat: 17.0833, lng: 120.9000, region: 'Cordillera', country: 'Philippines' },
  { name: 'Baguio City, Benguet, Philippines', lat: 16.4023, lng: 120.5960, region: 'Cordillera', country: 'Philippines' },
  { name: 'Manila, Metro Manila, Philippines', lat: 14.5995, lng: 120.9842, region: 'National Capital Region', country: 'Philippines' },
];

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
 * Autocomplete location search via Geoapify or fallback
 */
export const searchPlaces = async (query) => {
  if (!query || query.trim().length === 0) {
    return [];
  }

  const normalizedQuery = query.trim().toLowerCase();
  const cacheKey = `autocomplete:${normalizedQuery}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const apiKey = process.env.GEOAPIFY_API_KEY;

  if (apiKey && !apiKey.toLowerCase().includes('placeholder')) {
    try {
      const response = await axios.get('https://api.geoapify.com/v1/geocode/autocomplete', {
        params: {
          text: query,
          apiKey,
          filter: 'countrycode:ph', // Prioritize Philippine destinations
          limit: 8,
        },
        timeout: 5000,
      });

      const results = (response.data.features || []).map((feature) => ({
        formatted: feature.properties.formatted,
        name: feature.properties.name || feature.properties.formatted,
        city: feature.properties.city || feature.properties.county || '',
        state: feature.properties.state || '',
        country: feature.properties.country || 'Philippines',
        lat: feature.properties.lat,
        lng: feature.properties.lon,
      }));

      setCache(cacheKey, results);
      return results;
    } catch (error) {
      console.warn('[LocationService] Geoapify autocomplete failed, falling back:', error.message);
    }
  }

  // Fallback to local curated Philippine locations
  const filtered = POPULAR_PH_LOCATIONS.filter((item) =>
    item.name.toLowerCase().includes(normalizedQuery) ||
    item.region.toLowerCase().includes(normalizedQuery)
  ).map((item) => ({
    formatted: item.name,
    name: item.name.split(',')[0],
    city: item.name.split(',')[1]?.trim() || '',
    state: item.region,
    country: item.country,
    lat: item.lat,
    lng: item.lng,
  }));

  setCache(cacheKey, filtered);
  return filtered;
};

/**
 * Forward geocoding to resolve address/place name into coordinates
 */
export const geocodeAddress = async (address) => {
  if (!address) return { lat: 14.5995, lng: 120.9842 }; // Default Manila

  const cacheKey = `geocode:${address.toLowerCase()}`;
  const cached = getCached(cacheKey);
  if (cached) return cached;

  const apiKey = process.env.GEOAPIFY_API_KEY;

  if (apiKey && !apiKey.toLowerCase().includes('placeholder')) {
    try {
      const response = await axios.get('https://api.geoapify.com/v1/geocode/search', {
        params: {
          text: address,
          apiKey,
          limit: 1,
        },
        timeout: 5000,
      });

      const feature = response.data.features?.[0];
      if (feature) {
        const coords = {
          lat: feature.properties.lat,
          lng: feature.properties.lon,
          formatted: feature.properties.formatted,
        };
        setCache(cacheKey, coords);
        return coords;
      }
    } catch (error) {
      console.warn('[LocationService] Geoapify geocode failed, falling back:', error.message);
    }
  }

  // Fallback to closest match in curated list
  const match = POPULAR_PH_LOCATIONS.find((loc) =>
    address.toLowerCase().includes(loc.name.split(',')[0].toLowerCase())
  );

  const coords = match
    ? { lat: match.lat, lng: match.lng, formatted: match.name }
    : { lat: 14.5995, lng: 120.9842, formatted: address }; // Default to Manila coordinates

  setCache(cacheKey, coords);
  return coords;
};
