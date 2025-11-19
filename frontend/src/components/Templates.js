// frontend/src/components/Templates.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';

function Templates({ onUseTemplate }) {
  const [templates, setTemplates] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get('http://localhost:4000/api/templates', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setTemplates(res.data.templates);
    } catch (err) {
      console.error('Error fetching templates:', err);
    }
  };

  const handleUseTemplate = async (templateUid) => {
    try {
      const token = localStorage.getItem('token');
      const res = await axios.post(`http://localhost:4000/api/templates/${templateUid}/use`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (onUseTemplate) {
        onUseTemplate(res.data);
      }
    } catch (err) {
      console.error('Error using template:', err);
    }
  };

  const categories = ['all', ...new Set(templates.map(t => t.category).filter(Boolean))];

  const filteredTemplates = selectedCategory === 'all' 
    ? templates 
    : templates.filter(t => t.category === selectedCategory);

  return (
    <div className="templates-page">
      <div className="page-header">
        <h2>Dashboard Templates</h2>
        <button className="btn-primary">+ Create Template</button>
      </div>

      <div className="templates-filters">
        {categories.map(cat => (
          <button
            key={cat}
            className={`filter-btn ${selectedCategory === cat ? 'active' : ''}`}
            onClick={() => setSelectedCategory(cat)}
          >
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>

      <div className="templates-grid">
        {filteredTemplates.length === 0 ? (
          <div className="empty-state">
            <h3>No templates found</h3>
            <p>Check back later for more templates</p>
          </div>
        ) : (
          filteredTemplates.map(template => (
            <div key={template.id} className="template-card">
              <div className="template-preview">
                {template.preview_image ? (
                  <img src={template.preview_image} alt={template.name} />
                ) : (
                  <div className="template-placeholder">📊</div>
                )}
              </div>

              <div className="template-info">
                <h3>{template.name}</h3>
                <p className="template-description">{template.description}</p>

                <div className="template-meta">
                  {template.category && (
                    <span className="template-category">{template.category}</span>
                  )}
                  <span className="template-downloads">
                    ⬇️ {template.downloads} downloads
                  </span>
                </div>

                {template.tags && template.tags.length > 0 && (
                  <div className="template-tags">
                    {template.tags.map((tag, idx) => (
                      <span key={idx} className="tag">{tag}</span>
                    ))}
                  </div>
                )}

                <button 
                  className="btn-primary"
                  onClick={() => handleUseTemplate(template.uid)}
                >
                  Use Template
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

export default Templates;