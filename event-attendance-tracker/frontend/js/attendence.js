/**
 * Attendance Module
 * Handles participant verification and attendance marking at the event entrance
 */
const Attendance = {
    init() {
        this.setupEventListeners();
        // Clear previous results
        document.getElementById('attendanceResult').style.display = 'none';
        document.getElementById('attendanceMultiple').style.display = 'none';
    },

    setupEventListeners() {
        const searchInput = document.getElementById('attendanceSearch');
        const verifyBtn = document.getElementById('verifyBtn');

        verifyBtn.onclick = () => this.verify();
        
        searchInput.onkeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.verify();
            }
        };

        // Focus the input
        setTimeout(() => searchInput.focus(), 100);
    },

    async verify() {
        const query = document.getElementById('attendanceSearch').value.trim();
        
        if (!query) {
            App.showToast('warning', 'Empty Search', 'Please enter a name, email, college ID, or phone number');
            return;
        }

        const resultDiv = document.getElementById('attendanceResult');
        const multipleDiv = document.getElementById('attendanceMultiple');

        try {
            const response = await API.verifyParticipant(query);

            if (!response.found) {
                // Not found
                resultDiv.style.display = 'block';
                multipleDiv.style.display = 'none';
                resultDiv.innerHTML = this.renderNotFound(query);
            } else if (response.multiple) {
                // Multiple matches
                resultDiv.style.display = 'none';
                multipleDiv.style.display = 'block';
                multipleDiv.innerHTML = this.renderMultipleResults(response.data);
            } else {
                // Single match
                resultDiv.style.display = 'block';
                multipleDiv.style.display = 'none';
                resultDiv.innerHTML = this.renderParticipant(response.data);
            }
        } catch (error) {
            App.showToast('error', 'Error', 'Failed to verify participant');
        }
    },

    renderNotFound(query) {
        return `
            <div class="result-card">
                <div class="result-header not-found">
                    <i class="fas fa-exclamation-circle"></i>
                    Participant Not Found
                </div>
                <div class="not-found-body">
                    <i class="fas fa-user-slash"></i>
                    <h4>No registered participant found</h4>
                    <p>No one matching "<strong>${this.escapeHtml(query)}</strong>" was found in the registration list. 
                    Please verify the details and try again, or check if the student has registered for this event.</p>
                </div>
            </div>
        `;
    },

    renderParticipant(participant) {
        const isPresent = participant.attendance_status === 'present';
        const headerClass = isPresent ? 'already-present' : 'found';
        const headerText = isPresent ? '✓ Already Marked Present' : '✓ Registered Participant Found';
        const headerIcon = isPresent ? 'fas fa-check-double' : 'fas fa-check-circle';

        return `
            <div class="result-card">
                <div class="result-header ${headerClass}">
                    <i class="${headerIcon}"></i>
                    ${headerText}
                </div>
                <div class="result-body">
                    <div class="participant-details">
                        <div class="detail-item">
                            <span class="detail-label">Full Name</span>
                            <span class="detail-value">${this.escapeHtml(participant.name)}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">College ID</span>
                            <span class="detail-value">${this.escapeHtml(participant.college_id)}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Email</span>
                            <span class="detail-value">${this.escapeHtml(participant.email)}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Phone</span>
                            <span class="detail-value">${participant.phone || '—'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Year</span>
                            <span class="detail-value">${participant.year || '—'}</span>
                        </div>
                        <div class="detail-item">
                            <span class="detail-label">Branch</span>
                            <span class="detail-value">${participant.branch || '—'}</span>
                        </div>
                        <div class="detail-item" style="grid-column: 1 / -1;">
                            <span class="detail-label">Attendance Status</span>
                            <span class="detail-value status-text">
                                <span class="status-badge ${participant.attendance_status}">
                                    ${isPresent ? 'Present' : 'Not Yet Marked'}
                                </span>
                                ${isPresent && participant.marked_at ? `<span style="font-size: 0.8rem; color: var(--gray-400); font-weight: 400;">&nbsp;• Marked at ${new Date(participant.marked_at).toLocaleString()}</span>` : ''}
                            </span>
                        </div>
                    </div>
                    <div class="result-actions">
                        ${isPresent 
                            ? `<button class="btn btn-warning" onclick="Attendance.markAttendance(${participant.id}, 'absent')">
                                <i class="fas fa-undo"></i> Unmark Attendance
                               </button>`
                            : `<button class="btn btn-success" onclick="Attendance.markAttendance(${participant.id}, 'present')">
                                <i class="fas fa-check-circle"></i> Mark as Present
                               </button>`
                        }
                    </div>
                </div>
            </div>
        `;
    },

    renderMultipleResults(participants) {
        return `
            <div class="multiple-card">
                <div class="multiple-header">
                    <i class="fas fa-users"></i>
                    Multiple Matches Found (${participants.length})  — Please select one
                </div>
                <div class="multiple-list">
                    ${participants.map(p => `
                        <div class="multiple-item" onclick="Attendance.selectParticipant(${p.id})">
                            <div class="multiple-item-info">
                                <div class="multiple-item-name">${this.escapeHtml(p.name)}</div>
                                <div class="multiple-item-detail">${p.college_id} • ${p.email} ${p.year ? '• ' + p.year : ''}</div>
                            </div>
                            <span class="status-badge ${p.attendance_status}">${p.attendance_status === 'present' ? 'Present' : 'Absent'}</span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    },

    async selectParticipant(id) {
        try {
            const response = await API.request(`/participants/${id}`);
            if (response.success) {
                const resultDiv = document.getElementById('attendanceResult');
                const multipleDiv = document.getElementById('attendanceMultiple');
                
                resultDiv.style.display = 'block';
                multipleDiv.style.display = 'none';
                resultDiv.innerHTML = this.renderParticipant(response.data);
            }
        } catch (error) {
            App.showToast('error', 'Error', 'Failed to load participant details');
        }
    },

    async markAttendance(id, status) {
        try {
            const response = await API.markAttendance(id, status);
            
            if (response.success) {
                const statusText = status === 'present' ? 'marked as Present' : 'unmarked';
                App.showToast('success', 'Attendance Updated', `${response.data.name} ${statusText}`);
                
                // Re-render the result with updated data
                const resultDiv = document.getElementById('attendanceResult');
                resultDiv.innerHTML = this.renderParticipant(response.data);

                // Clear search and refocus for next student
                if (status === 'present') {
                    setTimeout(() => {
                        document.getElementById('attendanceSearch').value = '';
                        document.getElementById('attendanceSearch').focus();
                    }, 1500);
                }
            }
        } catch (error) {
            App.showToast('error', 'Error', 'Failed to update attendance');
        }
    },

    escapeHtml(str) {
        if (!str) return '';
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }
};