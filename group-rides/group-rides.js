// ===== Group Rides Listing =====

const DAY_NAMES = {
  1: { full: "Sunday", short: "SUN" },
  2: { full: "Monday", short: "MON" },
  3: { full: "Tuesday", short: "TUE" },
  4: { full: "Wednesday", short: "WED" },
  5: { full: "Thursday", short: "THU" },
  6: { full: "Friday", short: "FRI" },
  7: { full: "Saturday", short: "SAT" },
};

// Matches the iOS app palette and /r/ride.js DAY_COLORS.
const DAY_COLORS = {
  1: { bg: "#264653", fg: "#ffffff" },
  2: { bg: "#287271", fg: "#ffffff" },
  3: { bg: "#2A9D8F", fg: "#ffffff" },
  4: { bg: "#8AB17D", fg: "#ffffff" },
  5: { bg: "#E9C46A", fg: "#1f2937" },
  6: { bg: "#F4A261", fg: "#1f2937" },
  7: { bg: "#E76F51", fg: "#ffffff" },
};

function rideDayOfWeek(ride) {
  if (ride.recurrence) return ride.recurrence;
  if (ride.date) {
    const d = new Date(ride.date + "T00:00:00");
    if (!isNaN(d.getTime())) return d.getDay() + 1;
  }
  return null;
}

const WMO_EMOJI = {
  0: "☀️", 1: "🌤️", 2: "⛅", 3: "☁️",
  45: "🌫️", 48: "🌫️",
  51: "🌦️", 53: "🌦️", 55: "🌧️", 56: "🌧️", 57: "🌧️",
  61: "🌧️", 63: "🌧️", 65: "🌧️", 66: "🌧️", 67: "🌧️",
  71: "❄️", 73: "❄️", 75: "❄️", 77: "❄️",
  80: "🌦️", 81: "🌧️", 82: "🌧️",
  85: "❄️", 86: "❄️",
  95: "⛈️", 96: "⛈️", 99: "⛈️",
};

document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const region = params.get("r");

  const picker = document.getElementById("picker-view");
  const listing = document.getElementById("listing-view");

  if (region && /^[a-z0-9-]+$/i.test(region)) {
    if (picker) picker.hidden = true;
    if (listing) listing.hidden = false;
    initListing(document.getElementById("rides-root"), `${region}.json`);
  } else {
    if (picker) picker.hidden = false;
    if (listing) listing.hidden = true;
    renderRegionPicker(document.getElementById("regions-grid"));
  }
});

async function renderRegionPicker(grid) {
  if (!grid) return;
  try {
    const res = await fetch("regions.json", { cache: "no-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const regions = data.regions || [];
    if (regions.length === 0) {
      grid.innerHTML = `
        <div class="region-card region-card-soon">
          <div class="region-card-name">No regions yet</div>
          <div class="region-card-meta">Drop a &lt;slug&gt;.json next to regions.json and add an entry.</div>
        </div>
      `;
      return;
    }
    grid.innerHTML = regions.map((r) => `
      <a href="?r=${encodeURIComponent(r.slug)}" class="region-card">
        <div class="region-card-name">${escapeHtml(r.title || r.slug)}</div>
        ${r.subtitle ? `<div class="region-card-meta">${escapeHtml(r.subtitle)}</div>` : ""}
      </a>
    `).join("");
  } catch (err) {
    console.error("Failed to load regions.json:", err);
    grid.innerHTML = `
      <div class="region-card region-card-soon">
        <div class="region-card-name">Could not load regions</div>
        <div class="region-card-meta">Check that regions.json exists.</div>
      </div>
    `;
  }
}

async function initListing(root, ridesUrl) {
  if (!root) return;
  try {
    const res = await fetch(ridesUrl, { cache: "no-cache" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    renderRegionMeta(data);
    renderRides(root, data);
  } catch (err) {
    console.error("Failed to load rides:", err);
    root.innerHTML = `
      <div class="rides-empty">
        <p>Could not load rides. Try refreshing.</p>
      </div>
    `;
  }
}

function renderRegionMeta(data) {
  if (data.title) {
    const titleEl = document.getElementById("region-title");
    if (titleEl) titleEl.textContent = data.title;
    document.title = `${data.title} Group Rides - Ride Call`;
  }
  if (data.subtitle) {
    const subEl = document.getElementById("region-subtitle");
    if (subEl) subEl.textContent = data.subtitle;
  }
}

function renderRides(root, data) {
  const rides = data.rides || [];
  const { dayGroups, oneOff } = groupAndOrderRides(rides);

  root.innerHTML = "";
  const wrap = document.createElement("div");
  wrap.className = "day-sections";
  root.appendChild(wrap);

  dayGroups.forEach((group) => wrap.appendChild(buildDaySection(group)));

  if (oneOff.length > 0) {
    const section = document.createElement("section");
    section.className = "day-section day-section-oneoff";
    section.innerHTML = `
      <div class="day-section-card">
        <header class="day-header">
          <div class="day-header-left">
            <h2 class="day-name">Upcoming dates</h2>
          </div>
        </header>
        <div class="day-rides"></div>
      </div>
    `;
    const list = section.querySelector(".day-rides");
    oneOff.forEach((ride) => list.appendChild(buildRideCard(ride)));
    wrap.appendChild(section);
  }

  // Pair cards with rides in DOM order so we can fetch per-ride weather.
  const orderedRides = dayGroups.flatMap((g) => g.rides).concat(oneOff);
  const allCards = Array.from(document.querySelectorAll("[data-ride-card]"));
  orderedRides.forEach((ride, i) => {
    const cardEl = allCards[i];
    if (!cardEl) return;
    if (ride.route?.polyline) renderMiniMap(cardEl, ride.route.polyline);
    fetchAndRenderRideWeather(cardEl, ride);
  });
}

function groupAndOrderRides(rides) {
  const byDay = new Map();
  const oneOff = [];
  for (const ride of rides) {
    const dow = rideDayOfWeek(ride);
    if (!dow || ride.date) {
      // One-off dated rides go in their own section.
      if (ride.date) oneOff.push(ride);
      else if (dow) {
        if (!byDay.has(dow)) byDay.set(dow, []);
        byDay.get(dow).push(ride);
      }
      continue;
    }
    if (!byDay.has(dow)) byDay.set(dow, []);
    byDay.get(dow).push(ride);
  }
  // Sort rides within each day by start time.
  for (const arr of byDay.values()) {
    arr.sort((a, b) => ((a.hour || 0) * 60 + (a.minute || 0)) - ((b.hour || 0) * 60 + (b.minute || 0)));
  }
  oneOff.sort((a, b) => (a.date || "").localeCompare(b.date || ""));

  // Always render the week Mon → Sun so Sunday lands at the bottom.
  const weekOrder = [2, 3, 4, 5, 6, 7, 1];
  const orderedDays = weekOrder.map((dow) => ({
    dow,
    rides: byDay.get(dow) || [],
  }));
  return { dayGroups: orderedDays, oneOff };
}

function buildDaySection(group) {
  const { dow, rides } = group;
  const colors = DAY_COLORS[dow] || { bg: "#94a3b8", fg: "#fff" };
  const dayName = DAY_NAMES[dow]?.full || "";
  const date = nextOccurrenceDate({ recurrence: dow });
  const dateStr = date
    ? date.toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : "";

  const section = document.createElement("section");
  section.className = "day-section";
  section.style.setProperty("--day-color", colors.bg);
  section.style.setProperty("--day-color-fg", colors.fg);

  const isEmpty = rides.length === 0;
  if (isEmpty) section.classList.add("day-section-empty");

  section.innerHTML = `
    <div class="day-section-card">
      <header class="day-header">
        <div class="day-header-left">
          <h2 class="day-name">${escapeHtml(dayName)}</h2>
          ${dateStr ? `<p class="day-date">${escapeHtml(dateStr)}</p>` : ""}
        </div>
        ${isEmpty ? `<div class="day-header-right"><span class="day-empty-note">No rides yet</span></div>` : ""}
      </header>
      ${isEmpty ? "" : `<div class="day-rides"></div>`}
    </div>
  `;
  if (!isEmpty) {
    const list = section.querySelector(".day-rides");
    rides.forEach((ride) => list.appendChild(buildRideCard(ride)));
  }
  return section;
}

function buildRideCard(ride) {
  const link = document.createElement("a");
  link.className = "ride-listing-card";
  link.href = buildRideLink(ride);
  link.dataset.rideCard = "1";
  if (ride.route?.polyline) link.dataset.polyline = ride.route.polyline;

  const timeStr = formatTime(ride.hour, ride.minute);
  const durationStr = formatDuration(ride.duration);
  const recurrenceStr = ride.recurrence
    ? "Weekly"
    : (ride.date ? formatDate(ride.date) : "");

  const distMi = ride.route?.distance ? (ride.route.distance / 1609.34).toFixed(1) : null;
  const elFt = ride.route?.elevation ? Math.round(ride.route.elevation * 3.28084).toLocaleString() : null;

  const tags = [];
  if (ride.pace) tags.push(`<span class="ride-card-tag tag-pace">${escapeHtml(ride.pace)}</span>`);
  if (ride.drop === "no-drop") tags.push(`<span class="ride-card-tag tag-no-drop">No-drop</span>`);
  else if (ride.drop === "drop") tags.push(`<span class="ride-card-tag tag-drop">Drop ride</span>`);
  if (ride.host) tags.push(`<span class="ride-card-tag">${escapeHtml(ride.host)}</span>`);

  const stats = [];
  if (distMi) stats.push(`<div class="ride-card-stat"><span class="ride-card-stat-label">Distance</span><span class="ride-card-stat-value">${distMi} mi</span></div>`);
  if (elFt) stats.push(`<div class="ride-card-stat"><span class="ride-card-stat-label">Elevation</span><span class="ride-card-stat-value">${elFt} ft</span></div>`);

  link.innerHTML = `
    <div class="ride-card-map"></div>
    <div class="ride-card-body">
      <div class="ride-card-content">
        <div class="ride-card-info">
          <div class="ride-card-title">${escapeHtml(ride.title || "Group Ride")}</div>
          <div class="ride-card-time">
            <span class="ride-card-time-icon">🕐</span>
            <span>${timeStr}</span>
            ${durationStr ? `<span class="ride-card-time-secondary">· ${durationStr}</span>` : ""}
            ${recurrenceStr ? `<span class="ride-card-time-secondary"> · ${recurrenceStr}</span>` : ""}
          </div>
          ${ride.meet ? `
            <div class="ride-card-meet">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
              <span>${escapeHtml(ride.meet)}</span>
            </div>
          ` : ""}
          ${ride.description ? `<p class="ride-card-description">${escapeHtml(ride.description)}</p>` : ""}
          ${tags.length ? `<div class="ride-card-tags">${tags.join("")}</div>` : ""}
        </div>
        <div class="ride-card-weather" data-ride-weather></div>
      </div>
      ${stats.length ? `<div class="ride-card-stats">${stats.join("")}</div>` : ""}
    </div>
  `;

  return link;
}

// ===== Mini map =====

function renderMiniMap(cardEl, polyline) {
  const mapEl = cardEl.querySelector(".ride-card-map");
  if (!mapEl || typeof L === "undefined") return;

  const coords = decodePolyline(polyline);
  if (coords.length === 0) return;

  const map = L.map(mapEl, {
    zoomControl: false,
    attributionControl: false,
    dragging: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    touchZoom: false,
    keyboard: false,
    boxZoom: false,
  });

  L.tileLayer("https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png", {
    maxZoom: 19,
  }).addTo(map);

  const line = L.polyline(coords, {
    color: "#0a84ff",
    weight: 3,
    opacity: 1,
    lineJoin: "round",
    lineCap: "round",
  }).addTo(map);

  setTimeout(() => {
    map.invalidateSize();
    map.fitBounds(line.getBounds(), { padding: [16, 16] });
  }, 50);
}

// ===== Per-ride weather summary (app-style: feels temp range + wind) =====

async function fetchAndRenderRideWeather(cardEl, ride) {
  const el = cardEl.querySelector("[data-ride-weather]");
  if (!el || !ride.route?.polyline) return;

  const coords = decodePolyline(ride.route.polyline);
  if (coords.length === 0) return;
  const [lat, lng] = coords[0];
  const date = nextOccurrenceDate(ride);
  if (!date) return;
  const dateStr = date.toISOString().split("T")[0];

  try {
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${lat.toFixed(3)}&longitude=${lng.toFixed(3)}` +
      `&hourly=apparent_temperature,precipitation_probability,wind_speed_10m,wind_direction_10m,weather_code` +
      `&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=auto` +
      `&start_date=${dateStr}&end_date=${dateStr}`;
    const res = await fetch(url);
    if (!res.ok) return;
    const data = await res.json();
    const hr = data.hourly;
    if (!hr?.time) return;

    const startDecimal = (ride.hour ?? 8) + (ride.minute ?? 0) / 60;
    const endDecimal = startDecimal + (ride.duration ?? 60) / 60;
    const startIdx = Math.max(0, Math.floor(startDecimal));
    const endIdx = Math.min(23, Math.ceil(endDecimal));

    const feels = [];
    const winds = [];
    const dirs = [];
    const codes = [];
    const precips = [];
    for (let h = startIdx; h <= endIdx; h++) {
      feels.push(hr.apparent_temperature[h]);
      winds.push(hr.wind_speed_10m[h]);
      dirs.push(hr.wind_direction_10m[h]);
      codes.push(hr.weather_code[h]);
      precips.push(hr.precipitation_probability?.[h] ?? 0);
    }
    if (feels.length === 0) return;

    const feelsLo = Math.round(Math.min(...feels));
    const feelsHi = Math.round(Math.max(...feels));
    const tempStr = feelsLo === feelsHi ? `Feels ${feelsLo}°` : `Feels ${feelsLo}-${feelsHi}°`;
    const avgWind = Math.round(winds.reduce((a, b) => a + b, 0) / winds.length);
    const dir = compassDirection(dirs[Math.floor(dirs.length / 2)]);
    const dominantCode = codes.reduce((m, c) => Math.max(m, c), 0);
    const emoji = WMO_EMOJI[dominantCode] || "";
    const maxPrecip = Math.max(...precips);

    const precipLine = maxPrecip >= 20
      ? `<div class="ride-weather-item">☔ <span>${maxPrecip}%</span></div>`
      : "";

    el.innerHTML = `
      ${emoji ? `<div class="ride-weather-emoji">${emoji}</div>` : ""}
      <div class="ride-weather-temp">${escapeHtml(tempStr)}</div>
      <div class="ride-weather-wind">${avgWind} mph ${dir}</div>
      ${precipLine}
    `;
  } catch {
    // ignore — leave the placeholder empty.
  }
}

function compassDirection(deg) {
  if (!Number.isFinite(deg)) return "";
  const dirs = ["N","NNE","NE","ENE","E","ESE","SE","SSE","S","SSW","SW","WSW","W","WNW","NW","NNW"];
  return dirs[Math.round(deg / 22.5) % 16];
}

function nextOccurrenceDate(ride) {
  if (ride.date) {
    const d = new Date(ride.date + "T00:00:00");
    if (isNaN(d.getTime())) return null;
    return d;
  }
  if (ride.recurrence) {
    // recurrence is 1=Sun ... 7=Sat. JS getDay() is 0=Sun ... 6=Sat.
    const targetDow = ride.recurrence - 1;
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    let diff = (targetDow - today.getDay() + 7) % 7;
    // If the ride is today and already past, push to next week. Open-Meteo
    // forecasts up to ~16 days, so this stays in range.
    if (diff === 0) {
      const rideMin = (ride.hour || 0) * 60 + (ride.minute || 0);
      const nowMin = now.getHours() * 60 + now.getMinutes();
      if (nowMin > rideMin) diff = 7;
    }
    today.setDate(today.getDate() + diff);
    return today;
  }
  return null;
}

// ===== Build encoded ride link =====

function buildRideLink(ride) {
  const payload = ridePayload(ride);
  const encoded = encodePayload(payload);
  // Absolute URL matches the iOS Universal Link pattern (no trailing slash).
  return `https://ridecall.bike/r?d=${encoded}`;
}

function ridePayload(ride) {
  const r = {
    t: ride.title,
    h: ride.hour ?? 0,
    m: ride.minute ?? 0,
    d: ride.duration ?? 60,
  };
  if (ride.recurrence) r.rec = ride.recurrence;
  if (ride.date) r.dt = ride.date;

  const out = { r };
  if (ride.route) {
    out.rt = {
      n: ride.route.name,
      di: ride.route.distance,
      el: ride.route.elevation,
      pl: ride.route.polyline,
    };
  }
  return out;
}

function encodePayload(obj) {
  const json = JSON.stringify(obj);
  const compressed = pako.deflateRaw(json);
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < compressed.length; i += chunkSize) {
    binary += String.fromCharCode.apply(null, compressed.subarray(i, i + chunkSize));
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

// ===== Helpers =====

function decodePolyline(encoded) {
  const points = [];
  let index = 0;
  let lat = 0;
  let lng = 0;
  while (index < encoded.length) {
    let shift = 0, result = 0, byte;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    shift = 0; result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

function formatTime(hour, minute) {
  const h = hour ?? 0;
  const m = minute ?? 0;
  const period = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  const mm = String(m).padStart(2, "0");
  return `${h12}:${mm} ${period}`;
}

function formatDuration(minutes) {
  if (!minutes) return "";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h}h ${m}m`;
  if (h) return `${h}h`;
  return `${m}m`;
}

function formatDate(iso) {
  const d = new Date(iso + "T00:00:00");
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" });
}

function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
