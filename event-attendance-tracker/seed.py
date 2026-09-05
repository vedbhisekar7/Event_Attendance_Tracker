"""Fictional sample data, inserted ONLY when a new database has no events."""
from datetime import datetime, timedelta, timezone

NAMES = [
    "Ananya Sharma", "Aarav Mehta", "Diya Patel", "Rohan Desai",
    "Ishita Rao", "Kabir Shah", "Meera Joshi", "Arjun Nair",
    "Saanvi Kulkarni", "Vihaan Gupta", "Aditi Menon", "Dev Malhotra",
    "Nisha Reddy", "Yash Verma", "Tara Kapoor", "Aditya Singh",
    "Pooja Iyer", "Kunal Jain", "Riya Chatterjee", "Neel Patil",
    "Sneha Das", "Rahul Bhat", "Avni Saxena", "Dhruv Sethi",
    "Kavya Pillai", "Siddharth Roy", "Zoya Khan", "Pranav Bose",
    "Anika Mathur", "Ishaan Sinha", "Maya Narang", "Samar Suri",
    "Leela Krishnan", "Atharv Mishra", "Naina Bansal", "Ved Agarwal",
    "Kiara Shetty", "Harsh Arora", "Sara Ali", "Manav Chopra",
    "Esha Naik", "Om Jadhav", "Myra Dutta", "Reyansh Sen",
    "Jiya Batra", "Aryan Sood", "Ira Mahajan", "Laksh Goel",
]
BRANCHES = ["Computer Science", "Information Technology", "Electronics", "Mechanical", "Civil", "Design"]


def seed_demo(db):
    now = datetime.now(timezone.utc).replace(microsecond=0)
    # The date of this sample event is intentionally fixed; check-in times are
    # relative to first launch to make the sample dashboard easy to understand.
    event_id = db.execute(
        "INSERT INTO events (name, event_date, venue, is_demo, created_at) VALUES (?, ?, ?, 1, ?)",
        ("Campus Connect '26", "2026-09-05", "Main Auditorium", now.isoformat()),
    ).lastrowid
    for i, name in enumerate(NAMES):
        present = i % 7 not in (2, 5)
        checked_in = (now - timedelta(minutes=(48 - i) * 2)).isoformat() if present else None
        db.execute(
            """INSERT INTO participants
               (event_id, name, college_id, email, phone, year, branch,
                present, checked_in_at, created_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (event_id, name, f"CC26-{i + 1:03}",
             name.lower().replace(" ", ".") + "@example.com",
             f"000000{i + 1001:04}" if i % 3 != 0 else "",
             str((i // 6) % 4 + 1), BRANCHES[i % 6], int(present),
             checked_in, (now - timedelta(days=7)).isoformat()),
        )
