// ===== Regional Rides Pages =====
//
// Each region page sets `window.REGION_KEY` before loading this script.
// We render a 7-day week view of recurring group rides and fetch a forecast
// for each ride at its start hour. The "Open in Ride Call" link uses the
// same /r?d=<base64url(deflate-raw(JSON))> deep link as the shared-ride
// page so iOS Universal Links open it directly in the app.

document.addEventListener("DOMContentLoaded", () => {
    if (window.REGION_KEY) {
        renderRegionPage(window.REGION_KEY);
    } else if (document.getElementById("region-grid")) {
        renderRegionIndex();
    }
});

// ===== WMO Code → emoji =====
const WMO = {
    0: { e: "☀️", d: "Clear" },
    1: { e: "🌤️", d: "Mostly clear" },
    2: { e: "⛅", d: "Partly cloudy" },
    3: { e: "☁️", d: "Overcast" },
    45: { e: "🌫️", d: "Fog" },
    48: { e: "🌫️", d: "Fog" },
    51: { e: "🌦️", d: "Drizzle" },
    53: { e: "🌦️", d: "Drizzle" },
    55: { e: "🌧️", d: "Drizzle" },
    56: { e: "🌧️", d: "Freezing drizzle" },
    57: { e: "🌧️", d: "Freezing drizzle" },
    61: { e: "🌧️", d: "Light rain" },
    63: { e: "🌧️", d: "Rain" },
    65: { e: "🌧️", d: "Heavy rain" },
    66: { e: "🌧️", d: "Freezing rain" },
    67: { e: "🌧️", d: "Freezing rain" },
    71: { e: "❄️", d: "Light snow" },
    73: { e: "❄️", d: "Snow" },
    75: { e: "❄️", d: "Heavy snow" },
    77: { e: "❄️", d: "Snow grains" },
    80: { e: "🌦️", d: "Showers" },
    81: { e: "🌧️", d: "Showers" },
    82: { e: "🌧️", d: "Heavy showers" },
    85: { e: "❄️", d: "Snow showers" },
    86: { e: "❄️", d: "Snow showers" },
    95: { e: "⛈️", d: "Thunderstorm" },
    96: { e: "⛈️", d: "Thunderstorm" },
    99: { e: "⛈️", d: "Thunderstorm" },
};

// ===== Deep link encoding (mirror of r/ride.js decoder) =====
function encodeRideLink(payload) {
    const json = JSON.stringify(payload);
    const compressed = pako.deflateRaw(json);
    let binary = "";
    for (let i = 0; i < compressed.length; i++) {
        binary += String.fromCharCode(compressed[i]);
    }
    const base64 = btoa(binary);
    const base64url = base64
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
    return `/r?d=${base64url}`;
}

// ===== Date helpers =====
// JS Date.getDay(): 0=Sun..6=Sat. Recurrence convention: 1=Sun..7=Sat.
function jsDayToRec(jsDay) {
    return jsDay + 1;
}

// Find the date of the next occurrence of a given recurrence day (1=Sun..7=Sat).
// "Next" includes today if today is that day.
function nextOccurrenceDate(rec, fromDate = new Date()) {
    const target = ((rec - 1) - fromDate.getDay() + 7) % 7;
    const d = new Date(fromDate);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + target);
    return d;
}

function formatDateShort(d) {
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatTime(h, m) {
    const hr = ((h % 24) + 24) % 24;
    const ampm = hr >= 12 ? "PM" : "AM";
    const display = hr % 12 || 12;
    return `${display}:${m.toString().padStart(2, "0")} ${ampm}`;
}

function formatDuration(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
}

function metersToMiles(m) {
    return (m / 1609.34).toFixed(1);
}

function metersToFeet(m) {
    return Math.round(m * 3.28084).toLocaleString();
}

// ===== Weather fetch — one call per region for the next 7 days =====
async function fetchRegionForecast(region) {
    const url =
        `https://api.open-meteo.com/v1/forecast?latitude=${region.lat}&longitude=${region.lon}` +
        `&hourly=temperature_2m,apparent_temperature,precipitation_probability,wind_speed_10m,weather_code` +
        `&temperature_unit=fahrenheit&wind_speed_unit=mph&timezone=${encodeURIComponent(region.timezone)}` +
        `&forecast_days=8`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`Open-Meteo error: ${res.status}`);
    return res.json();
}

// Look up the forecast hour matching `targetDate` (YYYY-MM-DD) and `hour`
function findHour(forecast, targetDate, hour) {
    if (!forecast || !forecast.hourly || !forecast.hourly.time) return null;
    const targetIso = `${targetDate}T${hour.toString().padStart(2, "0")}:00`;
    const idx = forecast.hourly.time.indexOf(targetIso);
    if (idx === -1) return null;
    const h = forecast.hourly;
    return {
        temp: Math.round(h.temperature_2m[idx]),
        feels: Math.round(h.apparent_temperature[idx]),
        precip: h.precipitation_probability[idx] ?? 0,
        wind: Math.round(h.wind_speed_10m[idx]),
        code: h.weather_code[idx],
    };
}

function ymd(date) {
    const y = date.getFullYear();
    const m = (date.getMonth() + 1).toString().padStart(2, "0");
    const d = date.getDate().toString().padStart(2, "0");
    return `${y}-${m}-${d}`;
}

// ===== Render: per-region week view =====
function renderRegionPage(regionKey) {
    const region = RIDE_REGIONS[regionKey];
    if (!region) {
        document.querySelector(".rides-container").innerHTML =
            "<p>Region not found.</p>";
        return;
    }

    document.title = `${region.shortName} Group Rides — Ride Call`;

    // Header
    document.getElementById("region-title").textContent = region.name;
    document.getElementById("region-tagline").textContent = region.tagline;
    document.getElementById("region-ride-count").textContent =
        `${region.rides.length} weekly rides`;

    // Build week grid: 7 columns, Mon → Sun
    const grid = document.getElementById("week-grid");
    grid.innerHTML = "";

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    WEEK_REC_ORDER.forEach((rec) => {
        const col = document.createElement("div");
        col.className = "day-column";

        const date = nextOccurrenceDate(rec, today);

        const head = document.createElement("div");
        head.className = "day-header";
        head.innerHTML = `
            <span class="day-name">${REC_DAY_NAMES[rec]}</span>
            <span class="day-date">${formatDateShort(date)}</span>
        `;
        col.appendChild(head);

        const dayRides = region.rides.filter((r) => r.r.rec === rec);
        if (dayRides.length === 0) {
            const empty = document.createElement("div");
            empty.className = "day-empty";
            empty.textContent = "No group rides";
            col.appendChild(empty);
        } else {
            dayRides
                .sort((a, b) => a.r.h * 60 + (a.r.m || 0) - (b.r.h * 60 + (b.r.m || 0)))
                .forEach((ride) => {
                    col.appendChild(renderRideCard(ride, date));
                });
        }

        grid.appendChild(col);
    });

    // Kick off weather fetch and update placeholders
    fetchRegionForecast(region)
        .then((forecast) => updateWeatherPills(forecast, region, today))
        .catch((err) => {
            console.error("Weather fetch failed", err);
            document.querySelectorAll(".weather-pill.loading").forEach((el) => {
                el.textContent = "Forecast unavailable";
            });
        });
}

function renderRideCard(ride, date) {
    const card = document.createElement("article");
    card.className = "ride-card";

    const linkPayload = {
        r: { ...ride.r },
        rt: ride.rt ? { ...ride.rt } : undefined,
    };
    if (!linkPayload.rt) delete linkPayload.rt;
    const deepLink = encodeRideLink(linkPayload);

    const time = formatTime(ride.r.h, ride.r.m || 0);
    const duration = formatDuration(ride.r.d);
    const route = ride.rt;

    const head = `
        <div class="ride-card-head">
            <div>
                <div class="ride-card-title">${escapeHtml(ride.r.t)}</div>
                <div class="ride-card-time">${time} · ${duration}</div>
            </div>
            ${ride.vibe ? `<span class="ride-card-vibe">${escapeHtml(ride.vibe)}</span>` : ""}
        </div>
    `;

    const routeBlock = route
        ? `
        <div class="ride-card-route">
            <span class="route-name">${escapeHtml(route.n)}</span>
        </div>
        <div class="ride-card-stats">
            <span><strong>${metersToMiles(route.di)}</strong> mi</span>
            <span><strong>${metersToFeet(route.el)}</strong> ft</span>
        </div>
    `
        : "";

    const meet = ride.meet
        ? `<div class="ride-card-meet">${escapeHtml(ride.meet)}</div>`
        : "";
    const desc = ride.description
        ? `<p class="ride-card-description">${escapeHtml(ride.description)}</p>`
        : "";

    const dateIso = ymd(date);
    const cardId = `weather-${Math.random().toString(36).slice(2, 9)}`;
    const weather = `
        <div class="weather-pill loading"
             id="${cardId}"
             data-date="${dateIso}"
             data-hour="${ride.r.h}">
            <span class="emoji">⏳</span>
            <span>Loading forecast…</span>
        </div>
    `;

    const cta = `
        <a class="add-to-app" href="${deepLink}">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M12 5v14M5 12h14"/>
            </svg>
            Add to Ride Call
        </a>
    `;

    card.innerHTML = head + routeBlock + meet + desc + weather + cta;
    return card;
}

function updateWeatherPills(forecast, region, today) {
    document.querySelectorAll(".weather-pill[data-date]").forEach((pill) => {
        const date = pill.getAttribute("data-date");
        const hour = parseInt(pill.getAttribute("data-hour"), 10);
        const data = findHour(forecast, date, hour);
        pill.classList.remove("loading");
        if (!data) {
            pill.innerHTML = `<span class="emoji">·</span><span>No forecast</span>`;
            return;
        }
        const wmo = WMO[data.code] || WMO[0];
        pill.innerHTML = `
            <span class="emoji" title="${wmo.d}">${wmo.e}</span>
            <span class="temp">${data.temp}°</span>
            <span class="precip">${data.precip}%</span>
            <span class="wind">${data.wind} mph</span>
        `;
    });
}

// ===== Render: regional index =====
function renderRegionIndex() {
    const grid = document.getElementById("region-grid");
    grid.innerHTML = "";
    REGION_ORDER.forEach((key) => {
        const r = RIDE_REGIONS[key];
        if (!r) return;
        const a = document.createElement("a");
        a.className = "region-card";
        a.href = `${key}/`;
        a.innerHTML = `
            <h3>${escapeHtml(r.name)}</h3>
            <p>${escapeHtml(r.tagline)}</p>
            <span class="ride-count">${r.rides.length} weekly rides →</span>
        `;
        grid.appendChild(a);
    });
}

function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
    }[c]));
}
