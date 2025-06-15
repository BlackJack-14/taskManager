// Global variables to store our data
let currentUser = null;
let authToken = null;
let allTasks = [];
let currentFilter = 'all';
let editingTaskId = null;

// API base URL
const API_URL = 'http://localhost:3000/api';

// When page loads, start the app
document.addEventListener('DOMContentLoaded', function () {
    initializeApp();
});

// Initialize the application
function initializeApp() {
    setupEventListeners();

    // Check if user is already logged in
    authToken = localStorage.getItem('token');
    if (authToken) {
        loadUserData();
    } else {
        showAuthPage();
    }
}

// Set up all event listeners
function setupEventListeners() {
    // Auth form submit
    document.getElementById('auth-form').addEventListener('submit', handleAuthSubmit);

    // Switch between login and signup
    document.getElementById('auth-switch-btn').addEventListener('click', toggleAuthMode);

    // Logout button
    document.getElementById('logout-btn').addEventListener('click', handleLogout);

    // Add new task button
    document.getElementById('add-task-btn').addEventListener('click', function () {
        showTaskModal();
    });

    // Filter buttons
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(function (button) {
        button.addEventListener('click', function () {
            setFilter(button.dataset.filter);
        });
    });

    // Task form submit
    document.getElementById('task-form').addEventListener('submit', handleTaskSubmit);

    // Cancel task form
    document.getElementById('task-cancel').addEventListener('click', hideTaskModal);

    // Close modal when clicking outside
    document.getElementById('task-modal').addEventListener('click', function (event) {
        if (event.target.id === 'task-modal') {
            hideTaskModal();
        }
    });
}

// Handle login/signup form submission
function handleAuthSubmit(event) {
    event.preventDefault();

    const isSignup = document.getElementById('auth-submit').textContent === 'Sign Up';
    const email = document.getElementById('email-input').value;
    const password = document.getElementById('password-input').value;
    const name = document.getElementById('name-input').value;

    if (isSignup) {
        registerUser(email, password, name);
    } else {
        loginUser(email, password);
    }
}

// Register new user
function registerUser(email, password, name) {
    showLoading();

    const userData = {
        email: email,
        password: password,
        name: name
    };

    fetch(API_URL + '/auth/register', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(userData)
    })
        .then(function (response) {
            return response.json();
        })
        .then(function (data) {
            if (data.token) {
                authToken = data.token;
                currentUser = data.user;
                localStorage.setItem('token', authToken);
                hideError();
                loadTasks();
                showDashboard();
            } else {
                showError(data.error || 'Registration failed');
            }
        })
        .catch(function (error) {
            showError('Network error. Please try again.');
            console.error('Registration error:', error);
        })
        .finally(function () {
            hideLoading();
        });
}

// Login existing user
function loginUser(email, password) {
    showLoading();

    const loginData = {
        email: email,
        password: password
    };

    fetch(API_URL + '/auth/login', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify(loginData)
    })
        .then(function (response) {
            return response.json();
        })
        .then(function (data) {
            if (data.token) {
                authToken = data.token;
                currentUser = data.user;
                localStorage.setItem('token', authToken);
                hideError();
                loadTasks();
                showDashboard();
            } else {
                showError(data.error || 'Login failed');
            }
        })
        .catch(function (error) {
            showError('Network error. Please try again.');
            console.error('Login error:', error);
        })
        .finally(function () {
            hideLoading();
        });
}

// Load user data when app starts
function loadUserData() {
    fetch(API_URL + '/auth/me', {
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + authToken
        }
    })
        .then(function (response) {
            return response.json();
        })
        .then(function (data) {
            if (data.user) {
                currentUser = data.user;
                loadTasks();
                showDashboard();
            } else {
                handleLogout();
            }
        })
        .catch(function (error) {
            console.error('Error loading user data:', error);
            handleLogout();
        });
}

// Logout user
function handleLogout() {
    authToken = null;
    currentUser = null;
    allTasks = [];
    localStorage.removeItem('token');
    showAuthPage();
}

// Toggle between login and signup forms
function toggleAuthMode() {
    const submitBtn = document.getElementById('auth-submit');
    const nameGroup = document.getElementById('name-group');
    const switchText = document.getElementById('auth-switch-text');
    const switchBtn = document.getElementById('auth-switch-btn');
    const subtitle = document.querySelector('.auth-subtitle');

    if (submitBtn.textContent === 'Sign In') {
        // Switch to signup mode
        submitBtn.textContent = 'Sign Up';
        nameGroup.style.display = 'block';
        switchText.textContent = 'Already have an account? ';
        switchBtn.textContent = 'Sign In';
        subtitle.textContent = 'Create your account';
        document.getElementById('name-input').required = true;
    } else {
        // Switch to login mode
        submitBtn.textContent = 'Sign In';
        nameGroup.style.display = 'none';
        switchText.textContent = "Don't have an account? ";
        switchBtn.textContent = 'Sign Up';
        subtitle.textContent = 'Welcome back!';
        document.getElementById('name-input').required = false;
    }

    // Clear form and hide errors
    document.getElementById('auth-form').reset();
    hideError();
}

// Load all tasks from server
function loadTasks() {
    fetch(API_URL + '/tasks', {
        method: 'GET',
        headers: {
            'Authorization': 'Bearer ' + authToken
        }
    })
        .then(function (response) {
            return response.json();
        })
        .then(function (tasks) {
            allTasks = tasks;
            displayTasks();
            updateStats();
        })
        .catch(function (error) {
            console.error('Error loading tasks:', error);
            showError('Failed to load tasks');
        });
}

// Create new task
function createTask(taskData) {
    fetch(API_URL + '/tasks', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + authToken
        },
        body: JSON.stringify(taskData)
    })
        .then(function (response) {
            return response.json();
        })
        .then(function (newTask) {
            allTasks.push(newTask);
            displayTasks();
            updateStats();
            hideTaskModal();
        })
        .catch(function (error) {
            console.error('Error creating task:', error);
            alert('Failed to create task');
        });
}

// Update existing task
function updateTask(taskId, taskData) {
    fetch(API_URL + '/tasks/' + taskId, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + authToken
        },
        body: JSON.stringify(taskData)
    })
        .then(function (response) {
            return response.json();
        })
        .then(function (updatedTask) {
            // Find and update the task in our array
            for (let i = 0; i < allTasks.length; i++) {
                if (allTasks[i].id === taskId) {
                    allTasks[i] = updatedTask;
                    break;
                }
            }
            displayTasks();
            updateStats();
            hideTaskModal();
        })
        .catch(function (error) {
            console.error('Error updating task:', error);
            alert('Failed to update task');
        });
}

// Delete task
function deleteTask(taskId) {
    if (!confirm('Are you sure you want to delete this task?')) {
        return;
    }

    fetch(API_URL + '/tasks/' + taskId, {
        method: 'DELETE',
        headers: {
            'Authorization': 'Bearer ' + authToken
        }
    })
        .then(function (response) {
            return response.json();
        })
        .then(function () {
            // Remove task from our array
            allTasks = allTasks.filter(function (task) {
                return task.id !== taskId;
            });
            displayTasks();
            updateStats();
        })
        .catch(function (error) {
            console.error('Error deleting task:', error);
            alert('Failed to delete task');
        });
}

// Toggle task completion
function toggleTask(taskId) {
    fetch(API_URL + '/tasks/' + taskId + '/toggle', {
        method: 'PATCH',
        headers: {
            'Authorization': 'Bearer ' + authToken
        }
    })
        .then(function (response) {
            return response.json();
        })
        .then(function (updatedTask) {
            // Find and update the task in our array
            for (let i = 0; i < allTasks.length; i++) {
                if (allTasks[i].id === taskId) {
                    allTasks[i] = updatedTask;
                    break;
                }
            }
            displayTasks();
            updateStats();
        })
        .catch(function (error) {
            console.error('Error toggling task:', error);
        });
}

// Set filter for tasks
function setFilter(filter) {
    currentFilter = filter;

    // Update active filter button
    const filterButtons = document.querySelectorAll('.filter-btn');
    filterButtons.forEach(function (button) {
        if (button.dataset.filter === filter) {
            button.classList.add('active');
        } else {
            button.classList.remove('active');
        }
    });

    displayTasks();
}

// Get filtered tasks based on current filter
function getFilteredTasks() {
    if (currentFilter === 'completed') {
        return allTasks.filter(function (task) {
            return task.completed;
        });
    } else if (currentFilter === 'pending') {
        return allTasks.filter(function (task) {
            return !task.completed;
        });
    } else {
        return allTasks;
    }
}

// Display tasks on the page
function displayTasks() {
    const tasksContainer = document.getElementById('tasks-grid');
    const emptyState = document.getElementById('empty-state');
    const filteredTasks = getFilteredTasks();

    // Clear existing tasks
    tasksContainer.innerHTML = '';

    if (filteredTasks.length === 0) {
        emptyState.style.display = 'block';
        return;
    }

    emptyState.style.display = 'none';

    // Create task cards
    filteredTasks.forEach(function (task) {
        const taskCard = createTaskCard(task);
        tasksContainer.appendChild(taskCard);
    });
}

// Create a single task card element
function createTaskCard(task) {
    const card = document.createElement('div');
    card.className = 'task-card priority-' + task.priority;

    if (task.completed) {
        card.classList.add('completed');
    }

    // Check if task is overdue
    const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && !task.completed;
    if (isOverdue) {
        card.classList.add('overdue');
    }

    // Format due date
    let dueDateText = '';
    if (task.dueDate) {
        const dueDate = new Date(task.dueDate);
        dueDateText = dueDate.toLocaleDateString();
        if (isOverdue) {
            dueDateText = '⚠️ ' + dueDateText;
        }
    }

    // Create card HTML
    card.innerHTML = `
        <div class="task-header">
            <div class="task-title-section">
                <div class="task-checkbox ${task.completed ? 'completed' : ''}">
                    ${task.completed ? '✓' : ''}
                </div>
                <h3 class="task-title ${task.completed ? 'completed' : ''}">${escapeHtml(task.title)}</h3>
            </div>
            <div class="task-actions">
                <button class="task-action-btn edit-btn" title="Edit">✏️</button>
                <button class="task-action-btn delete-btn" title="Delete">🗑️</button>
            </div>
        </div>
        
        ${task.description ? `
            <div class="task-description ${task.completed ? 'completed' : ''}">
                ${escapeHtml(task.description)}
            </div>
        ` : ''}
        
        <div class="task-footer">
            <span class="priority-badge priority-${task.priority}">
                ${task.priority.toUpperCase()}
            </span>
            ${dueDateText ? `
                <span class="task-due-date ${isOverdue ? 'overdue' : ''}">
                    ${dueDateText}
                </span>
            ` : ''}
        </div>
    `;

    // Add event listeners
    const checkbox = card.querySelector('.task-checkbox');
    checkbox.addEventListener('click', function () {
        toggleTask(task.id);
    });

    const editBtn = card.querySelector('.edit-btn');
    editBtn.addEventListener('click', function () {
        showTaskModal(task);
    });

    const deleteBtn = card.querySelector('.delete-btn');
    deleteBtn.addEventListener('click', function () {
        deleteTask(task.id);
    });

    return card;
}

// Show task creation/editing modal
function showTaskModal(task) {
    const modal = document.getElementById('task-modal');
    const title = document.getElementById('modal-title');
    const submitBtn = document.getElementById('task-submit');
    const form = document.getElementById('task-form');

    if (task) {
        // Editing existing task
        editingTaskId = task.id;
        title.textContent = 'Edit Task';
        submitBtn.textContent = 'Update';

        // Fill form with task data
        document.getElementById('task-title').value = task.title;
        document.getElementById('task-description').value = task.description || '';
        document.getElementById('task-priority').value = task.priority;

        if (task.dueDate) {
            const dueDate = new Date(task.dueDate);
            document.getElementById('task-due-date').value = dueDate.toISOString().split('T')[0];
        }
    } else {
        // Creating new task
        editingTaskId = null;
        title.textContent = 'New Task';
        submitBtn.textContent = 'Create';
        form.reset();
        document.getElementById('task-priority').value = 'medium';
    }

    modal.style.display = 'flex';
    document.getElementById('task-title').focus();
}

// Hide task modal
function hideTaskModal() {
    document.getElementById('task-modal').style.display = 'none';
    editingTaskId = null;
}

// Handle task form submission
function handleTaskSubmit(event) {
    event.preventDefault();

    const taskData = {
        title: document.getElementById('task-title').value,
        description: document.getElementById('task-description').value,
        priority: document.getElementById('task-priority').value,
        dueDate: document.getElementById('task-due-date').value || null
    };

    if (editingTaskId) {
        updateTask(editingTaskId, taskData);
    } else {
        createTask(taskData);
    }
}

// Update task statistics
function updateStats() {
    const totalTasks = allTasks.length;
    const completedTasks = allTasks.filter(function (task) {
        return task.completed;
    }).length;
    const pendingTasks = totalTasks - completedTasks;

    document.getElementById('total-tasks').textContent = totalTasks;
    document.getElementById('completed-tasks').textContent = completedTasks;
    document.getElementById('pending-tasks').textContent = pendingTasks;
}

// Show/hide different pages
function showAuthPage() {
    document.getElementById('auth-container').style.display = 'flex';
    document.getElementById('dashboard').style.display = 'none';
    document.getElementById('loading').style.display = 'none';
}

function showDashboard() {
    document.getElementById('auth-container').style.display = 'none';
    document.getElementById('dashboard').style.display = 'block';
    document.getElementById('loading').style.display = 'none';
    document.getElementById('user-name').textContent = currentUser.name;
}

function showLoading() {
    document.getElementById('loading').style.display = 'flex';
}

function hideLoading() {
    document.getElementById('loading').style.display = 'none';
}

// Show/hide error messages
function showError(message) {
    const errorElement = document.getElementById('error-message');
    errorElement.textContent = message;
    errorElement.style.display = 'block';
}

function hideError() {
    document.getElementById('error-message').style.display = 'none';
}

// Utility function to escape HTML to prevent XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}