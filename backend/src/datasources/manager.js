const PrometheusDataSource = require('./prometheus');
const PostgreSQLDataSource = require('./postgresql');

class DataSourceManager {
  constructor() {
    this.dataSources = new Map();
    this.initialized = false;
  }

  async initialize() {
    try {
      const prometheusUrl = process.env.PROMETHEUS_URL || 'http://prometheus:9090';
      const prometheus = new PrometheusDataSource(prometheusUrl);
      
      if (await prometheus.testConnection()) {
        this.dataSources.set('prometheus', prometheus);
        console.log('✅ Prometheus data source connected');
      } else {
        console.log('⚠️  Prometheus not available');
      }

      const postgresConfig = {
        url: process.env.METRICS_DB_URL || process.env.DATABASE_URL,
        ssl: false
      };
      
      const postgres = new PostgreSQLDataSource(postgresConfig);
      
      if (await postgres.testConnection()) {
        this.dataSources.set('postgres', postgres);
        console.log('✅ PostgreSQL data source connected');
      } else {
        console.log('⚠️  PostgreSQL not available');
      }

      this.initialized = true;
    } catch (error) {
      console.error('Error initializing data sources:', error);
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
      datasource = 'mock',
      metric,
      from = 'now-1h',
      to = 'now',
      query: rawQuery
    } = options;

    try {
      switch (datasource) {
        case 'prometheus':
          return await this.queryPrometheus(options);
        
        case 'postgres':
          return await this.queryPostgreSQL(options);
        
        case 'mock':
        default:
          return this.generateMockData(options);
      }
    } catch (error) {
      console.error(`Error querying ${datasource}:`, error);
      return this.generateMockData(options);
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

  async queryPostgreSQL(options) {
    const postgres = this.getDataSource('postgres');
    if (!postgres) {
      throw new Error('PostgreSQL not available');
    }

    const {
      metric='cpu_usage',
      from = "now() - interval '1 hour'",
      to = 'now()',
      aggregation = 'AVG',
    } = options;

    const data = await postgres.queryTimeSeries({
      table,
      metric,
      from,
      to,
      aggregation,
      groupBy
    });

    return {
      type: 'timeseries',
      data
    };
  }

  generateMockData(options) {
    const { metric = 'cpu_usage', from = 'now-1h' } = options;

    const dataPoints = [];
    const now = new Date();
    const duration = this.parseDuration(from);
    const points = Math.min(duration / 60, 100);

    for (let i = points; i >= 0; i--) {
      const timestamp = new Date(now - i * (duration / points) * 1000);
      const value = Math.random() * 100;
      
      dataPoints.push({
        timestamp: timestamp.toISOString(),
        value: Math.round(value * 100) / 100
      });
    }

    return {
      type: 'mock',
      data: dataPoints
    };
  }

  parseDuration(timeStr) {
    const match = timeStr.match(/now-(\d+)([smhdw])/);
    if (!match) return 3600;

    const value = parseInt(match[1]);
    const unit = match[2];

    const multipliers = {
      's': 1,
      'm': 60,
      'h': 3600,
      'd': 86400,
      'w': 604800
    };

    return value * multipliers[unit];
  }

  async getAvailableMetrics() {
    const metrics = {
      prometheus: [],
      postgres: [],
      mock: [
        'cpu_usage',
        'memory_usage',
        'disk_io',
        'network_traffic'
      ]
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
        const rows = await postgres.query(`
          SELECT DISTINCT metric_name 
          FROM metrics 
          ORDER BY metric_name
        `);
        metrics.postgres = rows.map(r => r.metric_name);
      } catch (error) {
        console.error('Error fetching PostgreSQL metrics:', error);
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
}

const dataSourceManager = new DataSourceManager();

module.exports = dataSourceManager;