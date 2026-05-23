import express from 'express';
import { fetchWeatherApi } from 'openmeteo';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

interface WeatherPoint {
  time: string;
  temperature_2m?: number;
  precipitation_probability?: number;
  weather_code?: number;
  wind_speed_10m?: number;
  uv_index?: number;
}

const OPEN_METEO_FORECAST_URL = 'https://api.open-meteo.com/v1/forecast';
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
];

const range = (start: number, stop: number, step: number) =>
  Array.from({ length: Math.max(0, Math.ceil((stop - start) / step)) }, (_, index) => start + index * step);

const parseCoordinate = (value: unknown, min: number, max: number) => {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue < min || numberValue > max) {
    return null;
  }
  return numberValue;
};

const getWeatherSummary = (code?: number) => {
  if (code == null) return 'Unknown';
  if (code === 0) return 'Clear';
  if ([1, 2, 3].includes(code)) return 'Partly cloudy';
  if ([45, 48].includes(code)) return 'Foggy';
  if ([51, 53, 55, 56, 57].includes(code)) return 'Drizzle';
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return 'Rain';
  if ([71, 73, 75, 77, 85, 86].includes(code)) return 'Snow';
  if ([95, 96, 99].includes(code)) return 'Storms';
  return 'Mixed conditions';
};

const scoreOutdoorWorkout = (
  temperature: number,
  precipitation: number,
  windSpeed: number,
  uvIndex: number,
) => {
  let score = 100;

  if (temperature < 5 || temperature > 34) score -= 35;
  else if (temperature < 12 || temperature > 29) score -= 15;

  if (precipitation >= 70) score -= 35;
  else if (precipitation >= 40) score -= 18;

  if (windSpeed > 35) score -= 20;
  else if (windSpeed > 22) score -= 10;

  if (uvIndex >= 8) score -= 18;
  else if (uvIndex >= 6) score -= 8;

  return Math.max(0, Math.min(100, score));
};

const getSuggestion = (score: number, weather: string, uvIndex: number) => {
  if (score >= 80) return `Great for an outdoor run, walk, or circuit. ${weather} conditions look friendly.`;
  if (score >= 60) return uvIndex >= 6
    ? 'Good for outdoor training, but pick shade or an early/late session.'
    : 'Decent outdoor conditions. Keep the session flexible.';
  if (score >= 40) return 'Outdoor work is possible, but a gym session may feel better.';
  return 'Indoor training is recommended for now.';
};

const fetchOverpassData = async (query: string) => {
  let lastError = 'Map provider request failed';

  for (const endpoint of OVERPASS_ENDPOINTS) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Accept': 'application/json',
          'User-Agent': 'social-fitness-app/1.0',
        },
        body: new URLSearchParams({ data: query }).toString(),
      });

      if (response.ok) {
        return {
          data: await response.json(),
          endpoint,
        };
      }

      const responseText = await response.text().catch(() => '');
      lastError = `Map provider ${response.status}: ${responseText.slice(0, 120)}`;
      console.warn(`Overpass request failed at ${endpoint}:`, lastError);
    } catch (error) {
      lastError = error instanceof Error ? error.message : 'Map provider request failed';
      console.warn(`Overpass request failed at ${endpoint}:`, error);
    }
  }

  throw new Error(lastError);
};

router.get('/weather', authenticateToken, async (req, res) => {
  try {
    const latitude = parseCoordinate(req.query.lat, -90, 90);
    const longitude = parseCoordinate(req.query.lon, -180, 180);

    if (latitude == null || longitude == null) {
      return res.status(400).json({ error: 'Valid lat and lon query parameters are required' });
    }

    const params = {
      latitude: [latitude],
      longitude: [longitude],
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m',
      hourly: 'temperature_2m,precipitation_probability,weather_code,wind_speed_10m,uv_index',
      forecast_days: 1,
      timezone: 'auto',
    };

    const responses = await fetchWeatherApi(OPEN_METEO_FORECAST_URL, params);
    const response = responses[0];
    if (!response) {
      return res.status(502).json({ error: 'Weather provider request failed' });
    }

    const utcOffsetSeconds = response.utcOffsetSeconds();
    const currentData = response.current();
    const hourlyData = response.hourly();

    if (!currentData || !hourlyData) {
      return res.status(502).json({ error: 'Weather provider returned incomplete data' });
    }

    const currentTime = new Date((Number(currentData.time()) + utcOffsetSeconds) * 1000).toISOString();
    const current = {
      time: currentTime,
      temperature_2m: currentData.variables(0)?.value(),
      relative_humidity_2m: currentData.variables(1)?.value(),
      apparent_temperature: currentData.variables(2)?.value(),
      precipitation: currentData.variables(3)?.value(),
      weather_code: currentData.variables(4)?.value(),
      wind_speed_10m: currentData.variables(5)?.value(),
    };

    const hourlyTimes = range(Number(hourlyData.time()), Number(hourlyData.timeEnd()), hourlyData.interval())
      .map((time) => new Date((time + utcOffsetSeconds) * 1000).toISOString());
    const hourlyTemperatures = hourlyData.variables(0)?.valuesArray() || [];
    const hourlyPrecipitationProbabilities = hourlyData.variables(1)?.valuesArray() || [];
    const hourlyWeatherCodes = hourlyData.variables(2)?.valuesArray() || [];
    const hourlyWindSpeeds = hourlyData.variables(3)?.valuesArray() || [];
    const hourlyUvIndexes = hourlyData.variables(4)?.valuesArray() || [];

    const hourlyPoints: WeatherPoint[] = hourlyTimes.slice(0, 12).map((time, index) => ({
      time,
      temperature_2m: hourlyTemperatures[index],
      precipitation_probability: hourlyPrecipitationProbabilities[index],
      weather_code: hourlyWeatherCodes[index],
      wind_speed_10m: hourlyWindSpeeds[index],
      uv_index: hourlyUvIndexes[index],
    }));

    const precipitation = Number(hourlyPoints[0]?.precipitation_probability ?? current.precipitation ?? 0);
    const uvIndex = Number(hourlyPoints[0]?.uv_index ?? 0);
    const temperature = Number(current.temperature_2m ?? hourlyPoints[0]?.temperature_2m ?? 0);
    const windSpeed = Number(current.wind_speed_10m ?? hourlyPoints[0]?.wind_speed_10m ?? 0);
    const weather = getWeatherSummary(current.weather_code ?? hourlyPoints[0]?.weather_code);
    const workoutScore = scoreOutdoorWorkout(temperature, precipitation, windSpeed, uvIndex);

    res.json({
      source: 'Open-Meteo',
      location: { latitude, longitude, timezone: response.timezone() },
      current: {
        time: current.time,
        temperature,
        apparent_temperature: current.apparent_temperature,
        humidity: current.relative_humidity_2m,
        precipitation: current.precipitation,
        precipitation_probability: precipitation,
        wind_speed: windSpeed,
        uv_index: uvIndex,
        weather_code: current.weather_code,
        weather,
      },
      workout: {
        score: workoutScore,
        suggestion: getSuggestion(workoutScore, weather, uvIndex),
      },
      hourly: hourlyPoints,
    });
  } catch (error) {
    console.error('Outdoor weather error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/places', authenticateToken, async (req, res) => {
  try {
    const latitude = parseCoordinate(req.query.lat, -90, 90);
    const longitude = parseCoordinate(req.query.lon, -180, 180);
    const radius = Math.min(Math.max(Number(req.query.radius) || 3000, 250), 10000);

    if (latitude == null || longitude == null) {
      return res.status(400).json({ error: 'Valid lat and lon query parameters are required' });
    }

    const query = `
      [out:json][timeout:15];
      (
        node["leisure"~"^(fitness_centre|sports_centre|park|track)$"](around:${radius},${latitude},${longitude});
        way["leisure"~"^(fitness_centre|sports_centre|park|track)$"](around:${radius},${latitude},${longitude});
        relation["leisure"~"^(fitness_centre|sports_centre|park|track)$"](around:${radius},${latitude},${longitude});
        node["sport"="fitness"](around:${radius},${latitude},${longitude});
        way["sport"="fitness"](around:${radius},${latitude},${longitude});
      );
      out center tags 30;
    `;

    const { data, endpoint } = await fetchOverpassData(query);
    const places = (data.elements || []).map((element: any) => {
      const lat = element.lat ?? element.center?.lat;
      const lon = element.lon ?? element.center?.lon;
      return {
        id: `${element.type}-${element.id}`,
        name: element.tags?.name || 'Unnamed workout spot',
        category: element.tags?.leisure || element.tags?.sport || 'fitness',
        latitude: lat,
        longitude: lon,
        address: [
          element.tags?.['addr:housenumber'],
          element.tags?.['addr:street'],
          element.tags?.['addr:city'],
        ].filter(Boolean).join(' '),
        map_url: lat && lon ? `https://www.openstreetmap.org/?mlat=${lat}&mlon=${lon}#map=17/${lat}/${lon}` : null,
      };
    }).filter((place: any) => place.latitude != null && place.longitude != null);

    res.json({
      source: 'OpenStreetMap Overpass API',
      provider: endpoint,
      location: { latitude, longitude, radius },
      places,
    });
  } catch (error) {
    console.error('Outdoor places error:', error);
    res.status(502).json({
      error: 'Map provider request failed',
      details: error instanceof Error ? error.message : 'Unknown map provider error',
    });
  }
});

export default router;
