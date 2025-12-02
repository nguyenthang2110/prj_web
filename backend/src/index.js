const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { Pool } = require('pg');
const dataSourceManager = require('./datasources/manager');

const app = express();
const PORT = process.env.PORT || 4000;
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Simple in-memory log buffer
const logBuffer = [];
const MAX_LOGS = 200;
['log', 'warn', 'error'].forEach((level) => {
  const original = console[level];
  console[level] = (...args) => {
    const entry = {
      level,
      message: args.map((a) => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' '),
      timestamp: new Date().toISOString()
    };
    logBuffer.push(entry);
    if (logBuffer.length > MAX_LOGS) {
      logBuffer.shift();
    }
    original.apply(console, args);
  };
});

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

// Ensure required tables/columns exist (lightweight migration for alerts)
async function runMigrations() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS alerts (
        id SERIAL PRIMARY KEY,
        dashboard_id INTEGER REFERENCES dashboards(id) ON DELETE CASCADE,
        panel_id INTEGER REFERENCES panels(id) ON DELETE CASCADE,
        name VARCHAR(255) NOT NULL,
        message TEXT,
        state VARCHAR(50) DEFAULT 'ok',
        frequency VARCHAR(50),
        handler INTEGER DEFAULT 1,
        conditions JSONB,
        notifications JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        last_triggered TIMESTAMP
      );
    `);

    await pool.query(`
      ALTER TABLE alerts
        ADD COLUMN IF NOT EXISTS dashboard_id INTEGER REFERENCES dashboards(id) ON DELETE CASCADE,
        ADD COLUMN IF NOT EXISTS panel_id INTEGER REFERENCES panels(id) ON DELETE CASCADE,
        ADD COLUMN IF NOT EXISTS name VARCHAR(255) DEFAULT '' NOT NULL,
        ADD COLUMN IF NOT EXISTS message TEXT,
        ADD COLUMN IF NOT EXISTS state VARCHAR(50) DEFAULT 'ok',
        ADD COLUMN IF NOT EXISTS frequency VARCHAR(50),
        ADD COLUMN IF NOT EXISTS datasource VARCHAR(255),
        ADD COLUMN IF NOT EXISTS query TEXT DEFAULT '',
        ADD COLUMN IF NOT EXISTS conditions JSONB,
        ADD COLUMN IF NOT EXISTS notifications JSONB,
        ADD COLUMN IF NOT EXISTS comparator VARCHAR(10) DEFAULT '>',
        ADD COLUMN IF NOT EXISTS threshold DOUBLE PRECISION DEFAULT 0,
        ADD COLUMN IF NOT EXISTS time_window VARCHAR(20) DEFAULT '5m',
        ADD COLUMN IF NOT EXISTS eval_interval_seconds INTEGER DEFAULT 60,
        ADD COLUMN IF NOT EXISTS is_enabled BOOLEAN DEFAULT TRUE,
        ADD COLUMN IF NOT EXISTS last_value DOUBLE PRECISION,
        ADD COLUMN IF NOT EXISTS last_state VARCHAR(50),
        ADD COLUMN IF NOT EXISTS last_evaluated_at TIMESTAMP,
        ADD COLUMN IF NOT EXISTS last_triggered TIMESTAMP;
    `);

    await pool.query(`
      CREATE TABLE IF NOT EXISTS alert_history (
        id SERIAL PRIMARY KEY,
        alert_id INTEGER REFERENCES alerts(id) ON DELETE CASCADE,
        state VARCHAR(50),
        message TEXT,
        data JSONB,
        triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `);

    // Ensure query column is nullable with default ''
    await pool.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'alerts' AND column_name = 'query'
        ) THEN
          BEGIN
            EXECUTE 'ALTER TABLE alerts ALTER COLUMN query DROP NOT NULL';
            EXECUTE 'ALTER TABLE alerts ALTER COLUMN query SET DEFAULT ''''';
          EXCEPTION WHEN others THEN
            -- ignore
            NULL;
          END;
        END IF;
      END $$;
    `);
    await pool.query(`
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1 FROM information_schema.columns 
          WHERE table_name = 'alerts' AND column_name = 'comparator'
        ) THEN
          BEGIN
            EXECUTE 'ALTER TABLE alerts ALTER COLUMN comparator DROP NOT NULL';
            EXECUTE 'ALTER TABLE alerts ALTER COLUMN comparator SET DEFAULT ''>''';
          EXCEPTION WHEN others THEN NULL;
          END;
        END IF;
      END $$;
    `);
  } catch (err) {
    console.error('Migration error:', err);
  }
}

runMigrations();

// Alert helpers
const parseFrequencyToMs = (freq = '1m') => {
  const match = String(freq).match(/(\\d+)(s|m|h)/i);
  if (!match) return 60000;
  const val = parseInt(match[1], 10);
  const unit = match[2].toLowerCase();
  const mult = unit === 's' ? 1000 : unit === 'm' ? 60000 : 3600000;
  return val * mult;
};

const extractLatestValue = (result) => {
  if (!result) return null;
  if (Array.isArray(result.data)) {
    const arr = result.data;
    if (arr.length === 0) return null;
    const last = arr[arr.length - 1];
    return last?.value ?? null;
  }
  if (Array.isArray(result.series) && result.series.length > 0) {
    const series = result.series[0]?.data || [];
    if (series.length === 0) return null;
    const last = series[series.length - 1];
    return last?.value ?? null;
  }
  return null;
};

const evaluateCondition = (value, condition) => {
  if (value === null || value === undefined) return 'no_data';
  const evaluator = condition?.evaluator || {};
  const type = evaluator.type || 'above';
  const params = Array.isArray(evaluator.params) ? evaluator.params : [evaluator.params];

  switch (type) {
    case 'above':
      return value > Number(params[0]) ? 'alerting' : 'ok';
    case 'below':
      return value < Number(params[0]) ? 'alerting' : 'ok';
    case 'outside_range': {
      const [min, max] = params;
      return value < Number(min) || value > Number(max) ? 'alerting' : 'ok';
    }
    case 'within_range': {
      const [min, max] = params;
      return value >= Number(min) && value <= Number(max) ? 'alerting' : 'ok';
    }
    case 'no_value':
      return value === null ? 'alerting' : 'ok';
    default:
      return 'ok';
  }
};

const evaluateAlert = async (alert) => {
  try {
    const panelResult = await pool.query('SELECT * FROM panels WHERE id = $1', [alert.panel_id]);
    if (panelResult.rows.length === 0) return;
    const panel = panelResult.rows[0];

    let datasource = panel.datasource || 'prometheus';
    let metric = panel.metric;
    let query = panel.query;

    try {
      const targets = typeof panel.targets === 'string' ? JSON.parse(panel.targets) : panel.targets;
      const target = Array.isArray(targets) ? targets[0] : null;
      if (target) {
        datasource = target.datasource || datasource;
        metric = target.metric || metric;
        query = target.query || query;
      }
    } catch (err) {
      console.warn('Cannot parse panel targets for alert', err);
    }

    const result = await dataSourceManager.query({
      datasource,
      metric,
      query,
      from: 'now-5m',
      to: 'now'
    });

    const latest = extractLatestValue(result);
    const newState = evaluateCondition(latest, alert.conditions);
    const now = new Date();

    if (newState === 'alerting') {
      await pool.query(
        'INSERT INTO alert_history (alert_id, state, message, data, triggered_at) VALUES ($1, $2, $3, $4, $5)',
        [alert.id, newState, alert.message || '', JSON.stringify({ value: latest }), now]
      );
    }

    if (newState !== alert.state) {
      await pool.query(
        'UPDATE alerts SET state = $1, last_triggered = $2, updated_at = CURRENT_TIMESTAMP WHERE id = $3',
        [newState, newState === 'alerting' ? now : alert.last_triggered, alert.id]
      );
    }
  } catch (err) {
    console.error('Alert evaluate error:', err);
  }
};

const evaluateAllAlerts = async () => {
  try {
    const alerts = await pool.query('SELECT * FROM alerts');
    for (const alert of alerts.rows) {
      await evaluateAlert(alert);
    }
  } catch (err) {
    console.error('Evaluate alerts error:', err);
  }
};

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

// Change password
app.post('/api/auth/change-password', authenticateToken, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: 'Current and new password are required' });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ error: 'New password must be at least 6 characters' });
    }

    const userResult = await pool.query(
      'SELECT id, password_hash FROM users WHERE id = $1',
      [req.user.id]
    );
    if (userResult.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }
    const user = userResult.rows[0];
    const match = await bcrypt.compare(currentPassword, user.password_hash);
    if (!match) {
      return res.status(400).json({ error: 'Current password is incorrect' });
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    await pool.query('UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2', [newHash, user.id]);

    // log to datasource log buffer
    try {
      dataSourceManager.pushLog('postgres', `User ${user.id} changed password`);
    } catch (e) {
      // ignore logging failure
    }

    res.json({ message: 'Password updated successfully' });
  } catch (err) {
    console.error('Change password error:', err);
    try {
      dataSourceManager.pushLog('postgres', `Change password error: ${err.message}`, 'error');
    } catch (e) {
      // ignore logging failure
    }
    res.status(500).json({ error: 'Failed to change password' });
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
    
    const datasources = [];

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

// ==================== ALERTS ====================

app.get('/api/alerts', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT a.*, d.title as dashboard_title, p.title as panel_title FROM alerts a JOIN dashboards d ON a.dashboard_id = d.id JOIN panels p ON a.panel_id = p.id ORDER BY a.updated_at DESC'
    );
    res.json({ alerts: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch alerts' });
  }
});

app.post('/api/alerts', authenticateToken, async (req, res) => {
  try {
    const { dashboardId, panelId, name, message, frequency, conditions, notifications } = req.body;
    const dashId = Number(dashboardId);
    const pnlId = Number(panelId);
    if (!dashId || !pnlId) {
      return res.status(400).json({ error: 'dashboardId and panelId are required' });
    }
    if (!name) {
      return res.status(400).json({ error: 'name is required' });
    }

    // verify dashboard/panel exist and match
    const panelCheck = await pool.query(
      'SELECT p.id, p.dashboard_id, p.datasource, p.targets FROM panels p WHERE p.id = $1',
      [pnlId]
    );
    if (panelCheck.rows.length === 0) {
      return res.status(400).json({ error: 'Panel not found' });
    }
    if (panelCheck.rows[0].dashboard_id !== dashId) {
      return res.status(400).json({ error: 'Panel does not belong to dashboard' });
    }
    let alertDatasource = panelCheck.rows[0].datasource || 'prometheus';
    let alertQuery = '';
    // try to read from targets if missing
    if ((!alertDatasource || !alertQuery) && panelCheck.rows[0].targets) {
      try {
        const targets = typeof panelCheck.rows[0].targets === 'string'
          ? JSON.parse(panelCheck.rows[0].targets)
          : panelCheck.rows[0].targets;
        if (Array.isArray(targets) && targets[0]?.datasource) {
          alertDatasource = targets[0].datasource;
        }
        if (Array.isArray(targets) && targets[0]?.query) {
          alertQuery = targets[0].query;
        }
      } catch (e) {
        console.warn('Cannot parse targets for alert datasource');
      }
    }
    if (!alertDatasource) alertDatasource = 'prometheus';
    if (!alertQuery) {
      alertQuery = '';
    }

    const result = await pool.query(
      'INSERT INTO alerts (dashboard_id, panel_id, name, message, frequency, datasource, query, comparator, threshold, time_window, eval_interval_seconds, is_enabled, conditions, notifications, state) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15) RETURNING *',
      [
        dashId,
        pnlId,
        name,
        message || '',
        frequency || '1m',
        alertDatasource,
        alertQuery || '',
        conditions?.evaluator?.type === 'below' ? '<' : conditions?.evaluator?.type === 'above' ? '>' : conditions?.evaluator?.type === 'outside_range' ? 'outside' : 'within',
        Array.isArray(conditions?.evaluator?.params) ? Number(conditions.evaluator.params[0]) : Number(conditions?.evaluator?.params) || 0,
        frequency && typeof frequency === 'string' ? frequency : '5m',
        conditions?.eval_interval_seconds ? Number(conditions.eval_interval_seconds) : 60,
        true,
        conditions || {},
        notifications || [],
        'pending'
      ]
    );
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error('Failed to create alert:', err);
    res.status(500).json({ error: err.message || 'Failed to create alert' });
  }
});

app.put('/api/alerts/:id', authenticateToken, async (req, res) => {
  try {
    const { name, message, state, frequency, conditions, notifications } = req.body;
    
    const result = await pool.query(
      'UPDATE alerts SET name = $1, message = $2, state = $3, frequency = $4, conditions = $5, notifications = $6, updated_at = CURRENT_TIMESTAMP WHERE id = $7 RETURNING *',
      [name, message, state || 'pending', frequency, conditions, notifications, req.params.id]
    );
    
    res.json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to update alert' });
  }
});

app.delete('/api/alerts/:id', authenticateToken, async (req, res) => {
  try {
    await pool.query('DELETE FROM alerts WHERE id = $1', [req.params.id]);
    res.json({ message: 'Alert deleted' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete alert' });
  }
});

// Get alert history
app.get('/api/alerts/:id/history', authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM alert_history WHERE alert_id = $1 ORDER BY triggered_at DESC LIMIT 100',
      [req.params.id]
    );
    res.json({ history: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch alert history' });
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

// Logs (last 200 console entries)
app.get('/api/logs', authenticateToken, (req, res) => {
  res.json({ logs: logBuffer.slice(-MAX_LOGS).reverse() });
});

// Data source logs
app.get('/api/datasources/:id/logs', authenticateToken, (req, res) => {
  try {
    const logs = dataSourceManager.getLogs(req.params.id);
    if (!logs || logs.length === 0) {
      // add a friendly message if empty
      return res.json({ logs: [{ level: 'info', message: 'No logs yet for this datasource', timestamp: new Date().toISOString() }] });
    }
    res.json({ logs: (logs || []).slice().reverse() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch datasource logs' });
  }
});

app.delete('/api/datasources/:id/logs', authenticateToken, (req, res) => {
  try {
    dataSourceManager.clearLogs(req.params.id);
    res.json({ message: 'Logs cleared' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to clear logs' });
  }
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

// Start alert evaluator loop
setInterval(evaluateAllAlerts, 30000);

// Cleanup on shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  await dataSourceManager.close();
  await pool.end();
  process.exit(0);
});
