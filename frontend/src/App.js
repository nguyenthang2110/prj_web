// frontend/src/App.js - Complete with Authentication
import React, { useState, useEffect, useCallback } from 'react';
import GridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import './App.css';
import Login from './components/Login';
import TimeRangePicker from './components/TimeRangePicker';
import Panel from './components/Panel';
import QueryEditor from './components/QueryEditor';
import Alerts from './components/Alerts';
import axios from 'axios';
import AddPanelModal from './components/AddPanelModal';

const API_URL = 'http://localhost:4000/api';

function App() {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [dashboards, setDashboards] = useState([]);
  const [currentDashboard, setCurrentDashboard] = useState(null);
  const [panels, setPanels] = useState([]);
  const [showSidebar, setShowSidebar] = useState(true);
  const [timeRange, setTimeRange] = useState({ from: 'now-1h', to: 'now' });
  const [autoRefresh, setAutoRefresh] = useState(null);
  const [showQueryEditor, setShowQueryEditor] = useState(false);
  const [editingPanel, setEditingPanel] = useState(null);
  const [currentPage, setCurrentPage] = useState('dashboard');
  const [showExportImport, setShowExportImport] = useState(false);
  const [showAddPanelModal, setShowAddPanelModal] = useState(false);
  const [dataSources, setDataSources] = useState([]);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);

  // tick dùng để ép panel refetch data
  const [refreshTick, setRefreshTick] = useState(0);

  // Check for existing session
  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');
    
    if (savedToken && savedUser) {
      setToken(savedToken);
      setUser(JSON.parse(savedUser));
    }
  }, []);

  // Fetch dashboards when logged in
  const handleLogout = useCallback(async () => {
    try {
      await axios.post(`${API_URL}/auth/logout`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      setUser(null);
      setToken(null);
      setDashboards([]);
      setCurrentDashboard(null);
      setPanels([]);
    }
  }, [token]);

  const fetchDashboards = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/dashboards`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDashboards(res.data.dashboards);
      if (res.data.dashboards.length > 0 && !currentDashboard) {
        setCurrentDashboard(res.data.dashboards[0]);
      }
    } catch (err) {
      console.error('Error fetching dashboards:', err);
      if (err.response?.status === 401) {
        handleLogout();
      }
    }
  }, [token, currentDashboard, handleLogout]);

  const fetchDataSources = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/datasources`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDataSources(res.data.datasources || []);
    } catch (err) {
      console.error('Error fetching datasources:', err);
    }
  }, [token]);

  const fetchPanels = useCallback(async (dashboardUid) => {
    if (!dashboardUid) return;
    try {
      const res = await axios.get(`${API_URL}/dashboards/${dashboardUid}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPanels(res.data.panels || []);
    } catch (err) {
      console.error('Error fetching panels:', err);
    }
  }, [token]);

  // Fetch dashboards when logged in
  useEffect(() => {
    if (token) {
      fetchDashboards();
      fetchDataSources();
    }
  }, [token, fetchDashboards, fetchDataSources]);

  // Load panels when dashboard changes
  useEffect(() => {
    if (currentDashboard && token) {
      fetchPanels(currentDashboard.uid);
    }
  }, [currentDashboard, token, fetchPanels]);

  // Auto-refresh: chỉ tăng refreshTick, panel sẽ tự gọi fetchData
  useEffect(() => {
    if (autoRefresh && currentDashboard && token) {
      const interval = setInterval(() => {
        setRefreshTick((prev) => prev + 1);
      }, autoRefresh * 1000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, currentDashboard, token]);

  const handleLoginSuccess = (userData, userToken) => {
    setUser(userData);
    setToken(userToken);
  };

  const createDashboard = async () => {
    const title = prompt('Dashboard name:');
    if (!title) return;

    try {
      const res = await axios.post(`${API_URL}/dashboards`, 
        { title, description: '', tags: [] },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      setDashboards([...dashboards, res.data]);
      setCurrentDashboard(res.data);
    } catch (err) {
      console.error('Error creating dashboard:', err);
    }
  };

  const deleteDashboard = async (uid) => {
    if (!window.confirm('Delete this dashboard?')) return;

    try {
      await axios.delete(`${API_URL}/dashboards/${uid}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const remain = dashboards.filter(d => d.uid !== uid);
      setDashboards(remain);
      if (currentDashboard?.uid === uid) {
        setCurrentDashboard(remain[0] || null);
      }
    } catch (err) {
      console.error('Error deleting dashboard:', err);
    }
  };

  const handleOpenAddPanel = () => {
    setShowAddPanelModal(true);
  };

  const handleCreatePanelFromPreset = async (preset) => {
    if (!currentDashboard) return;

    const newPanelPayload = {
      title: preset.title,
      type: preset.type || 'graph',
      position: { x: 0, y: 0, w: 6, h: 4 },
      datasource: preset.datasource,
      targets: [
        {
          refId: 'A',
          datasource: preset.datasource,
          query: preset.query
        }
      ],
      options: {}
    };

    try {
      const res = await axios.post(
        `${API_URL}/dashboards/${currentDashboard.id}/panels`,
        newPanelPayload,
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setPanels(prev => [...prev, res.data]);
    } catch (err) {
      console.error('Error adding panel:', err);
      alert('Không tạo được panel, xem log console.');
    }
  };

  const removePanel = async (panelId) => {
    try {
      await axios.delete(`${API_URL}/panels/${panelId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPanels(panels.filter(p => p.id !== panelId));
    } catch (err) {
      console.error('Error removing panel:', err);
    }
  };

  const updatePanel = async (panelId, updates) => {
    try {
      const existing = panels.find(p => p.id === panelId);
      const payload = existing ? { ...existing, ...updates } : updates;
      const res = await axios.put(`${API_URL}/panels/${panelId}`, payload, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPanels(panels.map(p => (p.id === panelId ? res.data : p)));
    } catch (err) {
      console.error('Error updating panel:', err);
    }
  };

  const onLayoutChange = (layout) => {
    layout.forEach(item => {
      const panel = panels.find(p => p.id.toString() === item.i);
      if (panel) {
        updatePanel(panel.id, {
          ...panel,
          position: { x: item.x, y: item.y, w: item.w, h: item.h }
        });
      }
    });
  };

  const exportDashboard = async () => {
    if (!currentDashboard) return;

    try {
      const res = await axios.get(
        `${API_URL}/dashboards/${currentDashboard.uid}/export`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'blob'
        }
      );
      
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `${currentDashboard.uid}.json`);
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (err) {
      console.error('Export error:', err);
    }
  };

  const importDashboard = async (file) => {
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      
      await axios.post(`${API_URL}/dashboards/import`, data, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      fetchDashboards();
      alert('Dashboard imported successfully!');
    } catch (err) {
      console.error('Import error:', err);
      alert('Failed to import dashboard');
    }
  };

  const handleManualRefresh = () => {
    // reload cấu trúc panel (nếu có panel mới/sửa/xoá)
    if (currentDashboard) {
      fetchPanels(currentDashboard.uid);
    }
    // ép tất cả panel refetch dữ liệu
    setRefreshTick(prev => prev + 1);
  };

  // Show login if not authenticated
  if (!user || !token) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="app">
      {/* Top Navigation */}
      <nav className="navbar">
        <div className="navbar-left">
          <button className="menu-btn" onClick={() => setShowSidebar(!showSidebar)}>
            ☰
          </button>
          <h1 className="logo">📊 Grafana Clone</h1>
        </div>
        
        <div className="navbar-center">
          {currentPage === 'dashboard' && (
            <select 
              className="dashboard-select"
              value={currentDashboard?.uid || ''}
              onChange={(e) => {
                const dash = dashboards.find(d => d.uid === e.target.value);
                setCurrentDashboard(dash);
              }}
            >
              <option value="">Select Dashboard</option>
              {dashboards.map(d => (
                <option key={d.uid} value={d.uid}>{d.title}</option>
              ))}
            </select>
          )}
        </div>

        <div className="navbar-right">
          {currentPage === 'dashboard' && (
            <>
              <TimeRangePicker value={timeRange} onChange={setTimeRange} />
              <select 
                className="refresh-select"
                value={autoRefresh || ''}
                onChange={(e) =>
                  setAutoRefresh(e.target.value ? parseInt(e.target.value) : null)
                }
              >
                <option value="">Off</option>
                <option value="5">5s</option>
                <option value="10">10s</option>
                <option value="30">30s</option>
                <option value="60">1m</option>
              </select>
              <button
                className="nav-btn"
                onClick={handleManualRefresh}
                title="Refresh now"
              >
                🔄
              </button>
            </>
          )}
          <div className="account-wrapper">
            <button
              className="nav-btn"
              title={`Logged in as ${user.username}`}
              onClick={() => setShowAccountMenu((prev) => !prev)}
            >
              👤
            </button>
            {showAccountMenu && (
              <div className="account-menu">
                <div className="account-menu-header">
                  <div className="account-name">{user?.username}</div>
                  <div className="account-email">{user?.email}</div>
                </div>
                <button
                  className="account-menu-item"
                  onClick={() => {
                    setShowAccountModal(true);
                    setShowAccountMenu(false);
                  }}
                >
                  🔒 Change Password
                </button>
                <button
                  className="account-menu-item"
                  onClick={() => {
                    setShowAccountMenu(false);
                    handleLogout();
                  }}
                >
                  🚪 Logout
                </button>
              </div>
            )}
          </div>
        </div>
      </nav>

      <div className="main-container">
        {/* Sidebar */}
        {showSidebar && (
          <aside className="sidebar">
            <div className="sidebar-section">
              <h3>Navigation</h3>
              <ul className="nav-list">
                <li
                  className={currentPage === 'dashboard' ? 'active' : ''}
                  onClick={() => setCurrentPage('dashboard')}
                >
                  📊 Dashboards
                </li>
                <li
                  className={currentPage === 'alerts' ? 'active' : ''}
                  onClick={() => setCurrentPage('alerts')}
                >
                  🔔 Alerts
                </li>
                <li
                  className={currentPage === 'logs' ? 'active' : ''}
                  onClick={() => setCurrentPage('logs')}
                >
                  🧾 Logs
                </li>
              </ul>
            </div>

            {currentPage === 'dashboard' && (
              <>
                <div className="sidebar-section">
                  <h3>Dashboards</h3>
                  <button className="btn-primary" onClick={createDashboard}>
                    + New Dashboard
                  </button>
                  <ul className="dashboard-list">
                    {dashboards.map(d => (
                      <li 
                        key={d.uid}
                        className={currentDashboard?.uid === d.uid ? 'active' : ''}
                        onClick={() => setCurrentDashboard(d)}
                      >
                        <span>📄 {d.title}</span>
                        <button
                          className="delete-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteDashboard(d.uid);
                          }}
                        >
                          🗑️
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="sidebar-section">
                  <h3>Data Sources</h3>
                  <ul className="data-source-list">
                    {dataSources.length === 0 && (
                      <li className="muted">No data sources available</li>
                    )}
                    {dataSources.map((ds) => (
                      <li key={ds.id}>
                        {ds.type === 'postgres' ? '🗄️' : ds.type === 'prometheus' ? '📈' : '🔌'}{' '}
                        {ds.name || ds.id}
                      </li>
                    ))}
                  </ul>
                </div>
              </>
            )}
          </aside>
        )}

        {/* Main Content */}
        <main className="dashboard-content">
          {currentPage === 'dashboard' && currentDashboard ? (
            <>
              <div className="dashboard-header">
                <h2>{currentDashboard.title}</h2>
                <div className="dashboard-controls">
                  <button className="btn" onClick={handleOpenAddPanel}>
                    ➕ Add Panel
                  </button>
                </div>
              </div>

              {/* Dashboard Grid */}
              <GridLayout
                className="dashboard-grid"
                layout={panels.map(p => ({
                  i: p.id.toString(),
                  x: p.position?.x || 0,
                  y: p.position?.y || 0,
                  w: p.position?.w || 6,
                  h: p.position?.h || 4,
                  minW: 2,
                  minH: 2
                }))}
                cols={12}
                rowHeight={60}
                width={1200}
                onLayoutChange={onLayoutChange}
                draggableHandle=".panel-drag-handle"
              >
                {panels.map(panel => (
                  <div key={panel.id.toString()}>
                    <Panel 
                      panel={panel}
                      timeRange={timeRange}
                      token={token}
                      refreshTick={refreshTick}
                      onRemove={removePanel}
                      onEdit={(p) => {
                        setEditingPanel(p);
                        setShowQueryEditor(true);
                      }}
                      onUpdate={updatePanel}
                    />
                  </div>
                ))}
              </GridLayout>
            </>
          ) : currentPage === 'alerts' ? (
            <Alerts />
          ) : currentPage === 'logs' ? (
            <Logs token={token} />
          ) : (
            <div className="empty-state">
              <h2>No dashboard selected</h2>
              <p>Create a new dashboard to get started</p>
              <button className="btn-primary" onClick={createDashboard}>
                Create Dashboard
              </button>
            </div>
          )}
        </main>
      </div>

      {/* Query Editor Modal */}
      {showQueryEditor && (
        <QueryEditor
          panel={editingPanel}
          onClose={() => setShowQueryEditor(false)}
          onSave={(updates) => {
            updatePanel(editingPanel.id, updates);
            setShowQueryEditor(false);
          }}
        />
      )}

      {/* Export/Import Modal */}
      {showExportImport && (
        <ExportImportModal
          onClose={() => setShowExportImport(false)}
          onExport={exportDashboard}
          onImport={importDashboard}
        />
      )}

      {/* Add Panel Modal */}
      <AddPanelModal
        isOpen={showAddPanelModal}
        onClose={() => setShowAddPanelModal(false)}
        onCreate={handleCreatePanelFromPreset}
      />

      {showAccountModal && (
        <AccountModal
          onClose={() => setShowAccountModal(false)}
          token={token}
          user={user}
        />
      )}
    </div>
  );
}

function AccountModal({ onClose, token, user }) {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('');
    setError('');
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match');
      return;
    }
    try {
      setLoading(true);
      await axios.post(
        `${API_URL}/auth/change-password`,
        { currentPassword, newPassword },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setStatus('Password changed successfully');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err.response?.data?.error || 'Failed to change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="query-editor-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Account</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <p>Logged in as <strong>{user?.username}</strong> ({user?.email})</p>
          <form onSubmit={handleSubmit}>
            <div className="editor-section">
              <h4>Current Password</h4>
              <input
                type={showCurrent ? 'text' : 'password'}
                className="editor-select"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
              />
              <div className="inline-actions">
                <button
                  type="button"
                  className="btn"
                  onClick={() => setShowCurrent((prev) => !prev)}
                >
                  {showCurrent ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            <div className="editor-section">
              <h4>New Password</h4>
              <input
                type={showNew ? 'text' : 'password'}
                className="editor-select"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
              />
              <div className="inline-actions">
                <button
                  type="button"
                  className="btn"
                  onClick={() => setShowNew((prev) => !prev)}
                >
                  {showNew ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            <div className="editor-section">
              <h4>Confirm New Password</h4>
              <input
                type={showConfirm ? 'text' : 'password'}
                className="editor-select"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
              />
              <div className="inline-actions">
                <button
                  type="button"
                  className="btn"
                  onClick={() => setShowConfirm((prev) => !prev)}
                >
                  {showConfirm ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
            {error && <div className="error-banner">{error}</div>}
            {status && <div className="success-banner">{status}</div>}
            <div className="modal-footer">
              <button type="button" className="btn" onClick={onClose}>Close</button>
              <button type="submit" className="btn-primary" disabled={loading}>
                {loading ? 'Saving...' : 'Change Password'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

function ExportImportModal({ onClose, onExport, onImport }) {
  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (file) {
      onImport(file);
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="query-editor-modal small-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3>Import / Export Dashboard</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="export-import-actions">
            <div className="action-card">
              <h4>📤 Export</h4>
              <p>Download dashboard as JSON file</p>
              <button
                className="btn-primary"
                onClick={() => {
                  onExport();
                  onClose();
                }}
              >
                Export Dashboard
              </button>
            </div>

            <div className="action-card">
              <h4>📥 Import</h4>
              <p>Upload dashboard JSON file</p>
              <input
                type="file"
                accept=".json"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
                id="import-file"
              />
              <label
                htmlFor="import-file"
                className="btn-primary"
                style={{ cursor: 'pointer' }}
              >
                Choose File
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;

function Logs({ token }) {
  const [dsLogs, setDsLogs] = useState([]);
  const [dsLoading, setDsLoading] = useState(false);
  const [datasources, setDatasources] = useState([]);
  const [selectedDs, setSelectedDs] = useState('');
  const [page, setPage] = useState(1);
  const pageSize = 20;

  const fetchDatasources = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/datasources`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDatasources(res.data.datasources || []);
      if (res.data.datasources?.length) {
        setSelectedDs(res.data.datasources[0].id);
      }
    } catch (err) {
      console.error('Error fetching datasources:', err);
    }
  }, [token]);

  const fetchDsLogs = useCallback(async (id) => {
    setDsLoading(true);
    try {
      const res = await axios.get(`${API_URL}/datasources/${id}/logs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setDsLogs(res.data.logs || []);
    } catch (err) {
      console.error('Error fetching datasource logs:', err);
    } finally {
      setDsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchDatasources();
  }, [fetchDatasources]);

  useEffect(() => {
    if (selectedDs) {
      fetchDsLogs(selectedDs);
      setPage(1);
    }
  }, [selectedDs, fetchDsLogs]);

  const totalPages = Math.max(1, Math.ceil(dsLogs.length / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = (currentPage - 1) * pageSize;
  const visibleLogs = dsLogs.slice(start, start + pageSize);

  return (
    <div className="logs-page">
      <div className="page-header" style={{ marginTop: 24 }}>
        <h2>Datasource Logs</h2>
        <div className="logs-filter-row">
          <select
            className="editor-select"
            value={selectedDs}
            onChange={(e) => setSelectedDs(e.target.value)}
          >
            {datasources.map((ds) => (
              <option key={ds.id} value={ds.id}>
                {ds.name || ds.id}
              </option>
            ))}
          </select>
          <button className="btn" onClick={() => fetchDsLogs(selectedDs)}>🔄</button>
        </div>
      </div>
      {dsLoading ? (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading datasource logs...</p>
        </div>
      ) : (
        <>
          <div className="logs-list scrollable">
            {visibleLogs.length === 0 ? (
              <p>No datasource logs</p>
            ) : (
              visibleLogs.map((log, idx) => (
                <div key={idx} className={`log-item log-${log.level}`}>
                  <span className="log-time">{new Date(log.timestamp).toLocaleString()}</span>
                  <span className="log-level">[{log.level?.toUpperCase() || 'INFO'}]</span>
                  <span className="log-msg">{log.message}</span>
                </div>
              ))
            )}
          </div>
            <div className="logs-actions">
              <div className="pagination">
                <button
                  className="btn"
                  disabled={currentPage <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                >
                  Prev
                </button>
                <span className="logs-count">
                  Page {currentPage} / {totalPages} ({visibleLogs.length}/{dsLogs.length})
                </span>
                <button
                  className="btn"
                  disabled={currentPage >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                >
                  Next
                </button>
              </div>
              <button className="btn danger" onClick={async () => {
                try {
                  await axios.delete(`${API_URL}/datasources/${selectedDs}/logs`, {
                    headers: { Authorization: `Bearer ${token}` }
                  });
                  setDsLogs([]);
                  setPage(1);
                } catch (err) {
                  alert(err.response?.data?.error || 'Failed to clear logs');
                }
              }}>
                Clear Logs
            </button>
          </div>
        </>
      )}
    </div>
  );
}
