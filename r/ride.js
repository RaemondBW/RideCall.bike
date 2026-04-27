// ===== Ride Page JavaScript =====

document.addEventListener("DOMContentLoaded", () => {
  initRidePage();
});

// ===== SF Symbol to Emoji Mapping =====
const SF_SYMBOL_MAP = {
  "sun.max": "☀️",
  "cloud.sun": "⛅",
  cloud: "☁️",
  "cloud.rain": "🌧️",
  "cloud.heavyrain": "🌧️",
  "cloud.drizzle": "🌦️",
  "cloud.snow": "❄️",
  wind: "💨",
  "cloud.bolt": "⛈️",
  "moon.stars": "🌙",
  "cloud.moon": "☁️🌙",
};

// ===== WMO Weather Code Mapping =====
const WMO_CODE_MAP = {
  0: { emoji: "☀️", desc: "Clear sky" },
  1: { emoji: "🌤️", desc: "Mainly clear" },
  2: { emoji: "⛅", desc: "Partly cloudy" },
  3: { emoji: "☁️", desc: "Overcast" },
  45: { emoji: "🌫️", desc: "Foggy" },
  48: { emoji: "🌫️", desc: "Depositing rime fog" },
  51: { emoji: "🌦️", desc: "Light drizzle" },
  53: { emoji: "🌦️", desc: "Moderate drizzle" },
  55: { emoji: "🌧️", desc: "Dense drizzle" },
  56: { emoji: "🌧️", desc: "Freezing drizzle" },
  57: { emoji: "🌧️", desc: "Heavy freezing drizzle" },
  61: { emoji: "🌧️", desc: "Slight rain" },
  63: { emoji: "🌧️", desc: "Moderate rain" },
  65: { emoji: "🌧️", desc: "Heavy rain" },
  66: { emoji: "🌧️", desc: "Freezing rain" },
  67: { emoji: "🌧️", desc: "Heavy freezing rain" },
  71: { emoji: "❄️", desc: "Slight snow" },
  73: { emoji: "❄️", desc: "Moderate snow" },
  75: { emoji: "❄️", desc: "Heavy snow" },
  77: { emoji: "❄️", desc: "Snow grains" },
  80: { emoji: "🌦️", desc: "Slight rain showers" },
  81: { emoji: "🌧️", desc: "Moderate rain showers" },
  82: { emoji: "🌧️", desc: "Violent rain showers" },
  85: { emoji: "❄️", desc: "Slight snow showers" },
  86: { emoji: "❄️", desc: "Heavy snow showers" },
  95: { emoji: "⛈️", desc: "Thunderstorm" },
  96: { emoji: "⛈️", desc: "Thunderstorm with slight hail" },
  99: { emoji: "⛈️", desc: "Thunderstorm with heavy hail" },
};

// ===== Day Name Mapping =====
const DAY_NAMES = {
  1: "Sunday",
  2: "Monday",
  3: "Tuesday",
  4: "Wednesday",
  5: "Thursday",
  6: "Friday",
  7: "Saturday",
};

// ===== Day-of-week Colors (matches the iOS app palette) =====
const DAY_COLORS = {
  1: { bg: "#264653", fg: "#ffffff" }, // Sunday
  2: { bg: "#287271", fg: "#ffffff" }, // Monday
  3: { bg: "#2A9D8F", fg: "#ffffff" }, // Tuesday
  4: { bg: "#8AB17D", fg: "#ffffff" }, // Wednesday
  5: { bg: "#E9C46A", fg: "#1f2937" }, // Thursday
  6: { bg: "#F4A261", fg: "#1f2937" }, // Friday
  7: { bg: "#E76F51", fg: "#ffffff" }, // Saturday
};

// Convert a ride to its day-of-week (1-7), preferring rec, falling back to dt.
function rideDayOfWeek(ride) {
  if (ride.rec) return ride.rec;
  if (ride.dt) {
    const d = parseDate(ride.dt);
    if (!isNaN(d.getTime())) return d.getDay() + 1; // 1=Sun..7=Sat
  }
  return null;
}

function applyDayColor(ride) {
  const dow = rideDayOfWeek(ride);
  const color = DAY_COLORS[dow];
  if (!color) return;
  document.documentElement.style.setProperty("--day-color", color.bg);
  document.documentElement.style.setProperty("--day-color-fg", color.fg);
}

// Global state for chart/map sync
let chartState = {
  hourlyData: [],
  rideStartHour: 0,
  rideEndTime: 0,
  rideDuration: 0,
  map: null,
  routeCoordinates: [],
  positionMarker: null,
  // Chart scale info for indicator positioning
  yMin: 0,
  yMax: 0,
  chartHeight: 0,
  hourWidth: 0,
};

// ===== Main Initialization =====
function initRidePage() {
  const urlParams = new URLSearchParams(window.location.search);
  const encodedData = urlParams.get("d");

  if (!encodedData) {
    showError("No ride data found in the URL.");
    return;
  }

  try {
    const rideData = decodeRideData(encodedData);
    console.log("Decoded ride data:", rideData);
    displayRideData(rideData);
  } catch (error) {
    console.error("Error decoding ride data:", error);
    showError("Unable to decode the ride data. The link may be corrupted.");
  }
}

// ===== Decode Ride Data =====
function decodeRideData(encodedData) {
  // Convert base64url to standard base64
  let base64 = encodedData.replace(/-/g, "+").replace(/_/g, "/");

  // Add padding if needed
  while (base64.length % 4 !== 0) {
    base64 += "=";
  }

  // Decode base64 to binary
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }

  // Decompress with raw deflate using pako (no zlib header)
  const decompressed = pako.inflateRaw(bytes, { to: "string" });

  // Parse JSON
  return JSON.parse(decompressed);
}

// ===== Display Ride Data =====
function displayRideData(data) {
  // Validate required ride data
  if (!data || !data.r || typeof data.r.h !== "number" || typeof data.r.d !== "number") {
    showError("The ride data is incomplete or invalid.");
    return;
  }

  // Update page title
  if (data.r.t) {
    document.title = `${data.r.t} - Ride Call`;
  }

  // Display ride info
  displayRideInfo(data.r);

  // Display route if present
  if (data.rt) {
    displayRoute(data.rt);
  } else {
    document.getElementById("route-info-row").style.display = "none";
  }

  // Show content, hide loading immediately so map can render
  document.getElementById("loading-state").classList.add("hidden");
  document.getElementById("ride-content").classList.remove("hidden");

  // Fetch live weather from Open-Meteo asynchronously
  fetchRouteWeather(data.rt, data.r)
    .then((weather) => {
      if (weather) {
        displayWeather(weather, data.r);
        if (weather.hr && weather.hr.length > 0) {
          displayTemperatureChart(weather.hr, data.r);
          displayPrecipitationChart(weather.hr, data.r);
        }
      }
    })
    .catch((err) => {
      console.error("Failed to fetch live weather:", err);
      // Fall back to cached weather if available
      if (data.w) {
        displayWeather(data.w, data.r);
        if (data.w.hr && data.w.hr.length > 0) {
          displayTemperatureChart(data.w.hr, data.r);
          displayPrecipitationChart(data.w.hr, data.r);
        }
      }
    });
}

// ===== Display Ride Info =====
function displayRideInfo(ride) {
  applyDayColor(ride);

  // Title
  document.getElementById("ride-title").textContent = ride.t;

  // Time
  const rideTime = formatTime(ride.h, ride.m);
  document.getElementById("ride-time").textContent = rideTime;

  // Schedule
  const scheduleEl = document.getElementById("ride-schedule");
  const recurrenceIcon = document.getElementById("recurrence-icon");
  if (ride.rec) {
    scheduleEl.textContent = DAY_NAMES[ride.rec];
    recurrenceIcon.style.display = "inline-flex";
  } else if (ride.dt) {
    const date = parseDate(ride.dt);
    scheduleEl.textContent = formatDateShort(date);
    recurrenceIcon.style.display = "none";
  }

  // Duration
  document.getElementById("ride-duration").textContent = formatDuration(ride.d);

  // Store for chart/map sync
  chartState.rideStartTime = ride.h + (ride.m || 0) / 60;
  chartState.rideEndTime = chartState.rideStartTime + ride.d / 60;
  chartState.rideDuration = ride.d;
}

// ===== Display Route =====
function displayRoute(route) {
  // Route name
  document.getElementById("route-name").textContent = route.n;

  // Distance (convert meters to miles)
  const miles = route.di / 1609.34;
  document.getElementById("route-distance").textContent =
    `${miles.toFixed(1)} mi`;

  // Elevation (convert meters to feet)
  const feet = route.el * 3.28084;
  document.getElementById("route-elevation").textContent =
    `${Math.round(feet).toLocaleString()} ft`;

  // Map
  if (route.pl) {
    document.getElementById("map-section").classList.remove("hidden");
    initMap(route.pl);
  }
}

// ===== Initialize Map =====
function initMap(polyline) {
  // Decode polyline
  const coordinates = decodePolyline(polyline);
  chartState.routeCoordinates = coordinates;

  if (coordinates.length === 0) {
    document.getElementById("map-section").classList.add("hidden");
    return;
  }

  // Check if Leaflet is available
  if (typeof L === "undefined") {
    return;
  }

  // Create Leaflet map
  const map = L.map("route-map", {
    zoomControl: false,
    attributionControl: false,
    dragging: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    touchZoom: false,
  });

  chartState.map = map;

  // Use CartoDB Voyager (light, clean style like Apple Maps)
  L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
    maxZoom: 19,
  }).addTo(map);

  // Add the route polyline
  const routeLine = L.polyline(coordinates, {
    color: "#0a84ff",
    weight: 4,
    opacity: 1,
    lineJoin: "round",
    lineCap: "round",
  }).addTo(map);

  // Create position marker (hidden initially)
  const markerIcon = L.divIcon({
    className: "position-marker",
    iconSize: [16, 16],
    iconAnchor: [8, 8],
  });
  chartState.positionMarker = L.marker([0, 0], {
    icon: markerIcon,
    opacity: 0,
  }).addTo(map);

  // Fit map to route bounds once container is stable
  const fitMap = () => {
    map.invalidateSize();
    map.fitBounds(routeLine.getBounds(), {
      padding: [80, 60],
    });
  };

  // Initial fit after brief layout delay
  setTimeout(fitMap, 100);

  // Re-fit whenever the map container resizes (e.g. weather/chart sections loading below)
  if (typeof ResizeObserver !== "undefined") {
    const mapContainer = document.getElementById("route-map");
    const ro = new ResizeObserver(() => {
      map.invalidateSize();
    });
    ro.observe(mapContainer);
  }
}

// ===== Add Temperature Markers to Map =====
function addTempMarkersToMap(sampledPoints, hourlyData, rideStartTime, rideEndTime) {
  if (!chartState.map || !sampledPoints || sampledPoints.length === 0) return;

  const map = chartState.map;

  sampledPoints.forEach((pt, i) => {
    // Find the temperature at ride start for each point
    const progress = sampledPoints.length > 1 ? i / (sampledPoints.length - 1) : 0;
    const timeAtPoint = rideStartTime + progress * (rideEndTime - rideStartTime);
    const hourIndex = Math.round(timeAtPoint);

    // Find temperature from the merged hourly data
    const hourData = hourlyData.find((h) => h.h === Math.min(23, Math.max(0, hourIndex)));
    const temp = hourData ? hourData.t : null;
    if (temp === null) return;

    const icon = L.divIcon({
      className: "temp-marker",
      html: `${temp}°`,
      iconSize: null,
      iconAnchor: [20, 12],
    });

    L.marker([pt[0], pt[1]], { icon: icon, interactive: false }).addTo(map);
  });
}

// ===== Decode Google Polyline =====
function decodePolyline(encoded) {
  const points = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte;

    // Decode latitude
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const dlat = result & 1 ? ~(result >> 1) : result >> 1;
    lat += dlat;

    shift = 0;
    result = 0;

    // Decode longitude
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);

    const dlng = result & 1 ? ~(result >> 1) : result >> 1;
    lng += dlng;

    points.push([lat / 1e5, lng / 1e5]);
  }

  return points;
}

// ===== Open-Meteo Route-Aware Weather =====

// Haversine distance in km between two [lat, lng] points
function haversineKm(a, b) {
  const R = 6371;
  const dLat = ((b[0] - a[0]) * Math.PI) / 180;
  const dLon = ((b[1] - a[1]) * Math.PI) / 180;
  const lat1 = (a[0] * Math.PI) / 180;
  const lat2 = (b[0] * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

// Sample N evenly-spaced points from a coordinate array
function samplePoints(coords, count) {
  if (coords.length <= count) return coords.slice();
  const points = [];
  for (let i = 0; i < count; i++) {
    const idx = Math.round((i / (count - 1)) * (coords.length - 1));
    points.push(coords[idx]);
  }
  return points;
}

// Check if all points are within maxKm of the start
function isShortLoop(coords, maxKm) {
  const start = coords[0];
  return coords.every((c) => haversineKm(start, c) <= maxKm);
}

// Convert wind direction degrees to compass string
function degreesToCompass(deg) {
  const dirs = [
    "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
    "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
  ];
  return dirs[Math.round(deg / 22.5) % 16];
}

// Get the ride date: use ride.dt if set, otherwise compute next occurrence of ride.rec
function getRideDate(ride) {
  if (ride.dt) return ride.dt; // Already YYYY-MM-DD
  // For recurring rides, find the next occurrence
  const today = new Date();
  const todayDay = today.getDay() + 1; // 1=Sun..7=Sat (match app convention)
  let daysAhead = (ride.rec - todayDay + 7) % 7;
  if (daysAhead === 0) daysAhead = 0; // Today if it matches
  const target = new Date(today);
  target.setDate(target.getDate() + daysAhead);
  return target.toISOString().split("T")[0];
}

// Reverse-geocode a coordinate to a city/locality name
async function reverseGeocode(lat, lon) {
  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}` +
      `&format=json&zoom=10&addressdetails=1`;
    const res = await fetch(url, {
      headers: { "User-Agent": "RideCall-Website/1.0" },
    });
    if (!res.ok) return null;
    const data = await res.json();
    const addr = data.address;
    return addr.city || addr.town || addr.village || addr.hamlet || addr.county || null;
  } catch {
    return null;
  }
}

// Fetch hourly weather from Open-Meteo for a single point
async function fetchPointWeather(lat, lon, date) {
  const url =
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&hourly=temperature_2m,apparent_temperature,precipitation_probability,wind_speed_10m,wind_direction_10m,weather_code` +
    `&daily=sunrise,sunset` +
    `&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto` +
    `&start_date=${date}&end_date=${date}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`);
  return res.json();
}

// Main: fetch weather along the route and merge into ride-hour data
async function fetchRouteWeather(route, ride) {
  let coords = [];
  let sampledPoints = [];

  if (route && route.pl) {
    coords = decodePolyline(route.pl);
  }

  if (coords.length >= 2) {
    if (isShortLoop(coords, 15)) {
      // Short loop — single point is enough
      sampledPoints = [coords[0]];
    } else {
      sampledPoints = samplePoints(coords, 5);
    }
  } else {
    // No route — can't fetch weather
    return null;
  }

  const date = getRideDate(ride);

  // Fetch weather and city names for all sampled points in parallel
  const [pointForecasts, pointCities] = await Promise.all([
    Promise.all(sampledPoints.map((pt) => fetchPointWeather(pt[0], pt[1], date))),
    Promise.all(sampledPoints.map((pt) => reverseGeocode(pt[0], pt[1]))),
  ]);

  // Extract daily data from first point
  const daily = pointForecasts[0].daily;
  const sunriseRaw = daily.sunrise?.[0] || "";
  const sunsetRaw = daily.sunset?.[0] || "";

  // Store sampled points and city names for chart/map interaction
  chartState.sampledPoints = sampledPoints;
  chartState.pointCities = pointCities;

  // Parse hourly arrays for each sampled point
  // Each forecast has .hourly.time[], .hourly.temperature_2m[], etc.
  const pointHourlies = pointForecasts.map((fc) => {
    const h = fc.hourly;
    return h.time.map((t, i) => ({
      hour: new Date(t).getHours(),
      temp: Math.round(h.temperature_2m[i]),
      feelsLike: Math.round(h.apparent_temperature[i]),
      precip: h.precipitation_probability[i] || 0,
      wind: Math.round(h.wind_speed_10m[i]),
      windDir: h.wind_direction_10m[i],
      code: h.weather_code[i],
    }));
  });

  // Build ride-hour merged weather
  // For each hour, figure out where the rider is on the route, pick closest sampled point
  const rideStartTime = ride.h + (ride.m || 0) / 60;
  const rideEndTime = rideStartTime + ride.d / 60;

  // We want a window of hours around the ride for the chart (2h before, 2h after)
  const chartStartHour = Math.max(0, Math.floor(rideStartTime) - 1);
  const chartEndHour = Math.min(23, Math.ceil(rideEndTime) + 1);

  const mergedHourly = [];
  for (let hour = chartStartHour; hour <= chartEndHour; hour++) {
    // Determine rider position on route at this hour
    let pointIndex = 0; // default: start point
    if (hour >= rideStartTime && hour <= rideEndTime && sampledPoints.length > 1) {
      const progress = (hour - rideStartTime) / (rideEndTime - rideStartTime);
      const clampedProgress = Math.max(0, Math.min(1, progress));
      // Find closest sampled point index
      pointIndex = Math.round(clampedProgress * (sampledPoints.length - 1));
    } else if (hour > rideEndTime && sampledPoints.length > 1) {
      pointIndex = sampledPoints.length - 1; // end point
    }

    const hourData = pointHourlies[pointIndex].find((h) => h.hour === hour);
    if (!hourData) continue;

    mergedHourly.push({
      h: hour,
      t: hourData.temp,
      fl: hourData.feelsLike,
      pc: hourData.precip,
      w: hourData.wind,
      wd: degreesToCompass(hourData.windDir),
      sym: null, // Not using SF symbols anymore
      code: hourData.code,
    });
  }

  // Determine dominant weather code during ride hours
  const rideHours = mergedHourly.filter(
    (h) => h.h >= Math.floor(rideStartTime) && h.h <= Math.ceil(rideEndTime),
  );
  const dominantCode =
    rideHours.length > 0
      ? rideHours.reduce((worst, h) => Math.max(worst, h.code), 0)
      : mergedHourly[0]?.code || 0;
  const wmoInfo = WMO_CODE_MAP[dominantCode] || WMO_CODE_MAP[0];

  // Compute daily hi/lo from ride hours
  const rideTemps = rideHours.map((h) => h.t);
  const hi = rideTemps.length > 0 ? Math.max(...rideTemps) : mergedHourly[0]?.t || 0;
  const lo = rideTemps.length > 0 ? Math.min(...rideTemps) : mergedHourly[0]?.t || 0;

  // Average wind during ride
  const avgWind =
    rideHours.length > 0
      ? Math.round(rideHours.reduce((s, h) => s + h.w, 0) / rideHours.length)
      : 0;

  // Max precip during ride
  const maxPrecip =
    rideHours.length > 0 ? Math.max(...rideHours.map((h) => h.pc)) : 0;

  // Dominant wind direction during ride
  const dominantWd = rideHours.length > 0 ? rideHours[Math.floor(rideHours.length / 2)].wd : "N";

  // Format sunrise/sunset for display
  const formatSunTime = (iso) => {
    if (!iso) return "";
    const d = new Date(iso);
    const h = d.getHours();
    const m = d.getMinutes();
    const ampm = h >= 12 ? "PM" : "AM";
    const dh = h % 12 || 12;
    return `${dh}:${m.toString().padStart(2, "0")} ${ampm}`;
  };

  return {
    dt: date,
    hi: hi,
    lo: lo,
    pr: maxPrecip,
    ws: avgWind,
    wd: dominantWd,
    desc: wmoInfo.desc,
    emoji: wmoInfo.emoji,
    code: dominantCode,
    sr: formatSunTime(sunriseRaw),
    ss: formatSunTime(sunsetRaw),
    hr: mergedHourly,
  };
}

// ===== Display Weather =====
function displayWeather(weather, ride) {
  const weatherSection = document.getElementById("weather-section");

  // Date
  if (weather.dt) {
    const date = parseDate(weather.dt);
    document.getElementById("weather-date").textContent = formatDateShort(date);
  }

  // Calculate ride time window
  const rideStartTime = ride.h + (ride.m || 0) / 60;
  const rideEndTime = rideStartTime + ride.d / 60;

  // Filter hourly data to ride window and calculate summary
  let rideWeather = {
    temps: [],
    precip: [],
    wind: [],
    symbols: [],
  };

  if (weather.hr && weather.hr.length > 0) {
    weather.hr.forEach((h) => {
      // Include hours that overlap with ride time
      // An hour overlaps if: hour < rideEndTime AND hour+1 > rideStartTime
      if (h.h < rideEndTime && h.h + 1 > rideStartTime) {
        rideWeather.temps.push(h.t);
        rideWeather.precip.push(h.pc || 0);
        rideWeather.wind.push(h.w || 0);
        if (h.sym) rideWeather.symbols.push(h.sym);
      }
    });
  }

  // Use ride-specific data if available, otherwise fall back to daily data
  if (rideWeather.temps.length > 0) {
    const minTemp = Math.min(...rideWeather.temps);
    const maxTemp = Math.max(...rideWeather.temps);
    const maxPrecip = Math.max(...rideWeather.precip);
    const avgWind = Math.round(
      rideWeather.wind.reduce((a, b) => a + b, 0) / rideWeather.wind.length,
    );

    // Temperature display
    if (minTemp === maxTemp) {
      document.getElementById("temp-high").textContent = maxTemp;
      document.querySelector(".temp-divider").style.display = "none";
      document.querySelector(".temp-low").style.display = "none";
    } else {
      document.getElementById("temp-high").textContent = maxTemp;
      document.getElementById("temp-low").textContent = minTemp;
    }

    // Precipitation
    document.getElementById("precip-chance").textContent = `${maxPrecip}%`;

    // Wind
    document.getElementById("wind-speed").textContent = avgWind;

    // Weather emoji: prefer Open-Meteo WMO code, then SF symbol, then default
    if (weather.emoji) {
      document.querySelector(".weather-emoji").textContent = weather.emoji;
    } else if (rideWeather.symbols.length > 0) {
      const emoji = SF_SYMBOL_MAP[rideWeather.symbols[0]] || "🌤️";
      document.querySelector(".weather-emoji").textContent = emoji;
    }
  } else {
    // Fall back to daily weather
    document.getElementById("temp-high").textContent = weather.hi;
    document.getElementById("temp-low").textContent = weather.lo;
    document.getElementById("precip-chance").textContent = `${weather.pr}%`;
    document.getElementById("wind-speed").textContent = weather.ws;

    if (weather.emoji) {
      document.querySelector(".weather-emoji").textContent = weather.emoji;
    } else {
      const emoji = SF_SYMBOL_MAP[weather.sym] || "🌤️";
      document.querySelector(".weather-emoji").textContent = emoji;
    }
  }

  // Description (use daily description)
  document.getElementById("weather-desc").textContent = weather.desc;

  // Wind direction (use daily)
  document.getElementById("wind-dir").textContent = weather.wd;

  // Sunrise/Sunset - only show if it occurs during the ride
  const sunDetail = document.getElementById("sun-detail");
  const sunriseTime = parseTimeToDecimal(weather.sr, true);
  const sunsetTime = parseTimeToDecimal(weather.ss, false);

  let showSunEvent = false;

  if (sunriseTime >= rideStartTime && sunriseTime <= rideEndTime) {
    // Sunrise occurs during the ride
    document.getElementById("sun-time").textContent = weather.sr;
    document.getElementById("sun-label").textContent = "Sunrise";
    showSunEvent = true;
  } else if (sunsetTime >= rideStartTime && sunsetTime <= rideEndTime) {
    // Sunset occurs during the ride
    document.getElementById("sun-time").textContent = weather.ss;
    document.getElementById("sun-label").textContent = "Sunset";
    showSunEvent = true;
  }

  if (!showSunEvent) {
    sunDetail.style.display = "none";
  }

  // Update map overlay with first ride hour data
  if (weather.hr && weather.hr.length > 0) {
    const rideStartHour = Math.floor(rideStartTime);
    const firstRideHour =
      weather.hr.find((h) => h.h >= rideStartHour) || weather.hr[0];
    updateMapOverlay(firstRideHour);
  }
}

// ===== Get city name for a given time on the route =====
function getCityForTime(currentTime) {
  const { sampledPoints, pointCities, rideStartTime, rideEndTime } = chartState;
  if (!sampledPoints || !pointCities || sampledPoints.length === 0) return null;
  if (sampledPoints.length === 1) return pointCities[0];

  let pointIndex = 0;
  if (currentTime >= rideStartTime && currentTime <= rideEndTime) {
    const progress = (currentTime - rideStartTime) / (rideEndTime - rideStartTime);
    pointIndex = Math.round(Math.max(0, Math.min(1, progress)) * (sampledPoints.length - 1));
  } else if (currentTime > rideEndTime) {
    pointIndex = sampledPoints.length - 1;
  }
  return pointCities[pointIndex] || null;
}

// ===== Update map location display =====
function updateMapLocation(cityName) {
  const row = document.getElementById("map-location-row");
  const el = document.getElementById("map-location");
  if (cityName) {
    el.textContent = cityName;
    row.style.display = "";
  } else {
    row.style.display = "none";
  }
}

// ===== Update Map Weather Overlay =====
function updateMapOverlay(hourData) {
  document.getElementById("map-temp").textContent = `${hourData.t}°`;
  document.getElementById("map-feels").textContent = `${hourData.fl}°`;
  document.getElementById("map-wind").textContent = hourData.w;
  if (hourData.wd) {
    const windRow = document.querySelector(".wind-row span");
    if (windRow) {
      windRow.innerHTML = `💨 <span id="map-wind">${hourData.w}</span> ${hourData.wd}`;
    }
  }
  // Show starting city
  const city = getCityForTime(chartState.rideStartTime);
  updateMapLocation(city);
}

// ===== Update Map Position Marker =====
function updateMapPositionMarker(currentTime) {
  if (!chartState.positionMarker || chartState.routeCoordinates.length === 0) {
    return;
  }

  const { rideStartTime, rideEndTime, routeCoordinates, positionMarker } =
    chartState;

  // Check if current time is within ride window
  if (currentTime < rideStartTime || currentTime > rideEndTime) {
    positionMarker.setOpacity(0);
    return;
  }

  // Calculate progress through the ride (0 to 1)
  const rideDuration = rideEndTime - rideStartTime;
  const progress = (currentTime - rideStartTime) / rideDuration;

  // Find position along the route
  const totalPoints = routeCoordinates.length;
  const exactIndex = progress * (totalPoints - 1);
  const lowerIndex = Math.floor(exactIndex);
  const upperIndex = Math.min(lowerIndex + 1, totalPoints - 1);
  const fraction = exactIndex - lowerIndex;

  // Interpolate between points
  const lat =
    routeCoordinates[lowerIndex][0] +
    (routeCoordinates[upperIndex][0] - routeCoordinates[lowerIndex][0]) *
      fraction;
  const lng =
    routeCoordinates[lowerIndex][1] +
    (routeCoordinates[upperIndex][1] - routeCoordinates[lowerIndex][1]) *
      fraction;

  // Update marker
  positionMarker.setLatLng([lat, lng]);
  positionMarker.setOpacity(1);
}

// ===== Display Temperature Chart =====
function displayTemperatureChart(hourlyData, ride) {
  const chartSection = document.getElementById("temp-chart-section");
  chartSection.classList.remove("hidden");

  chartState.hourlyData = hourlyData;

  // Wait for browser to layout the unhidden element before measuring
  requestAnimationFrame(() => {
    renderTemperatureChart(hourlyData, ride);
  });
}

// ===== Render Temperature Chart (after layout) =====
function renderTemperatureChart(hourlyData, ride) {
  // Find min/max temps for scale with fixed 5 degree padding
  const temps = hourlyData.map((h) => h.t);
  const minTemp = Math.min(...temps);
  const maxTemp = Math.max(...temps);
  const yMin = minTemp - 5;
  const yMax = maxTemp + 5;

  // Update Y axis labels
  const yAxis = document.getElementById("chart-y-axis");
  yAxis.innerHTML = `
    <span>${yMax}°</span>
    <span>${Math.round((yMax + yMin) / 2)}°</span>
    <span>${yMin}°</span>
  `;

  // Chart dimensions - fill container
  const chartScroll = document.getElementById("chart-scroll");
  const containerWidth = chartScroll.clientWidth;
  const chartHeight = chartScroll.clientHeight - 20; // leave room for x-axis

  // Calculate hourWidth to fill the container
  // chartWidth = (n-1) * hourWidth, so hourWidth = containerWidth / (n-1)
  const hourWidth = containerWidth / (hourlyData.length - 1);
  const chartWidth = containerWidth;

  const chartInner = document.getElementById("chart-inner");
  chartInner.style.width = `${chartWidth}px`;

  const svg = document.getElementById("temp-chart-svg");
  svg.setAttribute("viewBox", `0 0 ${chartWidth} ${chartHeight}`);
  svg.setAttribute("width", chartWidth);
  svg.setAttribute("height", chartHeight);

  // Build points array - points at 0, hourWidth, 2*hourWidth, etc.
  const points = hourlyData.map((h, i) => ({
    x: i * hourWidth,
    y: chartHeight - ((h.t - yMin) / (yMax - yMin)) * chartHeight,
    data: h,
    index: i,
  }));

  // Store chart scale info for indicator positioning
  chartState.points = points;
  chartState.hourWidth = hourWidth;
  chartState.chartHeight = chartHeight;
  chartState.yMin = yMin;
  chartState.yMax = yMax;

  // Generate smooth curve using Catmull-Rom to Bezier conversion
  const linePath = generateSmoothPath(points, false);
  const areaPath = generateSmoothPath(points, true, chartHeight);

  document.getElementById("temp-line").setAttribute("d", linePath);
  document.getElementById("temp-area").setAttribute("d", areaPath);

  // Find ride time range in hourly data
  // Calculate position based on actual time values including minutes
  const firstHour = hourlyData[0].h;
  const rideStartTime = ride.h + (ride.m || 0) / 60; // e.g., 6:30 = 6.5
  const rideEndTime = rideStartTime + ride.d / 60; // duration in hours

  // Calculate pixel positions based on time offset from first hour
  const highlightStartX = (rideStartTime - firstHour) * hourWidth;
  const highlightEndX = (rideEndTime - firstHour) * hourWidth;
  const highlightWidth = highlightEndX - highlightStartX;

  // Draw ride highlight (green with transparency and outline)
  if (highlightWidth > 0) {
    const cornerRadius = 8;

    // Fill
    const highlight = document.getElementById("ride-highlight");
    highlight.setAttribute("x", highlightStartX);
    highlight.setAttribute("y", 0);
    highlight.setAttribute("width", highlightWidth);
    highlight.setAttribute("height", chartHeight);
    highlight.setAttribute("rx", cornerRadius);
    highlight.setAttribute("ry", cornerRadius);

    // Outline
    const outline = document.getElementById("ride-outline");
    outline.setAttribute("x", highlightStartX);
    outline.setAttribute("y", 0);
    outline.setAttribute("width", highlightWidth);
    outline.setAttribute("height", chartHeight);
    outline.setAttribute("rx", cornerRadius);
    outline.setAttribute("ry", cornerRadius);
  }

  // X axis labels
  const xAxis = document.getElementById("chart-x-axis");
  xAxis.innerHTML = hourlyData
    .map((h, i) => {
      const x = i * hourWidth;
      return `<span class="x-label" style="left: ${x}px">${formatHourShort(h.h)}</span>`;
    })
    .join("");

  // Position indicator at first point
  const indicator = document.getElementById("position-indicator");
  const firstPointY = points[0].y;
  indicator.style.left = `0px`;
  indicator.style.top = `${firstPointY}px`;
  indicator.style.setProperty(
    "--line-height",
    `${chartHeight - firstPointY}px`,
  );

  // Update current display
  updateChartDisplay(hourlyData[0], 0);

  // Click interaction (desktop)
  chartInner.addEventListener("click", (e) => {
    handleChartTap(e, hourlyData, hourWidth, indicator);
  });

  // Touch drag interaction (mobile)
  let isDragging = false;

  chartInner.addEventListener(
    "touchstart",
    (e) => {
      isDragging = true;
      handleChartTap(e.touches[0], hourlyData, hourWidth, indicator);
      e.preventDefault(); // Prevent scrolling while dragging on chart
    },
    { passive: false },
  );

  chartInner.addEventListener(
    "touchmove",
    (e) => {
      if (isDragging) {
        handleChartTap(e.touches[0], hourlyData, hourWidth, indicator);
        e.preventDefault();
      }
    },
    { passive: false },
  );

  chartInner.addEventListener("touchend", () => {
    isDragging = false;
  });

  chartInner.addEventListener("touchcancel", () => {
    isDragging = false;
  });
}

// ===== Display Precipitation Chart =====
function displayPrecipitationChart(hourlyData, ride) {
  const chartSection = document.getElementById("precip-chart-section");
  chartSection.classList.remove("hidden");

  // Show chart hint
  document.getElementById("chart-hint").classList.remove("hidden");

  requestAnimationFrame(() => {
    renderPrecipitationChart(hourlyData, ride);
  });
}

function renderPrecipitationChart(hourlyData, ride) {
  // Precip goes 0-100%, map to Heavy (100) / Mod (50) / Light (0)
  const yMin = 0;
  const yMax = 100;

  const chartScroll = document.getElementById("precip-chart-scroll");
  const chartHeight = chartScroll.clientHeight - 20; // leave room for x-axis
  const containerWidth = chartScroll.clientWidth;
  const hourWidth = containerWidth / (hourlyData.length - 1);
  const chartWidth = containerWidth;

  const chartInner = document.getElementById("precip-chart-inner");
  chartInner.style.width = `${chartWidth}px`;

  const svg = document.getElementById("precip-chart-svg");
  svg.setAttribute("viewBox", `0 0 ${chartWidth} ${chartHeight}`);
  svg.setAttribute("width", chartWidth);
  svg.setAttribute("height", chartHeight);

  // Build points
  const points = hourlyData.map((h, i) => ({
    x: i * hourWidth,
    y: chartHeight - ((h.pc || 0) / yMax) * chartHeight,
    data: h,
  }));

  const linePath = generateSmoothPath(points, false);
  const areaPath = generateSmoothPath(points, true, chartHeight);

  document.getElementById("precip-line").setAttribute("d", linePath);
  document.getElementById("precip-area").setAttribute("d", areaPath);

  // Ride highlight
  const firstHour = hourlyData[0].h;
  const rideStartTime = ride.h + (ride.m || 0) / 60;
  const rideEndTime = rideStartTime + ride.d / 60;

  const highlightStartX = (rideStartTime - firstHour) * hourWidth;
  const highlightEndX = (rideEndTime - firstHour) * hourWidth;
  const highlightWidth = highlightEndX - highlightStartX;

  if (highlightWidth > 0) {
    const cr = 8;
    const rh = document.getElementById("precip-ride-highlight");
    rh.setAttribute("x", highlightStartX);
    rh.setAttribute("y", 0);
    rh.setAttribute("width", highlightWidth);
    rh.setAttribute("height", chartHeight);
    rh.setAttribute("rx", cr);
    rh.setAttribute("ry", cr);

    const ro = document.getElementById("precip-ride-outline");
    ro.setAttribute("x", highlightStartX);
    ro.setAttribute("y", 0);
    ro.setAttribute("width", highlightWidth);
    ro.setAttribute("height", chartHeight);
    ro.setAttribute("rx", cr);
    ro.setAttribute("ry", cr);
  }

  // X axis
  const xAxis = document.getElementById("precip-x-axis");
  xAxis.innerHTML = hourlyData
    .map((h, i) => {
      const x = i * hourWidth;
      return `<span class="x-label" style="left: ${x}px">${formatHourShort(h.h)}</span>`;
    })
    .join("");

  // Set initial precip display
  const startHourData = hourlyData.find((h) => h.h >= Math.floor(rideStartTime)) || hourlyData[0];
  document.getElementById("precip-chart-time").textContent = formatHourShort(startHourData.h);
  const precipLabel = startHourData.pc > 0 ? `${startHourData.pc}%` : "None";
  document.getElementById("precip-chart-value").textContent = precipLabel;
}

// ===== Generate Smooth Path using Catmull-Rom Spline =====
function generateSmoothPath(points, isArea, chartHeight) {
  if (points.length < 2) return "";

  let path = "";

  // For area, start from bottom
  if (isArea) {
    path = `M ${points[0].x} ${chartHeight} L ${points[0].x} ${points[0].y}`;
  } else {
    path = `M ${points[0].x} ${points[0].y}`;
  }

  // Use monotone cubic interpolation for smooth curves
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    // Calculate control points using Catmull-Rom to Bezier conversion
    const tension = 0.3;
    const cp1x = p1.x + (p2.x - p0.x) * tension;
    const cp1y = p1.y + (p2.y - p0.y) * tension;
    const cp2x = p2.x - (p3.x - p1.x) * tension;
    const cp2y = p2.y - (p3.y - p1.y) * tension;

    path += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p2.x} ${p2.y}`;
  }

  // For area, close the path
  if (isArea) {
    path += ` L ${points[points.length - 1].x} ${chartHeight} Z`;
  }

  return path;
}

// ===== Interpolate weather data between hours =====
function interpolateWeather(hourlyData, position, hourWidth) {
  // Position is in pixels, convert to fractional hour index
  // Points are at: 0, hourWidth, 2*hourWidth, etc.
  const fractionalIndex = position / hourWidth;
  const clampedFraction = Math.max(
    0,
    Math.min(hourlyData.length - 1, fractionalIndex),
  );

  const lowerIndex = Math.floor(clampedFraction);
  const upperIndex = Math.min(lowerIndex + 1, hourlyData.length - 1);
  const fraction = clampedFraction - lowerIndex;

  const lower = hourlyData[lowerIndex];
  const upper = hourlyData[upperIndex];

  // Interpolate numeric values
  const tExact = lower.t + (upper.t - lower.t) * fraction;
  const interpolated = {
    h: lower.h + fraction, // Fractional hour
    t: Math.round(tExact),
    tExact: tExact, // Keep unrounded for Y position calculation
    fl: Math.round(lower.fl + (upper.fl - lower.fl) * fraction),
    w: Math.round(lower.w + (upper.w - lower.w) * fraction),
    pc: Math.round(lower.pc + (upper.pc - lower.pc) * fraction),
    wd: fraction < 0.5 ? lower.wd : upper.wd, // Use nearest hour's wind direction
  };

  return interpolated;
}

// ===== Format fractional hour =====
function formatFractionalHour(fractionalHour) {
  const hour = Math.floor(fractionalHour);
  const minutes = Math.round((fractionalHour - hour) * 60);
  const h = ((hour % 24) + 24) % 24;
  const ampm = h >= 12 ? "pm" : "am";
  const displayHour = h % 12 || 12;

  if (minutes === 0) {
    return `${displayHour}${ampm}`;
  }
  return `${displayHour}:${minutes.toString().padStart(2, "0")}${ampm}`;
}

// ===== Handle Chart Tap =====
function handleChartTap(e, hourlyData, hourWidth, indicator) {
  const chartInner = document.getElementById("chart-inner");
  const rect = chartInner.getBoundingClientRect();
  const tapX = (e.clientX || e.pageX) - rect.left;

  // Clamp tap position to valid range
  const minX = 0;
  const maxX = (hourlyData.length - 1) * hourWidth;
  const clampedTapX = Math.max(minX, Math.min(maxX, tapX));

  // Interpolate weather at tapped position
  const interpolated = interpolateWeather(hourlyData, clampedTapX, hourWidth);

  // Calculate Y position based on exact interpolated temperature
  const { yMin, yMax, chartHeight } = chartState;
  const yPos =
    chartHeight - ((interpolated.tExact - yMin) / (yMax - yMin)) * chartHeight;

  // Update indicator position (both X and Y)
  indicator.style.left = `${clampedTapX}px`;
  indicator.style.top = `${yPos}px`;
  // Set line height to reach the bottom of the chart (x-axis)
  indicator.style.setProperty("--line-height", `${chartHeight - yPos}px`);

  // Update display with interpolated values
  updateChartDisplayInterpolated(interpolated);

  // Update map overlay with interpolated values
  updateMapOverlayInterpolated(interpolated);
}

// ===== Update Chart Display with Interpolated Data =====
function updateChartDisplayInterpolated(data) {
  document.getElementById("chart-time").textContent = formatFractionalHour(
    data.h,
  );
  document.getElementById("chart-temp").textContent = `${data.t}°`;

  // Update precipitation chart display
  const precipTime = document.getElementById("precip-chart-time");
  const precipValue = document.getElementById("precip-chart-value");
  if (precipTime && precipValue) {
    precipTime.textContent = formatFractionalHour(data.h);
    precipValue.textContent = data.pc > 0 ? `${data.pc}%` : "None";
  }

  // Update map position marker
  updateMapPositionMarker(data.h);

  // Update city name based on position along route
  const city = getCityForTime(data.h);
  updateMapLocation(city);
}

// ===== Update Map Overlay with Interpolated Data =====
function updateMapOverlayInterpolated(data) {
  document.getElementById("map-temp").textContent = `${data.t}°`;
  document.getElementById("map-feels").textContent = `${data.fl}°`;
  document.getElementById("map-wind").textContent = data.w;
  if (data.wd) {
    const windRow = document.querySelector(".wind-row span");
    if (windRow) {
      windRow.innerHTML = `💨 <span id="map-wind">${data.w}</span> ${data.wd}`;
    }
  }
}

// ===== Update Chart Display =====
function updateChartDisplay(hourData, index) {
  document.getElementById("chart-time").textContent = formatHourShort(
    hourData.h,
  );
  document.getElementById("chart-temp").textContent = `${hourData.t}°`;
}

// ===== Utility Functions =====
function formatTime(hour, minute) {
  const h = ((hour % 24) + 24) % 24;
  const ampm = h >= 12 ? "PM" : "AM";
  const displayHour = h % 12 || 12;
  const displayMin = minute.toString().padStart(2, "0");
  return `${displayHour}:${displayMin} ${ampm}`;
}

// Parse time string like "7:15 AM", "5:45 PM", or "7:15" to decimal hours
// For strings without AM/PM, isSunrise hint is used
function parseTimeToDecimal(timeStr, isSunrise = true) {
  if (!timeStr) return null;

  // Try with AM/PM first
  const matchAmPm = timeStr.match(/(\d+):(\d+)\s*(AM|PM|am|pm)/i);
  if (matchAmPm) {
    let hour = parseInt(matchAmPm[1], 10);
    const minute = parseInt(matchAmPm[2], 10);
    const ampm = matchAmPm[3].toUpperCase();

    if (ampm === "PM" && hour !== 12) hour += 12;
    if (ampm === "AM" && hour === 12) hour = 0;

    return hour + minute / 60;
  }

  // Try without AM/PM (just "7:15")
  const matchSimple = timeStr.match(/(\d+):(\d+)/);
  if (matchSimple) {
    let hour = parseInt(matchSimple[1], 10);
    const minute = parseInt(matchSimple[2], 10);

    // Assume sunrise times < 12 are AM, sunset times are PM if hour < 12
    if (!isSunrise && hour < 12) {
      hour += 12;
    }

    return hour + minute / 60;
  }

  return null;
}

function formatHourShort(hour) {
  const h = ((hour % 24) + 24) % 24;
  const ampm = h >= 12 ? "p" : "a";
  const displayHour = h % 12 || 12;
  return `${displayHour}${ampm}`;
}

function formatDuration(minutes) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) {
    return `${mins}m`;
  } else if (mins === 0) {
    return `${hours}h`;
  } else {
    return `${hours}h ${mins}m`;
  }
}

function parseDate(dateStr) {
  // Parse "YYYY-MM-DD" format
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDateLong(date) {
  const options = { weekday: "long", month: "long", day: "numeric" };
  return date.toLocaleDateString("en-US", options);
}

function formatDateShort(date) {
  const options = { weekday: "short", month: "short", day: "numeric" };
  return date.toLocaleDateString("en-US", options);
}

// ===== Error Handling =====
function showError(message) {
  document.getElementById("loading-state").classList.add("hidden");
  document.getElementById("error-state").classList.remove("hidden");
  document.getElementById("error-message").textContent = message;
}
