# Event_Attendance_Tracker
A simple application for managing campus event registrations and attendance, with a colorful, mobile-friendly interface.

Features
Add participants manually or import a CSV.
Search by name, email, College ID, or phone.
Mark students present and undo incorrect check-ins.
View attendance totals and year/branch statistics.
Export attendance reports as CSV.
Manage multiple events separately.
Technologies
Python, Flask, SQLite, HTML, CSS, and JavaScript.

How to Run
Requirement: Python 3.10 or newer.

Clone or download this repository and open the project folder.
Start the application:
Windows: Double-click run.bat.
macOS/Linux: Run bash run.sh.
Open http://localhost:8000 in your browser.
The launcher installs dependencies on the first run. Keep the terminal open while using the app.

Data
Attendance is saved in data/attendance.sqlite3 and remains after refreshing or restarting.

CSV files require name, college_id, and email. Optional fields are phone, year, and branch. College IDs and emails must be unique within each event.

A sample event is included. Create a new event to use your own registration list.

Demo
View the screen recording

Notes
Organizers must verify the student's physical College ID before check-in.
This is a local/demo project without authentication. Do not expose real student data publicly.
AI Assistance
The initial code, tests, and documentation were substantially generated with Arena.ai's AI assistant. The application does not use AI at runtime.
