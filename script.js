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
        this.selectedSubjects = []; // Store selected subjects during setup
        
        // Default subjects available for selection (based on MSE B.A. Economics curriculum)
        this.defaultSubjects = [
            // Core Economics Courses
            { name: 'Principles of Microeconomics', classes: 30, category: 'Core Economics' },
            { name: 'Principles of Macroeconomics', classes: 30, category: 'Core Economics' },
            { name: 'Intermediate Microeconomics', classes: 30, category: 'Core Economics' },
            { name: 'Intermediate Macroeconomics', classes: 30, category: 'Core Economics' },
            { name: 'Public Economics', classes: 30, category: 'Core Economics' },
            { name: 'Development Economics', classes: 30, category: 'Core Economics' },
            { name: 'International Trade', classes: 30, category: 'Core Economics' },
            { name: 'Indian Economy', classes: 30, category: 'Core Economics' },
            
            // Mathematics & Statistics
            { name: 'Mathematical Methods for Economics I', classes: 30, category: 'Mathematics' },
            { name: 'Mathematical Methods for Economics II', classes: 30, category: 'Mathematics' },
            { name: 'Statistics for Economics', classes: 30, category: 'Mathematics' },
            { name: 'Introductory Econometrics', classes: 30, category: 'Mathematics' },
            { name: 'Applied Econometrics', classes: 30, category: 'Mathematics' },
            { name: 'Linear Algebra', classes: 30, category: 'Mathematics' },
            { name: 'Real Analysis', classes: 30, category: 'Mathematics' },
            { name: 'Abstract Algebra', classes: 30, category: 'Mathematics' },
            { name: 'Differential Equations', classes: 30, category: 'Mathematics' },
            { name: 'Operations Research', classes: 30, category: 'Mathematics' },
            { name: 'Probability Theory', classes: 30, category: 'Mathematics' },
            { name: 'Stochastic Calculus', classes: 30, category: 'Mathematics' },
            
            // Finance & Banking
            { name: 'Money and Banking', classes: 30, category: 'Finance' },
            { name: 'Financial Economics', classes: 30, category: 'Finance' },
            { name: 'International Finance', classes: 30, category: 'Finance' },
            { name: 'Risk Management', classes: 30, category: 'Finance' },
            
            // Technology & Programming
            { name: 'Decision Support System', classes: 25, category: 'Technology' },
            { name: 'Introduction to R/Matlab/Python', classes: 25, category: 'Technology' },
            { name: 'Introduction to Computer Programming', classes: 30, category: 'Technology' },
            { name: 'Introduction to Machine Learning', classes: 30, category: 'Technology' },
            { name: 'Introduction to Data Science', classes: 30, category: 'Technology' },
            { name: 'Introduction to Business Analytics', classes: 30, category: 'Technology' },
            
            // Advanced Economics Electives
            { name: 'Advanced Macroeconomics', classes: 30, category: 'Advanced Economics' },
            { name: 'Introduction to Game Theory', classes: 30, category: 'Advanced Economics' },
            { name: 'Issues in Development Economics', classes: 30, category: 'Advanced Economics' },
            { name: 'Energy Economics', classes: 30, category: 'Advanced Economics' },
            { name: 'Environmental Economics', classes: 30, category: 'Advanced Economics' },
            { name: 'Introduction to Behavioural Economics', classes: 30, category: 'Advanced Economics' },
            { name: 'History of Economic Thought', classes: 30, category: 'Advanced Economics' },
            { name: 'Economics of Climate Change and Development', classes: 30, category: 'Advanced Economics' },
            { name: 'Optimization in Economic Theory', classes: 30, category: 'Advanced Economics' },
            
            // Time Series & Econometrics
            { name: 'Introduction to Time Series Analysis', classes: 30, category: 'Econometrics' },
            { name: 'Stochastic Process', classes: 30, category: 'Econometrics' },
            { name: 'Introduction to Non-Linear Time Series Econometrics', classes: 30, category: 'Econometrics' },
            
            // Language & Communication
            { name: 'English (Communication)', classes: 25, category: 'Language' },
            { name: 'Environmental Studies/Science', classes: 25, category: 'Language' },
            
            // Philosophy & General Studies
            { name: 'History of Western Philosophy', classes: 30, category: 'Philosophy' },
            { name: 'Logic and Philosophical Inquiry', classes: 30, category: 'Philosophy' }
        ];
        
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
        document.getElementById('landingPage').style.display = 'flex';
        this.hideOtherSections(['landingPage']);
    }

    showSubjectSetupSection() {
        document.getElementById('subjectSetupSection').style.display = 'flex';
        this.hideOtherSections(['subjectSetupSection']);
        // Reset selected subjects and render the interface
        this.selectedSubjects = [];
        this.renderDefaultSubjects();
        this.updateSelectedSubjects();
    }

    renderDefaultSubjects() {
        const grid = document.getElementById('defaultSubjectsGrid');
        
        // Group subjects by category
        const categories = {};
        this.defaultSubjects.forEach(subject => {
            if (!categories[subject.category]) {
                categories[subject.category] = [];
            }
            categories[subject.category].push(subject);
        });

        let html = '';
        Object.keys(categories).sort().forEach(category => {
            html += `
                <div class="subject-category">
                    <h4 class="category-title">${category}</h4>
                    <div class="category-subjects">
                        ${categories[category].map(subject => `
                            <div class="default-subject-item" id="default-${subject.name.replace(/\s+/g, '-').toLowerCase()}">
                                <div class="subject-info">
                                    <span class="subject-name">${subject.name}</span>
                                    <span class="subject-classes">${subject.classes} classes</span>
                                </div>
                                <button class="btn btn-ghost btn-small add-subject-btn" onclick="tracker.selectDefaultSubject('${subject.name}', ${subject.classes})">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
                                </button>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        });

        grid.innerHTML = html;
    }

    selectDefaultSubject(name, classes) {
        // Check if already selected
        const exists = this.selectedSubjects.find(s => s.name === name);
        if (exists) {
            this.showAlert(`"${name}" is already selected`, 'warning');
            return;
        }

        // Add to selected subjects
        this.selectedSubjects.push({ name, classes, isCustom: false });
        
        // Update UI
        this.updateSubjectButton(name, true);
        this.updateSelectedSubjects();
        this.showAlert(`Added "${name}" to your subjects`, 'success');
    }

    updateSubjectButton(name, isSelected) {
        const elementId = `default-${name.replace(/\s+/g, '-').toLowerCase()}`;
        const element = document.getElementById(elementId);
        if (!element) return;

        const button = element.querySelector('.add-subject-btn');
        if (isSelected) {
            button.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
            `;
            button.className = 'btn btn-success btn-small add-subject-btn';
            button.onclick = () => this.unselectDefaultSubject(name);
            element.classList.add('selected');
        } else {
            button.innerHTML = `
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            `;
            button.className = 'btn btn-ghost btn-small add-subject-btn';
            button.onclick = () => this.selectDefaultSubject(name, this.defaultSubjects.find(s => s.name === name).classes);
            element.classList.remove('selected');
        }
    }

    unselectDefaultSubject(name) {
        // Remove from selected subjects
        this.selectedSubjects = this.selectedSubjects.filter(s => s.name !== name);
        
        // Update UI
        this.updateSubjectButton(name, false);
        this.updateSelectedSubjects();
        this.showAlert(`Removed "${name}" from your subjects`, 'warning');
    }

    updateSelectedSubjects() {
        const section = document.getElementById('selectedSubjectsSection');
        const list = document.getElementById('selectedSubjectsList');
        const count = document.getElementById('selectedCount');
        const finishBtn = document.getElementById('finishSetupBtn');

        count.textContent = this.selectedSubjects.length;

        if (this.selectedSubjects.length === 0) {
            section.style.display = 'none';
            finishBtn.disabled = true;
            return;
        }

        section.style.display = 'block';
        finishBtn.disabled = false;

        list.innerHTML = this.selectedSubjects.map((subject, index) => `
            <div class="selected-subject-item">
                <div class="subject-info">
                    <span class="subject-name">${subject.name}</span>
                    <span class="subject-classes">${subject.classes} classes</span>
                    ${subject.isCustom ? '<span class="custom-badge">Custom</span>' : ''}
                </div>
                <button class="btn btn-ghost btn-small" onclick="tracker.removeSelectedSubject(${index})">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                </button>
            </div>
        `).join('');
    }

    removeSelectedSubject(index) {
        const subject = this.selectedSubjects[index];
        this.selectedSubjects.splice(index, 1);

        // If it's a default subject, update its button
        if (!subject.isCustom) {
            this.updateSubjectButton(subject.name, false);
        }

        this.updateSelectedSubjects();
        this.showAlert(`Removed "${subject.name}" from your subjects`, 'warning');
    }

    showLoadingSection() {
        document.getElementById('loadingSection').style.display = 'flex';
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
        document.getElementById('errorSection').style.display = 'flex';
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
            
            // Load subjects - check if any exist for this user
            const subjectsResponse = await this.databases.listDocuments(
                this.databaseId,
                'subjects',
                [
                    Appwrite.Query.equal('user_id', this.user.$id),
                    Appwrite.Query.equal('semester', 'Spring 2025')
                ]
            );

            if (subjectsResponse.documents.length === 0) {
                // Reset selected subjects array for new setup
                this.selectedSubjects = [];
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

    async checkIfSubjectsExist() {
        try {
            const response = await this.databases.listDocuments(
                this.databaseId,
                'subjects',
                [
                    Appwrite.Query.equal('user_id', this.user.$id),
                    Appwrite.Query.equal('semester', 'Spring 2025')
                ]
            );
            return response.documents.length > 0;
        } catch (error) {
            console.error('Error checking subjects:', error);
            return false;
        }
    }

    async addSubject(name, totalClasses) {
        try {
            const now = new Date().toISOString();
            
            const subject = await this.databases.createDocument(
                this.databaseId,
                'subjects',
                Appwrite.ID.unique(),
                {
                    user_id: this.user.$id,
                    name: name,
                    total_classes: parseInt(totalClasses),
                    semester: 'Spring 2025',
                    created_at: now,
                    updated_at: now
                }
            );

            return subject;
        } catch (error) {
            console.error('Error adding subject:', error);
            throw error;
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

    renderAddedSubjects() {
        // This method is no longer needed - remove it
    }

    removeManualSubject(index) {
        // This method is no longer needed - remove it
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
    // This function is no longer needed - remove it
}

function showSubjectSetupSection() {
    tracker.showSubjectSetupSection();
}

function showManualSubjectForm() {
    // This function is no longer needed - remove it
}

function addManualSubject() {
    // This function is no longer needed - remove it
}

function addCustomSubject() {
    const name = document.getElementById('customSubjectName').value.trim();
    const classes = document.getElementById('customSubjectClasses').value.trim();

    if (!name || !classes) {
        alert('Please fill in all fields');
        return;
    }

    if (parseInt(classes) < 1 || parseInt(classes) > 200) {
        alert('Total classes must be between 1 and 200');
        return;
    }

    // Check for duplicate names
    const duplicate = tracker.selectedSubjects.find(subject => 
        subject.name.toLowerCase() === name.toLowerCase()
    );
    
    if (duplicate) {
        alert('A subject with this name already exists');
        return;
    }

    // Add to selected subjects
    tracker.selectedSubjects.push({
        name: name,
        classes: parseInt(classes),
        isCustom: true
    });

    // Clear form
    document.getElementById('customSubjectName').value = '';
    document.getElementById('customSubjectClasses').value = '';

    // Update UI
    tracker.updateSelectedSubjects();
    tracker.showAlert(`Added custom subject "${name}" successfully!`, 'success');
}

async function finishSubjectSetup() {
    if (tracker.selectedSubjects.length === 0) {
        alert('Please select at least one subject before finishing setup');
        return;
    }

    try {
        tracker.showLoadingSection();
        
        // Create all selected subjects
        for (const subject of tracker.selectedSubjects) {
            await tracker.addSubject(subject.name, subject.classes);
        }

        // Clear the selected subjects array
        tracker.selectedSubjects = [];

        tracker.showAlert('Subjects created successfully!', 'success');
        setTimeout(() => {
            tracker.loadData();
        }, 1500);
    } catch (error) {
        tracker.showAlert('Failed to create subjects: ' + error.message, 'destructive');
        tracker.showSubjectSetupSection();
    }
}

async function finishManualSetup() {
    // This function is no longer needed - remove it
}

function showAddSubjectModal() {
    document.getElementById('addSubjectModal').style.display = 'flex';
    document.getElementById('modalSubjectName').value = '';
    document.getElementById('modalTotalClasses').value = '';
    document.getElementById('modalSubjectName').focus();
}

function hideAddSubjectModal() {
    document.getElementById('addSubjectModal').style.display = 'none';
}

async function addSubjectFromModal() {
    const name = document.getElementById('modalSubjectName').value.trim();
    const totalClasses = document.getElementById('modalTotalClasses').value.trim();

    if (!name || !totalClasses) {
        alert('Please fill in all fields');
        return;
    }

    if (parseInt(totalClasses) < 1 || parseInt(totalClasses) > 200) {
        alert('Total classes must be between 1 and 200');
        return;
    }

    // Check for duplicate names
    const duplicate = tracker.subjects.find(subject => 
        subject.name.toLowerCase() === name.toLowerCase()
    );
    
    if (duplicate) {
        alert('A subject with this name already exists');
        return;
    }

    try {
        await tracker.addSubject(name, parseInt(totalClasses));
        hideAddSubjectModal();
        tracker.showAlert(`Added "${name}" successfully!`, 'success');
        tracker.loadData();
    } catch (error) {
        tracker.showAlert('Failed to add subject: ' + error.message, 'destructive');
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

        // Manual subject form
        if (activeElement.closest('#customSubjectName') || activeElement.closest('#customSubjectClasses')) {
            e.preventDefault();
            addCustomSubject();
        }

        // Modal form
        if (activeElement.closest('#addSubjectModal')) {
            e.preventDefault();
            addSubjectFromModal();
        }
    }

    // Escape key to close modal
    if (e.key === 'Escape') {
        const modal = document.getElementById('addSubjectModal');
        if (modal.style.display === 'flex') {
            hideAddSubjectModal();
        }
    }
});