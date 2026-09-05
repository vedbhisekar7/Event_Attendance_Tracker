/**
 * Import Module
 * Handles CSV file import, manual participant addition, and data management
 */
const Import = {
    init() {
        this.setupCSVUpload();
        this.setupManualForm();
        this.setupDangerZone();
    },

    // ---- CSV Upload ----
    setupCSVUpload() {
        const uploadZone = document.getElementById('uploadZone');
        const fileInput = document.getElementById('csvFile');

        // Drag and drop
        uploadZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadZone.classList.add('dragover');
        });

        uploadZone.addEventListener('dragleave', () => {
            uploadZone.classList.remove('dragover');
        });

        uploadZone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadZone.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                this.uploadFile(files[0]);
            }
        });

        // File input
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                this.uploadFile(e.target.files[0]);
                e.target.value = ''; // Reset for re-upload
            }
        });

        // Click on zone opens file picker
        uploadZone.addEventListener('click', (e) => {
            if (e.target === uploadZone || e.target.tagName === 'I' || e.target.tagName === 'P' || e.target.tagName === 'SPAN') {
                fileInput.click();
            }
        });
    },

    async uploadFile(file) {
        if (!file.name.endsWith('.csv')) {
            App.showToast('error', 'Invalid File', 'Please upload a CSV file');
            return;
        }

        const progressDiv = document.getElementById('uploadProgress');
        const progressFill = document.getElementById('progressFill');
        const progressText = document.getElementById('progressText');
        const resultDiv = document.getElementById('importResult');

        // Show progress
        progressDiv.style.display = 'block';
        resultDiv.style.display = 'none';
        progressFill.style.width = '30%';
        progressText.textContent = `Uploading ${file.name}...`;

        try {
            progressFill.style.width = '60%';
            progressText.textContent = 'Processing data...';

            const response = await API.importCSV(file);

            progressFill.style.width = '100%';

            setTimeout(() => {
                progressDiv.style.display = 'none';

                if (response.success) {
                    resultDiv.style.display = 'block';
                    resultDiv.className = 'import-result success';
                    resultDiv.innerHTML = `
                        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
                            <i class="fas fa-check-circle"></i>
                            <strong>Import Successful!</strong>
                        </div>
                        <div class="import-stats">
                            <div class="import-stat">
                                <span class="import-stat-value">${response.stats.total}</span>
                                <span class="import-stat-label">Total Rows</span>
                            </div>
                            <div class="import-stat">
                                <span class="import-stat-value">${response.stats.imported}</span>
                                <span class="import-stat-label">Imported</span>
                            </div>
                            <div class="import-stat">
                                <span class="import-stat-value">${response.stats.duplicates}</span>
                                <span class="import-stat-label">Duplicates</span>
                            </div>
                            <div class="import-stat">
                                <span class="import-stat-value">${response.stats.errors}</span>
                                <span class="import-stat-label">Errors</span>
                            </div>
                        </div>
                    `;

                    App.showToast('success', 'Import Complete', `${response.stats.imported} participants imported successfully`);
                } else {
                    resultDiv.style.display = 'block';
                    resultDiv.className = 'import-result error';
                    resultDiv.innerHTML = `
                        <i class="fas fa-times-circle"></i> 
                        <strong>Import Failed</strong>
                        <p>${response.message || 'An error occurred during import'}</p>
                    `;
                }
            }, 500);
        } catch (error) {
            progressDiv.style.display = 'none';
            resultDiv.style.display = 'block';
            resultDiv.className = 'import-result error';
            resultDiv.innerHTML = `
                <i class="fas fa-times-circle"></i>
                <strong>Upload Failed</strong>
                <p>${error.message || 'Could not upload the file. Please try again.'}</p>
            `;
            App.showToast('error', 'Import Failed', error.message);
        }
    },

    // ---- Manual Form ----
    setupManualForm() {
        const form = document.getElementById('manualForm');

        form.addEventListener('submit', async (e) => {
            e.preventDefault();

            const data = {
                name: document.getElementById('manualName').value.trim(),
                college_id: document.getElementById('manualCollegeId').value.trim(),
                email: document.getElementById('manualEmail').value.trim().toLowerCase(),
                phone: document.getElementById('manualPhone').value.trim(),
                year: document.getElementById('manualYear').value.trim(),
                branch: document.getElementById('manualBranch').value.trim()
            };

            if (!data.name || !data.college_id || !data.email) {
                App.showToast('warning', 'Missing Fields', 'Name, College ID, and Email are required');
                return;
            }

            try {
                const response = await API.addParticipant(data);
                
                if (response.success) {
                    App.showToast('success', 'Participant Added', `${data.name} has been registered`);
                    form.reset();
                } else {
                    App.showToast('error', 'Failed', response.message);
                }
            } catch (error) {
                App.showToast('error', 'Error', error.message || 'Failed to add participant');
            }
        });
    },

    // ---- Danger Zone ----
    setupDangerZone() {
        document.getElementById('resetAttendanceBtn').addEventListener('click', () => {
            App.showModal(
                'Reset All Attendance',
                `<p>This will reset the attendance status of <strong>all participants</strong> back to "Absent".</p>
                 <p style="margin-top: 8px; color: var(--danger-600); font-weight: 600;">This action cannot be undone.</p>`,
                async () => {
                    try {
                        await API.resetAttendance();
                        App.showToast('success', 'Attendance Reset', 'All attendance records have been cleared');
                    } catch (error) {
                        App.showToast('error', 'Error', 'Failed to reset attendance');
                    }
                },
                'Reset Attendance'
            );
        });

        document.getElementById('clearAllBtn').addEventListener('click', () => {
            App.showModal(
                'Delete All Participants',
                `<p>This will <strong>permanently delete all participants</strong> and their attendance records.</p>
                 <p style="margin-top: 8px; color: var(--danger-600); font-weight: 600;">This action is irreversible!</p>`,
                async () => {
                    try {
                        await API.clearAllParticipants();
                        App.showToast('success', 'All Data Cleared', 'All participant data has been deleted');
                    } catch (error) {
                        App.showToast('error', 'Error', 'Failed to clear data');
                    }
                },
                'Delete Everything'
            );
        });
    }
};