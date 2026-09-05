/**
 * Dashboard Module
 * Handles statistics display and chart rendering
 */
const Dashboard = {
    async load() {
        try {
            const response = await API.getDashboardStats();
            if (response.success) {
                this.render(response.data);
            }
        } catch (error) {
            App.showToast('error', 'Dashboard Error', 'Could not load dashboard data');
        }

        // Refresh button
        document.getElementById('refreshDashboard').onclick = () => this.load();
    },

    render(data) {
        // Animate stat counters
        this.animateCounter('statTotal', data.total);
        this.animateCounter('statPresent', data.present);
        this.animateCounter('statAbsent', data.absent);
        document.getElementById('statPercentage').textContent = `${data.percentage}%`;

        // Donut chart
        this.renderDonutChart(data.present, data.absent, data.percentage);

        // Year-wise chart
        this.renderBarChart('yearChart', data.yearWise, 'Year');

        // Branch-wise chart
        this.renderBarChart('branchChart', data.branchWise, 'Branch');

        // Recent check-ins
        this.renderRecentActivity(data.recentAttendance);
    },

    animateCounter(elementId, target) {
        const el = document.getElementById(elementId);
        const current = parseInt(el.textContent) || 0;
        const diff = target - current;
        const duration = 600;
        const steps = 30;
        const stepValue = diff / steps;
        let step = 0;

        const interval = setInterval(() => {
            step++;
            const value = Math.round(current + stepValue * step);
            el.textContent = value;
            if (step >= steps) {
                el.textContent = target;
                clearInterval(interval);
            }
        }, duration / steps);
    },

    renderDonutChart(present, absent, percentage) {
        const canvas = document.getElementById('attendanceDonut');
        const ctx = canvas.getContext('2d');
        const total = present + absent;

        // Set canvas size
        canvas.width = 180;
        canvas.height = 180;

        const centerX = 90;
        const centerY = 90;
        const radius = 72;
        const lineWidth = 22;

        ctx.clearRect(0, 0, 180, 180);

        if (total === 0) {
            // Draw empty circle
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
            ctx.strokeStyle = '#e2e8f0';
            ctx.lineWidth = lineWidth;
            ctx.stroke();
        } else {
            const presentAngle = (present / total) * Math.PI * 2;
            const startAngle = -Math.PI / 2;

            // Absent arc
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius, startAngle + presentAngle, startAngle + Math.PI * 2);
            ctx.strokeStyle = '#fda4af';
            ctx.lineWidth = lineWidth;
            ctx.lineCap = 'round';
            ctx.stroke();

            // Present arc
            if (present > 0) {
                ctx.beginPath();
                ctx.arc(centerX, centerY, radius, startAngle, startAngle + presentAngle);
                ctx.strokeStyle = '#34d399';
                ctx.lineWidth = lineWidth;
                ctx.lineCap = 'round';
                ctx.stroke();
            }
        }

        // Center text
        document.getElementById('donutCenter').textContent = `${percentage}%`;

        // Legend
        document.getElementById('donutLegend').innerHTML = `
            <div class="chart-legend-item">
                <div class="legend-dot" style="background: #34d399;"></div>
                Present (${present})
            </div>
            <div class="chart-legend-item">
                <div class="legend-dot" style="background: #fda4af;"></div>
                Absent (${absent})
            </div>
        `;
    },

    renderBarChart(containerId, data, type) {
        const container = document.getElementById(containerId);
        
        if (!data || data.length === 0) {
            container.innerHTML = '<p class="empty-state">No data available</p>';
            return;
        }

        const maxTotal = Math.max(...data.map(d => d.total), 1);

        container.innerHTML = data.map(item => {
            const presentPercent = item.total > 0 ? Math.round((item.present / item.total) * 100) : 0;
            const barWidth = Math.max((item.total / maxTotal) * 100, 5);
            const label = type === 'Year' ? item.year : item.branch;

            return `
                <div class="bar-row">
                    <span class="bar-label" title="${label}">${label}</span>
                    <div class="bar-track">
                        <div class="bar-fill present" style="width: ${barWidth * (presentPercent / 100)}%">
                            ${presentPercent > 15 ? `${item.present}/${item.total}` : ''}
                        </div>
                    </div>
                    <span class="bar-stats">${presentPercent}%</span>
                </div>
            `;
        }).join('');

        // Animate bars
        setTimeout(() => {
            container.querySelectorAll('.bar-fill').forEach(bar => {
                bar.style.width = bar.style.width; // Trigger reflow for animation
            });
        }, 100);
    },

    renderRecentActivity(recentData) {
        const container = document.getElementById('recentList');

        if (!recentData || recentData.length === 0) {
            container.innerHTML = '<p class="empty-state">No recent check-ins yet</p>';
            return;
        }

        container.innerHTML = recentData.map(item => {
            const initials = item.name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
            const time = item.marked_at ? this.formatTime(item.marked_at) : 'N/A';

            return `
                <div class="recent-item">
                    <div class="recent-avatar">${initials}</div>
                    <div class="recent-info">
                        <div class="recent-name">${item.name}</div>
                        <div class="recent-id">${item.college_id}</div>
                    </div>
                    <span class="recent-time">${time}</span>
                </div>
            `;
        }).join('');
    },

    formatTime(dateStr) {
        const date = new Date(dateStr);
        const now = new Date();
        const diff = now - date;

        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        
        return date.toLocaleDateString('en-IN', { 
            day: 'numeric', 
            month: 'short',
            hour: '2-digit',
            minute: '2-digit'
        });
    }
};