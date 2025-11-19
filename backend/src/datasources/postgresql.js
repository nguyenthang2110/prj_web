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
      metric = null,
      from = "now() - interval '1 hour'",
      to = 'now()',
      aggregation = 'AVG',
      groupBy = []
    } = options;

    try {
      let query = `
        SELECT 
          DATE_TRUNC('minute', ${timeColumn}) AS timestamp,
          ${aggregation}(${valueColumn}) AS value
      `;

      if (groupBy.length > 0) {
        query += `,\n          ${groupBy.join(', ')}`;
      }

      query += `\n        FROM ${table}`;

      const whereClauses = [
        `${timeColumn} >= ${from}`,
        `${timeColumn} <= ${to}`
      ];

      if (metric) {
        whereClauses.push(`metric_name = '${metric}'`);
      }

      query += `\n        WHERE ${whereClauses.join(' AND ')}`;

      const groupByColumns = ['timestamp'];
      if (groupBy.length > 0) {
        groupByColumns.push(...groupBy);
      }
      query += `\n        GROUP BY ${groupByColumns.join(', ')}`;
      query += `\n        ORDER BY timestamp ASC`;

      const result = await this.pool.query(query);

      return result.rows.map(row => ({
        timestamp: row.timestamp.toISOString(),
        value: parseFloat(row.value),
        ...groupBy.reduce((acc, col) => {
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