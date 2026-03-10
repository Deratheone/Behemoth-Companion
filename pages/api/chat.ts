import type { NextApiRequest, NextApiResponse } from 'next';
import { chatWithGemini } from '../../utils/gemini';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, location, currentTime, weather } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Message is required' });
    }

    // Build context string if location/time/weather data is provided
    let contextualMessage = message;
    if (location || currentTime || weather) {
      const contextParts = [];
      
      if (currentTime) {
        contextParts.push(`Current date/time: ${new Date(currentTime).toLocaleString('en-US', { 
          weekday: 'long', 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          timeZoneName: 'short'
        })}`);
      }
      
      if (location) {
        contextParts.push(`User location: Latitude ${location.latitude.toFixed(6)}, Longitude ${location.longitude.toFixed(6)}`);
      }
      
      if (weather) {
        const weatherCode = weather.weather_code;
        const weatherDescriptions: { [key: number]: string } = {
          0: 'Clear sky',
          1: 'Mainly clear', 2: 'Partly cloudy', 3: 'Overcast',
          45: 'Fog', 48: 'Depositing rime fog',
          51: 'Light drizzle', 53: 'Moderate drizzle', 55: 'Dense drizzle',
          61: 'Slight rain', 63: 'Moderate rain', 65: 'Heavy rain',
          71: 'Slight snow', 73: 'Moderate snow', 75: 'Heavy snow',
          80: 'Slight rain showers', 81: 'Moderate rain showers', 82: 'Violent rain showers',
          95: 'Thunderstorm', 96: 'Thunderstorm with hail', 99: 'Thunderstorm with heavy hail'
        };
        
        const weatherDesc = weatherDescriptions[weatherCode] || 'Unknown';
        const windDir = weather.wind_direction_10m;
        const windDirText = windDir >= 337.5 || windDir < 22.5 ? 'N' :
                           windDir >= 22.5 && windDir < 67.5 ? 'NE' :
                           windDir >= 67.5 && windDir < 112.5 ? 'E' :
                           windDir >= 112.5 && windDir < 157.5 ? 'SE' :
                           windDir >= 157.5 && windDir < 202.5 ? 'S' :
                           windDir >= 202.5 && windDir < 247.5 ? 'SW' :
                           windDir >= 247.5 && windDir < 292.5 ? 'W' : 'NW';
        
        contextParts.push(
          `Current weather: ${weatherDesc}, Temperature: ${weather.temperature_2m}°C, ` +
          `Feels like: ${weather.apparent_temperature}°C, Humidity: ${weather.relative_humidity_2m}%, ` +
          `Wind: ${weather.wind_speed_10m} km/h from ${windDirText}, Cloud cover: ${weather.cloud_cover}%`
        );
        
        if (weather.precipitation > 0) {
          contextParts.push(`Precipitation: ${weather.precipitation}mm`);
        }
      }
      
      contextualMessage = `[Context: ${contextParts.join(' | ')}]\n\nUser message: ${message}`;
    }

    const response = await chatWithGemini(contextualMessage);
    
    return res.status(200).json({ response });

  } catch (error) {
    console.error('Chat API error:', error);
    return res.status(500).json({ 
      error: 'Failed to get response',
      message: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}
