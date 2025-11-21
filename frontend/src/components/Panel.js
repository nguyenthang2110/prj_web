import React, { useState, useEffect } from 'react';
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

function Panel({ panel, timeRange, token, refreshTick, onRemove, onEdit, onUpdate }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [title, setTitle] = useState(panel.title);
  const [panelType, setPanelType] = useState(panel.type);

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [panel.id, panel.datasource, timeRange, token, refreshTick]);

  const fetchData = async () => {
    setLoading(true);

    const primaryTarget =
      Array.isArray(panel.targets) && panel.targets.length > 0
        ? panel.targets[0]
        : null;

    const ds = panel.datasource || 'mock';

    // ưu tiên lấy query từ targets, nếu không có thì dùng panel.query
    const queryText =
      (primaryTarget && primaryTarget.query) ||
      panel.query ||
      null;

    try {
      // Case 1: Prometheus hoặc PostgreSQL với query cụ thể (PromQL / SQL)
      if (
        queryText &&
        (ds === 'prometheus' || ds === 'postgres')
      ) {
        const res = await axios.post(
          'http://localhost:4000/api/query',
          {
            datasource: ds,
            query: queryText,
            from: timeRange.from,
            to: timeRange.to
          },
          token
            ? { headers: { Authorization: `Bearer ${token}` } }
            : {}
        );

        const responseData = res.data.result || {};
        setData(responseData.data || []);
      } else {
        // Case 2: fallback – dùng API metrics cũ (mock hoặc metric đơn giản)
        const res = await axios.get('http://localhost:4000/api/metrics', {
          params: {
            datasource: ds,
            metric:
              panel.metric ||
              (primaryTarget && primaryTarget.metric) ||
              'cpu_usage',
            from: timeRange.from,
            to: timeRange.to
          }
        });

        const responseData = res.data;
        setData(responseData.data || []);
      }
    } catch (err) {
      console.error('Fetch data error:', err);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

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
        return <div>Unknown visualization type</div>;
    }
  };

  return (
    <div className="panel">
      <div className="panel-header">
        <div className="panel-drag-handle">⋮⋮</div>
        {isEditing ? (
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="panel-title-edit"
            autoFocus
          />
        ) : (
          <h3>{title}</h3>
        )}
        <div className="panel-actions">
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
            <select value={panelType} onChange={(e) => setPanelType(e.target.value)}>
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
        />
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
          label={(entry) => `${entry.name}: ${entry.value.toFixed(1)}`}
          outerRadius={80}
          fill="#8884d8"
          dataKey="value"
        >
          {pieData.map((entry, index) => (
            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
          ))}
        </Pie>
        <Tooltip />
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
  return (
    <div className="table-container">
      <table className="data-table">
        <thead>
          <tr>
            <th>Timestamp</th>
            <th>Value</th>
          </tr>
        </thead>
        <tbody>
          {data
            .slice(-10)
            .reverse()
            .map((row, idx) => (
              <tr key={idx}>
                <td>{new Date(row.timestamp).toLocaleString()}</td>
                <td>{row.value.toFixed(2)}</td>
              </tr>
            ))}
        </tbody>
      </table>
    </div>
  );
}

export default Panel;