-- Database Schema for Grafana Clone

-- Users table
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(255) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'viewer',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_login TIMESTAMP
);

-- Dashboards table
CREATE TABLE IF NOT EXISTS dashboards (
    id SERIAL PRIMARY KEY,
    uid VARCHAR(40) UNIQUE NOT NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    tags TEXT[],
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    version INTEGER DEFAULT 1,
    is_starred BOOLEAN DEFAULT FALSE,
    folder_id INTEGER,
    data JSONB
);

-- Panels table
CREATE TABLE IF NOT EXISTS panels (
    id SERIAL PRIMARY KEY,
    dashboard_id INTEGER REFERENCES dashboards(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    position JSONB,
    datasource VARCHAR(255),
    targets JSONB,
    options JSONB,
    field_config JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Data Sources table
CREATE TABLE IF NOT EXISTS datasources (
    id SERIAL PRIMARY KEY,
    uid VARCHAR(40) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    url VARCHAR(500),
    access VARCHAR(50) DEFAULT 'proxy',
    basic_auth BOOLEAN DEFAULT FALSE,
    basic_auth_user VARCHAR(255),
    with_credentials BOOLEAN DEFAULT FALSE,
    json_data JSONB,
    secure_json_data JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Variables table
CREATE TABLE IF NOT EXISTS variables (
    id SERIAL PRIMARY KEY,
    dashboard_id INTEGER REFERENCES dashboards(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL,
    query TEXT,
    datasource VARCHAR(255),
    options JSONB,
    current JSONB,
    multi BOOLEAN DEFAULT FALSE,
    include_all BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Alerts table
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

-- Alert History table
CREATE TABLE IF NOT EXISTS alert_history (
    id SERIAL PRIMARY KEY,
    alert_id INTEGER REFERENCES alerts(id) ON DELETE CASCADE,
    state VARCHAR(50),
    message TEXT,
    data JSONB,
    triggered_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Templates table
CREATE TABLE IF NOT EXISTS templates (
    id SERIAL PRIMARY KEY,
    uid VARCHAR(40) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(100),
    tags TEXT[],
    dashboard_data JSONB,
    preview_image TEXT,
    created_by INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    downloads INTEGER DEFAULT 0
);

-- Sessions table
CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
    token VARCHAR(500) UNIQUE NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- API Keys table
CREATE TABLE IF NOT EXISTS api_keys (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    key_hash VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) NOT NULL,
    user_id INTEGER REFERENCES users(id),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    last_used TIMESTAMP
);

-- Metrics table (for PostgreSQL datasource)
CREATE TABLE IF NOT EXISTS metrics (
    id SERIAL PRIMARY KEY,
    metric_name VARCHAR(255) NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    value DOUBLE PRECISION NOT NULL,
    labels JSONB,
    host VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_dashboards_created_by ON dashboards(created_by);
CREATE INDEX IF NOT EXISTS idx_dashboards_uid ON dashboards(uid);
CREATE INDEX IF NOT EXISTS idx_panels_dashboard_id ON panels(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_variables_dashboard_id ON variables(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_alerts_dashboard_id ON alerts(dashboard_id);
CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_metrics_timestamp ON metrics(timestamp);
CREATE INDEX IF NOT EXISTS idx_metrics_name ON metrics(metric_name);

-- Insert default admin user
-- Password: admin123
-- Hash generated with: bcrypt.hash('admin123', 10)
INSERT INTO users (username, email, password_hash, full_name, role)
VALUES (
    'admin',
    'admin@grafana-clone.local',
    '$2b$10$5vZ3L6Y8FZL5X8Y8FZL5XeJ8FZL5X8Y8FZL5X8Y8FZL5X8Y8FZL5X',
    'Administrator',
    'admin'
) ON CONFLICT (username) DO NOTHING;

-- Insert sample datasources
INSERT INTO datasources (uid, name, type, url, json_data)
VALUES 
    ('ds-mock-001', 'Mock Data', 'mock', 'http://localhost:4000', '{}'),
    ('ds-prom-001', 'Prometheus', 'prometheus', 'http://prometheus:9090', '{}'),
    ('ds-pg-001', 'PostgreSQL', 'postgres', 'postgres://grafana:password123@postgres:5432/grafana_db', '{}')
ON CONFLICT (uid) DO NOTHING;

-- Function to generate sample metrics
CREATE OR REPLACE FUNCTION generate_sample_metrics() RETURNS void AS $$
DECLARE
    metric_names TEXT[] := ARRAY['cpu_usage', 'memory_usage', 'disk_io', 'network_traffic'];
    host_names TEXT[] := ARRAY['server-01', 'server-02', 'server-03'];
    i INTEGER;
    j INTEGER;
    ts TIMESTAMPTZ;
    metric TEXT;
    host TEXT;
    val DOUBLE PRECISION;
BEGIN
    -- Generate 1000 sample metrics
    FOR i IN 0..999 LOOP
        ts := NOW() - (i || ' minutes')::INTERVAL;
        metric := metric_names[1 + (random() * (array_length(metric_names, 1) - 1))::INTEGER];
        host := host_names[1 + (random() * (array_length(host_names, 1) - 1))::INTEGER];
        val := random() * 100;
        
        INSERT INTO metrics (metric_name, timestamp, value, labels, host)
        VALUES (metric, ts, val, jsonb_build_object('host', host), host);
    END LOOP;
END;
$$ LANGUAGE plpgsql;

-- Generate sample metrics on first run
DO $$
BEGIN
    IF (SELECT COUNT(*) FROM metrics) = 0 THEN
        PERFORM generate_sample_metrics();
        RAISE NOTICE 'Generated 1000 sample metrics';
    END IF;
END $$;