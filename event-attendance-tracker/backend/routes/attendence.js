const express = require('express');
const router = express.Router();
const { getDb } = require('../backend/database');

// POST - Search and verify participant for attendance
router.post('/verify', (req, res) => {
    try {
        const db = getDb();
        const { query } = req.body;

        if (!query || query.trim().length === 0) {
            return res.status(400).json({
                success: false,
                message: 'Please enter a search term'
            });
        }

        const searchTerm = query.trim();

        // Search by exact college_id first, then by email, then by name/phone
        let participant = db.prepare(
            'SELECT * FROM participants WHERE LOWER(college_id) = LOWER(?)'
        ).get(searchTerm);

        if (!participant) {
            participant = db.prepare(
                'SELECT * FROM participants WHERE LOWER(email) = LOWER(?)'
            ).get(searchTerm);
        }

        if (!participant) {
            participant = db.prepare(
                'SELECT * FROM participants WHERE phone = ?'
            ).get(searchTerm);
        }

        if (!participant) {
            // Fuzzy search by name
            const nameResults = db.prepare(
                'SELECT * FROM participants WHERE LOWER(name) LIKE LOWER(?)'
            ).all(`%${searchTerm}%`);

            if (nameResults.length === 1) {
                participant = nameResults[0];
            } else if (nameResults.length > 1) {
                return res.json({
                    success: true,
                    found: true,
                    multiple: true,
                    data: nameResults,
                    message: `Found ${nameResults.length} matching participants. Please select one.`
                });
            }
        }

        if (!participant) {
            return res.json({
                success: true,
                found: false,
                message: 'No registered participant found with the given details. Please check the information and try again.'
            });
        }

        res.json({
            success: true,
            found: true,
            multiple: false,
            data: participant
        });
    } catch (error) {
        console.error('Error verifying participant:', error);
        res.status(500).json({ success: false, message: 'Verification failed' });
    }
});

// PUT - Mark attendance
router.put('/mark/:id', (req, res) => {
    try {
        const db = getDb();
        const { status } = req.body; // 'present' or 'absent'
        const validStatuses = ['present', 'absent'];

        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid status. Must be "present" or "absent"'
            });
        }

        const markedAt = status === 'present' ? new Date().toISOString() : null;

        const result = db.prepare(`
            UPDATE participants 
            SET attendance_status = ?, marked_at = ?
            WHERE id = ?
        `).run(status, markedAt, req.params.id);

        if (result.changes === 0) {
            return res.status(404).json({
                success: false,
                message: 'Participant not found'
            });
        }

        const updated = db.prepare('SELECT * FROM participants WHERE id = ?').get(req.params.id);

        res.json({
            success: true,
            message: `Attendance ${status === 'present' ? 'marked' : 'unmarked'} successfully`,
            data: updated
        });
    } catch (error) {
        console.error('Error marking attendance:', error);
        res.status(500).json({ success: false, message: 'Failed to mark attendance' });
    }
});

// PUT - Reset all attendance
router.put('/reset', (req, res) => {
    try {
        const db = getDb();
        db.prepare("UPDATE participants SET attendance_status = 'absent', marked_at = NULL").run();
        res.json({ success: true, message: 'All attendance records have been reset' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to reset attendance' });
    }
});

// GET - Export attendance
router.get('/export', (req, res) => {
    try {
        const db = getDb();
        const participants = db.prepare(
            'SELECT name, college_id, email, phone, year, branch, attendance_status, marked_at FROM participants ORDER BY name'
        ).all();

        // Generate CSV
        const headers = 'Name,College ID,Email,Phone,Year,Branch,Status,Marked At\n';
        const rows = participants.map(p =>
            `"${p.name}","${p.college_id}","${p.email}","${p.phone || ''}","${p.year || ''}","${p.branch || ''}","${p.attendance_status}","${p.marked_at || ''}"`
        ).join('\n');

        res.setHeader('Content-Type', 'text/csv');
        res.setHeader('Content-Disposition', 'attachment; filename=attendance_report.csv');
        res.send(headers + rows);
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to export attendance' });
    }
});

module.exports = router;