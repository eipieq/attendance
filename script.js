class AttendanceTracker {
    constructor() {
        this.appwrite = null;
        this.databases = null;
        this.account = null;
        this.user = null;
        this.subjects = [];
        this.attendanceRecords = [];
        this.requiredPercentage = 75;
        
        this.init();
    }

    async init() {
        // Check if Appwrite config exists
        const config = this.getAppwriteConfig();
        if (!config) {
            this.showSetupSection();
            return;
        }

        // Initialize Appwrite
        this.initializeAppwrite(config);

        // Check if user is logged in
        try {
            this.user = await this.account.get();
            console.log('User logged in:', this.user.name);
            await this.loadData();
        } catch (error) {
            console.log('User not logged in');
            this.showLoginSection();
        }
    }

    getAppwriteConfig() {
        const projectId = localStorage.getItem('appwrite_project_id');
        const databaseId = localStorage.getItem('appwrite_database_id');
        const endpoint = localStorage.getItem('appwrite_endpoint');
        
        if (projectId && databaseId && endpoint) {
            return { projectId, databaseId, endpoint };
        }
        return null;
    }

    initializeAppwrite(config) {
        this.appwrite = new Appwrite.Client()
            .setEndpoint(config.endpoint)
            .setProject(config.projectId);

        this.databases = new Appwrite.Databases(this.appwrite);
        this.account = new Appwrite.Account(this.appwrite);
        this.databaseId = config.databaseId;
    }

    showSetupSection() {
        document.getElementById('setupSection').style.display = 'block';
        this.hideOtherSections(['setupSection']);
    }

    showLoginSection() {
        document.getElementById('loginSection').style.display = 'block';
        this.hideOtherSections(['loginSection']);
    }

    showSubjectSetupSection() {
        document.getElementById('subjectSetupSection').style.display = 'block';
        this.hideOtherSections(['subjectSetupSection']);
    }

    showLoadingSection() {
        document.getElementById('loadingSection').style.display = 'block';
        this.hideOtherSections(['loadingSection']);
    }

    showMainContent() {
        document.getElementById('mainContent').style.display = 'block';
        this.hideOtherSections(['mainContent']);
    }

    showError(message) {
        document.querySelector('#errorSection .error-text').textContent = message;
        document.getElementById('errorSection').style.display = 'block';
        this.hideOtherSections(['errorSection']);
    }

    hideOtherSections(except = []) {
        const sections = ['setupSection', 'loginSection', 'subjectSetupSection', 'loadingSection', 'errorSection', 'mainContent'];
        sections.forEach(section => {
            if (!except.includes(section)) {
                document.getElementById(section).style.display = 'none';
            }
        });
    }

    async loadData() {
        try {
            this.showLoadingSection();
            
            // Load subjects
            const subjectsResponse = await this.databases.listDocuments(
                this.databaseId,
                'subjects',
                [
                    Appwrite.Query.equal('user_id', this.user.$id),
                    Appwrite.Query.equal('semester', 'Spring 2025')
                ]
            );

            if (subjectsResponse.documents.length === 0) {
                this.showSubjectSetupSection();
                return;
            }

            this.subjects = subjectsResponse.documents;

            // Load attendance records
            const recordsResponse = await this.databases.listDocuments(
                this.databaseId,
                'attendance_records',
                [Appwrite.Query.equal('user_id', this.user.$id)]
            );

            this.attendanceRecords = recordsResponse.documents;
            
            this.showMainContent();
            this.render();
        } catch (error) {
            console.error('Error loading data:', error);
            this.showError('Failed to load data: ' + error.message);
        }
    }

    async markAttendance(subjectId, isPresent) {
        try {
            const status = isPresent ? 'present' : 'absent';
            const now = new Date().toISOString();

            await this.databases.createDocument(
                this.databaseId,
                'attendance_records',
                Appwrite.ID.unique(),
                {
                    user_id: this.user.$id,
                    subject_id: subjectId,
                    date: now,
                    status: status,
                    notes: '',
                    created_at: now
                }
            );

            // Reload data
            await this.loadData();
        } catch (error) {
            console.error('Error marking attendance:', error);
            this.showAlert('Failed to mark attendance: ' + error.message, 'destructive');
        }
    }

    async undoLastEntry(subjectId) {
        try {
            // Find the most recent record for this subject
            const records = this.attendanceRecords
                .filter(record => record.subject_id === subjectId)
                .sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

            if (records.length === 0) {
                this.showAlert('No records to undo for this subject', 'warning');
                return;
            }

            const lastRecord = records[0];
            await this.databases.deleteDocument(
                this.databaseId,
                'attendance_records',
                lastRecord.$id
            );

            // Reload data
            await this.loadData();
        } catch (error) {
            console.error('Error undoing entry:', error);
            this.showAlert('Failed to undo entry: ' + error.message, 'destructive');
        }
    }

    getSubjectAttendance(subjectId) {
        const records = this.attendanceRecords.filter(record => record.subject_id === subjectId);
        const presentCount = records.filter(record => record.status === 'present').length;
        const totalCount = records.length;
        
        return {
            present: presentCount,
            absent: totalCount - presentCount,
            total: totalCount,
            percentage: totalCount > 0 ? (presentCount / totalCount) * 100 : 0
        };
    }

    getOverallStats() {
        let totalClasses = 0;
        let totalAttended = 0;
        let totalConducted = 0;

        this.subjects.forEach(subject => {
            const attendance = this.getSubjectAttendance(subject.$id);
            totalClasses += subject.total_classes;
            totalAttended += attendance.present;
            totalConducted += attendance.total;
        });

        const overallPercentage = totalConducted > 0 ? (totalAttended / totalConducted) * 100 : 0;
        const classesNeededFor75 = Math.ceil(totalConducted * 0.75);
        const safeToMiss = Math.max(0, totalAttended - classesNeededFor75);
        const mustAttend = Math.max(0, classesNeededFor75 - totalAttended);

        return {
            totalClasses,
            totalAttended,
            totalConducted,
            overallPercentage,
            safeToMiss,
            mustAttend
        };
    }

    getAttendanceStatus(percentage) {
        if (percentage >= 75) return 'success';
        if (percentage >= 65) return 'warning';
        return 'destructive';
    }

    showAlert(message, type = 'warning') {
        // Remove existing alerts
        const existingAlerts = document.querySelectorAll('.alert');
        existingAlerts.forEach(alert => alert.remove());

        // Create new alert
        const alert = document.createElement('div');
        alert.className = `alert alert-${type}`;
        
        const iconMap = {
            success: 'ph-check-circle',
            warning: 'ph-warning',
            destructive: 'ph-x-circle'
        };

        alert.innerHTML = `
            <div class="alert-content">
                <i class="ph ${iconMap[type]} alert-icon"></i>
                <div class="alert-text">${message}</div>
            </div>
        `;

        // Add to the main content or current visible section
        const visibleSection = document.querySelector('[style*="display: block"]') || document.getElementById('mainContent');
        if (visibleSection) {
            visibleSection.appendChild(alert);
        }

        // Auto remove after 5 seconds
        setTimeout(() => {
            if (alert.parentNode) {
                alert.remove();
            }
        }, 5000);
    }

    render() {
        this.renderSubjects();
        this.renderSummary();
    }

    renderSubjects() {
        const grid = document.getElementById('subjectsGrid');
        grid.innerHTML = '';

        this.subjects.forEach((subject) => {
            const attendance = this.getSubjectAttendance(subject.$id);
            const remaining = subject.total_classes - attendance.total;
            const status = this.getAttendanceStatus(attendance.percentage);

            const card = document.createElement('div');
            card.className = 'subject-card';
            card.innerHTML = `
                <div class="subject-header">
                    <div class="subject-name">${subject.name}</div>
                    <div class="subject-stats">
                        <span>Total: ${subject.total_classes}</span>
                        <span>Remaining: ${remaining}</span>
                    </div>
                </div>
                <div class="subject-body">
                    <div class="progress-container">
                        <div class="progress-label">
                            <span>Attendance</span>
                            <span class="progress-percentage">${attendance.percentage.toFixed(1)}%</span>
                        </div>
                        <div class="progress-bar">
                            <div class="progress-fill ${status}" style="width: ${attendance.percentage}%"></div>
                        </div>
                    </div>
                    <div class="subject-details">
                        <div class="detail-item">
                            <div class="detail-value">${attendance.present}</div>
                            <div class="detail-label">Present</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-value">${attendance.absent}</div>
                            <div class="detail-label">Absent</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-value">${attendance.total}</div>
                            <div class="detail-label">Conducted</div>
                        </div>
                        <div class="detail-item">
                            <div class="detail-value">${remaining}</div>
                            <div class="detail-label">Remaining</div>
                        </div>
                    </div>
                    <div class="action-buttons">
                        <button class="btn btn-success" onclick="tracker.markAttendance('${subject.$id}', true)">
                            <i class="ph ph-check"></i>
                            Present
                        </button>
                        <button class="btn btn-destructive" onclick="tracker.markAttendance('${subject.$id}', false)">
                            <i class="ph ph-x"></i>
                            Absent
                        </button>
                        <button class="btn btn-ghost" onclick="tracker.undoLastEntry('${subject.$id}')">
                            <i class="ph ph-arrow-counter-clockwise"></i>
                        </button>
                    </div>
                </div>
            `;
            grid.appendChild(card);
        });
    }

    renderSummary() {
        const stats = this.getOverallStats();
        
        document.getElementById('totalClasses').textContent = stats.totalClasses;
        document.getElementById('totalAttended').textContent = stats.totalAttended;
        document.getElementById('overallPercentage').textContent = stats.overallPercentage.toFixed(1) + '%';
        document.getElementById('safeToMiss').textContent = stats.safeToMiss;
        document.getElementById('mustAttend').textContent = stats.mustAttend;
        
        const daysToTarget = Math.max(0, Math.ceil(stats.mustAttend / 4));
        document.getElementById('daysToTarget').textContent = daysToTarget;

        // Update warning message
        const warningDiv = document.getElementById('warningMessage');
        warningDiv.innerHTML = '';

        if (stats.overallPercentage < 65) {
            warningDiv.innerHTML = `
                <div class="alert alert-destructive">
                    <div class="alert-content">
                        <i class="ph ph-warning-circle alert-icon"></i>
                        <div class="alert-text">
                            <strong>Critical:</strong> Your attendance is below 65%. You need to attend ${stats.mustAttend} more classes to reach 75%.
                        </div>
                    </div>
                </div>
            `;
        } else if (stats.overallPercentage < 75) {
            warningDiv.innerHTML = `
                <div class="alert alert-warning">
                    <div class="alert-content">
                        <i class="ph ph-warning alert-icon"></i>
                        <div class="alert-text">
                            <strong>Warning:</strong> You need to attend ${stats.mustAttend} more classes to reach the 75% requirement.
                        </div>
                    </div>
                </div>
            `;
        } else {
            warningDiv.innerHTML = `
                <div class="alert alert-success">
                    <div class="alert-content">
                        <i class="ph ph-check-circle alert-icon"></i>
                        <div class="alert-text">
                            <strong>Great job!</strong> You're meeting the attendance requirement. You can safely miss ${stats.safeToMiss} more classes.
                        </div>
                    </div>
                </div>
            `;
        }
    }
}

// Global functions for UI interactions
function saveAppwriteConfig() {
    const projectId = document.getElementById('projectId').value.trim();
    const databaseId = document.getElementById('databaseId').value.trim();
    const endpoint = document.getElementById('endpoint').value.trim();

    if (!projectId || !databaseId || !endpoint) {
        alert('Please fill in all fields');
        return;
    }

    localStorage.setItem('appwrite_project_id', projectId);
    localStorage.setItem('appwrite_database_id', databaseId);
    localStorage.setItem('appwrite_endpoint', endpoint);

    // Restart the app
    location.reload();
}

async function loginUser() {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!email || !password) {
        alert('Please fill in all fields');
        return;
    }

    try {
        await tracker.account.createEmailPasswordSession(email, password);
        location.reload();
    } catch (error) {
        alert('Login failed: ' + error.message);
    }
}

async function signupUser() {
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    if (!email || !password) {
        alert('Please fill in all fields');
        return;
    }

    if (password.length < 8) {
        alert('Password must be at least 8 characters long');
        return;
    }

    try {
        await tracker.account.create(Appwrite.ID.unique(), email, password);
        await tracker.account.createEmailPasswordSession(email, password);
        location.reload();
    } catch (error) {
        alert('Signup failed: ' + error.message);
    }
}

async function setupSubjects() {
    const defaultSubjects = [
        { name: 'Linear Algebra', total_classes: 30 },
        { name: 'Statistics', total_classes: 30 },
        { name: 'Microeconomics', total_classes: 30 },
        { name: 'International Finance', total_classes: 30 },
        { name: 'Excel', total_classes: 20 }
    ];

    try {
        const now = new Date().toISOString();
        
        for (const subject of defaultSubjects) {
            await tracker.databases.createDocument(
                tracker.databaseId,
                'subjects',
                Appwrite.ID.unique(),
                {
                    user_id: tracker.user.$id,
                    name: subject.name,
                    total_classes: subject.total_classes,
                    semester: 'Spring 2025',
                    created_at: now,
                    updated_at: now
                }
            );
        }

        tracker.showAlert('Subjects created successfully!', 'success');
        setTimeout(() => {
            tracker.loadData();
        }, 1500);
    } catch (error) {
        tracker.showAlert('Failed to create subjects: ' + error.message, 'destructive');
    }
}

// Initialize the tracker when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.tracker = new AttendanceTracker();
});

// Add keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'r') {
        e.preventDefault();
        location.reload();
    }
});