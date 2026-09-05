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

Screenshots:
<img width="1887" height="971" alt="Screenshot 2026-09-05 113102" src="https://github.com/user-attachments/assets/77d8bb0e-4d1b-4373-8845-9c38e1bcd548" />
<img width="1906" height="968" alt="Screenshot 2026-09-05 113132" src="https://github.com/user-attachments/assets/d5ca1db1-e6f1-4b3d-ba24-5097508c7766" />
<img width="1896" height="967" alt="Screenshot 2026-09-05 113119" src="https://github.com/user-attachments/assets/c8ba5cf2-abd7-4a68-8cff-d5105fb2bd36" />

Demo
View the screen recording


https://github.com/user-attachments/assets/86dbca0a-0abc-49d1-afa3-e8e67395604e



