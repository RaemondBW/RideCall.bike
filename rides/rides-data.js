// ===== Static Group Rides Data =====
//
// Each region has a set of recurring group rides. Each ride uses the same
// shape that the shared-ride deep link decoder expects (see r/ride.js):
//   r:  { t, h, m, d, rec }  ride core
//   rt: { n, di, el }        route metadata (no polyline; the app fills route)
// We don't embed polylines here so the data stays small and editable.
//
// Recurrence days: 1=Sun, 2=Mon, 3=Tue, 4=Wed, 5=Thu, 6=Fri, 7=Sat
//
// Each region also carries lat/lon used to fetch the local Open-Meteo
// forecast and to anchor a static start-point map.

const RIDE_REGIONS = {
    "sf-bay-area": {
        name: "San Francisco Bay Area",
        shortName: "SF Bay Area",
        tagline: "Headlands, Marin, and Peninsula classics",
        lat: 37.8077,
        lon: -122.475,
        timezone: "America/Los_Angeles",
        rides: [
            {
                r: { t: "Headlands Sunrise", h: 6, m: 30, d: 90, rec: 3 },
                rt: { n: "Hawk Hill Loop", di: 28968, el: 487 },
                meet: "Crissy Field, near Warming Hut",
                lat: 37.8049,
                lon: -122.4655,
                vibe: "Spirited",
                description:
                    "Up and over the Golden Gate, three laps of Hawk Hill, back for coffee. Strong B+ pace, regroups on top.",
            },
            {
                r: { t: "Old La Honda Tempo", h: 6, m: 0, d: 150, rec: 5 },
                rt: { n: "OLH → Skyline → 84", di: 56327, el: 1219 },
                meet: "Woodside Bakery & Cafe",
                lat: 37.4286,
                lon: -122.2541,
                vibe: "Hard",
                description:
                    "Tempo up Old La Honda, regroup at the top, ridge along Skyline, descend 84. Drops on the climb.",
            },
            {
                r: { t: "Saturday Marin Long", h: 8, m: 0, d: 240, rec: 7 },
                rt: { n: "Nicasio – Pt. Reyes – Fairfax", di: 96560, el: 1463 },
                meet: "Equator Coffees, Mill Valley",
                lat: 37.9061,
                lon: -122.5446,
                vibe: "Endurance",
                description:
                    "Classic Marin all-day. Coffee stop in Pt Reyes Station, two regroups. Wheels turn at 8:00 sharp.",
            },
            {
                r: { t: "Tuesday Night Worlds", h: 18, m: 15, d: 75, rec: 3 },
                rt: { n: "SF → Sausalito → SF", di: 32187, el: 305 },
                meet: "Sports Basement, Presidio",
                lat: 37.7997,
                lon: -122.4707,
                vibe: "Race pace",
                description:
                    "Race-simulation effort on the GG Bridge corridor. Lights required after Oct.",
            },
        ],
    },

    "nyc": {
        name: "New York City",
        shortName: "NYC",
        tagline: "Central Park, River Road, and 9W",
        lat: 40.7959,
        lon: -73.9707,
        timezone: "America/New_York",
        rides: [
            {
                r: { t: "Central Park Loop", h: 6, m: 0, d: 75, rec: 4 },
                rt: { n: "Full Park × 4", di: 39588, el: 244 },
                meet: "Engineers' Gate (90th & 5th)",
                lat: 40.7829,
                lon: -73.9594,
                vibe: "B/B+",
                description:
                    "Four laps, double pacelines on the flats, regroup at Harlem Hill. Cars-free until 7am.",
            },
            {
                r: { t: "River Road Hammer", h: 7, m: 0, d: 180, rec: 7 },
                rt: { n: "GWB → Piermont → 9W", di: 80467, el: 854 },
                meet: "Strictly Bicycles, Fort Lee",
                lat: 40.8501,
                lon: -73.9685,
                vibe: "A",
                description:
                    "Hammerfest on River Rd, regroup before Piermont, coffee on Main, return on 9W. Drops north of GWB.",
            },
            {
                r: { t: "Nyack Coffee Cruise", h: 8, m: 30, d: 210, rec: 1 },
                rt: { n: "9W to Runcible Spoon", di: 88514, el: 762 },
                meet: "Boat Basin, Riverside Dr",
                lat: 40.7964,
                lon: -73.9857,
                vibe: "Social",
                description:
                    "No-drop B pace to Nyack. Long coffee stop, easy ride home. Newer riders welcome.",
            },
            {
                r: { t: "Prospect Pre-Work", h: 6, m: 30, d: 60, rec: 5 },
                rt: { n: "Prospect Park × 5", di: 25750, el: 198 },
                meet: "Grand Army Plaza",
                lat: 40.6724,
                lon: -73.9701,
                vibe: "B",
                description:
                    "Five laps, paceline rotation. Quick spin home for showers and the office.",
            },
        ],
    },

    "portland": {
        name: "Portland, Oregon",
        shortName: "Portland",
        tagline: "West Hills, river roads, and gravel",
        lat: 45.5152,
        lon: -122.6784,
        timezone: "America/Los_Angeles",
        rides: [
            {
                r: { t: "Sauvie Island Spin", h: 9, m: 0, d: 150, rec: 7 },
                rt: { n: "Sauvie Loop ×2", di: 60350, el: 213 },
                meet: "Cargo Bike Shop, NW Thurman",
                lat: 45.5421,
                lon: -122.7036,
                vibe: "B",
                description:
                    "Two laps of the island. Flat, fast, and friendly. Espresso stop on the way back.",
            },
            {
                r: { t: "West Hills Repeats", h: 6, m: 0, d: 105, rec: 4 },
                rt: { n: "Fairmount → Council Crest", di: 32187, el: 762 },
                meet: "Tom McCall Bowl, Fairmount Blvd",
                lat: 45.5051,
                lon: -122.7128,
                vibe: "Hard",
                description:
                    "Three Council Crest reps, threshold pace. Headlights mandatory through winter.",
            },
            {
                r: { t: "Gravel Social", h: 9, m: 30, d: 240, rec: 6 },
                rt: { n: "Forest Park & Logging Roads", di: 64374, el: 1189 },
                meet: "Lower Macleay Park",
                lat: 45.5363,
                lon: -122.7115,
                vibe: "Adventure",
                description:
                    "Gravel-friendly tires required. Mixed surface, regrouping often. Bring snacks.",
            },
            {
                r: { t: "Hood River Tempo", h: 7, m: 0, d: 270, rec: 3 },
                rt: { n: "Historic Highway", di: 105000, el: 1524 },
                meet: "Troutdale Park & Ride",
                lat: 45.5395,
                lon: -122.3873,
                vibe: "Endurance",
                description:
                    "Long out-and-back along the Historic Columbia River Highway. Carpool from PDX.",
            },
        ],
    },

    "boulder": {
        name: "Boulder, Colorado",
        shortName: "Boulder",
        tagline: "Foothills, canyons, and altitude",
        lat: 40.015,
        lon: -105.2705,
        timezone: "America/Denver",
        rides: [
            {
                r: { t: "Morning Lefthand", h: 6, m: 30, d: 120, rec: 3 },
                rt: { n: "Lefthand Canyon → Jamestown", di: 48280, el: 884 },
                meet: "Amante Coffee, North Boulder",
                lat: 40.046,
                lon: -105.275,
                vibe: "B+",
                description:
                    "Steady tempo up Lefthand, regroup at Jamestown, fast spin back. Watch for ice in spring.",
            },
            {
                r: { t: "Old Stage / Lee Hill", h: 17, m: 30, d: 90, rec: 4 },
                rt: { n: "Old Stage + Lee Hill loop", di: 30577, el: 671 },
                meet: "North Boulder Park",
                lat: 40.0341,
                lon: -105.2785,
                vibe: "Race pace",
                description:
                    "Two short, sharp climbs back-to-back. Strong group only. Headlights after Sept.",
            },
            {
                r: { t: "Saturday Peak to Peak", h: 8, m: 0, d: 300, rec: 7 },
                rt: { n: "Lefthand → Ward → Peak to Peak", di: 113000, el: 2134 },
                meet: "Amante Coffee, North Boulder",
                lat: 40.046,
                lon: -105.275,
                vibe: "Endurance",
                description:
                    "Big-day route at altitude. Pack layers and food. Multiple regroups.",
            },
            {
                r: { t: "Sunday Morgul-Bismarck", h: 9, m: 0, d: 165, rec: 1 },
                rt: { n: "Morgul-Bismarck × 3", di: 64374, el: 793 },
                meet: "Superior Park & Ride",
                lat: 39.9452,
                lon: -105.1686,
                vibe: "B",
                description:
                    "The classic Coors Classic loop, three times around. Rotating paceline on the flats.",
            },
        ],
    },

    "austin": {
        name: "Austin, Texas",
        shortName: "Austin",
        tagline: "Hill country tempo and dawn patrol",
        lat: 30.2672,
        lon: -97.7431,
        timezone: "America/Chicago",
        rides: [
            {
                r: { t: "Dam Loop Dawn Patrol", h: 5, m: 45, d: 90, rec: 3 },
                rt: { n: "Mansfield Dam Loop", di: 41843, el: 396 },
                meet: "Mellow Johnny's Bike Shop",
                lat: 30.2701,
                lon: -97.7505,
                vibe: "B+",
                description:
                    "Roll out before sunrise, beat the heat. Two regroups on the loop. Lights required.",
            },
            {
                r: { t: "Wednesday Driveway", h: 18, m: 30, d: 60, rec: 4 },
                rt: { n: "Driveway Series Crit", di: 25750, el: 122 },
                meet: "The Driveway, north Austin",
                lat: 30.4214,
                lon: -97.6677,
                vibe: "Race",
                description:
                    "Pay-to-race crit, multiple categories. Show up 30 min early to register.",
            },
            {
                r: { t: "Saturday Hill Country", h: 7, m: 30, d: 270, rec: 7 },
                rt: { n: "Lime Creek → Volente", di: 88514, el: 945 },
                meet: "Anderson Mill & 620 (Mister Tramps)",
                lat: 30.4485,
                lon: -97.798,
                vibe: "Endurance",
                description:
                    "Rolling hill country, regroup at the top of every climb. BBQ stop on long weekends.",
            },
            {
                r: { t: "Tuesday Tempo", h: 6, m: 15, d: 75, rec: 3 },
                rt: { n: "Veloway + Circle Dr", di: 32187, el: 152 },
                meet: "Veloway Trailhead",
                lat: 30.1756,
                lon: -97.8638,
                vibe: "B",
                description:
                    "Closed-course tempo intervals. Cars-free, lights still helpful.",
            },
        ],
    },
};

const REGION_ORDER = [
    "sf-bay-area",
    "nyc",
    "portland",
    "boulder",
    "austin",
];

// Day-of-week names; index matches recurrence (1=Sun .. 7=Sat)
const REC_DAY_NAMES = {
    1: "Sunday",
    2: "Monday",
    3: "Tuesday",
    4: "Wednesday",
    5: "Thursday",
    6: "Friday",
    7: "Saturday",
};
const REC_DAY_SHORT = {
    1: "Sun",
    2: "Mon",
    3: "Tue",
    4: "Wed",
    5: "Thu",
    6: "Fri",
    7: "Sat",
};

// Order of columns in the week view (Mon → Sun)
const WEEK_REC_ORDER = [2, 3, 4, 5, 6, 7, 1];
