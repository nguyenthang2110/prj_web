// frontend/src/components/VersionHistory.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';

function VersionHistory({ dashboard, onClose, onRestore }) {
  const [versions, setVersions] = useState([]);
  const [selectedVersion, setSelectedVersion] = useState(null);
  const [comparing, setComparing] = useState(false);
  const [compareWith, setCompareWith] = useState(null);

  useEffect(() => {
    fetchVersions();
  }, [dashboard.uid]);

  const fetchVersions = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`http://localhost:4000/api/dashboards/${dashboard.uid}/versions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVersions(res.data.versions || []);
    } catch (err) {
      console.error('Error fetching versions:', err);
    }
  };

  const viewVersion = async (version) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`http://localhost:4000/api/dashboards/${dashboard.uid}/versions/${version.version}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setSelectedVersion(res.data);
    } catch (err) {
      console.error('Error viewing version:', err);
    }
  };

  const restoreVersion = async (version) => {
    if (!window.confirm(`Restore dashboard to version ${version.version}?`)) return;

    try {
      const token = localStorage.getItem('token');
      await axios.post(`http://localhost:4000/api/dashboards/${dashboard.uid}/restore`, 
        { version: version.version },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      alert('Dashboard restored successfully!');
      onRestore();
      onClose();
    } catch (err) {
      alert('Failed to restore version');
    }
  };

  const compareVersions = (v1, v2) => {
    setSelectedVersion(v1);
    setCompareWith(v2);
    setComparing(true);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="version-history-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Version History: {dashboard.title}</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          <div className="version-layout">
            {/* Version List */}
            <div className="version-list">
              <h4>Versions ({versions.length})</h4>
              {versions.map(version => (
                <div 
                  key={version.version} 
                  className={`version-item ${selectedVersion?.version === version.version ? 'selected' : ''}`}
                  onClick={() => viewVersion(version)}
                >
                  <div className="version-info">
                    <div className="version-number">v{version.version}</div>
                    <div className="version-meta">
                      <strong>{version.message || 'No message'}</strong>
                      <p>
                        {new Date(version.created_at).toLocaleString()}
                      </p>
                      <p className="version-author">
                        By {version.created_by_name || 'Unknown'}
                      </p>
                    </div>
                  </div>
                  <div className="version-actions">
                    {version.version !== dashboard.version && (
                      <button 
                        className="btn-small"
                        onClick={(e) => {
                          e.stopPropagation();
                          restoreVersion(version);
                        }}
                      >
                        Restore
                      </button>
                    )}
                    {version.version === dashboard.version && (
                      <span className="current-badge">Current</span>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Version Preview */}
            <div className="version-preview">
              {selectedVersion ? (
                <>
                  <div className="preview-header">
                    <h4>Version {selectedVersion.version} Preview</h4>
                    {comparing && compareWith && (
                      <span className="compare-label">
                        Comparing with v{compareWith.version}
                      </span>
                    )}
                  </div>

                  <div className="preview-content">
                    <div className="preview-section">
                      <h5>Dashboard Settings</h5>
                      <div className="settings-grid">
                        <div className="setting-item">
                          <label>Title:</label>
                          <span>{selectedVersion.title}</span>
                        </div>
                        <div className="setting-item">
                          <label>Description:</label>
                          <span>{selectedVersion.description || 'None'}</span>
                        </div>
                        <div className="setting-item">
                          <label>Tags:</label>
                          <span>{selectedVersion.tags?.join(', ') || 'None'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="preview-section">
                      <h5>Panels ({selectedVersion.panels?.length || 0})</h5>
                      <div className="panels-preview">
                        {selectedVersion.panels?.map((panel, idx) => (
                          <div key={idx} className="panel-preview-card">
                            <strong>{panel.title}</strong>
                            <span className="panel-type">{panel.type}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="preview-section">
                      <h5>Variables ({selectedVersion.variables?.length || 0})</h5>
                      <div className="variables-preview">
                        {selectedVersion.variables?.map((variable, idx) => (
                          <div key={idx} className="variable-preview">
                            <code>${variable.name}</code>
                            <span>{variable.type}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="preview-section">
                      <h5>Change Summary</h5>
                      <div className="change-summary">
                        <div className="change-stat">
                          <span className="change-label">Panels:</span>
                          <span className="change-value">{selectedVersion.panels?.length || 0}</span>
                        </div>
                        <div className="change-stat">
                          <span className="change-label">Variables:</span>
                          <span className="change-value">{selectedVersion.variables?.length || 0}</span>
                        </div>
                        <div className="change-stat">
                          <span className="change-label">Size:</span>
                          <span className="change-value">
                            {(JSON.stringify(selectedVersion).length / 1024).toFixed(2)} KB
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="empty-preview">
                  <p>Select a version to preview</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VersionHistory;