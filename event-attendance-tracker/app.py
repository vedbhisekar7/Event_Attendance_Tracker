"""Gather — a small, event-scoped attendance tracker.

Run: python app.py
Tests: python -m unittest discover -s tests -v
"""
import csv
import io
import math
import os
from pathlib import Path
import re
import sqlite3

from flask import Flask, jsonify, render_template, request, Response
from werkzeug.exceptions import HTTPException

from database import get_db, init_database, participant_dict, utc_now
from validation import ValidationError, inspect_csv, validate_event, validate_participant

ROOT = Path(__file__).resolve().parent


def create_app(test_config=None):
    app = Flask(__name__)
    app.config.update(
        DATABASE=os.environ.get("ATTENDANCE_DB", str(ROOT / "data" / "attendance.sqlite3")),
        SEED_DEMO=os.environ.get("SEED_DEMO", "1").lower() not in {"0", "false", "no"},
        MAX_CONTENT_LENGTH=2 * 1024 * 1024,
        JSON_SORT_KEYS=False,
    )
    if test_config:
        app.config.update(test_config)
    init_database(app)

    @app.before_request
    def write_request_guard():
        # Not authentication. This custom header prevents ordinary cross-origin
        # HTML forms from changing a local database. CORS is deliberately absent.
        if (request.path.startswith("/api/")
                and request.method in {"POST", "PUT", "PATCH", "DELETE"}
                and request.headers.get("X-Requested-With") != "Gather"):
            raise ValidationError("This write request must come from the Gather application.", status=403)

    @app.after_request
    def response_headers(response):
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "same-origin"
        response.headers["Content-Security-Policy"] = (
            "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
            "img-src 'self' data:; font-src 'self'; connect-src 'self'; "
            "object-src 'none'; base-uri 'self'; form-action 'self'"
        )
        if request.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
        return response

    @app.errorhandler(ValidationError)
    def validation_error(exc):
        return jsonify(error=exc.message, errors=exc.errors), exc.status

    @app.errorhandler(HTTPException)
    def http_error(exc):
        message = "The file is too large. Use a CSV smaller than 2 MB." if exc.code == 413 else exc.description
        return jsonify(error=message), exc.code

    @app.errorhandler(sqlite3.OperationalError)
    def database_error(exc):
        app.logger.exception("Database operation failed")
        return jsonify(error="The database is busy or unavailable. Wait a moment and try again; do not delete your data file."), 503

    @app.errorhandler(Exception)
    def unexpected_error(exc):
        app.logger.exception("Unexpected application error")
        return jsonify(error="Something went wrong. Please try again. Details are available in the server log."), 500

    def body():
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            raise ValidationError("Send a JSON object with the required fields.")
        return data

    def event_or_404(event_id):
        event = get_db().execute("SELECT * FROM events WHERE id = ?", (event_id,)).fetchone()
        if event is None:
            raise ValidationError("This event does not exist. Choose an available event.", status=404)
        return dict(event)

    def participant_or_404(event_id, participant_id):
        row = get_db().execute(
            "SELECT * FROM participants WHERE id = ? AND event_id = ?", (participant_id, event_id)
        ).fetchone()
        if row is None:
            raise ValidationError("Student not found in this event's registration list. Attendance was not changed.", status=404)
        return participant_dict(row)

    def duplicate_guard(event_id, data, exclude_id=0):
        found = get_db().execute(
            """SELECT college_id, email FROM participants
               WHERE event_id = ? AND id != ? AND (college_id = ? OR email = ?)""",
            (event_id, exclude_id, data["college_id"], data["email"]),
        ).fetchall()
        if found:
            errors = []
            if any(row["college_id"].upper() == data["college_id"] for row in found):
                errors.append("This College ID is already registered for this event.")
            if any(row["email"].lower() == data["email"] for row in found):
                errors.append("This email is already registered for this event.")
            raise ValidationError("A registration already exists. Search for the student instead.", errors, 409)

    def query_parts(event_id):
        """Parameterized values + a hardcoded sort allowlist, shared by list/export."""
        where, params = ["event_id = ?"], [event_id]
        q = request.args.get("q", "").strip()
        if len(q) > 120:
            raise ValidationError("Keep your search to 120 characters or fewer.")
        if q:
            # Escape LIKE wildcards so a search for '%' means a literal percent.
            literal = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
            terms = ["name LIKE ? ESCAPE '\\'", "email LIKE ? ESCAPE '\\'", "college_id LIKE ? ESCAPE '\\'"]
            params += [f"%{literal}%"] * 3
            digits = re.sub(r"\D", "", q)
            if digits and re.fullmatch(r"[+()0-9.\- ]+", q):
                terms.append("phone LIKE ?")
                params.append(f"%{digits}%")
            where.append("(" + " OR ".join(terms) + ")")
        status = request.args.get("status", "all")
        if status not in {"all", "present", "absent"}:
            raise ValidationError("Status must be all, present or absent.")
        if status != "all":
            where.append("present = ?")
            params.append(1 if status == "present" else 0)
        for field in ("year", "branch"):
            value = request.args.get(field, "")
            if value:
                if len(value) > 80:
                    raise ValidationError(f"The {field} filter is too long.")
                where.append(f"{field} = ?")
                params.append("" if value == "__unspecified__" else value)
        sort = request.args.get("sort", "name")
        sorts = {
            "name": "name COLLATE NOCASE ASC, id ASC",
            "newest": "id DESC",
            "checkin": "present DESC, checked_in_at DESC, id DESC",
        }
        if sort not in sorts:
            raise ValidationError("Choose a valid sort order.")
        return " AND ".join(where), params, sorts[sort]

    def csv_inspection(event_id):
        event_or_404(event_id)
        file = request.files.get("file")
        if file is None or not file.filename:
            raise ValidationError("Choose a CSV file to import.")
        if not file.filename.lower().endswith(".csv"):
            raise ValidationError("Choose a .csv file, not an Excel workbook. In Excel, use Save As → CSV UTF-8.")
        existing = get_db().execute(
            "SELECT college_id, email FROM participants WHERE event_id = ?", (event_id,)
        ).fetchall()
        return inspect_csv(file.read(), existing)

    def insert_participant(db, event_id, data, created_at):
        return db.execute(
            """INSERT INTO participants
               (event_id, name, college_id, email, phone, year, branch, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?)""",
            (event_id, data["name"], data["college_id"], data["email"], data["phone"],
             data["year"], data["branch"], created_at),
        ).lastrowid

    @app.get("/")
    def index():
        return render_template("index.html")

    @app.get("/api/health")
    def health():
        get_db().execute("SELECT 1").fetchone()
        return jsonify(status="ok", storage="SQLite")

    @app.get("/api/events")
    def events():
        rows = get_db().execute("SELECT * FROM events ORDER BY id DESC").fetchall()
        return jsonify(events=[dict(row) for row in rows])

    @app.post("/api/events")
    def add_event():
        data = validate_event(body())
        db = get_db()
        with db:
            event_id = db.execute(
                "INSERT INTO events (name, event_date, venue, created_at) VALUES (?, ?, ?, ?)",
                (data["name"], data["event_date"], data["venue"], utc_now()),
            ).lastrowid
        return jsonify(event=event_or_404(event_id)), 201

    @app.get("/api/events/<int:event_id>/summary")
    def summary(event_id):
        event = event_or_404(event_id)
        db = get_db()
        counts = db.execute(
            "SELECT COUNT(*) AS total, COALESCE(SUM(present), 0) AS present FROM participants WHERE event_id = ?",
            (event_id,),
        ).fetchone()
        total, present = counts["total"], counts["present"]
        groups = {}
        for field in ("year", "branch"):
            # field is a constant from this tuple, not untrusted input.
            rows = db.execute(
                f"""SELECT {field} AS label, COUNT(*) AS total, SUM(present) AS present
                    FROM participants WHERE event_id = ? GROUP BY {field} ORDER BY {field}""",
                (event_id,),
            ).fetchall()
            groups[f"by_{field}"] = [
                {"label": row["label"], "total": row["total"], "present": row["present"],
                 "absent": row["total"] - row["present"],
                 "percentage": round(row["present"] / row["total"] * 100, 1)}
                for row in rows
            ]
        recent = db.execute(
            """SELECT * FROM participants WHERE event_id = ? AND present = 1
               ORDER BY checked_in_at DESC, id DESC LIMIT 5""", (event_id,)
        ).fetchall()
        return jsonify(
            event=event,
            total=total,
            present=present,
            absent=total - present,
            percentage=round(present / total * 100, 1) if total else 0,
            recent=[participant_dict(row) for row in recent],
            updated_at=utc_now(),
            **groups,
        )

    @app.get("/api/events/<int:event_id>/participants")
    def participants(event_id):
        event_or_404(event_id)
        where, params, order = query_parts(event_id)
        try:
            page = int(request.args.get("page", "1"))
            page_size = int(request.args.get("page_size", "10"))
        except ValueError:
            raise ValidationError("Page and page size must be whole numbers.")
        if not 1 <= page_size <= 100 or page < 1:
            raise ValidationError("Page must be positive and page size must be 1–100.")
        db = get_db()
        total = db.execute(f"SELECT COUNT(*) FROM participants WHERE {where}", params).fetchone()[0]
        pages = max(1, math.ceil(total / page_size))
        page = min(page, pages)
        rows = db.execute(
            f"SELECT * FROM participants WHERE {where} ORDER BY {order} LIMIT ? OFFSET ?",
            params + [page_size, (page - 1) * page_size],
        ).fetchall()
        return jsonify(
            participants=[participant_dict(row) for row in rows],
            pagination={"page": page, "page_size": page_size, "total": total, "pages": pages},
        )

    @app.post("/api/events/<int:event_id>/participants")
    def add_participant(event_id):
        event_or_404(event_id)
        data = validate_participant(body())
        duplicate_guard(event_id, data)
        db = get_db()
        try:
            with db:
                participant_id = insert_participant(db, event_id, data, utc_now())
        except sqlite3.IntegrityError:
            raise ValidationError("This College ID or email was just registered. Refresh the list and try again.", status=409)
        return jsonify(participant=participant_or_404(event_id, participant_id)), 201

    @app.get("/api/events/<int:event_id>/participants/<int:participant_id>")
    def participant_details(event_id, participant_id):
        return jsonify(participant=participant_or_404(event_id, participant_id))

    @app.patch("/api/events/<int:event_id>/participants/<int:participant_id>")
    def edit_participant(event_id, participant_id):
        current = participant_or_404(event_id, participant_id)
        # Attendance cannot be changed by editing/importing profile fields.
        data = validate_participant({**current, **body()})
        duplicate_guard(event_id, data, participant_id)
        db = get_db()
        try:
            with db:
                db.execute(
                    """UPDATE participants SET name = ?, college_id = ?, email = ?,
                       phone = ?, year = ?, branch = ? WHERE id = ? AND event_id = ?""",
                    (data["name"], data["college_id"], data["email"], data["phone"], data["year"],
                     data["branch"], participant_id, event_id),
                )
        except sqlite3.IntegrityError:
            raise ValidationError("This College ID or email already exists. Your edits were not saved.", status=409)
        return jsonify(participant=participant_or_404(event_id, participant_id))

    @app.delete("/api/events/<int:event_id>/participants/<int:participant_id>")
    def delete_participant(event_id, participant_id):
        participant_or_404(event_id, participant_id)
        db = get_db()
        with db:
            db.execute("DELETE FROM participants WHERE id = ? AND event_id = ?", (participant_id, event_id))
        return jsonify(message="Registration deleted from this event.")

    @app.put("/api/events/<int:event_id>/participants/<int:participant_id>/attendance")
    def attendance(event_id, participant_id):
        participant_or_404(event_id, participant_id)
        data = body()
        if not isinstance(data.get("present"), bool):
            raise ValidationError("Present must be true or false.")
        db = get_db()
        with db:
            if data["present"]:
                # Idempotent: repeated check-ins keep the original timestamp.
                cursor = db.execute(
                    """UPDATE participants SET present = 1, checked_in_at = ?
                       WHERE id = ? AND event_id = ? AND present = 0""",
                    (utc_now(), participant_id, event_id),
                )
            else:
                cursor = db.execute(
                    """UPDATE participants SET present = 0, checked_in_at = NULL
                       WHERE id = ? AND event_id = ? AND present = 1""", (participant_id, event_id)
                )
        return jsonify(participant=participant_or_404(event_id, participant_id), changed=cursor.rowcount > 0)

    @app.post("/api/events/<int:event_id>/import/preview")
    def preview_import(event_id):
        _rows, preview = csv_inspection(event_id)
        return jsonify(preview)

    @app.post("/api/events/<int:event_id>/import")
    def import_participants(event_id):
        rows, preview = csv_inspection(event_id)
        if not preview["valid"]:
            return jsonify(error="Fix all CSV errors before importing. Nothing was imported.", **preview), 400
        db = get_db()
        try:
            with db:
                now = utc_now()
                for data in rows:
                    insert_participant(db, event_id, data, now)
        except sqlite3.IntegrityError:
            raise ValidationError("A College ID or email was registered during this import. Nothing was imported. Preview the CSV again.", status=409)
        return jsonify(imported=len(rows), message=f"Imported {len(rows)} participants. All start as not marked."), 201

    def csv_response(rows, filename):
        output = io.StringIO(newline="")
        writer = csv.writer(output)
        writer.writerows(rows)
        return Response(
            "\ufeff" + output.getvalue(),
            content_type="text/csv; charset=utf-8",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )

    @app.get("/api/template.csv")
    def template_csv():
        return csv_response([
            ["name", "college_id", "email", "phone", "year", "branch"],
            ["Alex Morgan", "NEW-001", "alex.morgan@example.com", "", "1", "Computer Science"],
            ["Sam Taylor", "NEW-002", "sam.taylor@example.com", "0000000123", "2", "Design"],
            ["Jordan Lee", "NEW-003", "jordan.lee@example.com", "", "3", "Electronics"],
        ], "registration-template.csv")

    @app.get("/api/events/<int:event_id>/export")
    def export_csv(event_id):
        event_or_404(event_id)
        where, params, order = query_parts(event_id)
        participants = get_db().execute(
            f"SELECT * FROM participants WHERE {where} ORDER BY {order}", params
        ).fetchall()

        def safe_cell(value):
            # Prevent spreadsheet formula execution in names/other untrusted text.
            text = str(value or "")
            if text.lstrip().startswith(("=", "+", "-", "@")) or text.startswith(("\t", "\r", "\n")):
                return "'" + text
            return text

        rows = [["name", "college_id", "email", "phone", "year", "branch", "attendance", "checked_in_at_utc"]]
        for row in participants:
            rows.append([safe_cell(row[field]) for field in ("name", "college_id", "email", "phone", "year", "branch")]
                        + ["Present" if row["present"] else "Not marked", row["checked_in_at"] or ""])
        return csv_response(rows, f"event-{event_id}-attendance.csv")

    return app


if __name__ == "__main__":
    application = create_app()
    port = int(os.environ.get("PORT", "8000"))
    host = os.environ.get("HOST", "127.0.0.1")
    print(f"\n  Gather is ready. Open http://localhost:{port} in your browser.\n")
    # Bind to 0.0.0.0 only when explicitly requested (e.g. a hosted demo).
    # Flask's development server is sufficient for this local coursework app.
    application.run(host=host, port=port, debug=False)
