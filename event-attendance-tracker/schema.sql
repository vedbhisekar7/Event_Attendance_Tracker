-- Each registration belongs to one event. A student can join multiple events.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    event_date TEXT NOT NULL,
    venue TEXT NOT NULL DEFAULT '',
    is_demo INTEGER NOT NULL DEFAULT 0 CHECK (is_demo IN (0, 1)),
    created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS participants (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_id INTEGER NOT NULL REFERENCES events(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    college_id TEXT NOT NULL COLLATE NOCASE,
    email TEXT NOT NULL COLLATE NOCASE,
    phone TEXT NOT NULL DEFAULT '',
    year TEXT NOT NULL DEFAULT '',
    branch TEXT NOT NULL DEFAULT '',
    present INTEGER NOT NULL DEFAULT 0 CHECK (present IN (0, 1)),
    checked_in_at TEXT,
    created_at TEXT NOT NULL,
    UNIQUE (event_id, college_id),
    UNIQUE (event_id, email),
    CHECK (
        (present = 0 AND checked_in_at IS NULL) OR
        (present = 1 AND checked_in_at IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_participants_event_status
    ON participants(event_id, present);
CREATE INDEX IF NOT EXISTS idx_participants_event_name
    ON participants(event_id, name COLLATE NOCASE);
CREATE INDEX IF NOT EXISTS idx_participants_recent
    ON participants(event_id, checked_in_at DESC);
