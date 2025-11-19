// frontend/src/components/Alerts.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';

function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [showEditor, setShowEditor] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState(null);

  useEffect(() => {
    fetchAlerts();
  }, []);

  const fetchAlerts = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('http://localhost:4000/api/alerts', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setAlerts(res.data.alerts);
    } catch (err) {
      console.error('Error fetching alerts:', err);
    }
  };

  const deleteAlert = async (id) => {
    if (!window.confirm('Delete this alert?')) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`http://localhost:4000/api/alerts/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchAlerts();
    } catch (err) {
      console.error('Error deleting alert:', err);
    }
  };

  const getStateColor = (state) => {
    switch (state) {
      case 'ok': return '#10b981';
      case 'alerting': return '#ef4444';
      case 'pending': return '#f59e0b';
      default: return '#6b7280';
    }
  };

  return (
    <div className="alerts-page">
      <div className="page-header">
        <h2>Alerts</h2>
        <button className="btn-primary" onClick={() => setShowEditor(true)}>
          + Create Alert
        </button>
      </div>

      <div className="alerts-list">
        {alerts.length === 0 ? (
          <div className="empty-state">
            <h3>No alerts configured</h3>
            <p>Create an alert to get notified about important events</p>
          </div>
        ) : (
          alerts.map(alert => (
            <div key={alert.id} className="alert-card">
              <div className="alert-header">
                <div className="alert-info">
                  <h3>{alert.name}</h3>
                  <span className="alert-meta">
                    {alert.dashboard_title} / {alert.panel_title}
                  </span>
                </div>
                <div className="alert-state" style={{ background: getStateColor(alert.state) }}>
                  {alert.state.toUpperCase()}
                </div>
              </div>

              <div className="alert-body">
                <p>{alert.message}</p>
                <div className="alert-details">
                  <span>⏱️ Frequency: {alert.frequency}</span>
                  {alert.last_triggered && (
                    <span>🔔 Last triggered: {new Date(alert.last_triggered).toLocaleString()}</span>
                  )}
                </div>
              </div>

              <div className="alert-actions">
                <button className="btn" onClick={() => {
                  setSelectedAlert(alert);
                  setShowEditor(true);
                }}>
                  Edit
                </button>
                <button className="btn" onClick={() => deleteAlert(alert.id)}>
                  Delete
                </button>
                <button className="btn">View History</button>
              </div>
            </div>
          ))
        )}
      </div>

      {showEditor && (
        <AlertEditor
          alert={selectedAlert}
          onClose={() => {
            setShowEditor(false);
            setSelectedAlert(null);
          }}
          onSave={() => {
            fetchAlerts();
            setShowEditor(false);
            setSelectedAlert(null);
          }}
        />
      )}
    </div>
  );
}

function AlertEditor({ alert, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: alert?.name || '',
    message: alert?.message || '',
    frequency: alert?.frequency || '1m',
    condition: 'above',
    threshold: 80,
    dashboardId: alert?.dashboard_id || '',
    panelId: alert?.panel_id || ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const token = localStorage.getItem('token');
      const conditions = {
        evaluator: { type: formData.condition, params: [formData.threshold] },
        operator: { type: 'and' },
        query: { params: ['A', '5m', 'now'] }
      };

      const data = {
        ...formData,
        conditions,
        notifications: []
      };

      if (alert) {
        await axios.put(`http://localhost:4000/api/alerts/${alert.id}`, data, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post('http://localhost:4000/api/alerts', data, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }

      onSave();
    } catch (err) {
      console.error('Error saving alert:', err);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="query-editor-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{alert ? 'Edit Alert' : 'Create Alert'}</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="editor-section">
            <h4>Alert Name</h4>
            <input
              type="text"
              className="editor-select"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              placeholder="High CPU Usage"
              required
            />
          </div>

          <div className="editor-section">
            <h4>Message</h4>
            <textarea
              className="query-textarea"
              value={formData.message}
              onChange={(e) => setFormData({...formData, message: e.target.value})}
              placeholder="CPU usage is critically high!"
              rows={3}
            />
          </div>

          <div className="editor-section">
            <h4>Condition</h4>
            <div className="condition-builder">
              <span>WHEN value is</span>
              <select
                className="condition-select"
                value={formData.condition}
                onChange={(e) => setFormData({...formData, condition: e.target.value})}
              >
                <option value="above">above</option>
                <option value="below">below</option>
                <option value="outside_range">outside range</option>
                <option value="within_range">within range</option>
                <option value="no_value">no value</option>
              </select>
              <input
                type="number"
                className="threshold-input"
                value={formData.threshold}
                onChange={(e) => setFormData({...formData, threshold: e.target.value})}
              />
            </div>
          </div>

          <div className="editor-section">
            <h4>Evaluate Frequency</h4>
            <select
              className="editor-select"
              value={formData.frequency}
              onChange={(e) => setFormData({...formData, frequency: e.target.value})}
            >
              <option value="10s">Every 10 seconds</option>
              <option value="30s">Every 30 seconds</option>
              <option value="1m">Every 1 minute</option>
              <option value="5m">Every 5 minutes</option>
              <option value="10m">Every 10 minutes</option>
            </select>
          </div>

          <div className="editor-section">
            <h4>Notifications</h4>
            <button type="button" className="btn">+ Add Notification Channel</button>
            <p className="help-text">Send notifications via Email, Slack, Webhook, etc.</p>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">Save Alert</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Alerts;