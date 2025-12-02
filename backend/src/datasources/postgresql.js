const { Pool } = require('pg');

class PostgreSQLDataSource {
  constructor(config) {
    this.pool = new Pool({
      connectionString: config.url || process.env.DATABASE_URL,
      ssl: config.ssl || false,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  async queryTimeSeries(options) {
    const {
      table = 'metrics',
      timeColumn = 'timestamp',
      valueColumn = 'value',
      metricColumn = 'metric_name',
      metric = null,
      from,
      to,
      aggregation = 'AVG',
      groupBy = []
    } = options;

    try {
      const safeIdentifier = (name, fallback) => {
        const isValid = typeof name === 'string' && /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name);
        return isValid ? name : fallback;
      };

      const safeTable = safeIdentifier(table, 'metrics');
      const safeTimeColumn = safeIdentifier(timeColumn, 'timestamp');
      const safeValueColumn = safeIdentifier(valueColumn, 'value');
      const safeMetricColumn = metricColumn ? safeIdentifier(metricColumn, null) : null;
      const allowedAgg = ['AVG', 'SUM', 'MIN', 'MAX', 'COUNT'];
      const requestedAgg = typeof aggregation === 'string' ? aggregation.toUpperCase() : 'AVG';
      const safeAgg = allowedAgg.includes(requestedAgg) ? requestedAgg : 'AVG';
      const safeGroupBy = Array.isArray(groupBy)
        ? groupBy.map((col) => safeIdentifier(col, null)).filter(Boolean)
        : [];

      const groupBySelect = safeGroupBy.length ? `, ${safeGroupBy.join(', ')}` : '';
      const groupByClause = safeGroupBy.length ? `, ${safeGroupBy.join(', ')}` : '';

      const metricFilter = safeMetricColumn && metric
        ? ` AND ${safeMetricColumn} = $3`
        : '';

      const sql = `
        SELECT 
          DATE_TRUNC('minute', ${safeTimeColumn}) AS timestamp,
          ${safeAgg}(${safeValueColumn}) AS value
          ${groupBySelect}
        FROM ${safeTable}
        WHERE ${safeTimeColumn} >= $1
          AND ${safeTimeColumn} <= $2
          ${metricFilter}
        GROUP BY timestamp${groupByClause}
        ORDER BY timestamp ASC
      `;

      const params = [from, to];
      if (safeMetricColumn && metric) {
        params.push(metric);
      }
      if (options.logger) {
        options.logger(`Query: ${sql} params=${JSON.stringify(params)}`);
      }
      const result = await this.pool.query(sql, params);

      return result.rows.map((row) => ({
        timestamp: row.timestamp.toISOString(),
        value: parseFloat(row.value),
        ...safeGroupBy.reduce((acc, col) => {
          acc[col] = row[col];
          return acc;
        }, {})
      }));
    } catch (error) {
      console.error('PostgreSQL query error:', error);
      throw error;
    }
  }

  async query(sql, params = []) {
    try {
      const result = await this.pool.query(sql, params);
      return result.rows;
    } catch (error) {
      console.error('PostgreSQL query error:', error);
      throw error;
    }
  }

  async testConnection() {
    try {
      const result = await this.pool.query('SELECT NOW()');
      return result.rows.length > 0;
    } catch (error) {
      console.error('Connection test failed:', error);
      return false;
    }
  }

  async close() {
    await this.pool.end();
  }
}

module.exports = PostgreSQLDataSource;
