// frontend/src/components/PanelConfigModal.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';

function PanelConfigModal({ onClose, onSave, dashboardId }) {
  const [config, setConfig] = useState({
    title: 'New Panel',
    type: 'graph',
    datasource: 'mock',
    metric: '',
    query: '',
    aggregation: 'AVG',
    interval: '1m',
    groupBy: []
  });

  const [availableMetrics, setAvailableMetrics] = useState({
    mock: ['cpu_usage', 'memory_usage', 'disk_io', 'network_traffic'],
    postgres: [],
    prometheus: []
  });

  const [previewData, setPreviewData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState(1); // 1: Basic, 2: Query, 3: Preview

  // Load available metrics khi chọn datasource
  useEffect(() => {
    if (config.datasource !== 'mock') {
      fetchAvailableMetrics(config.datasource);
    }
  }, [config.datasource]);

  const fetchAvailableMetrics = async (datasource) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(
        `http://localhost:4000/api/datasources/${datasource}/metrics`,
        { headers: { Authorization: `Bearer ${token}` }}
      );
      
      setAvailableMetrics(prev => ({
        ...prev,
        [datasource]: res.data.metrics || []
      }));
    } catch (err) {
      console.error('Error fetching metrics:', err);
    }
  };

  const handlePreview = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const params = {
        datasource: config.datasource,
        metric: config.metric,
        query: config.query,
        from: 'now-1h',
        to: 'now',
        aggregation: config.aggregation
      };

      const res = await axios.get('http://localhost:4000/api/metrics', {
        params,
        headers: { Authorization: `Bearer ${token}` }
      });

      setPreviewData(res.data);
    } catch (err) {
      console.error('Preview error:', err);
      alert('Failed to preview data: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    // Validate
    if (!config.title) {
      alert('Please enter panel title');
      return;
    }

    if (config.datasource !== 'mock' && !config.metric && !config.query) {
      alert('Please select a metric or enter a query');
      return;
    }

    // Create panel config
    const panelConfig = {
      title: config.title,
      type: config.type,
      datasource: config.datasource,
      metric: config.metric,
      query: config.query,
      options: {
        aggregation: config.aggregation,
        interval: config.interval,
        groupBy: config.groupBy
      },
      position: { x: 0, y: 0, w: 6, h: 4 }
    };

    onSave(panelConfig);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="panel-config-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Configure New Panel</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        {/* Step Indicator */}
        <div className="config-steps">
          <div className={`step ${step === 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}>
            <span className="step-number">1</span>
            <span className="step-label">Basic Info</span>
          </div>
          <div className={`step ${step === 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}>
            <span className="step-number">2</span>
            <span className="step-label">Data Query</span>
          </div>
          <div className={`step ${step === 3 ? 'active' : ''}`}>
            <span className="step-number">3</span>
            <span className="step-label">Preview</span>
          </div>
        </div>

        <div className="modal-body">
          {/* Step 1: Basic Info */}
          {step === 1 && (
            <div className="config-section">
              <h4>Basic Information</h4>
              
              <div className="form-group">
                <label>Panel Title *</label>
                <input
                  type="text"
                  value={config.title}
                  onChange={(e) => setConfig({...config, title: e.target.value})}
                  placeholder="e.g., CPU Usage, Memory Stats"
                  className="config-input"
                  autoFocus
                />
              </div>

              <div className="form-group">
                <label>Visualization Type *</label>
                <select
                  value={config.type}
                  onChange={(e) => setConfig({...config, type: e.target.value})}
                  className="config-select"
                >
                  <option value="graph">📈 Line Graph</option>
                  <option value="bar">📊 Bar Chart</option>
                  <option value="pie">🥧 Pie Chart</option>
                  <option value="stat">🔢 Stat Panel</option>
                  <option value="table">📋 Table</option>
                </select>
              </div>

              <div className="form-group">
                <label>Data Source *</label>
                <select
                  value={config.datasource}
                  onChange={(e) => setConfig({...config, datasource: e.target.value, metric: ''})}
                  className="config-select"
                >
                  <option value="mock">🎲 Mock Data (Random)</option>
                  <option value="postgres">🐘 PostgreSQL</option>
                  <option value="prometheus">📊 Prometheus</option>
                </select>
              </div>

              <div className="datasource-info">
                {config.datasource === 'mock' && (
                  <p>ℹ️ Mock data generates random values for testing</p>
                )}
                {config.datasource === 'postgres' && (
                  <p>ℹ️ PostgreSQL will query from the 'metrics' table</p>
                )}
                {config.datasource === 'prometheus' && (
                  <p>ℹ️ Prometheus will query time-series metrics</p>
                )}
              </div>
            </div>
          )}

          {/* Step 2: Query Configuration */}
          {step === 2 && (
            <div className="config-section">
              <h4>Query Configuration</h4>

              {config.datasource === 'mock' ? (
                <div className="form-group">
                  <label>Metric Type</label>
                  <select
                    value={config.metric}
                    onChange={(e) => setConfig({...config, metric: e.target.value})}
                    className="config-select"
                  >
                    <option value="">Select metric...</option>
                    {availableMetrics.mock.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
              ) : (
                <>
                  <div className="query-mode-tabs">
                    <button 
                      className={`tab ${!config.query ? 'active' : ''}`}
                      onClick={() => setConfig({...config, query: ''})}
                    >
                      Metric Builder
                    </button>
                    <button 
                      className={`tab ${config.query ? 'active' : ''}`}
                      onClick={() => setConfig({...config, metric: '', query: 'SELECT '})}
                    >
                      Raw Query
                    </button>
                  </div>

                  {!config.query ? (
                    // Metric Builder Mode
                    <>
                      <div className="form-group">
                        <label>Metric *</label>
                        <select
                          value={config.metric}
                          onChange={(e) => setConfig({...config, metric: e.target.value})}
                          className="config-select"
                        >
                          <option value="">Select metric...</option>
                          {availableMetrics[config.datasource]?.map(m => (
                            <option key={m} value={m}>{m}</option>
                          ))}
                        </select>
                        <small>Available metrics from {config.datasource}</small>
                      </div>

                      <div className="form-group">
                        <label>Aggregation</label>
                        <select
                          value={config.aggregation}
                          onChange={(e) => setConfig({...config, aggregation: e.target.value})}
                          className="config-select"
                        >
                          <option value="AVG">Average (AVG)</option>
                          <option value="SUM">Sum (SUM)</option>
                          <option value="MIN">Minimum (MIN)</option>
                          <option value="MAX">Maximum (MAX)</option>
                          <option value="COUNT">Count (COUNT)</option>
                        </select>
                      </div>

                      <div className="form-group">
                        <label>Group By (Optional)</label>
                        <input
                          type="text"
                          value={config.groupBy.join(', ')}
                          onChange={(e) => setConfig({
                            ...config, 
                            groupBy: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
                          })}
                          placeholder="e.g., host, region"
                          className="config-input"
                        />
                        <small>Comma-separated fields for grouping</small>
                      </div>

                      {config.datasource === 'postgres' && (
                        <div className="query-preview">
                          <strong>Generated SQL:</strong>
                          <pre>{generatePostgreSQLPreview(config)}</pre>
                        </div>
                      )}
                    </>
                  ) : (
                    // Raw Query Mode
                    <div className="form-group">
                      <label>Custom Query *</label>
                      <textarea
                        value={config.query}
                        onChange={(e) => setConfig({...config, query: e.target.value})}
                        placeholder={getQueryPlaceholder(config.datasource)}
                        className="query-textarea"
                        rows={8}
                      />
                      <small>Write your custom {config.datasource} query</small>
                    </div>
                  )}

                  <div className="form-group">
                    <label>Time Interval</label>
                    <select
                      value={config.interval}
                      onChange={(e) => setConfig({...config, interval: e.target.value})}
                      className="config-select"
                    >
                      <option value="10s">10 seconds</option>
                      <option value="30s">30 seconds</option>
                      <option value="1m">1 minute</option>
                      <option value="5m">5 minutes</option>
                      <option value="10m">10 minutes</option>
                      <option value="1h">1 hour</option>
                    </select>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 3: Preview */}
          {step === 3 && (
            <div className="config-section">
              <h4>Data Preview</h4>
              
              <div className="preview-actions">
                <button 
                  className="btn-primary"
                  onClick={handlePreview}
                  disabled={loading}
                >
                  {loading ? '⏳ Loading...' : '▶️ Run Query'}
                </button>
              </div>

              {previewData && (
                <div className="preview-results">
                  <div className="preview-stats">
                    <div className="stat-box">
                      <span className="stat-label">Data Points</span>
                      <span className="stat-value">
                        {previewData.data?.length || 0}
                      </span>
                    </div>
                    <div className="stat-box">
                      <span className="stat-label">Type</span>
                      <span className="stat-value">{previewData.type}</span>
                    </div>
                  </div>

                  <div className="preview-data">
                    <strong>Sample Data (first 5 rows):</strong>
                    <table className="preview-table">
                      <thead>
                        <tr>
                          <th>Timestamp</th>
                          <th>Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewData.data?.slice(0, 5).map((row, idx) => (
                          <tr key={idx}>
                            <td>{new Date(row.timestamp).toLocaleString()}</td>
                            <td>{row.value?.toFixed(2)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {!previewData && !loading && (
                <div className="preview-empty">
                  <p>Click "Run Query" to preview your data</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Navigation Footer */}
        <div className="modal-footer">
          <div className="footer-left">
            {step > 1 && (
              <button className="btn" onClick={() => setStep(step - 1)}>
                ← Back
              </button>
            )}
          </div>
          <div className="footer-right">
            {step < 3 ? (
              <button 
                className="btn-primary" 
                onClick={() => setStep(step + 1)}
              >
                Next →
              </button>
            ) : (
              <>
                <button className="btn" onClick={onClose}>
                  Cancel
                </button>
                <button className="btn-primary" onClick={handleSave}>
                  ✓ Create Panel
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper functions
function generatePostgreSQLPreview(config) {
  return `SELECT 
  DATE_TRUNC('minute', timestamp) AS timestamp,
  ${config.aggregation}(value) AS value${config.groupBy.length > 0 ? ',\n  ' + config.groupBy.join(', ') : ''}
FROM metrics
WHERE timestamp >= now() - interval '1 hour'
  AND timestamp <= now()
  AND metric_name = '${config.metric}'
GROUP BY timestamp${config.groupBy.length > 0 ? ', ' + config.groupBy.join(', ') : ''}
ORDER BY timestamp ASC;`;
}

function getQueryPlaceholder(datasource) {
  switch (datasource) {
    case 'postgres':
      return `SELECT timestamp,value,host FROM metrics
            WHERE metric_name = 'cpu_usage'
            AND timestamp > now() - interval '1 hour'
            ORDER BY timestamp;`;
    case 'prometheus':
      return `rate(node_cpu_seconds_total[5m])`;
    
    default:
      return 'Enter your query here...';
  }
}

export default PanelConfigModal;