// Geolocation service for detecting user's country via GPS and IP fallback

interface GeoLocationResult {
  country_code: string;
  country_name: string;
  region_id: string | null;
  source: 'gps' | 'ip' | 'unknown';
}

interface IPGeoResponse {
  country_code: string;
  country_name: string;
}

// Map country codes to region IDs
const COUNTRY_TO_REGION: Record<string, string> = {
  // Australia
  AU: 'AU',
  // New Zealand
  NZ: 'NZ',
  // United Kingdom
  GB: 'UK',
  // United States & Canada
  US: 'US_CA',
  CA: 'US_CA',
  // European Union countries
  AT: 'EU', BE: 'EU', BG: 'EU', HR: 'EU', CY: 'EU', CZ: 'EU',
  DK: 'EU', EE: 'EU', FI: 'EU', FR: 'EU', DE: 'EU', GR: 'EU',
  HU: 'EU', IE: 'EU', IT: 'EU', LV: 'EU', LT: 'EU', LU: 'EU',
  MT: 'EU', NL: 'EU', PL: 'EU', PT: 'EU', RO: 'EU', SK: 'EU',
  SI: 'EU', ES: 'EU', SE: 'EU',
};

// Reverse geocode coordinates to country code using free API
async function reverseGeocode(lat: number, lon: number): Promise<string | null> {
  try {
    // Using BigDataCloud free API (no key required for basic use)
    const response = await fetch(
      `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`
    );
    if (!response.ok) return null;
    
    const data = await response.json();
    return data.countryCode || null;
  } catch (error) {
    console.warn('Reverse geocode failed:', error);
    return null;
  }
}

// Get country from GPS location
async function getCountryFromGPS(): Promise<{ country_code: string; source: 'gps' } | null> {
  return new Promise((resolve) => {
    if (!navigator.geolocation) {
      resolve(null);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        const countryCode = await reverseGeocode(latitude, longitude);
        
        if (countryCode) {
          resolve({ country_code: countryCode, source: 'gps' });
        } else {
          resolve(null);
        }
      },
      () => {
        // User denied or error - fallback to IP
        resolve(null);
      },
      {
        timeout: 10000,
        maximumAge: 300000, // Cache for 5 minutes
        enableHighAccuracy: false,
      }
    );
  });
}

// Get country from IP address (fallback)
async function getCountryFromIP(): Promise<{ country_code: string; country_name: string; source: 'ip' } | null> {
  try {
    // Using ipapi.co free tier (1000 requests/day)
    const response = await fetch('https://ipapi.co/json/');
    if (!response.ok) return null;
    
    const data: IPGeoResponse = await response.json();
    
    if (data.country_code) {
      return {
        country_code: data.country_code,
        country_name: data.country_name || data.country_code,
        source: 'ip',
      };
    }
    return null;
  } catch (error) {
    console.warn('IP geolocation failed:', error);
    return null;
  }
}

// Main function to detect user's location
export async function detectUserLocation(): Promise<GeoLocationResult> {
  // Try GPS first (more accurate, harder to spoof)
  const gpsResult = await getCountryFromGPS();
  
  if (gpsResult) {
    const region_id = COUNTRY_TO_REGION[gpsResult.country_code] || null;
    return {
      country_code: gpsResult.country_code,
      country_name: gpsResult.country_code, // Will be resolved by IP call if needed
      region_id,
      source: 'gps',
    };
  }
  
  // Fallback to IP geolocation
  const ipResult = await getCountryFromIP();
  
  if (ipResult) {
    const region_id = COUNTRY_TO_REGION[ipResult.country_code] || null;
    return {
      country_code: ipResult.country_code,
      country_name: ipResult.country_name,
      region_id,
      source: 'ip',
    };
  }
  
  // Unable to detect location — default to AU so preview/dev isn't blocked
  return {
    country_code: 'AU',
    country_name: 'Australia',
    region_id: 'AU',
    source: 'unknown',
  };
}

// Check if a region is currently active
export async function checkRegionActive(regionId: string): Promise<boolean> {
  // Only AU is active at launch
  return regionId === 'AU';
}

// Get region ID from country code
export function getRegionFromCountry(countryCode: string): string | null {
  return COUNTRY_TO_REGION[countryCode] || null;
}
