class AttendanceTracker {
    constructor() {
        this.appwrite = null;
        this.databases = null;
        this.account = null;
        this.user = null;
        this.subjects = [];
        this.attendanceRecords = [];
        this.requiredPercentage = 75;
        this.signupStep = 1; // 1 = email/password, 2 = name
        
        // Hardcoded Appwrite configuration
        this.config = {
            projectId: 'courseflow',
            databaseId: 'attendance-db',
            endpoint: 'https://fra.cloud.appwrite.io/v1'
        };
        
        this.init();
    }

    async init() {
        // Initialize Appwrite with hardcoded config
        this.initializeAppwrite(this.config);

        // Check if user is logged in
        try {
            this.user = await this.account.get();
            console.log('User logged in:', this.user.name);
            document.getElementById('userName').textContent = this.user.name || this.user.email;
            await this.loadData();
        } catch (error) {
            console.log('User not logged in');
            this.showLandingPage();
        }
    }

    initializeAppwrite(config) {
        this.appwrite = new Appwrite.Client()
            .setEndpoint(config.endpoint)
            .setProject(config.projectId);

        this.databases = new Appwrite.Databases(this.appwrite);
        this.account = new Appwrite.Account(this.appwrite);
        this.databaseId = config.databaseId;
    }

    showLandingPage() {
        document.getElementById('landingPage').style.display = 'block';
        this.hideOtherSections(['landingPage']);
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
        document.getElementById('appHeader').style.display = 'block';
        document.getElementById('statsSection').style.display = 'block';
        document.getElementById('mainContent').style.display = 'block';
        this.hideOtherSections(['mainContent']);
    }

    showError(message) {
        document.querySelector('#errorSection .error-text').textContent = message;
        document.getElementById('errorSection').style.display = 'block';
        this.hideOtherSections(['errorSection']);
    }

    hideOtherSections(except = []) {
        const sections = ['landingPage', 'subjectSetupSection', 'loadingSection', 'errorSection', 'mainContent'];
        sections.forEach(section => {
            if (!except.includes(section)) {
                document.getElementById(section).style.display = 'none';
            }
        });
        
        // Also hide app header and stats unless we're showing main content
        if (!except.includes('mainContent')) {
            document.getElementById('appHeader').style.display = 'none';
            document.getElementById('statsSection').style.display = 'none';
        }
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
        
        alert.innerHTML = `
            <div class="alert-text">${message}</div>
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
                            Present
                        </button>
                        <button class="btn btn-destructive" onclick="tracker.markAttendance('${subject.$id}', false)">
                            Absent
                        </button>
                        <button class="btn btn-ghost" onclick="tracker.undoLastEntry('${subject.$id}')">
                            Undo
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
                    <div class="alert-text">
                        <strong>Critical:</strong> Your attendance is below 65%. You need to attend ${stats.mustAttend} more classes to reach 75%.
                    </div>
                </div>
            `;
        } else if (stats.overallPercentage < 75) {
            warningDiv.innerHTML = `
                <div class="alert alert-warning">
                    <div class="alert-text">
                        <strong>Warning:</strong> You need to attend ${stats.mustAttend} more classes to reach the 75% requirement.
                    </div>
                </div>
            `;
        } else {
            warningDiv.innerHTML = `
                <div class="alert alert-success">
                    <div class="alert-text">
                        <strong>Great job!</strong> You're meeting the attendance requirement. You can safely miss ${stats.safeToMiss} more classes.
                    </div>
                </div>
            `;
        }
    }
}

// Global functions for UI interactions
function showLoginForm() {
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('signupForm').style.display = 'none';
    tracker.signupStep = 1;
}

function showSignupForm() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('signupForm').style.display = 'block';
    document.getElementById('nameField').style.display = 'none';
    tracker.signupStep = 1;
    
    // Clear signup form
    document.getElementById('signupEmail').value = '';
    document.getElementById('signupPassword').value = '';
    document.getElementById('signupName').value = '';
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
    if (tracker.signupStep === 1) {
        // First step: validate email and password
        const email = document.getElementById('signupEmail').value.trim();
        const password = document.getElementById('signupPassword').value;

        if (!email || !password) {
            alert('Please fill in all fields');
            return;
        }

        if (password.length < 8) {
            alert('Password must be at least 8 characters long');
            return;
        }

        // Show name field and proceed to step 2
        document.getElementById('nameField').style.display = 'block';
        tracker.signupStep = 2;
        document.getElementById('signupName').focus();
        return;
    }

    if (tracker.signupStep === 2) {
        // Second step: validate name and create account
        const email = document.getElementById('signupEmail').value.trim();
        const password = document.getElementById('signupPassword').value;
        const name = document.getElementById('signupName').value.trim();

        if (!name) {
            alert('Please enter your name');
            return;
        }

        try {
            await tracker.account.create(Appwrite.ID.unique(), email, password, name);
            await tracker.account.createEmailPasswordSession(email, password);
            location.reload();
        } catch (error) {
            alert('Signup failed: ' + error.message);
            // Reset to step 1 on error
            tracker.signupStep = 1;
            document.getElementById('nameField').style.display = 'none';
        }
    }
}

async function logoutUser() {
    try {
        // Delete current session
        await tracker.account.deleteSession('current');
        
        // Clear any stored data
        tracker.user = null;
        tracker.subjects = [];
        tracker.attendanceRecords = [];
        
        // Reload the page to show landing page
        location.reload();
    } catch (error) {
        console.error('Logout error:', error);
        // Force reload anyway in case of error
        tracker.user = null;
        location.reload();
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
    
    // Enter key support for forms
    if (e.key === 'Enter') {
        const activeElement = document.activeElement;
        
        // Login form
        if (activeElement.closest('#loginForm')) {
            e.preventDefault();
            loginUser();
        }
        
        // Signup form
        if (activeElement.closest('#signupForm')) {
            e.preventDefault();
            signupUser();
        }
    }
});