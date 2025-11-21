// frontend/src/components/QueryBuilder.js
import React, { useState } from 'react';

function QueryBuilder({ datasource, onQueryChange, initialQuery }) {
  const [queryMode, setQueryMode] = useState('builder'); // 'builder' or 'raw'
  const [builderState, setBuilderState] = useState({
    metric: initialQuery?.metric || '',
    aggregation: 'avg',
    groupBy: [],
    filters: [],
    timeRange: '5m'
  });
  const [rawQuery, setRawQuery] = useState(initialQuery?.raw || '');

  const addFilter = () => {
    setBuilderState({
      ...builderState,
      filters: [...builderState.filters, { field: '', operator: '=', value: '' }]
    });
  };

  const updateFilter = (index, key, value) => {
    const newFilters = [...builderState.filters];
    newFilters[index][key] = value;
    setBuilderState({ ...builderState, filters: newFilters });
  };

  const removeFilter = (index) => {
    setBuilderState({
      ...builderState,
      filters: builderState.filters.filter((_, i) => i !== index)
    });
  };

  const generateQuery = () => {
    let query = '';
    
    switch (datasource) {
      case 'prometheus':
        query = generatePrometheusQuery();
        break;
      case 'postgres':
        query = generateSQLQuery();
        break;
      case 'influxdb':
        query = generateInfluxQuery();
        break;
      default:
        query = generateGenericQuery();
    }
    
    onQueryChange(query);
    return query;
  };

  const generatePrometheusQuery = () => {
    let query = builderState.metric;
    
    if (builderState.filters.length > 0) {
      const filters = builderState.filters
        .map(f => `${f.field}${f.operator}"${f.value}"`)
        .join(',');
      query += `{${filters}}`;
    }
    
    if (builderState.aggregation !== 'none') {
      query = `${builderState.aggregation}(${query})`;
    }
    
    if (builderState.groupBy.length > 0) {
      query += ` by (${builderState.groupBy.join(',')})`;
    }
    
    return query;
  };

  const generateSQLQuery = () => {
    const agg = builderState.aggregation !== 'none' 
      ? `${builderState.aggregation.toUpperCase()}(${builderState.metric})` 
      : builderState.metric;
    
    let query = `SELECT ${agg} FROM metrics`;
    
    if (builderState.filters.length > 0) {
      const where = builderState.filters
        .map(f => `${f.field} ${f.operator} '${f.value}'`)
        .join(' AND ');
      query += ` WHERE ${where}`;
    }
    
    if (builderState.groupBy.length > 0) {
      query += ` GROUP BY ${builderState.groupBy.join(', ')}`;
    }
    
    query += ` ORDER BY time DESC LIMIT 1000`;
    
    return query;
  };

  const generateInfluxQuery = () => {
    let query = `SELECT ${builderState.aggregation}("${builderState.metric}") FROM "metrics"`;
    
    if (builderState.filters.length > 0) {
      const where = builderState.filters
        .map(f => `"${f.field}" ${f.operator} '${f.value}'`)
        .join(' AND ');
      query += ` WHERE ${where}`;
    }
    
    query += ` AND time > now() - ${builderState.timeRange}`;
    
    if (builderState.groupBy.length > 0) {
      query += ` GROUP BY ${builderState.groupBy.map(g => `"${g}"`).join(', ')}`;
    }
    
    return query;
  };

  const generateGenericQuery = () => {
    return JSON.stringify(builderState, null, 2);
  };

  return (
    <div className="query-builder">
      <div className="query-mode-switch">
        <button
          className={`mode-btn ${queryMode === 'builder' ? 'active' : ''}`}
          onClick={() => setQueryMode('builder')}
        >
          Query Builder
        </button>
        <button
          className={`mode-btn ${queryMode === 'raw' ? 'active' : ''}`}
          onClick={() => setQueryMode('raw')}
        >
          Raw Query
        </button>
      </div>

      {queryMode === 'builder' ? (
        <div className="builder-form">
          {/* Metric Selection */}
          <div className="builder-row">
            <label>Metric</label>
            <input
              type="text"
              value={builderState.metric}
              onChange={(e) => setBuilderState({...builderState, metric: e.target.value})}
              placeholder="cpu_usage, memory_used, etc."
              className="builder-input"
            />
          </div>

          {/* Aggregation */}
          <div className="builder-row">
            <label>Aggregation</label>
            <select
              value={builderState.aggregation}
              onChange={(e) => setBuilderState({...builderState, aggregation: e.target.value})}
              className="builder-select"
            >
              <option value="none">None</option>
              <option value="avg">Average</option>
              <option value="sum">Sum</option>
              <option value="min">Min</option>
              <option value="max">Max</option>
              <option value="count">Count</option>
            </select>
          </div>

          {/* Filters */}
          <div className="builder-section">
            <div className="section-header">
              <label>Filters</label>
              <button className="btn-small" onClick={addFilter}>+ Add Filter</button>
            </div>
            {builderState.filters.map((filter, index) => (
              <div key={index} className="filter-row">
                <input
                  type="text"
                  value={filter.field}
                  onChange={(e) => updateFilter(index, 'field', e.target.value)}
                  placeholder="Field"
                  className="filter-input"
                />
                <select
                  value={filter.operator}
                  onChange={(e) => updateFilter(index, 'operator', e.target.value)}
                  className="filter-select"
                >
                  <option value="=">=</option>
                  <option value="!=">!=</option>
                  <option value=">">{'>'}</option>
                  <option value="<">{'<'}</option>
                  <option value=">=">{'≥'}</option>
                  <option value="<=">{'≤'}</option>
                  <option value="LIKE">LIKE</option>
                </select>
                <input
                  type="text"
                  value={filter.value}
                  onChange={(e) => updateFilter(index, 'value', e.target.value)}
                  placeholder="Value"
                  className="filter-input"
                />
                <button 
                  className="btn-icon"
                  onClick={() => removeFilter(index)}
                >
                  🗑️
                </button>
              </div>
            ))}
          </div>

          {/* Group By */}
          <div className="builder-row">
            <label>Group By</label>
            <input
              type="text"
              value={builderState.groupBy.join(', ')}
              onChange={(e) => setBuilderState({
                ...builderState, 
                groupBy: e.target.value.split(',').map(s => s.trim()).filter(Boolean)
              })}
              placeholder="host, region, etc. (comma-separated)"
              className="builder-input"
            />
          </div>

          {/* Time Range */}
          <div className="builder-row">
            <label>Time Range</label>
            <select
              value={builderState.timeRange}
              onChange={(e) => setBuilderState({...builderState, timeRange: e.target.value})}
              className="builder-select"
            >
              <option value="5m">Last 5 minutes</option>
              <option value="15m">Last 15 minutes</option>
              <option value="1h">Last 1 hour</option>
              <option value="6h">Last 6 hours</option>
              <option value="24h">Last 24 hours</option>
              <option value="7d">Last 7 days</option>
            </select>
          </div>

          {/* Generated Query Preview */}
          <div className="builder-section">
            <label>Generated Query</label>
            <div className="query-preview">
              <code>{generateQuery()}</code>
            </div>
          </div>
        </div>
      ) : (
        <div className="raw-query-form">
          <textarea
            value={rawQuery}
            onChange={(e) => {
              setRawQuery(e.target.value);
              onQueryChange(e.target.value);
            }}
            placeholder="Enter your query here..."
            className="raw-query-textarea"
            rows={10}
          />
          <div className="query-hints">
            <strong>Examples:</strong>
            {datasource === 'prometheus' && (
              <div className="hint">
                <code>rate(http_requests_total[5m])</code>
                <code>sum(cpu_usage) by (host)</code>
              </div>
            )}
            {datasource === 'postgres' && (
              <div className="hint">
                <code>SELECT * FROM metrics WHERE time &gt; now() - interval '1 hour'</code>
              </div>
            )}
            {datasource === 'influxdb' && (
              <div className="hint">
                <code>SELECT mean("value") FROM "cpu" WHERE time &gt; now() - 1h GROUP BY time(5m)</code>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default QueryBuilder;