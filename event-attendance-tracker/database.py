"""Small SQLite persistence layer. One connection per Flask request."""
from datetime import datetime, timezone
from pathlib import Path
import sqlite3

from flask import current_app, g


def utc_now():
    """ISO 8601 UTC timestamp, which JavaScript can display in local time."""
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def get_db():
    if "db" not in g:
        g.db = sqlite3.connect(current_app.config["DATABASE"], timeout=10)
        g.db.row_factory = sqlite3.Row
        g.db.execute("PRAGMA foreign_keys = ON")
        g.db.execute("PRAGMA busy_timeout = 10000")
    return g.db


def close_db(_error=None):
    connection = g.pop("db", None)
    if connection is not None:
        connection.close()


def init_database(app):
    Path(app.config["DATABASE"]).parent.mkdir(parents=True, exist_ok=True)
    app.teardown_appcontext(close_db)
    with app.app_context():
        db = get_db()
        db.execute("PRAGMA journal_mode = WAL")
        schema = Path(app.root_path, "schema.sql").read_text(encoding="utf-8")
        db.executescript(schema)
        if app.config["SEED_DEMO"] and not db.execute("SELECT 1 FROM events LIMIT 1").fetchone():
            from seed import seed_demo
            with db:
                seed_demo(db)


def participant_dict(row):
    result = dict(row)
    result["present"] = bool(result["present"])
    return result
