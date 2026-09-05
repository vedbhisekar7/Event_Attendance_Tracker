const express = require('express');
const router = express.Router();
const multer = require('multer');
const csv = require('csv-parser');
const fs = require('fs');
const path = require('path');
const { getDb } = require('../database');

// Configure multer for file uploads
const upload = multer({
    dest: path.join(__dirname, '..', 'data', 'uploads'),
    fileFilter: (req, file, cb) => {
        if (file.mimetype === 'text/csv' || file.originalname.endsWith('.csv')) {
            cb(null, true);
        } else {
            cb(new Error('Only CSV files are allowed'), false);
        }
    }
});

// GET all participants with optional search/filter
router.get('/', (req, res) => {
    try {
        const db = getDb();
        const { search, year, branch, status, page = 1, limit = 50 } = req.query;
        
        let query = 'SELECT * FROM participants WHERE 1=1';
        const params = [];

        if (search) {
            query += ` AND (
                LOWER(name) LIKE LOWER(?) OR 
                LOWER(email) LIKE LOWER(?) OR 
                LOWER(college_id) LIKE LOWER(?) OR
                phone LIKE ?
            )`;
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }

        if (year) {
            query += ' AND year = ?';
            params.push(year);
        }

        if (branch) {
            query += ' AND LOWER(branch) = LOWER(?)';
            params.push(branch);
        }

        if (status) {
            query += ' AND attendance_status = ?';
            params.push(status);
        }

        // Get total count
        const countQuery = query.replace('SELECT *', 'SELECT COUNT(*) as total');
        const totalResult = db.prepare(countQuery).get(...params);

        // Add pagination
        const offset = (parseInt(page) - 1) * parseInt(limit);
        query += ' ORDER BY name ASC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);

        const participants = db.prepare(query).all(...params);

        res.json({
            success: true,
            data: participants,
            pagination: {
                total: totalResult.total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(totalResult.total / parseInt(limit))
            }
        });
    } catch (error) {
        console.error('Error fetching participants:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch participants' });
    }
});

// GET single participant by ID
router.get('/:id', (req, res) => {
    try {
        const db = getDb();
        const participant = db.prepare('SELECT * FROM participants WHERE id = ?').get(req.params.id);
        
        if (!participant) {
            return res.status(404).json({ success: false, message: 'Participant not found' });
        }

        res.json({ success: true, data: participant });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to fetch participant' });
    }
});

// POST - Add single participant
router.post('/', (req, res) => {
    try {
        const db = getDb();
        const { name, college_id, email, phone, year, branch } = req.body;

        if (!name || !college_id || !email) {
            return res.status(400).json({
                success: false,
                message: 'Name, College ID, and Email are required'
            });
        }

        // Check for duplicate college_id or email
        const existing = db.prepare(
            'SELECT * FROM participants WHERE college_id = ? OR email = ?'
        ).get(college_id, email);

        if (existing) {
            return res.status(409).json({
                success: false,
                message: 'A participant with this College ID or Email already exists'
            });
        }

        const stmt = db.prepare(`
            INSERT INTO participants (name, college_id, email, phone, year, branch)
            VALUES (?, ?, ?, ?, ?, ?)
        `);

        const result = stmt.run(name, college_id, email, phone || null, year || null, branch || null);

        res.status(201).json({
            success: true,
            message: 'Participant registered successfully',
            data: { id: result.lastInsertRowid }
        });
    } catch (error) {
        console.error('Error adding participant:', error);
        res.status(500).json({ success: false, message: 'Failed to add participant' });
    }
});

// POST - Import participants from CSV
router.post('/import', upload.single('file'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ success: false, message: 'No file uploaded' });
        }

        const db = getDb();
        const results = [];
        const errors = [];
        let successCount = 0;
        let duplicateCount = 0;

        const filePath = req.file.path;

        fs.createReadStream(filePath)
            .pipe(csv())
            .on('data', (row) => {
                results.push(row);
            })
            .on('end', () => {
                const insertStmt = db.prepare(`
                    INSERT OR IGNORE INTO participants (name, college_id, email, phone, year, branch)
                    VALUES (?, ?, ?, ?, ?, ?)
                `);

                const insertMany = db.transaction((participants) => {
                    for (const p of participants) {
                        const name = p.name || p.Name || p.NAME || '';
                        const college_id = p.college_id || p.collegeId || p.CollegeID || p['College ID'] || p.college_ID || '';
                        const email = p.email || p.Email || p.EMAIL || '';
                        const phone = p.phone || p.Phone || p.PHONE || p.contact || p.Contact || '';
                        const year = p.year || p.Year || p.YEAR || '';
                        const branch = p.branch || p.Branch || p.BRANCH || p.department || p.Department || '';

                        if (!name || !college_id || !email) {
                            errors.push(`Skipped row: missing required fields - ${JSON.stringify(p)}`);
                            continue;
                        }

                        const result = insertStmt.run(name.trim(), college_id.trim(), email.trim().toLowerCase(), phone.trim(), year.trim(), branch.trim());
                        
                        if (result.changes > 0) {
                            successCount++;
                        } else {
                            duplicateCount++;
                        }
                    }
                });

                insertMany(results);

                // Clean up uploaded file
                fs.unlinkSync(filePath);

                res.json({
                    success: true,
                    message: `Import complete`,
                    stats: {
                        total: results.length,
                        imported: successCount,
                        duplicates: duplicateCount,
                        errors: errors.length
                    },
                    errors: errors.slice(0, 10) // Only show first 10 errors
                });
            })
            .on('error', (error) => {
                fs.unlinkSync(filePath);
                res.status(500).json({ success: false, message: 'Error parsing CSV file' });
            });
    } catch (error) {
        console.error('Error importing CSV:', error);
        res.status(500).json({ success: false, message: 'Failed to import participants' });
    }
});

// DELETE - Remove participant
router.delete('/:id', (req, res) => {
    try {
        const db = getDb();
        const result = db.prepare('DELETE FROM participants WHERE id = ?').run(req.params.id);
        
        if (result.changes === 0) {
            return res.status(404).json({ success: false, message: 'Participant not found' });
        }

        res.json({ success: true, message: 'Participant removed successfully' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to remove participant' });
    }
});

// DELETE - Clear all participants
router.delete('/', (req, res) => {
    try {
        const db = getDb();
        db.prepare('DELETE FROM participants').run();
        res.json({ success: true, message: 'All participants cleared' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Failed to clear participants' });
    }
});

// GET - Dashboard statistics
router.get('/stats/dashboard', (req, res) => {
    try {
        const db = getDb();

        const total = db.prepare('SELECT COUNT(*) as count FROM participants').get().count;
        const present = db.prepare("SELECT COUNT(*) as count FROM participants WHERE attendance_status = 'present'").get().count;
        const absent = total - present;

        const yearWise = db.prepare(`
            SELECT 
                COALESCE(year, 'Unknown') as year,
                COUNT(*) as total,
                SUM(CASE WHEN attendance_status = 'present' THEN 1 ELSE 0 END) as present
            FROM participants 
            GROUP BY year 
            ORDER BY year
        `).all();

        const branchWise = db.prepare(`
            SELECT 
                COALESCE(branch, 'Unknown') as branch,
                COUNT(*) as total,
                SUM(CASE WHEN attendance_status = 'present' THEN 1 ELSE 0 END) as present
            FROM participants 
            GROUP BY branch 
            ORDER BY branch
        `).all();

        const recentAttendance = db.prepare(`
            SELECT name, college_id, marked_at 
            FROM participants 
            WHERE attendance_status = 'present' 
            ORDER BY marked_at DESC 
            LIMIT 10
        `).all();

        res.json({
            success: true,
            data: {
                total,
                present,
                absent,
                percentage: total > 0 ? ((present / total) * 100).toFixed(1) : 0,
                yearWise,
                branchWise,
                recentAttendance
            }
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch statistics' });
    }
});

module.exports = router;