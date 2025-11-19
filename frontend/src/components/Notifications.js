// frontend/src/components/Notifications.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';

function Notifications() {
  const [channels, setChannels] = useState([]);
  const [showEditor, setShowEditor] = useState(false);
  const [editingChannel, setEditingChannel] = useState(null);

  useEffect(() => {
    fetchChannels();
  }, []);

  const fetchChannels = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('http://localhost:4000/api/notifications', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setChannels(res.data.channels || []);
    } catch (err) {
      console.error('Error fetching channels:', err);
    }
  };

  const deleteChannel = async (id) => {
    if (!window.confirm('Delete this notification channel?')) return;

    try {
      const token = localStorage.getItem('token');
      await axios.delete(`http://localhost:4000/api/notifications/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchChannels();
    } catch (err) {
      console.error('Error deleting channel:', err);
    }
  };

  const testChannel = async (id) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`http://localhost:4000/api/notifications/${id}/test`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      alert('Test notification sent!');
    } catch (err) {
      console.error('Error testing channel:', err);
      alert('Failed to send test notification');
    }
  };

  return (
    <div className="notifications-page">
      <div className="page-header">
        <h2>Notification Channels</h2>
        <button className="btn-primary" onClick={() => setShowEditor(true)}>
          + Add Channel
        </button>
      </div>

      <div className="channels-grid">
        {channels.length === 0 ? (
          <div className="empty-state">
            <h3>No notification channels configured</h3>
            <p>Add a channel to receive alert notifications</p>
          </div>
        ) : (
          channels.map(channel => (
            <div key={channel.id} className="channel-card">
              <div className="channel-icon">
                {getChannelIcon(channel.type)}
              </div>
              <div className="channel-info">
                <h3>{channel.name}</h3>
                <p className="channel-type">{channel.type.toUpperCase()}</p>
                <p className="channel-target">{getChannelTarget(channel)}</p>
              </div>
              <div className="channel-actions">
                <button className="btn" onClick={() => testChannel(channel.id)}>
                  Test
                </button>
                <button className="btn" onClick={() => {
                  setEditingChannel(channel);
                  setShowEditor(true);
                }}>
                  Edit
                </button>
                <button className="btn" onClick={() => deleteChannel(channel.id)}>
                  Delete
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {showEditor && (
        <NotificationEditor
          channel={editingChannel}
          onClose={() => {
            setShowEditor(false);
            setEditingChannel(null);
          }}
          onSave={() => {
            fetchChannels();
            setShowEditor(false);
            setEditingChannel(null);
          }}
        />
      )}
    </div>
  );
}

function NotificationEditor({ channel, onClose, onSave }) {
  const [formData, setFormData] = useState({
    name: channel?.name || '',
    type: channel?.type || 'email',
    settings: channel?.settings || {}
  });

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const token = localStorage.getItem('token');
      if (channel) {
        await axios.put(`http://localhost:4000/api/notifications/${channel.id}`, formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post('http://localhost:4000/api/notifications', formData, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      onSave();
    } catch (err) {
      console.error('Error saving channel:', err);
    }
  };

  const updateSettings = (key, value) => {
    setFormData({
      ...formData,
      settings: { ...formData.settings, [key]: value }
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="query-editor-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{channel ? 'Edit Channel' : 'Add Notification Channel'}</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="editor-section">
            <h4>Channel Name</h4>
            <input
              type="text"
              className="editor-select"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              placeholder="My Email Channel"
              required
            />
          </div>

          <div className="editor-section">
            <h4>Type</h4>
            <select
              className="editor-select"
              value={formData.type}
              onChange={(e) => setFormData({...formData, type: e.target.value, settings: {}})}
            >
              <option value="email">Email</option>
              <option value="slack">Slack</option>
              <option value="webhook">Webhook</option>
              <option value="discord">Discord</option>
              <option value="telegram">Telegram</option>
            </select>
          </div>

          {formData.type === 'email' && (
            <div className="editor-section">
              <h4>Email Addresses</h4>
              <input
                type="text"
                className="editor-select"
                value={formData.settings.addresses || ''}
                onChange={(e) => updateSettings('addresses', e.target.value)}
                placeholder="email1@example.com, email2@example.com"
              />
            </div>
          )}

          {formData.type === 'slack' && (
            <>
              <div className="editor-section">
                <h4>Webhook URL</h4>
                <input
                  type="url"
                  className="editor-select"
                  value={formData.settings.url || ''}
                  onChange={(e) => updateSettings('url', e.target.value)}
                  placeholder="https://hooks.slack.com/services/..."
                />
              </div>
              <div className="editor-section">
                <h4>Channel</h4>
                <input
                  type="text"
                  className="editor-select"
                  value={formData.settings.channel || ''}
                  onChange={(e) => updateSettings('channel', e.target.value)}
                  placeholder="#alerts"
                />
              </div>
            </>
          )}

          {formData.type === 'webhook' && (
            <>
              <div className="editor-section">
                <h4>Webhook URL</h4>
                <input
                  type="url"
                  className="editor-select"
                  value={formData.settings.url || ''}
                  onChange={(e) => updateSettings('url', e.target.value)}
                  placeholder="https://example.com/webhook"
                />
              </div>
              <div className="editor-section">
                <h4>HTTP Method</h4>
                <select
                  className="editor-select"
                  value={formData.settings.method || 'POST'}
                  onChange={(e) => updateSettings('method', e.target.value)}
                >
                  <option value="POST">POST</option>
                  <option value="PUT">PUT</option>
                </select>
              </div>
            </>
          )}

          {formData.type === 'discord' && (
            <div className="editor-section">
              <h4>Discord Webhook URL</h4>
              <input
                type="url"
                className="editor-select"
                value={formData.settings.url || ''}
                onChange={(e) => updateSettings('url', e.target.value)}
                placeholder="https://discord.com/api/webhooks/..."
              />
            </div>
          )}

          {formData.type === 'telegram' && (
            <>
              <div className="editor-section">
                <h4>Bot Token</h4>
                <input
                  type="text"
                  className="editor-select"
                  value={formData.settings.botToken || ''}
                  onChange={(e) => updateSettings('botToken', e.target.value)}
                  placeholder="123456789:ABCdefGHIjklMNOpqrsTUVwxyz"
                />
              </div>
              <div className="editor-section">
                <h4>Chat ID</h4>
                <input
                  type="text"
                  className="editor-select"
                  value={formData.settings.chatId || ''}
                  onChange={(e) => updateSettings('chatId', e.target.value)}
                  placeholder="-1001234567890"
                />
              </div>
            </>
          )}

          <div className="modal-footer">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">Save Channel</button>
          </div>
        </form>
      </div>
    </div>
  );
}

function getChannelIcon(type) {
  const icons = {
    email: '📧',
    slack: '💬',
    webhook: '🔗',
    discord: '🎮',
    telegram: '✈️'
  };
  return icons[type] || '📢';
}

function getChannelTarget(channel) {
  switch(channel.type) {
    case 'email': return channel.settings?.addresses || 'Not configured';
    case 'slack': return channel.settings?.channel || 'Not configured';
    case 'webhook': return channel.settings?.url || 'Not configured';
    case 'discord': return 'Discord Webhook';
    case 'telegram': return `Chat ${channel.settings?.chatId || 'Not configured'}`;
    default: return 'Not configured';
  }
}

export default Notifications;