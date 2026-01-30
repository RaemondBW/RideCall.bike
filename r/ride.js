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
  // Update page title
  if (data.r && data.r.t) {
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

  // Display weather and chart if present
  if (data.w) {
    displayWeather(data.w, data.r);
    if (data.w.hr && data.w.hr.length > 0) {
      displayTemperatureChart(data.w.hr, data.r);
    }
  }

  // Show content, hide loading
  document.getElementById("loading-state").classList.add("hidden");
  document.getElementById("ride-content").classList.remove("hidden");
}

// ===== Display Ride Info =====
function displayRideInfo(ride) {
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

  // Wake time calculation
  const totalMinutesBefore = (ride.p || 0) + (ride.c || 0);
  const wakeMinutes = ride.h * 60 + ride.m - totalMinutesBefore;
  const wakeHour = Math.floor(wakeMinutes / 60);
  const wakeMin = wakeMinutes % 60;
  document.getElementById("wake-time").textContent = formatTime(
    wakeHour,
    wakeMin,
  );
  document.getElementById("alarm-time").textContent = formatTime(
    wakeHour,
    wakeMin,
  );

  // Prep + Commute
  document.getElementById("prep-commute").textContent =
    `${totalMinutesBefore} min`;

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

  // Use CartoDB dark matter for dark theme
  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
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

  // Fit map to route bounds with a slight delay
  setTimeout(() => {
    map.invalidateSize();
    map.fitBounds(routeLine.getBounds(), {
      padding: [40, 40],
    });
  }, 100);
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

    // Use most common symbol from ride hours, or first one
    if (rideWeather.symbols.length > 0) {
      const emoji = SF_SYMBOL_MAP[rideWeather.symbols[0]] || "🌤️";
      document.querySelector(".weather-emoji").textContent = emoji;
    }
  } else {
    // Fall back to daily weather
    document.getElementById("temp-high").textContent = weather.hi;
    document.getElementById("temp-low").textContent = weather.lo;
    document.getElementById("precip-chance").textContent = `${weather.pr}%`;
    document.getElementById("wind-speed").textContent = weather.ws;

    const emoji = SF_SYMBOL_MAP[weather.sym] || "🌤️";
    document.querySelector(".weather-emoji").textContent = emoji;
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

// ===== Update Map Weather Overlay =====
function updateMapOverlay(hourData) {
  document.getElementById("map-temp").textContent = `${hourData.t}°`;
  document.getElementById("map-feels").textContent = `${hourData.fl}°`;
  document.getElementById("map-wind").textContent = hourData.w;
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

  // Chart dimensions - fill container width
  const chartScroll = document.getElementById("chart-scroll");
  const containerWidth = chartScroll.clientWidth;
  const chartHeight = 100;

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

  // Update map position marker
  updateMapPositionMarker(data.h);
}

// ===== Update Map Overlay with Interpolated Data =====
function updateMapOverlayInterpolated(data) {
  document.getElementById("map-temp").textContent = `${data.t}°`;
  document.getElementById("map-feels").textContent = `${data.fl}°`;
  document.getElementById("map-wind").textContent = data.w;
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
