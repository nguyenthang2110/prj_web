// frontend/src/components/AddPanelModal.js
import React, { useState, useMemo, useEffect } from 'react';
import { METRIC_PRESETS } from '../metricPresets';

export default function AddPanelModal({ isOpen, onClose, onCreate }) {
  const [datasource, setDatasource] = useState('prometheus');
  const [presetId, setPresetId] = useState('');
  const [title, setTitle] = useState('');

  const presets = useMemo(() => {
    return METRIC_PRESETS[datasource] || [];
  }, [datasource]);

  // khi đổi datasource thì auto chọn preset đầu tiên
  useEffect(() => {
    if (presets.length > 0 && !presetId) {
      setPresetId(presets[0].id);
    }
  }, [presets, presetId]);

  if (!isOpen) return null;

  const selectedPreset = presets.find(p => p.id === presetId);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedPreset) return;

    const panelTitle = title.trim() || selectedPreset.label;

    onCreate({
      title: panelTitle,
      datasource,
      type: selectedPreset.type || 'graph',
      query: selectedPreset.query
    });

    // reset
    setTitle('');
    setPresetId('');
    setDatasource('prometheus');
    onClose();
  };

  return (
    <div className="add-panel-modal-backdrop" onClick={onClose}>
      <div className="add-panel-modal" onClick={(e) => e.stopPropagation()}>
        <h2>Thêm panel mới</h2>

        <form onSubmit={handleSubmit}>
          {/* Datasource */}
          <div className="form-group">
            <label>Datasource</label>
            <select
              value={datasource}
              onChange={(e) => {
                setDatasource(e.target.value);
                setPresetId('');
              }}
            >
              <option value="prometheus">Prometheus</option>
              <option value="postgres">PostgreSQL</option>
              <option value="mock">Mock (demo)</option>
            </select>
          </div>

          {/* Loại metric */}
          <div className="form-group">
            <label>Loại dữ liệu hiển thị</label>
            <select
              value={presetId}
              onChange={(e) => setPresetId(e.target.value)}
            >
              {presets.map(p => (
                <option key={p.id} value={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </div>

          {/* Tiêu đề panel */}
          <div className="form-group">
            <label>Tiêu đề panel (có thể để trống)</label>
            <input
              type="text"
              placeholder="VD: CPU usage server 1"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          {/* Preview query */}
          {selectedPreset && (
            <div className="form-group">
              <label>Query (tự sinh – user không cần sửa)</label>
              <textarea
                value={selectedPreset.query}
                readOnly
                rows={6}
                style={{ fontFamily: 'monospace', fontSize: 12 }}
              />
            </div>
          )}

          <div className="modal-actions">
            <button type="button" onClick={onClose}>
              Hủy
            </button>
            <button type="submit" disabled={!selectedPreset}>
              Tạo panel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}