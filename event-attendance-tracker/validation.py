"""Shared validation for manual registration and CSV import.

No institution-specific ID verification is possible without a college registry.
We validate the format, then match only registrations in the selected event.
"""
import csv
import io
import re
from datetime import date

COLLEGE_ID_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._/\-]{1,31}$")
EMAIL_RE = re.compile(r"^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~\-]+@[A-Za-z0-9](?:[A-Za-z0-9\-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9\-]*[A-Za-z0-9])?)+$")
YEARS = {"", "1", "2", "3", "4", "5", "PG", "Other"}
YEAR_ALIASES = {
    "1st year": "1", "2nd year": "2", "3rd year": "3", "4th year": "4", "5th year": "5",
    "year 1": "1", "year 2": "2", "year 3": "3", "year 4": "4", "year 5": "5",
    "postgraduate": "PG", "pg": "PG", "other": "Other",
}
HEADER_ALIASES = {
    "name": "name", "full_name": "name", "student_name": "name",
    "college_id": "college_id", "collegeid": "college_id", "student_id": "college_id",
    "email": "email", "email_id": "email", "email_address": "email",
    "phone": "phone", "phone_number": "phone", "contact": "phone",
    "contact_number": "phone", "mobile": "phone", "mobile_number": "phone",
    "year": "year", "study_year": "year", "branch": "branch", "department": "branch",
}
FIELDS = ("name", "college_id", "email", "phone", "year", "branch")
MAX_CSV_ROWS = 5000


class ValidationError(Exception):
    def __init__(self, message, errors=None, status=400):
        super().__init__(message)
        self.message = message
        self.errors = errors or []
        self.status = status


def clean_text(value):
    if value is None:
        return ""
    if not isinstance(value, str):
        raise ValidationError("Text fields must contain text, not objects or numbers.")
    return value.strip()


def has_control_chars(value):
    return any(ord(ch) < 32 or ord(ch) == 127 for ch in value)


def validate_participant(data):
    if not isinstance(data, dict):
        raise ValidationError("Please send a participant object.")
    cleaned = {field: clean_text(data.get(field, "")) for field in FIELDS}
    cleaned["name"] = re.sub(r" +", " ", cleaned["name"])
    cleaned["college_id"] = cleaned["college_id"].upper()
    cleaned["email"] = cleaned["email"].lower()
    errors = []
    if not 2 <= len(cleaned["name"]) <= 100 or has_control_chars(cleaned["name"]):
        errors.append("Name must be 2–100 characters with no line breaks.")
    if not COLLEGE_ID_RE.fullmatch(cleaned["college_id"]):
        errors.append("College ID must be 2–32 letters/numbers (., _, / and - are allowed), starting with a letter or number.")
    if len(cleaned["email"]) > 254 or not EMAIL_RE.fullmatch(cleaned["email"]):
        errors.append("Enter a valid email address, such as student@example.com.")
    phone = cleaned["phone"]
    digits = re.sub(r"\D", "", phone)
    if phone and (not re.fullmatch(r"[+()0-9.\- ]+", phone) or not 7 <= len(digits) <= 15):
        errors.append("Phone must contain 7–15 digits; spaces, +, -, dots and parentheses are allowed.")
    # Store only digits so formatted phone numbers can still be searched.
    cleaned["phone"] = digits
    cleaned["year"] = YEAR_ALIASES.get(cleaned["year"].lower(), cleaned["year"])
    if cleaned["year"] not in YEARS:
        errors.append("Year must be 1, 2, 3, 4, 5, PG, Other, or blank.")
    if len(cleaned["branch"]) > 80 or has_control_chars(cleaned["branch"]):
        errors.append("Branch must be at most 80 characters with no line breaks.")
    if errors:
        raise ValidationError("Please check the participant details.", errors)
    return cleaned


def validate_event(data):
    if not isinstance(data, dict):
        raise ValidationError("Please send an event object.")
    name = clean_text(data.get("name"))
    event_date = clean_text(data.get("event_date"))
    venue = clean_text(data.get("venue"))
    errors = []
    if not 2 <= len(name) <= 80 or has_control_chars(name):
        errors.append("Event name must be 2–80 characters with no line breaks.")
    try:
        if not re.fullmatch(r"\d{4}-\d{2}-\d{2}", event_date):
            raise ValueError
        date.fromisoformat(event_date)
    except ValueError:
        errors.append("Choose a valid event date (YYYY-MM-DD).")
    if len(venue) > 100 or has_control_chars(venue):
        errors.append("Venue must be at most 100 characters with no line breaks.")
    if errors:
        raise ValidationError("Please check the event details.", errors)
    return {"name": name, "event_date": event_date, "venue": venue}


def inspect_csv(raw, existing):
    """Return cleaned rows and a preview. Never writes to the database.

    All errors block the entire batch. The final import calls this again;
    database uniqueness constraints protect against concurrent imports.
    """
    try:
        text = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        raise ValidationError("Save the file as CSV UTF-8, then try again.")
    if not text.strip():
        raise ValidationError("This CSV is empty. Add a header row and at least one participant.")
    if "\x00" in text:
        raise ValidationError("This is not a valid text CSV file.")
    reader = csv.reader(io.StringIO(text, newline=""), strict=True)
    try:
        original_headers = next(reader)
    except (StopIteration, csv.Error):
        raise ValidationError("Could not read CSV headers. Use a comma-separated UTF-8 CSV file.")
    headers = []
    extras = []
    for value in original_headers:
        normalized = re.sub(r"[\s\-]+", "_", value.strip().lower())
        canonical = HEADER_ALIASES.get(normalized)
        headers.append(canonical)
        if canonical is None:
            extras.append(value[:80])
    required = {"name", "college_id", "email"}
    if not required.issubset(set(headers)):
        raise ValidationError("CSV needs name, college_id and email columns. Download the template to get started.")
    known = [header for header in headers if header]
    if len(known) != len(set(known)):
        raise ValidationError("CSV contains duplicate columns. Keep only one column for each field.")

    existing_ids = {row["college_id"].upper() for row in existing}
    existing_emails = {row["email"].lower() for row in existing}
    seen_ids, seen_emails = set(), set()
    valid_rows, issues = [], []
    row_count, error_count = 0, 0
    try:
        for values in reader:
            line = reader.line_num
            if not any(value.strip() for value in values):
                continue
            row_count += 1
            if row_count > MAX_CSV_ROWS:
                raise ValidationError(f"Import at most {MAX_CSV_ROWS:,} participants at a time.")
            row_errors = []
            if len(values) != len(headers):
                row_errors.append("Column count does not match the header. Put commas inside quoted values.")
            else:
                data = {key: val for key, val in zip(headers, values) if key}
                try:
                    cleaned = validate_participant(data)
                    cid, email = cleaned["college_id"], cleaned["email"]
                    if cid in existing_ids:
                        row_errors.append(f"College ID {cid} is already registered for this event.")
                    elif cid in seen_ids:
                        row_errors.append(f"College ID {cid} appears more than once in this CSV.")
                    if email in existing_emails:
                        row_errors.append(f"Email {email} is already registered for this event.")
                    elif email in seen_emails:
                        row_errors.append(f"Email {email} appears more than once in this CSV.")
                    seen_ids.add(cid)
                    seen_emails.add(email)
                    if not row_errors:
                        valid_rows.append(cleaned)
                except ValidationError as exc:
                    row_errors.extend(exc.errors or [exc.message])
            if row_errors:
                error_count += 1
                if len(issues) < 50:
                    issues.append({"row": line, "message": " ".join(row_errors)})
    except csv.Error:
        raise ValidationError("This CSV has malformed quoting or an oversized field. Correct the CSV and try again.")
    if not row_count:
        raise ValidationError("This CSV only has headers. Add at least one participant.")
    preview = {
        "valid": error_count == 0,
        "row_count": row_count,
        "valid_count": len(valid_rows),
        "error_count": error_count,
        "errors": issues,
        "preview": valid_rows[:5],
        "ignored_columns": extras,
    }
    return valid_rows, preview
