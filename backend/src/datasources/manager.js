const PrometheusDataSource = require('./prometheus');
const PostgreSQLDataSource = require('./postgresql');

class DataSourceManager {
  constructor() {
    this.dataSources = new Map();
    this.initialized = false;
    this.logs = new Map(); // store per-datasource logs
  }

  async initialize() {
    try {
      const prometheusUrl = process.env.PROMETHEUS_URL || 'http://prometheus:9090';
      const prometheus = new PrometheusDataSource(prometheusUrl);
      
      if (await prometheus.testConnection()) {
        this.dataSources.set('prometheus', prometheus);
        this.pushLog('prometheus', 'Connected to Prometheus');
        console.log('✅ Prometheus data source connected');
      } else {
        this.pushLog('prometheus', 'Prometheus not available', 'warn');
        console.log('⚠️  Prometheus not available');
      }

      const postgresConfig = {
        url: process.env.METRICS_DB_URL || process.env.DATABASE_URL,
        ssl: false
      };
      
      const postgres = new PostgreSQLDataSource(postgresConfig);
      
      if (await postgres.testConnection()) {
        this.dataSources.set('postgres', postgres);
        this.pushLog('postgres', 'Connected to PostgreSQL');
        console.log('✅ PostgreSQL data source connected');
      } else {
        this.pushLog('postgres', 'PostgreSQL not available', 'warn');
        console.log('⚠️  PostgreSQL not available');
      }

      this.initialized = true;
      this.pushLog('manager', 'DataSourceManager initialized');
    } catch (error) {
      console.error('Error initializing data sources:', error);
      this.pushLog('manager', `Init error: ${error.message}`, 'error');
    }
  }

  getDataSource(type) {
    return this.dataSources.get(type);
  }

  hasDataSource(type) {
    return this.dataSources.has(type);
  }

  async query(options) {
    const {
      datasource = 'prometheus'
    } = options;

    try {
      switch (datasource) {
        case 'prometheus':
          return await this.queryPrometheus(options);
        
        case 'postgres':
          return await this.queryPostgreSQL(options);
        
        default:
          throw new Error(`Unsupported datasource: ${datasource}`);
      }
    } catch (error) {
      console.error(`Error querying ${datasource}:`, error);
      this.pushLog(datasource, `Query error: ${error.message}`, 'error');
      throw error;
    }
  }

  async queryPrometheus(options) {
    const prometheus = this.getDataSource('prometheus');
    if (!prometheus) {
      throw new Error('Prometheus not available');
    }

    const {
      metric,
      query: rawQuery,
      from = 'now-1h',
      to = 'now',
      aggregation = 'avg',
      groupBy = [],
      rate = false
    } = options;

    const query = rawQuery || prometheus.buildQuery(metric, {
      aggregation,
      groupBy,
      rate,
      rateInterval: '5m'
    });

    this.pushLog('prometheus', `Query: ${query} from ${from} to ${to}`);
    const data = await prometheus.queryRange(query, from, to);

    if (Array.isArray(data) && data[0]?.metric) {
      return {
        type: 'grouped',
        series: data
      };
    }

    return {
      type: 'single',
      data
    };
  }

  async queryPostgreSQL(options = {}) {
    const postgres = this.getDataSource('postgres');
    if (!postgres) {
      throw new Error('PostgreSQL not available');
    }

    const {
      metric = 'cpu_usage',
      query: rawQuery,             // map field query → rawQuery
      table = 'metrics',           // bảng mặc định chứa time-series
      timeColumn = 'timestamp',
      valueColumn = 'value',
      metricColumn = 'metric_name',
      from = 'now-1h',
      to = 'now',
      aggregation = 'AVG',
      groupBy = []                 // groupBy mặc định là mảng rỗng
    } = options;

    const range = this.resolveTimeRange(from, to);
    const selectedValueColumn = valueColumn || 'value';

    // Nếu có custom raw query thì chạy luôn
    if (rawQuery) {
      const interpolatedQuery = this.interpolateSQLTimeRange(rawQuery, range);
      const rows = await postgres.query(interpolatedQuery);
      const hasTimeField =
        rows.length > 0 &&
        (rows[0].time || rows[0].timestamp || rows[0].ts || rows[0].date);
      const hasValueField =
        rows.length > 0 && (rows[0].value !== undefined || rows[0].val !== undefined);

      if (hasTimeField && hasValueField) {
        const timeField = rows[0].time
          ? 'time'
          : rows[0].timestamp
          ? 'timestamp'
          : rows[0].ts
          ? 'ts'
          : 'date';
        const valueField = rows[0].value !== undefined ? 'value' : 'val';

        const normalized = rows.map((row) => ({
          timestamp: new Date(row[timeField]).toISOString(),
          value: parseFloat(row[valueField])
        }));

        return {
          type: 'timeseries',
          data: normalized
        };
      }

      return {
        type: 'raw',
        data: rows
      };
    }

    // Còn không thì dùng helper queryTimeSeries
    const data = await postgres.queryTimeSeries({
      table,
      timeColumn,
      valueColumn: selectedValueColumn,
      metricColumn,
      metric,
      from: range.from,
      to: range.to,
      aggregation,
      groupBy,
      logger: (msg) => this.pushLog('postgres', msg)
    });

    return {
      type: 'timeseries',
      data
    };
  }

  resolveTimeRange(from, to) {
    const parseTime = (value, fallbackNow = false) => {
      if (!value && fallbackNow) return new Date();
      if (value === 'now') return new Date();

      const relative = /^now-(\d+)([smhdw])$/i;
      const match = typeof value === 'string' ? value.match(relative) : null;
      if (match) {
        const amount = parseInt(match[1], 10);
        const unit = match[2].toLowerCase();
        const multipliers = { s: 1, m: 60, h: 3600, d: 86400, w: 604800 };
        const seconds = amount * (multipliers[unit] || 0);
        return new Date(Date.now() - seconds * 1000);
      }

      const dt = new Date(value);
      if (Number.isNaN(dt.getTime())) {
        return new Date();
      }
      return dt;
    };

    const toDate = parseTime(to, true);
    const fromDate = parseTime(from, true);

    return { from: fromDate, to: toDate };
  }

  interpolateSQLTimeRange(sql, range) {
    if (!sql) return sql;
    const fromISO = range.from.toISOString();
    const toISO = range.to.toISOString();

    return sql
      .replace(/\$__from/g, `'${fromISO}'`)
      .replace(/\$__to/g, `'${toISO}'`);
  }

  async getAvailableMetrics() {
    const metrics = {
      prometheus: [],
      postgres: []
    };

    const prometheus = this.getDataSource('prometheus');
    if (prometheus) {
      try {
        metrics.prometheus = await prometheus.getMetrics();
      } catch (error) {
        console.error('Error fetching Prometheus metrics:', error);
      }
    }

    const postgres = this.getDataSource('postgres');
    if (postgres) {
      try {
        // Ưu tiên lấy metric_name trong bảng metrics
        const rows = await postgres.query(`
          SELECT DISTINCT metric_name 
          FROM metrics 
          ORDER BY metric_name
        `);
        metrics.postgres = rows.map(r => r.metric_name);
      } catch (error) {
        console.error('Error fetching PostgreSQL metrics from metrics table:', error);
        // Fallback: nếu dùng host_metrics dạng cột, lấy các cột (trừ cột thời gian)
        try {
          const rows = await postgres.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'host_metrics'
              AND column_name NOT IN ('ts', 'timestamp', 'time')
            ORDER BY column_name
          `);
          metrics.postgres = rows.map(r => r.column_name);
        } catch (err2) {
          console.error('Error fetching PostgreSQL metrics from host_metrics:', err2);
        }
      }
    }

    return metrics;
  }

  async testConnections() {
    const results = {};

    for (const [name, ds] of this.dataSources) {
      try {
        results[name] = await ds.testConnection();
      } catch (error) {
        results[name] = false;
      }
    }

    return results;
  }

  async close() {
    for (const [name, ds] of this.dataSources) {
      if (ds.close) {
        await ds.close();
      }
    }
  }

  pushLog(type, message, level = 'info') {
    if (!this.logs.has(type)) {
      this.logs.set(type, []);
    }
    const arr = this.logs.get(type);
    arr.push({
      level,
      message,
      timestamp: new Date().toISOString()
    });
    if (arr.length > 200) {
      arr.shift();
    }
  }

  getLogs(type) {
    return this.logs.get(type) || [];
  }

  clearLogs(type) {
    this.logs.set(type, []);
  }
}

const dataSourceManager = new DataSourceManager();

module.exports = dataSourceManager;
