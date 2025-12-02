// frontend/src/components/Panel.js
import React, { useState, useEffect, useMemo } from 'react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer
} from 'recharts';
import axios from 'axios';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

function Panel({ panel, timeRange, refreshTick, onRemove, onEdit, onUpdate }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(panel.title);
  const [panelType, setPanelType] = useState(panel.type || 'graph');
  const parsedTargets = useMemo(() => {
    if (Array.isArray(panel.targets)) return panel.targets;
    if (typeof panel.targets === 'string') {
      try {
        const parsed = JSON.parse(panel.targets);
        return Array.isArray(parsed) ? parsed : [];
      } catch (err) {
        console.warn('Cannot parse panel targets', err);
      }
    }
    return [];
  }, [panel.targets]);

  const primaryTarget = parsedTargets[0] || {};
  const effectiveDatasource = panel.datasource || primaryTarget.datasource || 'prometheus';
  const effectiveMetric = panel.metric || primaryTarget.metric || 'cpu_usage';
  const effectiveQuery = panel.query || primaryTarget.query || '';

  const normalizeResponseData = (responseData) => {
    if (!responseData) return [];
    if (Array.isArray(responseData.data)) return sanitizeData(responseData.data);

    if (Array.isArray(responseData.series) && responseData.series.length > 0) {
      return sanitizeData(responseData.series[0].data || []);
    }

    return [];
  };

  const sanitizeData = (arr) => {
    return arr
      .map((item) => {
        if (!item) return null;
        const ts =
          item.timestamp ||
          item.time ||
          item.ts ||
          item.date ||
          item.Time ||
          item.TS;
        const val =
          item.value !== undefined
            ? item.value
            : item.Value !== undefined
            ? item.Value
            : item.val;
        const parsedTs = ts ? new Date(ts) : null;
        if (!parsedTs || Number.isNaN(parsedTs.getTime())) return null;
        return {
          ...item,
          timestamp: parsedTs.toISOString(),
          value: typeof val === 'string' ? parseFloat(val) : val
        };
      })
      .filter(Boolean);
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await axios.get('http://localhost:4000/api/metrics', {
          params: {
            datasource: effectiveDatasource,
            metric: effectiveMetric,
            query: effectiveQuery,
            from: timeRange.from,
            to: timeRange.to
          }
        });

        const responseData = res.data || {};
        const normalizedData = normalizeResponseData(responseData);
        setData(normalizedData);
      } catch (err) {
        console.error('Error fetching data:', err);
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [
    panel.id,
    effectiveMetric,
    effectiveDatasource,
    effectiveQuery,
    timeRange.from,
    timeRange.to,
    refreshTick
  ]);

  const handleSave = () => {
    onUpdate(panel.id, { title, type: panelType });
    setIsEditing(false);
  };

  const renderVisualization = () => {
    if (loading) {
      return (
        <div className="loading-state">
          <div className="spinner"></div>
          <p>Loading data...</p>
        </div>
      );
    }

    switch (panelType) {
      case 'graph':
        return <GraphVisualization data={data} />;
      case 'bar':
        return <BarVisualization data={data} />;
      case 'pie':
        return <PieVisualization data={data} />;
      case 'stat':
        return <StatVisualization data={data} />;
      case 'table':
        return <TableVisualization data={data} />;
      default:
        return <GraphVisualization data={data} />;
    }
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-title">
          <span className="panel-drag-handle">⋮⋮</span>
          {isEditing ? (
            <input
              type="text"
              className="panel-title-input"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          ) : (
            <h3>{title}</h3>
          )}
        </div>

        <div className="panel-actions fixed-right">
          {isEditing ? (
            <>
              <button className="panel-btn" onClick={handleSave}>✓</button>
              <button className="panel-btn" onClick={() => setIsEditing(false)}>✗</button>
            </>
          ) : (
            <>
              <button className="panel-btn" onClick={() => setIsEditing(true)}>✏️</button>
              <button className="panel-btn" onClick={() => onEdit(panel)}>⚙️</button>
              <button className="panel-btn" onClick={() => onRemove(panel.id)}>🗑️</button>
            </>
          )}
        </div>
      </div>

      <div className="panel-content">
        {isEditing && (
          <div className="panel-type-selector">
            <label>Visualization:</label>
            <select
              value={panelType}
              onChange={(e) => setPanelType(e.target.value)}
            >
              <option value="graph">Line Graph</option>
              <option value="bar">Bar Chart</option>
              <option value="pie">Pie Chart</option>
              <option value="stat">Stat</option>
              <option value="table">Table</option>
            </select>
          </div>
        )}
        {renderVisualization()}
      </div>
    </div>
  );
}

function GraphVisualization({ data }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2c2c2f" />
        <XAxis
          dataKey="timestamp"
          stroke="#9b9b9b"
          tickFormatter={(ts) => new Date(ts).toLocaleTimeString()}
        />
        <YAxis stroke="#9b9b9b" />
        <Tooltip
          contentStyle={{ background: '#1f1f23', border: '1px solid #2c2c2f' }}
          labelStyle={{ color: '#d8d9da' }}
          labelFormatter={(label) => new Date(label).toLocaleString()}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="value"
          stroke="#3b82f6"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function BarVisualization({ data }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" stroke="#2c2c2f" />
        <XAxis
          dataKey="timestamp"
          stroke="#9b9b9b"
          tickFormatter={(ts) => new Date(ts).toLocaleTimeString()}
        />
        <YAxis stroke="#9b9b9b" />
        <Tooltip
          contentStyle={{ background: '#1f1f23', border: '1px solid #2c2c2f' }}
          labelStyle={{ color: '#d8d9da' }}
          labelFormatter={(label) => new Date(label).toLocaleString()}
        />
        <Legend />
        <Bar dataKey="value" fill="#3b82f6" />
      </BarChart>
    </ResponsiveContainer>
  );
}

function PieVisualization({ data }) {
  const pieData = data.slice(-5).map((item, index) => ({
    name: `Data ${index + 1}`,
    value: item.value
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <PieChart>
        <Pie
          data={pieData}
          cx="50%"
          cy="50%"
          labelLine={false}
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
          label={(entry) => entry.name}
        >
          {pieData.map((entry, index) => (
            <Cell
              key={`cell-${index}`}
              fill={COLORS[index % COLORS.length]}
            />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{ background: '#1f1f23', border: '1px solid #2c2c2f' }}
          labelStyle={{ color: '#d8d9da' }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

function StatVisualization({ data }) {
  const latest = data[data.length - 1]?.value || 0;
  const previous = data[data.length - 2]?.value || 0;
  const change = latest - previous;
  const changePercent = previous !== 0 ? (change / previous) * 100 : 0;

  return (
    <div className="stat-container">
      <div className="stat-value">{latest.toFixed(2)}</div>
      <div className="stat-label">Current Value</div>
      <div className={`stat-trend ${change >= 0 ? 'positive' : 'negative'}`}>
        {change >= 0 ? '↑' : '↓'} {Math.abs(changePercent).toFixed(1)}%
        <span className="stat-change">
          {' '}
          ({change >= 0 ? '+' : ''}
          {change.toFixed(2)})
        </span>
      </div>
    </div>
  );
}

function TableVisualization({ data }) {
  const rows = data.slice(-20).reverse();
  return (
    <div className="table-container">
      <div className="metrics-table-wrapper">
        <div className="metrics-table-header">
          <div className="metrics-col time">Time</div>
          <div className="metrics-col value">Value</div>
        </div>
        <div className="metrics-table-body">
          {rows.map((row, idx) => (
            <div className="metrics-row" key={idx}>
              <div className="metrics-col time">
                {new Date(row.timestamp).toLocaleString()}
              </div>
              <div className="metrics-col value">
                {row.value.toFixed(2)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default Panel;
