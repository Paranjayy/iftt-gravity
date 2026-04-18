/**
 * Gravity Weather Intelligence
 * Powered by Open-Meteo (Junagadh)
 */

export interface WeatherData {
  temp: number;
  humidity: number;
  condition: string;
  isRain: boolean;
  updatedAt: number;
}

export class WeatherEngine {
  private cache: WeatherData | null = null;
  private readonly CACHE_TTL = 30 * 60 * 1000; // 30 mins
  private readonly LAT = 21.52; // Junagadh
  private readonly LON = 70.45;

  async getWeather(): Promise<WeatherData | null> {
    const now = Date.now();
    if (this.cache && (now - this.cache.updatedAt < this.CACHE_TTL)) {
      return this.cache;
    }

    try {
      // Fetching temperature and relative humidity
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${this.LAT}&longitude=${this.LON}&current=temperature_2m,relative_humidity_2m,weather_code`;
      const response = await fetch(url);
      const data = await response.json();

      if (data.current) {
        const cur = data.current;
        const code = cur.weather_code;
        const isRain = [51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code);
        
        this.cache = {
          temp: cur.temperature_2m,
          humidity: cur.relative_humidity_2m,
          condition: this.mapCode(code),
          isRain,
          updatedAt: now
        };
        return this.cache;
      }
      return null;
    } catch (e) {
      console.error('[WeatherEngine] Failed to fetch weather:', e);
      return this.cache; // return stale cache if available
    }
  }

  private mapCode(code: number): string {
    if (code === 0) return "Clear Sky";
    if (code <= 3) return "Partly Cloudy";
    if (code <= 48) return "Foggy";
    if (code <= 55) return "Drizzle";
    if (code <= 65) return "Rainy";
    if (code <= 75) return "Snowy";
    if (code <= 82) return "Rain showers";
    if (code <= 99) return "Thunderstorm";
    return "Unknown";
  }
}
