export const TABLE_NAMES = [
  "stops",
  "routes",
  "trips",
  "stop_times",
  "calendar",
  "calendar_dates",
] as const;

export const INDEX_NAMES = [
  "idx_vic_stop_times_stop",
  "idx_vic_stop_times_trip",
  "idx_vic_trips_route",
  "idx_vic_trips_service",
  "idx_vic_stops_location",
  "idx_vic_calendar_dates_date",
] as const;

export const CREATE_SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS stops (
    stop_id TEXT PRIMARY KEY,
    stop_name TEXT NOT NULL,
    stop_code TEXT,
    stop_lat REAL NOT NULL,
    stop_lon REAL NOT NULL,
    location_type INTEGER DEFAULT 0,
    parent_station TEXT,
    route_type INTEGER DEFAULT -1
);

CREATE TABLE IF NOT EXISTS routes (
    route_id TEXT PRIMARY KEY,
    route_short_name TEXT,
    route_long_name TEXT,
    route_type INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS trips (
    trip_id TEXT PRIMARY KEY,
    route_id TEXT NOT NULL,
    service_id TEXT NOT NULL,
    trip_headsign TEXT,
    direction_id INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS stop_times (
    trip_id TEXT NOT NULL,
    stop_id TEXT NOT NULL,
    arrival_time TEXT,
    departure_time TEXT,
    stop_sequence INTEGER NOT NULL,
    arrival_seconds INTEGER,
    departure_seconds INTEGER
);

CREATE TABLE IF NOT EXISTS calendar (
    service_id TEXT PRIMARY KEY,
    monday INTEGER, tuesday INTEGER, wednesday INTEGER,
    thursday INTEGER, friday INTEGER, saturday INTEGER, sunday INTEGER,
    start_date TEXT, end_date TEXT
);

CREATE TABLE IF NOT EXISTS calendar_dates (
    service_id TEXT NOT NULL,
    date TEXT NOT NULL,
    exception_type INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_vic_stop_times_stop ON stop_times(stop_id, departure_seconds);
CREATE INDEX IF NOT EXISTS idx_vic_stop_times_trip ON stop_times(trip_id);
CREATE INDEX IF NOT EXISTS idx_vic_trips_route ON trips(route_id);
CREATE INDEX IF NOT EXISTS idx_vic_trips_service ON trips(service_id);
CREATE INDEX IF NOT EXISTS idx_vic_stops_location ON stops(stop_lat, stop_lon);
CREATE INDEX IF NOT EXISTS idx_vic_calendar_dates_date ON calendar_dates(date);
`;

export const TAG_BUS_STOPS_SQL = `
UPDATE stops SET route_type = 3
WHERE stop_id IN (
    SELECT DISTINCT st.stop_id
    FROM stop_times st
    JOIN trips t ON st.trip_id = t.trip_id
    JOIN routes r ON t.route_id = r.route_id
    WHERE r.route_type = 3
);
`;
