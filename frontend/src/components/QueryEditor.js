import React, { useState } from 'react';
import axios from 'axios';

const DATASOURCES = [
  { id: 'prometheus', name: 'Prometheus', type: 'prometheus' },
  { id: 'postgres', name: 'PostgreSQL', type: 'postgres' }
];

const METRICS = [
  'cpu_usage',
  'memory_usage',
  'disk_io',
  'network_traffic',
  'request_count',
  'response_time',
  'error_rate'
];

function QueryEditor({ panel, onClose, onSave }) {
  const [datasource, setDatasource] = useState(panel.datasource || 'prometheus');
  const [metric, setMetric] = useState(panel.metric || 'cpu_usage');
  const [query, setQuery] = useState(panel.query || '');
  const [interval, setInterval] = useState(panel.interval || '1m');
  const [previewData, setPreviewData] = useState(null);
  const [loading, setLoading] = useState(false);

  const runQuery = async () => {
    setLoading(true);
    try {
      const res = await axios.post('http://localhost:4000/api/query', {
        datasource,
        query: query || `SELECT ${metric} FROM metrics`,
        metric
      });
      setPreviewData(res.data.result);
    } catch (err) {
      console.error('Query error:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = () => {
    onSave({ datasource, metric, query, interval });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="query-editor-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Panel Editor - {panel.title}</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="editor-section">
            <h4>Data Source</h4>
            <select value={datasource} onChange={(e) => setDatasource(e.target.value)} className="editor-select">
              {DATASOURCES.map(ds => (
                <option key={ds.id} value={ds.id}>{ds.name} ({ds.type})</option>
              ))}
            </select>
          </div>

          <div className="editor-section">
            <h4>Metric</h4>
            <select value={metric} onChange={(e) => setMetric(e.target.value)} className="editor-select">
              {METRICS.map(m => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <div className="editor-section">
            <h4>Query</h4>
            <textarea 
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={`Example: SELECT ${metric} FROM metrics WHERE time > now() - 1h`}
              className="query-textarea"
              rows={6}
            />
          </div>

          <div className="editor-section">
            <h4>Interval</h4>
            <select value={interval} onChange={(e) => setInterval(e.target.value)} className="editor-select">
              <option value="10s">10 seconds</option>
              <option value="30s">30 seconds</option>
              <option value="1m">1 minute</option>
              <option value="5m">5 minutes</option>
            </select>
          </div>

          <div className="editor-actions">
            <button className="btn" onClick={runQuery} disabled={loading}>
              {loading ? '⏳ Running...' : '▶️ Run Query'}
            </button>
          </div>

          {previewData && (
            <div className="editor-section">
              <h4>Query Results</h4>
              <div className="query-results">
                <pre>{JSON.stringify(previewData, null, 2)}</pre>
              </div>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave}>Save Changes</button>
        </div>
      </div>
    </div>
  );
}

export default QueryEditor;
