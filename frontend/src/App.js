// frontend/src/App.js - Complete with Authentication
import React, { useState, useEffect } from 'react';
import GridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import './App.css';
import Login from './components/Login';
import TimeRangePicker from './components/TimeRangePicker';
import Panel from './components/Panel';
import QueryEditor from './components/QueryEditor';
import Variables from './components/Variables';
import Alerts from './components/Alerts';
import Templates from './components/Templates';
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
  useEffect(() => {
    if (token) {
      fetchDashboards();
    }
  }, [token]);

  // Load panels when dashboard changes
  useEffect(() => {
    if (currentDashboard && token) {
      fetchPanels(currentDashboard.uid);
    }
  }, [currentDashboard, token]);

  // Auto-refresh: chỉ tăng refreshTick, panel sẽ tự gọi fetchData
  useEffect(() => {
    if (autoRefresh && currentDashboard && token) {
      const interval = setInterval(() => {
        setRefreshTick((prev) => prev + 1);
      }, autoRefresh * 1000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, currentDashboard, token]);

  const fetchDashboards = async () => {
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
  };

  const fetchPanels = async (dashboardUid) => {
    if (!dashboardUid) return;
    try {
      const res = await axios.get(`${API_URL}/dashboards/${dashboardUid}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPanels(res.data.panels || []);
    } catch (err) {
      console.error('Error fetching panels:', err);
    }
  };

  const handleLoginSuccess = (userData, userToken) => {
    setUser(userData);
    setToken(userToken);
  };

  const handleLogout = async () => {
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
      const res = await axios.put(`${API_URL}/panels/${panelId}`, updates, {
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
          <button className="nav-btn" title={`Logged in as ${user.username}`}>
            👤
          </button>
          <button className="nav-btn" onClick={handleLogout} title="Logout">
            🚪
          </button>
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
                  className={currentPage === 'templates' ? 'active' : ''}
                  onClick={() => setCurrentPage('templates')}
                >
                  📄 Templates
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
                      >
                        <span onClick={() => setCurrentDashboard(d)}>
                          📄 {d.title}
                        </span>
                        <button 
                          className="delete-btn"
                          onClick={() => deleteDashboard(d.uid)}
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
                    <li>🗄️ PostgreSQL</li>
                    <li>📈 Prometheus</li>
                    <li>⏱️ InfluxDB</li>
                    <li>📊 Mock Data</li>
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
                  <button
                    className="btn"
                    onClick={() => setShowExportImport(true)}
                  >
                    📥 Import/Export
                  </button>
                  <button className="btn">💾 Save</button>
                  <button className="btn">⚙️ Settings</button>
                </div>
              </div>

              {/* Variables */}
              <Variables dashboardId={currentDashboard.id} />

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
          ) : currentPage === 'templates' ? (
            <Templates
              onUseTemplate={(template) => {
                console.log('Using template:', template);
                // Import template as new dashboard
              }}
            />
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