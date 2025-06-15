const express = require('express');
const bcrypt = require('bcryptjs');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// Logging utility
const log = {
    info: (message, data = {}) => {
        console.log(`[INFO] ${new Date().toISOString()} - ${message}`, data);
    },
    warn: (message, data = {}) => {
        console.warn(`[WARN] ${new Date().toISOString()} - ${message}`, data);
    },
    error: (message, error = {}) => {
        console.error(`[ERROR] ${new Date().toISOString()} - ${message}`, {
            message: error.message,
            stack: error.stack,
            ...error
        });
    },
    debug: (message, data = {}) => {
        if (process.env.NODE_ENV === 'development') {
            console.debug(`[DEBUG] ${new Date().toISOString()} - ${message}`, data);
        }
    },
    auth: (message, data = {}) => {
        console.log(`[AUTH] ${new Date().toISOString()} - ${message}`, data);
    },
    api: (message, data = {}) => {
        console.log(`[API] ${new Date().toISOString()} - ${message}`, data);
    }
};

// Request logging middleware
const requestLogger = (req, res, next) => {
    const start = Date.now();
    const { method, url, ip } = req;
    const userAgent = req.get('User-Agent') || 'Unknown';

    log.api(`Incoming ${method} request`, {
        url,
        ip,
        userAgent,
        timestamp: new Date().toISOString()
    });

    // Log response when it finishes
    res.on('finish', () => {
        const duration = Date.now() - start;
        const { statusCode } = res;

        log.api(`Request completed`, {
            method,
            url,
            statusCode,
            duration: `${duration}ms`,
            ip
        });
    });

    next();
};

// Middleware
app.use(express.json());
app.use(cors());
app.use(requestLogger);

// In-memory storage (replace with database in production)
let users = [];
let tasks = [];
let userIdCounter = 1;
let taskIdCounter = 1;

log.info('Application starting up', {
    port: PORT,
    environment: process.env.NODE_ENV || 'development',
    timestamp: new Date().toISOString()
});

// Simple auth middleware - checks Bearer token in headers
const requireAuth = (req, res, next) => {
    const authHeader = req.headers.authorization;
    const clientIp = req.ip;

    log.debug('Auth middleware called', {
        url: req.url,
        method: req.method,
        hasAuthHeader: !!authHeader,
        ip: clientIp
    });

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        log.auth('Authentication failed - missing or malformed authorization header', {
            url: req.url,
            ip: clientIp,
            authHeader: authHeader ? 'present but malformed' : 'missing'
        });
        return res.status(401).json({ error: 'Authorization header missing or malformed (Bearer token expected)' });
    }

    const token = authHeader.split(' ')[1];

    // In a real app, this token would be a JWT or an opaque token looked up in a database.
    // For this example, we'll assume the token is "token_for_user_ID".
    if (!token.startsWith('token_for_user_')) {
        log.auth('Authentication failed - invalid token format', {
            url: req.url,
            ip: clientIp,
            tokenPrefix: token.substring(0, 10) + '...'
        });
        return res.status(401).json({ error: 'Invalid token format' });
    }

    const userIdFromToken = parseInt(token.replace('token_for_user_', ''));
    if (isNaN(userIdFromToken)) {
        log.auth('Authentication failed - invalid token payload', {
            url: req.url,
            ip: clientIp,
            token: token.substring(0, 15) + '...'
        });
        return res.status(401).json({ error: 'Invalid token payload' });
    }

    const user = users.find(u => u.id === userIdFromToken);
    if (!user) {
        log.auth('Authentication failed - user not found', {
            url: req.url,
            ip: clientIp,
            userId: userIdFromToken
        });
        return res.status(401).json({ error: 'Invalid token: User not found' });
    }

    log.auth('Authentication successful', {
        userId: user.id,
        email: user.email,
        url: req.url,
        ip: clientIp
    });

    req.user = user; // Add user to request
    next();
};

// Helper function to find user by email
const findUserByEmail = (email) => {
    log.debug('Finding user by email', { email });
    return users.find(user => user.email === email);
};

// Health check endpoint
app.get('/api/health', (req, res) => {
    const healthData = {
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        users: users.length,
        tasks: tasks.length
    };

    log.info('Health check requested', healthData);
    res.json(healthData);
});

// AUTH ROUTES

// Register
app.post('/api/auth/register', async (req, res) => {
    try {
        const { email, password, name } = req.body;
        const clientIp = req.ip;

        log.auth('Registration attempt', {
            email,
            name,
            ip: clientIp,
            hasPassword: !!password
        });

        if (!email || !password || !name) {
            log.auth('Registration failed - missing required fields', {
                email: !!email,
                password: !!password,
                name: !!name,
                ip: clientIp
            });
            return res.status(400).json({ error: 'Email, password, and name are required' });
        }

        if (findUserByEmail(email)) {
            log.auth('Registration failed - user already exists', {
                email,
                ip: clientIp
            });
            return res.status(400).json({ error: 'User already exists' });
        }

        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        const newUser = {
            id: userIdCounter++,
            email,
            password: hashedPassword,
            name,
            createdAt: new Date().toISOString()
        };
        users.push(newUser);

        // Generate a simple token (in a real app, use JWT)
        const token = `token_for_user_${newUser.id}`;

        log.auth('User registered successfully', {
            userId: newUser.id,
            email: newUser.email,
            name: newUser.name,
            ip: clientIp,
            totalUsers: users.length
        });

        res.status(201).json({
            message: 'User registered successfully',
            user: {
                id: newUser.id,
                email: newUser.email,
                name: newUser.name
            },
            token // Return token to client
        });
    } catch (error) {
        log.error('Registration error', {
            error,
            email: req.body.email,
            ip: req.ip
        });
        res.status(500).json({ error: 'Server error during registration' });
    }
});

// Login
app.post('/api/auth/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        const clientIp = req.ip;

        log.auth('Login attempt', {
            email,
            ip: clientIp,
            hasPassword: !!password
        });

        if (!email || !password) {
            log.auth('Login failed - missing credentials', {
                email: !!email,
                password: !!password,
                ip: clientIp
            });
            return res.status(400).json({ error: 'Email and password are required' });
        }

        const user = findUserByEmail(email);
        if (!user) {
            log.auth('Login failed - user not found', {
                email,
                ip: clientIp
            });
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        const isValidPassword = await bcrypt.compare(password, user.password);
        if (!isValidPassword) {
            log.auth('Login failed - invalid password', {
                userId: user.id,
                email,
                ip: clientIp
            });
            return res.status(400).json({ error: 'Invalid credentials' });
        }

        // Generate a simple token (in a real app, use JWT)
        const token = `token_for_user_${user.id}`;

        log.auth('Login successful', {
            userId: user.id,
            email: user.email,
            name: user.name,
            ip: clientIp
        });

        res.json({
            message: 'Login successful',
            user: {
                id: user.id,
                email: user.email,
                name: user.name
            },
            token // Return token to client
        });
    } catch (error) {
        log.error('Login error', {
            error,
            email: req.body.email,
            ip: req.ip
        });
        res.status(500).json({ error: 'Server error during login' });
    }
});

// Logout - doesn't do anything server-side for this simple token
app.post('/api/auth/logout', (req, res) => {
    const clientIp = req.ip;
    log.auth('Logout requested', { ip: clientIp });
    res.json({ message: 'Logged out successfully' });
});

// Get current user info
app.get('/api/auth/me', requireAuth, (req, res) => {
    log.auth('User info requested', {
        userId: req.user.id,
        email: req.user.email,
        ip: req.ip
    });

    res.json({
        user: {
            id: req.user.id,
            email: req.user.email,
            name: req.user.name
        }
    });
});

// TASK ROUTES

// Get all tasks for authenticated user
app.get('/api/tasks', requireAuth, (req, res) => {
    const userTasks = tasks.filter(task => task.userId === req.user.id);

    log.api('Tasks retrieved', {
        userId: req.user.id,
        taskCount: userTasks.length,
        ip: req.ip
    });

    res.json(userTasks);
});

// Get single task
app.get('/api/tasks/:id', requireAuth, (req, res) => {
    const taskId = parseInt(req.params.id);
    const task = tasks.find(t => t.id === taskId && t.userId === req.user.id);

    if (!task) {
        log.api('Task not found', {
            taskId,
            userId: req.user.id,
            ip: req.ip
        });
        return res.status(404).json({ error: 'Task not found' });
    }

    log.api('Task retrieved', {
        taskId: task.id,
        userId: req.user.id,
        taskTitle: task.title,
        ip: req.ip
    });

    res.json(task);
});

// Create new task
app.post('/api/tasks', requireAuth, (req, res) => {
    const { title, description, completed = false, priority = 'medium', dueDate } = req.body;

    log.api('Task creation attempt', {
        userId: req.user.id,
        title,
        priority,
        hasDueDate: !!dueDate,
        ip: req.ip
    });

    if (!title) {
        log.api('Task creation failed - missing title', {
            userId: req.user.id,
            ip: req.ip
        });
        return res.status(400).json({ error: 'Title is required' });
    }

    const newTask = {
        id: taskIdCounter++,
        userId: req.user.id,
        title,
        description: description || '',
        completed,
        priority,
        dueDate: dueDate || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };

    tasks.push(newTask);

    log.api('Task created successfully', {
        taskId: newTask.id,
        userId: req.user.id,
        title: newTask.title,
        priority: newTask.priority,
        totalTasks: tasks.length,
        ip: req.ip
    });

    res.status(201).json(newTask);
});

// Update task
app.put('/api/tasks/:id', requireAuth, (req, res) => {
    const taskId = parseInt(req.params.id);
    const taskIndex = tasks.findIndex(t => t.id === taskId && t.userId === req.user.id);

    if (taskIndex === -1) {
        log.api('Task update failed - task not found', {
            taskId,
            userId: req.user.id,
            ip: req.ip
        });
        return res.status(404).json({ error: 'Task not found' });
    }

    const { title, description, completed, priority, dueDate } = req.body;
    const originalTask = { ...tasks[taskIndex] };

    // Update task fields
    if (title !== undefined) tasks[taskIndex].title = title;
    if (description !== undefined) tasks[taskIndex].description = description;
    if (completed !== undefined) tasks[taskIndex].completed = completed;
    if (priority !== undefined) tasks[taskIndex].priority = priority;
    if (dueDate !== undefined) tasks[taskIndex].dueDate = dueDate;

    tasks[taskIndex].updatedAt = new Date().toISOString();

    log.api('Task updated successfully', {
        taskId,
        userId: req.user.id,
        changes: {
            title: originalTask.title !== tasks[taskIndex].title,
            description: originalTask.description !== tasks[taskIndex].description,
            completed: originalTask.completed !== tasks[taskIndex].completed,
            priority: originalTask.priority !== tasks[taskIndex].priority,
            dueDate: originalTask.dueDate !== tasks[taskIndex].dueDate
        },
        ip: req.ip
    });

    res.json(tasks[taskIndex]);
});

// Delete task
app.delete('/api/tasks/:id', requireAuth, (req, res) => {
    const taskId = parseInt(req.params.id);
    const taskIndex = tasks.findIndex(t => t.id === taskId && t.userId === req.user.id);

    if (taskIndex === -1) {
        log.api('Task deletion failed - task not found', {
            taskId,
            userId: req.user.id,
            ip: req.ip
        });
        return res.status(404).json({ error: 'Task not found' });
    }

    const deletedTask = tasks.splice(taskIndex, 1)[0];

    log.api('Task deleted successfully', {
        taskId: deletedTask.id,
        userId: req.user.id,
        taskTitle: deletedTask.title,
        totalTasks: tasks.length,
        ip: req.ip
    });

    res.json({ message: 'Task deleted successfully', task: deletedTask });
});

// Toggle task completion
app.patch('/api/tasks/:id/toggle', requireAuth, (req, res) => {
    const taskId = parseInt(req.params.id);
    const taskIndex = tasks.findIndex(t => t.id === taskId && t.userId === req.user.id);

    if (taskIndex === -1) {
        log.api('Task toggle failed - task not found', {
            taskId,
            userId: req.user.id,
            ip: req.ip
        });
        return res.status(404).json({ error: 'Task not found' });
    }

    const wasCompleted = tasks[taskIndex].completed;
    tasks[taskIndex].completed = !tasks[taskIndex].completed;
    tasks[taskIndex].updatedAt = new Date().toISOString();

    log.api('Task completion toggled', {
        taskId,
        userId: req.user.id,
        taskTitle: tasks[taskIndex].title,
        wasCompleted,
        nowCompleted: tasks[taskIndex].completed,
        ip: req.ip
    });

    res.json(tasks[taskIndex]);
});

// Error handling middleware
app.use((err, req, res, next) => {
    log.error('Unhandled error', {
        error: err,
        url: req.url,
        method: req.method,
        ip: req.ip,
        userAgent: req.get('User-Agent')
    });

    res.status(500).json({ error: 'Something went wrong!' });
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
    log.info('SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    log.info('SIGINT received, shutting down gracefully');
    process.exit(0);
});

app.listen(PORT, () => {
    log.info('Server started successfully', {
        port: PORT,
        environment: process.env.NODE_ENV || 'development',
        healthCheck: `http://localhost:${PORT}/api/health`,
        timestamp: new Date().toISOString()
    });
});

module.exports = app;