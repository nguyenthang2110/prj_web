// frontend/src/components/DashboardSharing.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';

function DashboardSharing({ dashboard, onClose }) {
  const [permissions, setPermissions] = useState([]);
  const [publicLink, setPublicLink] = useState(null);
  const [newUser, setNewUser] = useState({ email: '', role: 'viewer' });
  const [shareSettings, setShareSettings] = useState({
    isPublic: false,
    allowAnonymous: false,
    requireAuth: true
  });

  useEffect(() => {
    fetchPermissions();
    fetchPublicLink();
  }, [dashboard.uid]);

  const fetchPermissions = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`http://localhost:4000/api/dashboards/${dashboard.uid}/permissions`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPermissions(res.data.permissions || []);
    } catch (err) {
      console.error('Error fetching permissions:', err);
    }
  };

  const fetchPublicLink = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`http://localhost:4000/api/dashboards/${dashboard.uid}/public-link`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.link) {
        setPublicLink(res.data.link);
        setShareSettings(res.data.settings);
      }
    } catch (err) {
      console.error('Error fetching public link:', err);
    }
  };

  const addPermission = async () => {
    if (!newUser.email) return;

    try {
      const token = localStorage.getItem('token');
      await axios.post(`http://localhost:4000/api/dashboards/${dashboard.uid}/permissions`, newUser, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setNewUser({ email: '', role: 'viewer' });
      fetchPermissions();
    } catch (err) {
      alert('Failed to add user');
    }
  };

  const updatePermission = async (permissionId, role) => {
    try {
      const token = localStorage.getItem('token');
      await axios.put(`http://localhost:4000/api/dashboards/${dashboard.uid}/permissions/${permissionId}`, 
        { role },
        { headers: { Authorization: `Bearer ${token}` }}
      );
      fetchPermissions();
    } catch (err) {
      alert('Failed to update permission');
    }
  };

  const removePermission = async (permissionId) => {
    if (!window.confirm('Remove this user\'s access?')) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`http://localhost:4000/api/dashboards/${dashboard.uid}/permissions/${permissionId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchPermissions();
    } catch (err) {
      alert('Failed to remove permission');
    }
  };

  const generatePublicLink = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`http://localhost:4000/api/dashboards/${dashboard.uid}/public-link`, 
        shareSettings,
        { headers: { Authorization: `Bearer ${token}` }}
      );
      setPublicLink(res.data.link);
      alert('Public link created!');
    } catch (err) {
      alert('Failed to create public link');
    }
  };

  const revokePublicLink = async () => {
    if (!window.confirm('Revoke public access to this dashboard?')) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`http://localhost:4000/api/dashboards/${dashboard.uid}/public-link`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setPublicLink(null);
    } catch (err) {
      alert('Failed to revoke public link');
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="sharing-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Share Dashboard: {dashboard.title}</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="modal-body">
          {/* Add User */}
          <div className="sharing-section">
            <h4>Add People</h4>
            <div className="add-user-form">
              <input
                type="email"
                placeholder="Email address"
                value={newUser.email}
                onChange={(e) => setNewUser({...newUser, email: e.target.value})}
                className="share-input"
              />
              <select
                value={newUser.role}
                onChange={(e) => setNewUser({...newUser, role: e.target.value})}
                className="share-select"
              >
                <option value="viewer">Viewer</option>
                <option value="editor">Editor</option>
                <option value="admin">Admin</option>
              </select>
              <button className="btn-primary" onClick={addPermission}>
                Add
              </button>
            </div>
          </div>

          {/* Current Permissions */}
          <div className="sharing-section">
            <h4>People with Access</h4>
            <div className="permissions-list">
              {permissions.length === 0 ? (
                <p className="empty-text">No users added yet</p>
              ) : (
                permissions.map(perm => (
                  <div key={perm.id} className="permission-item">
                    <div className="permission-user">
                      <div className="user-avatar">
                        {perm.user_email.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <strong>{perm.user_email}</strong>
                        <p>{perm.user_name}</p>
                      </div>
                    </div>
                    <div className="permission-controls">
                      <select
                        value={perm.role}
                        onChange={(e) => updatePermission(perm.id, e.target.value)}
                        className="role-select"
                      >
                        <option value="viewer">Viewer</option>
                        <option value="editor">Editor</option>
                        <option value="admin">Admin</option>
                      </select>
                      <button 
                        className="btn-icon"
                        onClick={() => removePermission(perm.id)}
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Public Link */}
          <div className="sharing-section">
            <h4>Public Access</h4>
            
            {!publicLink ? (
              <div className="public-link-config">
                <div className="config-option">
                  <label>
                    <input
                      type="checkbox"
                      checked={shareSettings.allowAnonymous}
                      onChange={(e) => setShareSettings({
                        ...shareSettings, 
                        allowAnonymous: e.target.checked
                      })}
                    />
                    Allow anonymous access
                  </label>
                </div>
                <div className="config-option">
                  <label>
                    <input
                      type="checkbox"
                      checked={shareSettings.requireAuth}
                      onChange={(e) => setShareSettings({
                        ...shareSettings, 
                        requireAuth: e.target.checked
                      })}
                    />
                    Require authentication
                  </label>
                </div>
                <button className="btn-primary" onClick={generatePublicLink}>
                  Generate Public Link
                </button>
              </div>
            ) : (
              <div className="public-link-display">
                <div className="link-box">
                  <input
                    type="text"
                    value={publicLink}
                    readOnly
                    className="link-input"
                  />
                  <button 
                    className="btn"
                    onClick={() => copyToClipboard(publicLink)}
                  >
                    📋 Copy
                  </button>
                </div>
                <button className="btn-danger" onClick={revokePublicLink}>
                  Revoke Public Access
                </button>
              </div>
            )}
          </div>

          {/* Embed Code */}
          <div className="sharing-section">
            <h4>Embed Dashboard</h4>
            <div className="embed-code">
              <textarea
                readOnly
                value={`<iframe src="${publicLink || 'Generate public link first'}" width="100%" height="600" frameborder="0"></iframe>`}
                className="embed-textarea"
                rows={3}
              />
              <button 
                className="btn"
                onClick={() => copyToClipboard(`<iframe src="${publicLink}" width="100%" height="600" frameborder="0"></iframe>`)}
              >
                📋 Copy Embed Code
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default DashboardSharing;