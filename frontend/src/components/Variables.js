// frontend/src/components/Variables.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';

function Variables({ dashboardId, onVariableChange }) {
  const [variables, setVariables] = useState([]);
  const [showEditor, setShowEditor] = useState(false);
  const [editingVar, setEditingVar] = useState(null);

  useEffect(() => {
    if (dashboardId) {
      fetchVariables();
    }
  }, [dashboardId]);

  const fetchVariables = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`http://localhost:4000/api/dashboards/${dashboardId}/variables`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setVariables(res.data.variables);
    } catch (err) {
      console.error('Error fetching variables:', err);
    }
  };

  const saveVariable = async (varData) => {
    try {
      const token = localStorage.getItem('token');
      if (editingVar) {
        await axios.put(`http://localhost:4000/api/variables/${editingVar.id}`, varData, {
          headers: { Authorization: `Bearer ${token}` }
        });
      } else {
        await axios.post(`http://localhost:4000/api/dashboards/${dashboardId}/variables`, varData, {
          headers: { Authorization: `Bearer ${token}` }
        });
      }
      fetchVariables();
      setShowEditor(false);
      setEditingVar(null);
    } catch (err) {
      console.error('Error saving variable:', err);
    }
  };

  const deleteVariable = async (id) => {
    if (!window.confirm('Delete this variable?')) return;
    
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`http://localhost:4000/api/variables/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchVariables();
    } catch (err) {
      console.error('Error deleting variable:', err);
    }
  };

  return (
    <div className="variables-container">
      <div className="variables-header">
        <h3>Variables</h3>
        <button className="btn" onClick={() => setShowEditor(true)}>
          + Add Variable
        </button>
      </div>

      <div className="variables-list">
        {variables.map(variable => (
          <div key={variable.id} className="variable-item">
            <div className="variable-info">
              <strong>${variable.name}</strong>
              <span className="variable-type">{variable.type}</span>
            </div>
            <select 
              className="variable-select"
              onChange={(e) => onVariableChange && onVariableChange(variable.name, e.target.value)}
            >
              {variable.options && JSON.parse(variable.options).map((opt, idx) => (
                <option key={idx} value={opt.value}>{opt.label}</option>
              ))}
            </select>
            <div className="variable-actions">
              <button className="panel-btn" onClick={() => {
                setEditingVar(variable);
                setShowEditor(true);
              }}>✏️</button>
              <button className="panel-btn" onClick={() => deleteVariable(variable.id)}>🗑️</button>
            </div>
          </div>
        ))}
      </div>

      {showEditor && (
        <VariableEditor
          variable={editingVar}
          onSave={saveVariable}
          onClose={() => {
            setShowEditor(false);
            setEditingVar(null);
          }}
        />
      )}
    </div>
  );
}

function VariableEditor({ variable, onSave, onClose }) {
  const [formData, setFormData] = useState({
    name: variable?.name || '',
    type: variable?.type || 'query',
    query: variable?.query || '',
    datasource: variable?.datasource || 'mock',
    multi: variable?.multi || false,
    includeAll: variable?.include_all || false
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="query-editor-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{variable ? 'Edit Variable' : 'Add Variable'}</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="editor-section">
            <h4>Name</h4>
            <input
              type="text"
              className="editor-select"
              value={formData.name}
              onChange={(e) => setFormData({...formData, name: e.target.value})}
              placeholder="variable_name"
              required
            />
          </div>

          <div className="editor-section">
            <h4>Type</h4>
            <select
              className="editor-select"
              value={formData.type}
              onChange={(e) => setFormData({...formData, type: e.target.value})}
            >
              <option value="query">Query</option>
              <option value="custom">Custom</option>
              <option value="interval">Interval</option>
              <option value="datasource">Data Source</option>
            </select>
          </div>

          {formData.type === 'query' && (
            <>
              <div className="editor-section">
                <h4>Data Source</h4>
                <select
                  className="editor-select"
                  value={formData.datasource}
                  onChange={(e) => setFormData({...formData, datasource: e.target.value})}
                >
                  <option value="mock">Mock Data</option>
                  <option value="prometheus">Prometheus</option>
                  <option value="postgres">PostgreSQL</option>
                </select>
              </div>

              <div className="editor-section">
                <h4>Query</h4>
                <textarea
                  className="query-textarea"
                  value={formData.query}
                  onChange={(e) => setFormData({...formData, query: e.target.value})}
                  placeholder="SELECT DISTINCT server FROM metrics"
                  rows={4}
                />
              </div>
            </>
          )}

          <div className="editor-section">
            <label>
              <input
                type="checkbox"
                checked={formData.multi}
                onChange={(e) => setFormData({...formData, multi: e.target.checked})}
              />
              Multi-select
            </label>
          </div>

          <div className="editor-section">
            <label>
              <input
                type="checkbox"
                checked={formData.includeAll}
                onChange={(e) => setFormData({...formData, includeAll: e.target.checked})}
              />
              Include All option
            </label>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">Save Variable</button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default Variables;