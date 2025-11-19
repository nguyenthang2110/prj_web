// frontend/src/components/Settings.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';

function Settings({ user }) {
  const [activeTab, setActiveTab] = useState('profile');
  const [profileData, setProfileData] = useState({
    username: user?.username || '',
    email: user?.email || '',
    fullName: user?.fullName || ''
  });
  const [passwordData, setPasswordData] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [preferences, setPreferences] = useState({
    theme: 'dark',
    timezone: 'UTC',
    language: 'en',
    homeDashboard: ''
  });
  const [apiKeys, setApiKeys] = useState([]);
  const [message, setMessage] = useState('');

  useEffect(() => {
    fetchApiKeys();
    fetchPreferences();
  }, []);

  const fetchPreferences = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('http://localhost:4000/api/user/preferences', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.preferences) {
        setPreferences(res.data.preferences);
      }
    } catch (err) {
      console.error('Error fetching preferences:', err);
    }
  };

  const fetchApiKeys = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('http://localhost:4000/api/user/api-keys', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setApiKeys(res.data.apiKeys || []);
    } catch (err) {
      console.error('Error fetching API keys:', err);
    }
  };

  const updateProfile = async (e) => {
    e.preventDefault();
    try {
      const token = localStorage.getItem('token');
      await axios.put('http://localhost:4000/api/user/profile', profileData, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage('Profile updated successfully!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Failed to update profile');
    }
  };

  const changePassword = async (e) => {
    e.preventDefault();
    if (passwordData.newPassword !== passwordData.confirmPassword) {
      setMessage('Passwords do not match!');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      await axios.post('http://localhost:4000/api/user/change-password', {
        currentPassword: passwordData.currentPassword,
        newPassword: passwordData.newPassword
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage('Password changed successfully!');
      setPasswordData({ currentPassword: '', newPassword: '', confirmPassword: '' });
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Failed to change password');
    }
  };

  const savePreferences = async () => {
    try {
      const token = localStorage.getItem('token');
      await axios.put('http://localhost:4000/api/user/preferences', preferences, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setMessage('Preferences saved!');
      setTimeout(() => setMessage(''), 3000);
    } catch (err) {
      setMessage('Failed to save preferences');
    }
  };

  const generateApiKey = async () => {
    const name = prompt('API Key name:');
    if (!name) return;

    try {
      const token = localStorage.getItem('token');
      const res = await axios.post('http://localhost:4000/api/user/api-keys', { name }, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      alert(`Your API Key: ${res.data.key}\n\nSave it now! You won't be able to see it again.`);
      fetchApiKeys();
    } catch (err) {
      alert('Failed to generate API key');
    }
  };

  const deleteApiKey = async (id) => {
    if (!window.confirm('Delete this API key?')) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`http://localhost:4000/api/user/api-keys/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchApiKeys();
    } catch (err) {
      alert('Failed to delete API key');
    }
  };

  return (
    <div className="settings-page">
      <div className="page-header">
        <h2>Settings</h2>
      </div>

      {message && (
        <div className="message-banner">
          {message}
        </div>
      )}

      <div className="settings-container">
        <div className="settings-sidebar">
          <button 
            className={`settings-tab ${activeTab === 'profile' ? 'active' : ''}`}
            onClick={() => setActiveTab('profile')}
          >
            👤 Profile
          </button>
          <button 
            className={`settings-tab ${activeTab === 'password' ? 'active' : ''}`}
            onClick={() => setActiveTab('password')}
          >
            🔒 Password
          </button>
          <button 
            className={`settings-tab ${activeTab === 'preferences' ? 'active' : ''}`}
            onClick={() => setActiveTab('preferences')}
          >
            ⚙️ Preferences
          </button>
          <button 
            className={`settings-tab ${activeTab === 'api' ? 'active' : ''}`}
            onClick={() => setActiveTab('api')}
          >
            🔑 API Keys
          </button>
        </div>

        <div className="settings-content">
          {activeTab === 'profile' && (
            <form onSubmit={updateProfile} className="settings-form">
              <h3>Profile Information</h3>
              
              <div className="form-group">
                <label>Username</label>
                <input
                  type="text"
                  value={profileData.username}
                  onChange={(e) => setProfileData({...profileData, username: e.target.value})}
                  disabled
                />
                <small>Username cannot be changed</small>
              </div>

              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={profileData.email}
                  onChange={(e) => setProfileData({...profileData, email: e.target.value})}
                />
              </div>

              <div className="form-group">
                <label>Full Name</label>
                <input
                  type="text"
                  value={profileData.fullName}
                  onChange={(e) => setProfileData({...profileData, fullName: e.target.value})}
                />
              </div>

              <button type="submit" className="btn-primary">Update Profile</button>
            </form>
          )}

          {activeTab === 'password' && (
            <form onSubmit={changePassword} className="settings-form">
              <h3>Change Password</h3>
              
              <div className="form-group">
                <label>Current Password</label>
                <input
                  type="password"
                  value={passwordData.currentPassword}
                  onChange={(e) => setPasswordData({...passwordData, currentPassword: e.target.value})}
                  required
                />
              </div>

              <div className="form-group">
                <label>New Password</label>
                <input
                  type="password"
                  value={passwordData.newPassword}
                  onChange={(e) => setPasswordData({...passwordData, newPassword: e.target.value})}
                  required
                />
              </div>

              <div className="form-group">
                <label>Confirm New Password</label>
                <input
                  type="password"
                  value={passwordData.confirmPassword}
                  onChange={(e) => setPasswordData({...passwordData, confirmPassword: e.target.value})}
                  required
                />
              </div>

              <button type="submit" className="btn-primary">Change Password</button>
            </form>
          )}

          {activeTab === 'preferences' && (
            <div className="settings-form">
              <h3>Preferences</h3>
              
              <div className="form-group">
                <label>Theme</label>
                <select
                  value={preferences.theme}
                  onChange={(e) => setPreferences({...preferences, theme: e.target.value})}
                >
                  <option value="dark">Dark</option>
                  <option value="light">Light</option>
                  <option value="auto">Auto</option>
                </select>
              </div>

              <div className="form-group">
                <label>Timezone</label>
                <select
                  value={preferences.timezone}
                  onChange={(e) => setPreferences({...preferences, timezone: e.target.value})}
                >
                  <option value="UTC">UTC</option>
                  <option value="America/New_York">New York</option>
                  <option value="Europe/London">London</option>
                  <option value="Asia/Tokyo">Tokyo</option>
                  <option value="Asia/Ho_Chi_Minh">Ho Chi Minh</option>
                </select>
              </div>

              <div className="form-group">
                <label>Language</label>
                <select
                  value={preferences.language}
                  onChange={(e) => setPreferences({...preferences, language: e.target.value})}
                >
                  <option value="en">English</option>
                  <option value="vi">Tiếng Việt</option>
                  <option value="ja">日本語</option>
                </select>
              </div>

              <button onClick={savePreferences} className="btn-primary">Save Preferences</button>
            </div>
          )}

          {activeTab === 'api' && (
            <div className="settings-form">
              <div className="api-header">
                <h3>API Keys</h3>
                <button className="btn-primary" onClick={generateApiKey}>
                  + Generate New Key
                </button>
              </div>

              <div className="api-keys-list">
                {apiKeys.length === 0 ? (
                  <p>No API keys yet. Generate one to get started.</p>
                ) : (
                  apiKeys.map(key => (
                    <div key={key.id} className="api-key-item">
                      <div>
                        <strong>{key.name}</strong>
                        <p>Created: {new Date(key.created_at).toLocaleDateString()}</p>
                        {key.last_used && (
                          <p>Last used: {new Date(key.last_used).toLocaleString()}</p>
                        )}
                      </div>
                      <button className="btn" onClick={() => deleteApiKey(key.id)}>
                        Delete
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default Settings;