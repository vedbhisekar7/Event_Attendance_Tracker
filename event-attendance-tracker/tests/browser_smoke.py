"""Optional end-to-end Chromium test, using an isolated temporary database.

Install: pip install -r requirements-dev.txt
         python -m playwright install chromium
Run:     python tests/browser_smoke.py
Linux CI may need: python -m playwright install --with-deps chromium
"""
from pathlib import Path
import sys
import tempfile
import threading

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from playwright.sync_api import sync_playwright, expect
from werkzeug.serving import make_server
from app import create_app


def run():
    with tempfile.TemporaryDirectory() as directory:
        app = create_app({"TESTING": True, "DATABASE": str(Path(directory) / "browser.sqlite3"), "SEED_DEMO": True})
        server = make_server("127.0.0.1", 0, app, threaded=True)
        thread = threading.Thread(target=server.serve_forever, daemon=True)
        thread.start()
        origin = f"http://127.0.0.1:{server.server_port}"
        errors = []
        try:
            with sync_playwright() as p:
                browser = p.chromium.launch()
                context = browser.new_context(viewport={"width":1440,"height":1000})
                page = context.new_page()
                page.on("pageerror", lambda error: errors.append(str(error)))
                page.goto(origin, wait_until="networkidle")
                expect(page.locator("#stat-total")).to_have_text("48")
                expect(page.locator("#stat-present")).to_have_text("34")
                page.click('[data-breakdown="branch"]')
                expect(page.locator("#breakdown-chart")).to_contain_text("Design")
                print("PASS: seeded dashboard and branch breakdown")

                page.click('.primary-nav [data-nav="participants"]')
                expect(page.locator("#directory-count")).to_have_text("48 participants")
                page.select_option("#filter-year", "1")
                expect(page.locator("#directory-count")).to_have_text("12 participants")
                page.select_option("#filter-status", "absent")
                expect(page.locator("#directory-count")).to_have_text("3 participants")
                page.click('[data-action="clear-filters"]')
                page.fill("#participant-search", "DIYA.PATEL@EXAMPLE.COM")
                expect(page.locator("#directory-count")).to_have_text("1 participant")
                expect(page.locator("#participant-table")).to_contain_text("CC26-003")
                print("PASS: case-insensitive directory search and combined filters")

                page.click('.primary-nav [data-nav="checkin"]')
                page.fill("#checkin-search", "NO-SUCH-STUDENT")
                expect(page.locator("#checkin-results")).to_contain_text("Student not found")
                expect(page.locator('#checkin-results [data-action="mark-present"]')).to_have_count(0)
                page.fill("#checkin-search", "diya.patel@example.com")
                page.click('#checkin-results [data-detail]')
                expect(page.locator("#detail-content")).to_contain_text("CC26-003")
                expect(page.locator("#detail-content .status-badge")).to_have_text("Not marked")
                page.click('[data-action="mark-present"]')
                expect(page.locator("#detail-content .status-badge")).to_have_text("Present")
                page.click('[data-close="detail-dialog"]')
                page.reload(wait_until="networkidle")
                expect(page.locator("#stat-present")).to_have_text("35")
                page.fill("#checkin-search", "(000) 000-1003")
                expect(page.locator("#checkin-results")).to_contain_text("Already here")
                page.click('#checkin-results [data-detail]')
                page.click('[data-action="undo-attendance"]')
                page.click("#confirm-action")
                expect(page.locator("#confirm-dialog")).not_to_be_visible()
                expect(page.locator("#detail-content .status-badge")).to_have_text("Not marked")
                expect(page.locator("#stat-present")).to_have_text("34")
                print("PASS: not-found, ID verification, check-in, refresh persistence, phone search and undo")

                page.click('[data-action="edit-participant"]')
                page.fill('#participant-form [name="name"]', "Diya Patel Updated")
                page.click("#save-participant")
                expect(page.locator("#detail-title")).to_have_text("Diya Patel Updated")
                page.click('[data-close="detail-dialog"]')
                page.click('#heading-actions [data-action="add-participant"]')
                page.fill('#participant-form [name="name"]', "Workflow Student")
                page.fill('#participant-form [name="college_id"]', "QA-001")
                page.fill('#participant-form [name="email"]', "diya.patel@example.com")
                page.click("#save-participant")
                expect(page.locator("#participant-form-error")).to_contain_text("already registered")
                page.fill('#participant-form [name="email"]', "qa.student@example.com")
                page.fill('#participant-form [name="phone"]', "0000000012")
                page.select_option('#participant-form [name="year"]', "2")
                page.fill('#participant-form [name="branch"]', "Design")
                page.click("#save-participant")
                expect(page.locator("#detail-title")).to_have_text("Workflow Student")
                page.click('[data-action="mark-present"]')
                expect(page.locator("#detail-content .status-badge")).to_have_text("Present")
                page.click('[data-close="detail-dialog"]')
                print("PASS: edit, duplicate rejection, manual registration and check-in")

                page.click('.primary-nav [data-nav="participants"]')
                page.click('#heading-actions [data-action="import"]')
                invalid = b"name,college_id,email\nValid Student,Z-001,z1@example.com\nInvalid Student,Z-002,not-an-email\n"
                page.set_input_files("#csv-file", {"name":"invalid.csv","mimeType":"text/csv","buffer":invalid})
                expect(page.locator("#import-feedback")).to_contain_text("1 row needs attention")
                expect(page.locator("#confirm-import")).to_be_disabled()
                valid = b"name,college_id,email,year,branch\nCSV Student One,Z-001,z1@example.com,1,Design\nCSV Student Two,Z-002,z2@example.com,3,Civil\n"
                page.set_input_files("#csv-file", {"name":"valid.csv","mimeType":"text/csv","buffer":valid})
                expect(page.locator("#import-feedback")).to_contain_text("2 participants ready to import")
                page.click("#confirm-import")
                expect(page.locator("#import-dialog")).not_to_be_visible()
                expect(page.locator("#directory-count")).to_have_text("51 participants")
                page.select_option("#filter-status", "present")
                expect(page.locator("#directory-count")).to_have_text("35 participants")
                with page.expect_download() as download_info:
                    page.click('[data-action="export"]')
                download = download_info.value
                report_path = Path(directory) / "report.csv"
                download.save_as(report_path)
                content = report_path.read_text(encoding="utf-8-sig")
                assert content.count("\n") == 36
                assert "checked_in_at_utc" in content
                print("PASS: invalid CSV blocked, valid CSV imported, filtered CSV export")

                page.click('[data-action="new-event"]')
                page.fill('#event-form [name="name"]', "Fresh Test Event")
                page.fill('#event-form [name="event_date"]', "2026-10-24")
                page.fill('#event-form [name="venue"]', "Seminar Hall")
                page.click("#save-event")
                expect(page.locator("#event-dialog")).not_to_be_visible()
                expect(page.locator("#directory-count")).to_have_text("0 participants")
                page.click('#heading-actions [data-action="add-participant"]')
                page.fill('#participant-form [name="name"]', "Workflow Student")
                page.fill('#participant-form [name="college_id"]', "QA-001")
                page.fill('#participant-form [name="email"]', "qa.student@example.com")
                page.click("#save-participant")
                expect(page.locator("#detail-content .status-badge")).to_have_text("Not marked")
                page.click('[data-close="detail-dialog"]')
                page.select_option("#event-select", "1")
                expect(page.locator("#directory-count")).to_have_text("51 participants")
                page.reload(wait_until="networkidle")
                expect(page.locator("#event-select")).to_have_value("1")
                page.fill("#participant-search", "QA-001")
                expect(page.locator("#directory-count")).to_have_text("1 participant")
                page.locator('#participant-table [data-detail]').first.click()
                expect(page.locator("#detail-content .status-badge")).to_have_text("Present")
                page.click('[data-action="delete-participant"]')
                page.click("#confirm-action")
                expect(page.locator("#detail-dialog")).not_to_be_visible()
                expect(page.locator("#directory-count")).to_have_text("0 participants")
                print("PASS: new event, independent attendance, remembered event choice and deletion")

                # XSS regression: user-provided markup is displayed as text, never executed.
                xss_name = '<img src=x onerror=alert(1)>'
                result = context.request.post(f"{origin}/api/events/1/participants",headers={"X-Requested-With":"Gather"},data={"name":xss_name,"college_id":"XSS-01","email":"xss@example.com"})
                assert result.status == 201
                page.fill("#participant-search", "XSS-01")
                expect(page.locator("#participant-table .student-name")).to_have_text(xss_name)
                expect(page.locator("#participant-table img")).to_have_count(0)
                print("PASS: untrusted participant content remains escaped text")

                mobile = browser.new_context(viewport={"width":390,"height":844},is_mobile=True,has_touch=True)
                phone = mobile.new_page()
                phone.on("pageerror", lambda error: errors.append(str(error)))
                phone.goto(origin, wait_until="networkidle")
                phone.select_option("#event-select", "1")
                expect(phone.locator(".mobile-nav")).to_be_visible()
                assert phone.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
                phone.click('.mobile-nav [data-nav="checkin"]')
                phone.fill("#checkin-search", "CC26-003")
                phone.click('#checkin-results [data-detail]')
                expect(phone.locator("#detail-title")).to_have_text("Diya Patel Updated")
                assert phone.locator("#detail-dialog").bounding_box()["width"] <= 390
                phone.click('[data-close="detail-dialog"]')
                phone.click('.mobile-nav [data-nav="participants"]')
                phone.click('#heading-actions [data-action="import"]')
                expect(phone.locator("#import-dialog")).to_be_visible()
                assert phone.locator("#import-dialog").bounding_box()["width"] <= 390
                phone.locator('[data-close="import-dialog"]').first.click()
                assert phone.evaluate("document.documentElement.scrollWidth <= window.innerWidth")
                print("PASS: 390px mobile navigation, search, drawer and import modal without page overflow")

                assert not errors, "Unexpected browser errors: " + repr(errors)
                browser.close()
                print("\nAll browser smoke checks passed. No uncaught JavaScript errors.")
        finally:
            server.shutdown()
            server.server_close()
            thread.join(timeout=3)


if __name__ == "__main__":
    run()
