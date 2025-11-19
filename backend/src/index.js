const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const dataSourceManager = require('./datasources/manager');

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Database connection (for app data)
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false
});

// Middleware
app.use(cors());
app.use(express.json());

// Initialize data sources
dataSourceManager.initialize().then(() => {
  console.log('📊 Data sources initialized');
});

// ==================== AUTHENTICATION ====================
// (Keep existing auth routes - same as before)

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    req.user = user;
    next();
  });
};

app.post('/api/auth/register', async (req, res) => {
  try {
    const { username, email, password, fullName } = req.body;
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = await pool.query(
      'INSERT INTO users (username, email, password_hash, full_name) VALUES ($1, $2, $3, $4) RETURNING id, username, email, full_name, role',
      [username, email, hashedPassword, fullName]
    );
    
    res.status(201).json({ user: result.rows[0] });
  } catch (err) {
    console.error('Registration error:', err);
    res.status(400).json({ error: 'User already exists or invalid data' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    const result = await pool.query(
      'SELECT * FROM users WHERE username = $1',
      [username]
    );
    
    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    const user = result.rows[0];
    const validPassword = await bcrypt.compare(password, user.password_hash);
    
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    
    await pool.query('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
    
    const token = jwt.sign(
      { id: user.id, username: user.username, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );
    
    await pool.query(
      'INSERT INTO sessions (user_id, token, expires_at) VALUES ($1, $2, NOW() + INTERVAL \'24 hours\')',
      [user.id, token]
    );
    
    res.json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.full_name,
        role: user.role
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

app.post('/api/auth/logout', authenticateToken, async (req, res) => {
  try {
    const token = req.headers['authorization'].split(' ')[1];
    await pool.query('DELETE FROM sessions WHERE token = $1', [token]);
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Logout failed' });
  }
});

app.get('/api/auth/me', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, username, email, full_name, role FROM users WHERE id = $1',
      [req.user.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to get user info' });
  }
});

// ==================== DATA SOURCES ====================

// Get available data sources
app.get('/api/datasources', authenticateToken, async (req, res) => {
  try {
    const connections = await dataSourceManager.testConnections();
    
    const datasources = [
      {
        id: 'mock',
        name: 'Mock Data',
        type: 'mock',
        status: 'connected',
        description: 'Generated test data'
      }
    ];

    if (connections.prometheus) {
      datasources.push({
        id: 'prometheus',
        name: 'Prometheus',
        type: 'prometheus',
        status: 'connected',
        description: 'Time-series metrics database'
      });
    }

    if (connections.postgres) {
      datasources.push({
        id: 'postgres',
        name: 'PostgreSQL',
        type: 'postgres',
        status: 'connected',
        description: 'Relational metrics database'
      });
    }

    res.json({ datasources });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch datasources' });
  }
});

// Get available metrics for a datasource
app.get('/api/datasources/:id/metrics', authenticateToken, async (req, res) => {
  try {
    const metrics = await dataSourceManager.getAvailableMetrics();
    const datasourceMetrics = metrics[req.params.id] || [];
    
    res.json({ metrics: datasourceMetrics });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch metrics' });
  }
});

// Test datasource connection
app.post('/api/datasources/:id/test', authenticateToken, async (req, res) => {
  try {
    const ds = dataSourceManager.getDataSource(req.params.id);
    if (!ds) {
      return res.status(404).json({ error: 'Data source not found' });
    }

    const connected = await ds.testConnection();
    res.json({ connected, datasource: req.params.id });
  } catch (err) {
    res.status(500).json({ error: 'Test failed', connected: false });
  }
});

// ==================== METRICS QUERY ====================

// Query metrics from any datasource
app.get('/api/metrics', async (req, res) => {
  try {
    const result = await dataSourceManager.query(req.query);
    res.json(result);
  } catch (err) {
    console.error('Metrics query error:', err);
    res.status(500).json({ error: err.message });
  }
});

// Execute custom query
app.post('/api/query', authenticateToken, async (req, res) => {
  try {
    const { datasource, query, metric } = req.body;
    
    const result = await dataSourceManager.query({
      datasource,
      query,
      metric,
      ...req.body
    });

    res.json({ result });
  } catch (err) {
    console.error('Query error:', err);
    res.status(500).json({ error: err.message });
  }
});

// ==================== DASHBOARDS ====================
// (Keep existing dashboard routes)

app.get('/api/dashboards', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT d.*, u.username as created_by_username FROM dashboards d LEFT JOIN users u ON d.created_by = u.id ORDER BY d.updated_at DESC'
    );
    res.json({ dashboards: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch dashboards' });
  }
});

app.get('/api/dashboards/:uid', authenticateToken, async (req, res) => {
  try {
    const dashResult = await pool.query(
      'SELECT * FROM dashboards WHERE uid = $1',
      [req.params.uid]
    );
    
    if (dashResult.rows.length === 0) {
      return res.status(404).json({ error: 'Dashboard not found' });
    }
    
    const dashboard = dashResult.rows[0];
    const panelsResult = await pool.query(
      'SELECT * FROM panels WHERE dashboard_id = $1',
      [dashboard.id]
    );
    
    res.json({
      ...dashboard,
      panels: panelsResult.rows
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch dashboard' });
  }
});

app.post('/api/dashboards', authenticateToken, async (req, res) => {
  try {
    const { title, description, tags, data } = req.body;
    const uid = generateUID();
    
    const result = await pool.query(
      'INSERT INTO dashboards (uid, title, description, tags, created_by, data) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [uid, title, description, tags, req.user.id, data]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create dashboard' });
  }
});

app.put('/api/dashboards/:uid', authenticateToken, async (req, res) => {
  try {
    const { title, description, tags, data } = req.body;
    
    const result = await pool.query(
      'UPDATE dashboards SET title = $1, description = $2, tags = $3, data = $4, updated_at = CURRENT_TIMESTAMP, version = version + 1 WHERE uid = $5 RETURNING *',
      [title, description, tags, data, req.params.uid]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dashboard not found' });
    }
    
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update dashboard' });
  }
});

app.delete('/api/dashboards/:uid', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM dashboards WHERE uid = $1 RETURNING id',
      [req.params.uid]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Dashboard not found' });
    }
    
    res.json({ message: 'Dashboard deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete dashboard' });
  }
});

// ==================== PANELS ====================

app.get('/api/dashboards/:id/panels', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM panels WHERE dashboard_id = $1',
      [req.params.id]
    );
    res.json({ panels: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch panels' });
  }
});

app.post('/api/dashboards/:id/panels', authenticateToken, async (req, res) => {
  try {
    const { title, type, position, datasource, targets, options } = req.body;
    
    const result = await pool.query(
      'INSERT INTO panels (dashboard_id, title, type, position, datasource, targets, options) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
      [req.params.id, title, type, JSON.stringify(position), datasource, JSON.stringify(targets), JSON.stringify(options)]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to create panel' });
  }
});

app.put('/api/panels/:id', authenticateToken, async (req, res) => {
  try {
    const { title, type, position, datasource, targets, options } = req.body;
    
    const result = await pool.query(
      'UPDATE panels SET title = $1, type = $2, position = $3, datasource = $4, targets = $5, options = $6, updated_at = CURRENT_TIMESTAMP WHERE id = $7 RETURNING *',
      [title, type, JSON.stringify(position), datasource, JSON.stringify(targets), JSON.stringify(options), req.params.id]
    );
    
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update panel' });
  }
});

app.delete('/api/panels/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM panels WHERE id = $1', [req.params.id]);
    res.json({ message: 'Panel deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete panel' });
  }
});

// ==================== UTILITIES ====================

function generateUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Health check
app.get('/health', async (req, res) => {
  const connections = await dataSourceManager.testConnections();
  
  res.json({
    status: 'OK',
    message: 'Backend is running',
    timestamp: new Date(),
    uptime: process.uptime(),
    database: 'connected',
    datasources: connections
  });
});

// Error handling
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`
  🚀 Server is running!
  📡 Port: ${PORT}
  🏥 Health: http://localhost:${PORT}/health
  🔐 Auth: Enabled
  💾 Database: PostgreSQL
  📊 Data Sources: Prometheus, PostgreSQL, Mock
  `);
});

// Cleanup on shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  await dataSourceManager.close();
  await pool.end();
  process.exit(0);
});
