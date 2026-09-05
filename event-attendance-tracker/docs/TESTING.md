# Testing and demo guide

## Verified result

Verified on **5 September 2026 (Asia/Kolkata)** using Python **3.13.14**, Flask **3.1.2**, Playwright **1.55.0**, and Chromium on Linux.

- **40 backend/database tests passed.**
- **All end-to-end browser smoke checks passed.**
- Desktop and **390px-wide mobile** workflows checked.
- No uncaught JavaScript errors in the browser smoke run.

Windows/macOS launch scripts are provided, but the application was executed and tested on Linux; native Windows/macOS execution was not tested here.

## Backend suite

```bash
python -m unittest discover -s tests -v
```

Use your virtual environment's Python. No extra testing package is needed: the suite uses standard-library `unittest`, `tempfile`, and Flask's test client.

Every test gets a separate temporary database. The suite **never reads, clears, or modifies the application's real database**.

Coverage includes:

- Application startup, HTML, static assets, health check, security response headers.
- Empty-event counts and division-by-zero handling.
- Event name/date validation and missing events.
- Required/optional fields; input types; name, College ID, phone, and year limits.
- Uppercase College IDs, lowercase emails, trimmed names, normalized phone digits.
- Case-insensitive duplicate IDs/emails within an event.
- Reuse of a student in different events without sharing attendance.
- Name/email/College ID/phone searches.
- Unknown IDs, literal SQL wildcard searches, injection-like queries.
- Combined attendance/year/branch filters, sorting, pagination and invalid parameters.
- Check-in, duplicate check-in idempotence, original timestamp preservation.
- Persistence across a **new application instance and database connection**, simulating restart.
- Undo, edit without changing attendance, duplicate edit rejection, confirmed-deletion API behavior.
- Year/branch statistics, percentage rounding, recent arrivals.
- CSV preview without writes; valid atomic imports.
- Invalid rows, missing fields, malformed quoting, duplicate headers, duplicate IDs/emails, existing-event conflicts.
- UTF-8 BOM, header aliases, quoted commas, blank lines, year aliases, phone formatting.
- Binary/invalidly encoded uploads, wrong extensions, upload size and row-count limits.
- Validation repeated between preview and final import.
- Extra attendance columns ignored: CSV cannot mark students present.
- Filtered export with UTC timestamps, spreadsheet-formula escaping, usable downloadable template.
- Missing custom write-request header and malformed JSON.
- Demo event labeled as sample data and seeded only once.

## Optional browser suite

```bash
python -m pip install -r requirements-dev.txt
python -m playwright install chromium
python tests/browser_smoke.py
```

For a fresh Linux CI/container environment, browser system packages may be needed:

```bash
python -m playwright install --with-deps chromium
```

The browser script starts and stops its own temporary local server, uses a temporary database, and does not depend on a running normal app. It covers:

1. Seeded dashboard and branch breakdown.
2. Directory search and combined filters.
3. Unknown student → exact match → College ID details → mark present.
4. Reload and verify that attendance remains present.
5. Formatted phone search and confirmed undo.
6. Edit participant; attempt duplicate email; correct and save a new registration.
7. Invalid CSV preview blocks import; valid CSV imports; filtered CSV download contains the expected rows.
8. New event; same student allowed in another event; independent attendance; event preference after reload.
9. Confirmed deletion and count updates.
10. HTML-like participant names remain escaped text, not executable markup.
11. Mobile navigation, search, detail drawer and import modal at 390px with no whole-page horizontal overflow.

The test does not run a production load/security audit and does not claim comprehensive support for every browser or screen size.

## Manual acceptance checklist

### Registration

- [ ] Create a new blank event.
- [ ] Add name, College ID, and email; leave optional fields blank.
- [ ] Verify that status starts as **Not marked**.
- [ ] Try the same College ID with different casing. Confirm a duplicate error.
- [ ] Try malformed email and invalid College ID. Confirm nothing is saved.
- [ ] Add two students with the same name and different IDs/emails; verify both can be distinguished.

### Entrance

- [ ] Search by full/partial name, uppercase email, College ID and formatted phone.
- [ ] Search an unknown ID; confirm **Student not found**.
- [ ] Open a record, inspect details, and compare against the physical card.
- [ ] Mark present. Refresh; reopen the student and confirm status/time persisted.
- [ ] Click again/repeat the API request: counts must not increase twice.
- [ ] Undo with confirmation and verify the student is not marked, not deleted.

### CSV

- [ ] Download the template and import it into a blank event.
- [ ] Preview a valid file. Confirm counts do not change until final import.
- [ ] Mix valid and invalid rows. Confirm **no rows** are imported.
- [ ] Try a duplicate College ID/email in the file or existing event.
- [ ] Export a filtered attendance report and inspect it in a spreadsheet.

### Persistence and events

- [ ] Stop and restart the server. Recheck attendance.
- [ ] Switch events; verify that totals, searches and check-ins are event-specific.
- [ ] Use a second browser connected to the same server. Refresh and confirm shared results.
- [ ] Stop the server during use: the interface should show a connection error rather than a false success.

## A short presentation flow

1. **Overview:** explain the four totals and year/branch attendance.
2. **Registration:** add a student or preview/import the supplied CSV.
3. **Search:** locate Diya Patel using `CC26-003`; briefly show an unknown ID.
4. **Verification:** inspect the record and explain that the physical ID is checked by the organizer.
5. **Attendance:** mark present and show the status/time.
6. **Persistence:** refresh and find the same present record.
7. **Reporting:** filter the directory and export a CSV.
8. **Technical explanation:** SQLite file, event-scoped uniqueness, transactions, idempotent update, and limitations.

The included **`demo.webm`** is a silent recording of the real application showing the dashboard, directory search, check-in, refresh persistence, an unknown student, a CSV import, and export.
