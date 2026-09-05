"""Run with: python -m unittest discover -s tests -v

Uses temporary SQLite files. The real data/attendance.sqlite3 is never touched.
No test dependency beyond Flask and Python's standard library is required.
"""
import csv
import io
from pathlib import Path
import tempfile
import unittest

from app import create_app

HEADERS = {"X-Requested-With": "Gather"}


class AttendanceTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.config = {"TESTING": True, "DATABASE": str(Path(self.temp.name) / "test.sqlite3"), "SEED_DEMO": False}
        self.app = create_app(self.config)
        self.client = self.app.test_client()
        self.event_id = self.new_event()["id"]

    def tearDown(self):
        self.temp.cleanup()

    def new_event(self, name="Test Event"):
        response = self.client.post("/api/events", json={"name": name, "event_date": "2026-09-05", "venue": "Auditorium"}, headers=HEADERS)
        self.assertEqual(response.status_code, 201, response.json)
        return response.json["event"]

    def data(self, **updates):
        return {"name": "Test Student", "college_id": "C-001", "email": "student@example.com", "phone": "+91 00000 00001", "year": "2", "branch": "Computer Science", **updates}

    def register(self, event_id=None, **updates):
        response = self.client.post(f"/api/events/{event_id or self.event_id}/participants", json=self.data(**updates), headers=HEADERS)
        self.assertEqual(response.status_code, 201, response.json)
        return response.json["participant"]

    def mark(self, participant_id, present=True, event_id=None):
        return self.client.put(f"/api/events/{event_id or self.event_id}/participants/{participant_id}/attendance", json={"present": present}, headers=HEADERS)

    def summary(self, event_id=None):
        response = self.client.get(f"/api/events/{event_id or self.event_id}/summary")
        self.assertEqual(response.status_code, 200)
        return response.json

    def search(self, **params):
        return self.client.get(f"/api/events/{self.event_id}/participants", query_string=params)

    def upload(self, content, preview=False, filename="students.csv", event_id=None):
        raw = content if isinstance(content, bytes) else content.encode("utf-8")
        response = self.client.post(f"/api/events/{event_id or self.event_id}/import" + ("/preview" if preview else ""), data={"file": (io.BytesIO(raw), filename)}, headers=HEADERS)
        response.request.input_stream.close()  # Close the test client multipart stream.
        return response

    def test_empty_database_and_zero_statistics(self):
        stats = self.summary()
        self.assertEqual((stats["total"], stats["present"], stats["absent"], stats["percentage"]), (0, 0, 0, 0))
        self.assertEqual(stats["recent"], [])
        self.assertEqual(stats["by_year"], [])

    def test_health_and_html(self):
        self.assertEqual(self.client.get("/api/health").json["status"], "ok")
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"Gather", response.data)
        self.assertIn("script-src 'self'", response.headers["Content-Security-Policy"])
        with self.client.get("/static/favicon.svg") as static_response:
            self.assertEqual(static_response.status_code, 200)

    def test_manual_registration_normalizes_fields_and_starts_absent(self):
        person = self.register(name="  Test  Student ", college_id=" c-001 ", email=" STUDENT@EXAMPLE.COM ")
        self.assertEqual(person["name"], "Test Student")
        self.assertEqual(person["college_id"], "C-001")
        self.assertEqual(person["email"], "student@example.com")
        self.assertEqual(person["phone"], "910000000001")
        self.assertFalse(person["present"])
        self.assertIsNone(person["checked_in_at"])

    def test_required_fields_and_invalid_types(self):
        bad_inputs = [{}, self.data(name=""), self.data(email="no-at-sign"), self.data(college_id="!ID"), self.data(name=["a", "b"]), self.data(email=32)]
        for data in bad_inputs:
            with self.subTest(data=data):
                response = self.client.post(f"/api/events/{self.event_id}/participants", json=data, headers=HEADERS)
                self.assertEqual(response.status_code, 400)
        self.assertEqual(self.summary()["total"], 0)

    def test_phone_year_and_id_format_validation(self):
        for update in ({"phone":"123"},{"phone":"call 0000001234"},{"year":"99"},{"college_id":"contains spaces"},{"college_id":"X"},{"college_id":"C" * 33},{"branch":"X" * 81},{"name":"One\nTwo"}):
            with self.subTest(update=update):
                result = self.client.post(f"/api/events/{self.event_id}/participants", json=self.data(**update), headers=HEADERS)
                self.assertEqual(result.status_code,400,result.json)
        self.assertEqual(self.summary()["total"], 0)

    def test_optional_fields_can_be_blank(self):
        person = self.register(phone="", year="", branch="")
        self.assertEqual(person["year"], "")
        self.assertEqual(self.summary()["by_year"][0]["label"], "")

    def test_duplicate_id_and_email_are_event_scoped_case_insensitive(self):
        self.register()
        for update in ({"email":"another@example.com","college_id":"c-001"},{"email":"STUDENT@EXAMPLE.COM","college_id":"C-002"}):
            result = self.client.post(f"/api/events/{self.event_id}/participants", json=self.data(**update), headers=HEADERS)
            self.assertEqual(result.status_code,409)
        second_event = self.new_event("Second Event")["id"]
        self.register(event_id=second_event)
        self.assertEqual(self.summary()["total"],1)
        self.assertEqual(self.summary(second_event)["total"],1)

    def test_search_by_name_email_id_and_formatted_phone(self):
        person = self.register()
        for query in ("test stu", "STUDENT@EXAMPLE", "c-001", "+91 00000", "0000000001"):
            with self.subTest(query=query):
                result = self.search(q=query).json
                self.assertEqual(result["pagination"]["total"],1)
                self.assertEqual(result["participants"][0]["id"],person["id"])

    def test_unknown_student_returns_empty_not_an_auto_registration(self):
        self.register()
        result = self.search(q="NO-SUCH-COLLEGE-ID").json
        self.assertEqual(result["participants"],[])
        self.assertEqual(self.summary()["total"],1)
        self.assertEqual(self.summary()["present"],0)

    def test_sql_injection_and_like_wildcards_are_literal(self):
        self.register()
        for q in ("%' OR 1=1 --", "%", "_", "C-001' OR 1=1 --"):
            self.assertEqual(self.search(q=q).json["pagination"]["total"],0)
        self.assertEqual(self.summary()["total"],1)

    def test_filters_sort_and_pagination(self):
        for i in range(12):
            person = self.register(name=f"Student {i:02}", college_id=f"X-{i:03}", email=f"s{i}@example.com", year="1" if i < 6 else "2")
            if i % 2 == 0:
                self.mark(person["id"])
        result = self.search(status="present",year="1",branch="Computer Science").json
        self.assertEqual(result["pagination"]["total"],3)
        paged = self.search(page=2,page_size=5).json
        self.assertEqual(len(paged["participants"]),5)
        self.assertEqual(paged["pagination"]["pages"],3)
        self.assertEqual(self.search(page=100).json["pagination"]["page"],2)
        self.assertEqual(self.search(sort="newest").json["participants"][0]["name"],"Student 11")

    def test_invalid_query_parameters_have_clear_errors(self):
        for params in ({"page":"abc"},{"page":0},{"page_size":0},{"page_size":101},{"status":"maybe"},{"sort":"name; DROP TABLE participants"},{"q":"x"*121}):
            with self.subTest(params=params):
                self.assertEqual(self.search(**params).status_code,400)

    def test_mark_present_is_idempotent_and_does_not_duplicate(self):
        person = self.register()
        result = self.mark(person["id"])
        self.assertEqual(result.status_code,200)
        first_time = result.json["participant"]["checked_in_at"]
        self.assertTrue(result.json["changed"])
        self.assertIsNotNone(first_time)
        again = self.mark(person["id"])
        self.assertFalse(again.json["changed"])
        self.assertEqual(again.json["participant"]["checked_in_at"],first_time)
        self.assertEqual(self.summary()["present"],1)
        self.assertEqual(self.summary()["percentage"],100)

    def test_attendance_persists_across_new_app_instance_and_connection(self):
        person = self.register()
        timestamp = self.mark(person["id"]).json["participant"]["checked_in_at"]
        restarted = create_app(self.config).test_client()
        fetched = restarted.get(f"/api/events/{self.event_id}/participants/{person['id']}").json["participant"]
        self.assertTrue(fetched["present"])
        self.assertEqual(fetched["checked_in_at"],timestamp)
        self.assertEqual(restarted.get(f"/api/events/{self.event_id}/summary").json["total"],1)

    def test_undo_attendance_preserves_registration(self):
        person = self.register()
        self.mark(person["id"])
        undone = self.mark(person["id"],False).json
        self.assertTrue(undone["changed"])
        self.assertFalse(undone["participant"]["present"])
        self.assertIsNone(undone["participant"]["checked_in_at"])
        self.assertFalse(self.mark(person["id"],False).json["changed"])
        self.assertEqual(self.summary()["total"],1)

    def test_unknown_or_wrong_event_participant_cannot_be_marked(self):
        person = self.register()
        second_event = self.new_event("Second Event")["id"]
        self.assertEqual(self.mark(99999).status_code,404)
        self.assertEqual(self.mark(person["id"],event_id=second_event).status_code,404)
        self.assertEqual(self.summary()["present"],0)

    def test_attendance_requires_actual_boolean(self):
        person = self.register()
        for value in ("true",1,None,"false",[]):
            self.assertEqual(self.mark(person["id"],value).status_code,400)
        self.assertFalse(self.search().json["participants"][0]["present"])

    def test_profile_edits_preserve_attendance(self):
        person = self.register()
        time = self.mark(person["id"]).json["participant"]["checked_in_at"]
        result = self.client.patch(f"/api/events/{self.event_id}/participants/{person['id']}",json={"name":"Updated Student","present":False},headers=HEADERS)
        self.assertEqual(result.status_code,200)
        updated = result.json["participant"]
        self.assertEqual(updated["name"],"Updated Student")
        self.assertTrue(updated["present"])
        self.assertEqual(updated["checked_in_at"],time)

    def test_edits_cannot_create_duplicates(self):
        first = self.register()
        second = self.register(college_id="C-002",email="other@example.com")
        result = self.client.patch(f"/api/events/{self.event_id}/participants/{second['id']}",json={"college_id":first["college_id"]},headers=HEADERS)
        self.assertEqual(result.status_code,409)
        self.assertEqual(self.summary()["total"],2)

    def test_delete_updates_counts_and_does_not_touch_other_events(self):
        first = self.register()
        second_event = self.new_event("Second Event")["id"]
        self.register(event_id=second_event)
        self.mark(first["id"])
        result = self.client.delete(f"/api/events/{self.event_id}/participants/{first['id']}",headers=HEADERS)
        self.assertEqual(result.status_code,200)
        self.assertEqual(self.summary()["total"],0)
        self.assertEqual(self.summary()["present"],0)
        self.assertEqual(self.summary(second_event)["total"],1)

    def test_dashboard_year_and_branch_statistics(self):
        first = self.register(year="1",branch="Design")
        self.register(college_id="C-002",email="two@example.com",year="2",branch="Design")
        self.register(college_id="C-003",email="three@example.com",year="2",branch="Civil")
        self.mark(first["id"])
        stats = self.summary()
        self.assertEqual(stats["percentage"],33.3)
        self.assertEqual(stats["absent"],2)
        self.assertEqual(sum(group["total"] for group in stats["by_year"]),3)
        self.assertEqual(sum(group["present"] for group in stats["by_branch"]),1)
        self.assertEqual(stats["recent"][0]["id"],first["id"])

    def test_csv_preview_is_read_only_and_import_is_validated(self):
        content = "name,college_id,email,year\nOne Student,A-01,one@example.com,1\nTwo Student,A-02,two@example.com,2\n"
        preview = self.upload(content,preview=True)
        self.assertEqual(preview.status_code,200)
        self.assertTrue(preview.json["valid"])
        self.assertEqual(preview.json["valid_count"],2)
        self.assertEqual(self.summary()["total"],0)
        result = self.upload(content)
        self.assertEqual(result.status_code,201)
        self.assertEqual(result.json["imported"],2)
        self.assertEqual(self.summary()["total"],2)
        self.assertEqual(self.summary()["present"],0)

    def test_csv_invalid_rows_block_the_entire_batch(self):
        content = "name,college_id,email\nValid Student,A-01,valid@example.com\nInvalid Student,A-02,not-an-email\n"
        preview = self.upload(content,preview=True)
        self.assertFalse(preview.json["valid"])
        self.assertEqual(preview.json["errors"][0]["row"],3)
        result = self.upload(content)
        self.assertEqual(result.status_code,400)
        self.assertEqual(self.summary()["total"],0)

    def test_csv_duplicate_ids_and_emails_inside_file_are_rejected(self):
        content = "name,college_id,email\nFirst Student,A-01,one@example.com\nSecond Student,a-01,two@example.com\nThird Student,A-03,ONE@EXAMPLE.COM\n"
        result = self.upload(content)
        self.assertEqual(result.status_code,400)
        self.assertEqual(result.json["error_count"],2)
        self.assertEqual(self.summary()["total"],0)

    def test_csv_duplicate_existing_row_does_not_overwrite(self):
        person = self.register()
        self.mark(person["id"])
        content = "name,college_id,email\nReplacement,C-001,different@example.com\nNew Student,N-01,new@example.com\n"
        result = self.upload(content)
        self.assertEqual(result.status_code,400)
        self.assertEqual(self.summary()["total"],1)
        self.assertEqual(self.summary()["present"],1)
        self.assertEqual(self.search().json["participants"][0]["name"],"Test Student")

    def test_csv_bom_header_aliases_quoted_names_and_year_aliases(self):
        content = '\ufeffFull Name,College ID,Email ID,Contact Number,Year,Department\n"Student, Example",A/2026/01,quoted@example.com,"(000) 000-0123",1st year,Design\n'
        result = self.upload(content)
        self.assertEqual(result.status_code,201,result.json)
        person = self.search().json["participants"][0]
        self.assertEqual(person["name"],"Student, Example")
        self.assertEqual(person["phone"],"0000000123")
        self.assertEqual(person["year"],"1")

    def test_csv_can_reuse_same_student_in_another_event(self):
        self.register()
        second = self.new_event("Second Event")["id"]
        result = self.upload("name,college_id,email\nTest Student,C-001,student@example.com\n",event_id=second)
        self.assertEqual(result.status_code,201)
        self.assertEqual(self.summary(second)["total"],1)

    def test_csv_ignores_attendance_fields(self):
        result = self.upload("name,college_id,email,present,attendance,checked_in_at\nTest Student,C-001,student@example.com,true,Present,2026-09-05\n")
        self.assertEqual(result.status_code,201)
        self.assertEqual(self.summary()["present"],0)

    def test_csv_rejects_missing_duplicate_headers_and_malformed_rows(self):
        inputs = ["", "name,email\nStudent,s@example.com", "name,college_id,email\n", "name,name,college_id,email\n", "name,college_id,email\nStudent,A-01,a@example.com,extra\n", 'name,college_id,email\n"Unclosed,A-01,a@example.com\n']
        for content in inputs:
            with self.subTest(content=content):
                self.assertEqual(self.upload(content).status_code,400)
        self.assertEqual(self.summary()["total"],0)

    def test_csv_rejects_binary_files_invalid_encoding_and_wrong_extension(self):
        self.assertEqual(self.upload(b"\xff\xfe\xfd").status_code,400)
        self.assertEqual(self.upload(b"name,college_id,email\n\x00").status_code,400)
        self.assertEqual(self.upload(b"data",filename="students.xlsx").status_code,400)

    def test_csv_blank_rows_are_ignored(self):
        result = self.upload("name,college_id,email\n\n,,\nStudent,A-01,a@example.com\n\n")
        self.assertEqual(result.status_code,201)
        self.assertEqual(result.json["imported"],1)

    def test_csv_upload_and_row_limits(self):
        self.assertEqual(self.upload(b"x" * (2 * 1024 * 1024 + 1)).status_code,413)
        content = "name,college_id,email\n" + "".join(f"Student {i},A-{i:04},s{i}@example.com\n" for i in range(5001))
        result = self.upload(content)
        self.assertEqual(result.status_code,400)
        self.assertIn("5,000",result.json["error"])
        self.assertEqual(self.summary()["total"],0)

    def test_csv_final_import_rechecks_after_preview(self):
        content = "name,college_id,email\nFirst Student,C-001,student@example.com\n"
        self.assertTrue(self.upload(content,preview=True).json["valid"])
        self.register()
        self.assertEqual(self.upload(content).status_code,400)
        self.assertEqual(self.summary()["total"],1)

    def test_export_contains_filtered_status_and_utc_timestamp(self):
        first = self.register()
        self.register(college_id="C-002",email="two@example.com")
        self.mark(first["id"])
        result = self.client.get(f"/api/events/{self.event_id}/export?status=present")
        self.assertEqual(result.status_code,200)
        rows = list(csv.DictReader(io.StringIO(result.data.decode("utf-8-sig"))))
        self.assertEqual(len(rows),1)
        self.assertEqual(rows[0]["attendance"],"Present")
        self.assertTrue(rows[0]["checked_in_at_utc"].endswith("+00:00"))
        self.assertIn("attachment",result.headers["Content-Disposition"])

    def test_csv_export_escapes_spreadsheet_formulas(self):
        self.register(name="=HYPERLINK(1)",branch="+SUM(1,1)")
        result = self.client.get(f"/api/events/{self.event_id}/export")
        row = list(csv.DictReader(io.StringIO(result.data.decode("utf-8-sig"))))[0]
        self.assertEqual(row["name"],"'=HYPERLINK(1)")
        self.assertTrue(row["branch"].startswith("'"))

    def test_downloaded_template_can_be_imported(self):
        template = self.client.get("/api/template.csv")
        self.assertEqual(template.status_code,200)
        result = self.upload(template.data)
        self.assertEqual(result.status_code,201)
        self.assertEqual(result.json["imported"],3)

    def test_write_guard_rejects_cross_origin_style_form_posts(self):
        response = self.client.post("/api/events",json={"name":"Injected Event","event_date":"2026-09-05"})
        self.assertEqual(response.status_code,403)
        response = self.client.post(f"/api/events/{self.event_id}/participants",data=self.data())
        self.assertEqual(response.status_code,403)
        self.assertNotIn("Access-Control-Allow-Origin",response.headers)

    def test_malformed_json_and_unknown_endpoints(self):
        response = self.client.post(f"/api/events/{self.event_id}/participants",data="{broken",content_type="application/json",headers=HEADERS)
        self.assertEqual(response.status_code,400)
        self.assertEqual(self.client.get("/api/events/9999/summary").status_code,404)
        self.assertEqual(self.client.get("/api/no-such-endpoint").status_code,404)

    def test_event_date_and_name_validation(self):
        for updates in ({"name":""},{"event_date":"2026-02-30"},{"event_date":"20260905"},{"venue":"x"*101}):
            result = self.client.post("/api/events",json={"name":"Some Event","event_date":"2026-09-05",**updates},headers=HEADERS)
            self.assertEqual(result.status_code,400,result.json)

    def test_demo_seed_is_inserted_once_and_is_explicitly_labeled(self):
        config = {**self.config,"DATABASE":str(Path(self.temp.name)/"demo.sqlite3"),"SEED_DEMO":True}
        demo = create_app(config).test_client()
        events = demo.get("/api/events").json["events"]
        self.assertEqual(len(events),1)
        self.assertTrue(events[0]["is_demo"])
        summary = demo.get(f"/api/events/{events[0]['id']}/summary").json
        self.assertEqual((summary["total"],summary["present"],summary["absent"]),(48,34,14))
        second = create_app(config).test_client()
        self.assertEqual(second.get(f"/api/events/{events[0]['id']}/summary").json["total"],48)


if __name__ == "__main__":
    unittest.main()
