/**
 * API Module - Handles all HTTP requests to the backend
 */
const API = {
    BASE_URL: '/api',

    async request(endpoint, options = {}) {
        try {
            const response = await fetch(`${this.BASE_URL}${endpoint}`, {
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers
                },
                ...options
            });
            
            const data = await response.json();
            
            if (!response.ok) {
                throw new Error(data.message || 'Request failed');
            }
            
            return data;
        } catch (error) {
            console.error(`API Error [${endpoint}]:`, error);
            throw error;
        }
    },

    // Participants
    async getParticipants(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        return this.request(`/participants?${queryString}`);
    },

    async addParticipant(data) {
        return this.request('/participants', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    },

    async deleteParticipant(id) {
        return this.request(`/participants/${id}`, {
            method: 'DELETE'
        });
    },

    async clearAllParticipants() {
        return this.request('/participants', {
            method: 'DELETE'
        });
    },

    async importCSV(file) {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${this.BASE_URL}/participants/import`, {
            method: 'POST',
            body: formData
        });

        return response.json();
    },

    async getDashboardStats() {
        return this.request('/participants/stats/dashboard');
    },

    // Attendance
    async verifyParticipant(query) {
        return this.request('/attendance/verify', {
            method: 'POST',
            body: JSON.stringify({ query })
        });
    },

    async markAttendance(id, status) {
        return this.request(`/attendance/mark/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ status })
        });
    },

    async resetAttendance() {
        return this.request('/attendance/reset', {
            method: 'PUT'
        });
    },

    getExportUrl() {
        return `${this.BASE_URL}/attendance/export`;
    }
};