// frontend/src/components/Alerts.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';

function Alerts() {
  const [alerts, setAlerts] = useState([]);
  const [showEditor, setShowEditor] = useState(false);
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [historyModal, setHistoryModal] = useState({ open: false, items: [] });
  const [historyPage, setHistoryPage] = useState(1);
  const historyPageSize = 20;

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
      setErrorMsg('');
    } catch (err) {
      console.error('Error fetching alerts:', err);
      setErrorMsg(err.response?.data?.error || 'Failed to fetch alerts');
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

  const viewHistory = async (id) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`http://localhost:4000/api/alerts/${id}/history`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setHistoryModal({ open: true, items: res.data.history || [] });
      setHistoryPage(1);
    } catch (err) {
      console.error('Error fetching history:', err);
      alert('Failed to fetch history');
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

      {errorMsg && <div className="error-banner">{errorMsg}</div>}

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
                <button className="btn" onClick={() => viewHistory(alert.id)}>View History</button>
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

      {historyModal.open && (
        <div className="modal-overlay" onClick={() => setHistoryModal({ open: false, items: [] })}>
          <div className="query-editor-modal history-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Alert History</h3>
              <button className="close-btn" onClick={() => setHistoryModal({ open: false, items: [] })}>✕</button>
            </div>
            <div className="modal-body history-body">
              {historyModal.items.length === 0 ? (
                <p>No history</p>
              ) : (
                <>
                  <div className="history-header">
                    <div className="history-col state">State</div>
                    <div className="history-col msg">Message</div>
                    <div className="history-col time">Time</div>
                  </div>
                  <div className="history-list">
                    {historyModal.items
                      .slice((historyPage - 1) * historyPageSize, historyPage * historyPageSize)
                      .map((h) => (
                        <div key={h.id} className="history-row">
                          <span className="history-col state">{h.state}</span>
                          <span className="history-col msg">{h.message || ''}</span>
                          <span className="history-col time">
                            {h.triggered_at ? new Date(h.triggered_at).toLocaleString() : ''}
                          </span>
                        </div>
                      ))}
                  </div>
                  {historyModal.items.length > historyPageSize && (
                    <div className="pagination">
                      <button
                        className="btn"
                        disabled={historyPage <= 1}
                        onClick={() => setHistoryPage((p) => Math.max(1, p - 1))}
                      >
                        Prev
                      </button>
                      <span className="logs-count">
                        Page {historyPage} / {Math.ceil(historyModal.items.length / historyPageSize)}
                      </span>
                      <button
                        className="btn"
                        disabled={historyPage >= Math.ceil(historyModal.items.length / historyPageSize)}
                        onClick={() => setHistoryPage((p) => Math.min(Math.ceil(historyModal.items.length / historyPageSize), p + 1))}
                      >
                        Next
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function AlertEditor({ alert, onClose, onSave }) {
  const [dashboards, setDashboards] = useState([]);
  const [panels, setPanels] = useState([]);
  const [selectedDashboard, setSelectedDashboard] = useState(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [formData, setFormData] = useState({
    name: alert?.name || '',
    message: alert?.message || '',
    frequency: alert?.frequency || '1m',
    condition: 'above',
    threshold: 80,
    dashboardId: alert?.dashboard_id || '',
    panelId: alert?.panel_id || ''
  });

  useEffect(() => {
    const token = localStorage.getItem('token');
    const fetchDashboards = async () => {
      try {
        const res = await axios.get('http://localhost:4000/api/dashboards', {
          headers: { Authorization: `Bearer ${token}` }
        });
        setDashboards(res.data.dashboards || []);
      } catch (err) {
        console.error('Error fetching dashboards for alerts:', err);
      }
    };
    fetchDashboards();
  }, []);

  useEffect(() => {
    const token = localStorage.getItem('token');
    const dashId = formData.dashboardId;
    if (!dashId) {
      setPanels([]);
      setSelectedDashboard(null);
      return;
    }
    const dashObj = dashboards.find((d) => String(d.id) === String(dashId));
    setSelectedDashboard(dashObj || null);
    const fetchPanels = async () => {
      try {
        const targetId = dashObj?.uid || dashId;
        const res = await axios.get(`http://localhost:4000/api/dashboards/${targetId}`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        setPanels(res.data.panels || res.data?.panels || []);
      } catch (err) {
        console.error('Error fetching panels for alert:', err);
        setPanels([]);
      }
    };
    fetchPanels();
  }, [formData.dashboardId, dashboards]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const dashId = formData.dashboardId;
    const panelId = formData.panelId;
    if (!dashId || !panelId) {
      alert('Please select dashboard and panel');
      return;
    }
    try {
      setSaving(true);
      const token = localStorage.getItem('token');
      const conditions = {
        evaluator: { type: formData.condition, params: [Number(formData.threshold)] },
        operator: { type: 'and' },
        query: { params: ['A', '5m', 'now'] }
      };

      const data = {
        ...formData,
        dashboardId: Number(dashId),
        panelId: Number(panelId),
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
      setErrorMsg('');
    } catch (err) {
      console.error('Error saving alert:', err);
      setErrorMsg(err.response?.data?.error || 'Failed to save alert');
    } finally {
      setSaving(false);
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
            <h4>Dashboard</h4>
            <select
              className="editor-select"
              value={formData.dashboardId}
              onChange={(e) => setFormData({ ...formData, dashboardId: e.target.value, panelId: '' })}
              required
            >
              <option value="">Select dashboard</option>
              {dashboards.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </select>
          </div>

          <div className="editor-section">
            <h4>Panel</h4>
            <select
              className="editor-select"
              value={formData.panelId}
              onChange={(e) => setFormData({ ...formData, panelId: e.target.value })}
              required
              disabled={!formData.dashboardId}
            >
              <option value="">Select panel</option>
              {panels.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.title}
                </option>
              ))}
            </select>
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
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'Saving...' : 'Save Alert'}
            </button>
          </div>
          {errorMsg && <div className="error-banner">{errorMsg}</div>}
        </form>
      </div>
    </div>
  );
}

export default Alerts;
