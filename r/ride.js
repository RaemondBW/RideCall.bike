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

  // Decompress with zlib using pako
  const decompressed = pako.inflate(bytes, { to: "string" });

  // Parse JSON
  return JSON.parse(decompressed);
}

// ===== Display Ride Data =====
function displayRideData(data) {
  // Update page title
  if (data.r && data.r.t) {
    document.title = `${data.r.t} - Ride Call`;
  }

  // Display ride info
  displayRideInfo(data.r);

  // Display route if present
  if (data.rt) {
    displayRoute(data.rt);
  }

  // Display weather if present
  if (data.w) {
    displayWeather(data.w, data.r);
  }

  // Show content, hide loading
  document.getElementById("loading-state").classList.add("hidden");
  document.getElementById("ride-content").classList.remove("hidden");
}

// ===== Display Ride Info =====
function displayRideInfo(ride) {
  // Title
  document.getElementById("ride-title").textContent = ride.t;

  // Schedule
  const scheduleEl = document.getElementById("ride-schedule");
  if (ride.rec) {
    scheduleEl.innerHTML = `<span class="schedule-badge">Every ${DAY_NAMES[ride.rec]}</span>`;
  } else if (ride.dt) {
    const date = parseDate(ride.dt);
    scheduleEl.innerHTML = `<span class="schedule-badge">${formatDateLong(date)}</span>`;
  }

  // Time
  const rideTime = formatTime(ride.h, ride.m);
  document.getElementById("ride-time").textContent = rideTime;

  // Duration
  document.getElementById("ride-duration").textContent = formatDuration(
    ride.d,
  );

  // Wake time calculation
  const totalMinutesBefore = (ride.p || 0) + (ride.c || 0);
  const wakeMinutes = ride.h * 60 + ride.m - totalMinutesBefore;
  const wakeHour = Math.floor(wakeMinutes / 60);
  const wakeMin = wakeMinutes % 60;
  document.getElementById("wake-time").textContent = formatTime(
    wakeHour,
    wakeMin,
  );
}

// ===== Display Route =====
function displayRoute(route) {
  const routeSection = document.getElementById("route-section");
  routeSection.classList.remove("hidden");

  // Route name
  document.getElementById("route-name").textContent = route.n;

  // Source badge
  const sourceEl = document.getElementById("route-source");
  if (route.act) {
    sourceEl.textContent = "Strava Activity";
  } else {
    sourceEl.textContent = "Planned Route";
    sourceEl.classList.add("planned");
  }

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
    initMap(route.pl);
  } else {
    const mapEl = document.getElementById("route-map");
    mapEl.classList.add("no-map");
    mapEl.innerHTML = "<span>Route map not available</span>";
  }
}

// ===== Initialize Map =====
function initMap(polyline) {
  // Decode polyline
  const coordinates = decodePolyline(polyline);

  if (coordinates.length === 0) {
    const mapEl = document.getElementById("route-map");
    mapEl.classList.add("no-map");
    mapEl.innerHTML = "<span>Unable to display route</span>";
    return;
  }

  // Check if Mapbox is available
  if (typeof mapboxgl === "undefined") {
    const mapEl = document.getElementById("route-map");
    mapEl.classList.add("no-map");
    mapEl.innerHTML = "<span>Map loading...</span>";
    return;
  }

  // Use a free/public Mapbox style (no token required for simple display)
  // For production, you'd want to add your own token
  mapboxgl.accessToken =
    "pk.eyJ1IjoibWFwYm94IiwiYSI6ImNpejY4NXVycTA2emYycXBndHRqcmZ3N3gifQ.rJcFIG214AriISLbB6B5aw";

  const map = new mapboxgl.Map({
    container: "route-map",
    style: "mapbox://styles/mapbox/outdoors-v12",
    interactive: false,
  });

  map.on("load", () => {
    // Add the route line
    map.addSource("route", {
      type: "geojson",
      data: {
        type: "Feature",
        properties: {},
        geometry: {
          type: "LineString",
          coordinates: coordinates.map((coord) => [coord[1], coord[0]]), // [lng, lat]
        },
      },
    });

    map.addLayer({
      id: "route",
      type: "line",
      source: "route",
      layout: {
        "line-join": "round",
        "line-cap": "round",
      },
      paint: {
        "line-color": "#3b82f6",
        "line-width": 4,
      },
    });

    // Fit map to route bounds
    const bounds = coordinates.reduce(
      (bounds, coord) => {
        return bounds.extend([coord[1], coord[0]]);
      },
      new mapboxgl.LngLatBounds(
        [coordinates[0][1], coordinates[0][0]],
        [coordinates[0][1], coordinates[0][0]],
      ),
    );

    map.fitBounds(bounds, {
      padding: 40,
    });
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

// ===== Display Weather =====
function displayWeather(weather, ride) {
  const weatherSection = document.getElementById("weather-section");
  weatherSection.classList.remove("hidden");

  // Date
  if (weather.dt) {
    const date = parseDate(weather.dt);
    document.getElementById("weather-date").textContent =
      formatDateShort(date);
  }

  // Weather icon
  const emoji = SF_SYMBOL_MAP[weather.sym] || "🌤️";
  document.querySelector(".weather-emoji").textContent = emoji;

  // Temperatures
  document.getElementById("temp-high").textContent = weather.hi;
  document.getElementById("temp-low").textContent = weather.lo;

  // Description
  document.getElementById("weather-desc").textContent = weather.desc;

  // Precipitation
  document.getElementById("precip-chance").textContent = `${weather.pr}%`;

  // Wind
  document.getElementById("wind-speed").textContent = `${weather.ws} mph`;
  document.getElementById("wind-dir").textContent = weather.wd;

  // Sunrise/Sunset
  if (weather.sr && weather.ss) {
    document.getElementById("sunrise").textContent = formatTimeString(
      weather.sr,
    );
    document.getElementById("sunset").textContent = formatTimeString(weather.ss);
  } else {
    document.querySelector(".sunrise-sunset").style.display = "none";
  }

  // Hourly weather
  if (weather.hr && weather.hr.length > 0) {
    displayHourlyWeather(weather.hr, ride);
  }
}

// ===== Display Hourly Weather =====
function displayHourlyWeather(hourlyData, ride) {
  const hourlySection = document.getElementById("hourly-section");
  const hourlyChart = document.getElementById("hourly-chart");

  // Filter to show hours relevant to the ride
  const rideStartHour = ride.h;
  const rideDurationHours = Math.ceil(ride.d / 60);
  const rideEndHour = rideStartHour + rideDurationHours;

  // Filter hourly data to ride window (with some buffer)
  const relevantHours = hourlyData.filter((h) => {
    return h.h >= rideStartHour - 1 && h.h <= rideEndHour + 1;
  });

  if (relevantHours.length === 0) {
    return;
  }

  hourlySection.classList.remove("hidden");

  hourlyChart.innerHTML = relevantHours
    .map(
      (h) => `
    <div class="hourly-item">
      <span class="hourly-time">${formatTime(h.h, 0)}</span>
      <span class="hourly-temp">${h.t}°</span>
      <span class="hourly-feels">Feels ${h.fl}°</span>
      ${
        h.pc > 0
          ? `
        <span class="hourly-precip">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z"/>
          </svg>
          ${h.pc}%
        </span>
      `
          : ""
      }
      <span class="hourly-wind">${h.w} mph</span>
    </div>
  `,
    )
    .join("");
}

// ===== Utility Functions =====
function formatTime(hour, minute) {
  const h = hour % 24;
  const ampm = h >= 12 ? "PM" : "AM";
  const displayHour = h % 12 || 12;
  const displayMin = minute.toString().padStart(2, "0");
  return `${displayHour}:${displayMin} ${ampm}`;
}

function formatTimeString(timeStr) {
  // Convert "07:15" to "7:15 AM"
  const [h, m] = timeStr.split(":").map(Number);
  return formatTime(h, m);
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
