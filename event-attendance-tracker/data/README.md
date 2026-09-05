# Local database

Gather creates `attendance.sqlite3` here on its first run. The database is deliberately not shipped with the source ZIP or committed to Git.

- A new default database receives the clearly labeled demo event and 48 fictional participants.
- Future restarts reuse the database; they do not reset registrations or attendance.
- Create a new event in the UI to work with a clean registration list.
- To launch with no demo data in a new database, set `SEED_DEMO=0` before the first run.
- The `ATTENDANCE_DB` environment variable can choose a different database path.

**Backup:** stop all Gather server processes, then copy this entire directory to a safe location (including any `-wal`/`-shm` files if present). Do not copy just the main SQLite file while the application is writing. Restore while the application is stopped.

**Reset only a disposable demo:** stop the app, back up this directory, then remove `attendance.sqlite3` and its `-wal`/`-shm` companion files. Restarting will generate a fresh demo unless `SEED_DEMO=0`. Never do this to a database containing attendance you need to keep.
