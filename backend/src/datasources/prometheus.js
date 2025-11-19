const axios = require('axios');

class PrometheusDataSource {
  constructor(url = 'http://prometheus:9090') {
    this.baseUrl = url;
  }

  async queryRange(query, start, end, step = '60s') {
    try {
      const response = await axios.get(`${this.baseUrl}/api/v1/query_range`, {
        params: {
          query: query,
          start: this.parseTime(start),
          end: this.parseTime(end),
          step: step
        },
        timeout: 30000
      });

      if (response.data.status === 'success') {
        return this.transformRangeData(response.data.data.result);
      }

      throw new Error('Prometheus query failed');
    } catch (error) {
      console.error('Prometheus query error:', error.message);
      throw error;
    }
  }

  async testConnection() {
    try {
      const response = await axios.get(`${this.baseUrl}/api/v1/status/buildinfo`, {
        timeout: 5000
      });
      return response.status === 200;
    } catch (error) {
      return false;
    }
  }

  transformRangeData(results) {
    if (!results || results.length === 0) {
      return [];
    }

    if (results.length > 1) {
      return results.map(result => ({
        metric: this.formatLabels(result.metric),
        data: result.values.map(([timestamp, value]) => ({
          timestamp: new Date(timestamp * 1000).toISOString(),
          value: parseFloat(value)
        }))
      }));
    }

    const result = results[0];
    return result.values.map(([timestamp, value]) => ({
      timestamp: new Date(timestamp * 1000).toISOString(),
      value: parseFloat(value)
    }));
  }

  formatLabels(labels) {
    const entries = Object.entries(labels)
      .filter(([key]) => key !== '__name__')
      .map(([key, value]) => `${key}="${value}"`)
      .join(', ');
    
    return labels.__name__ + (entries ? `{${entries}}` : '');
  }

  parseTime(timeStr) {
    if (!timeStr) {
      return Math.floor(Date.now() / 1000);
    }

    if (timeStr === 'now') {
      return Math.floor(Date.now() / 1000);
    }

    const match = timeStr.match(/^now-(\d+)([smhdw])$/);
    if (match) {
      const value = parseInt(match[1]);
      const unit = match[2];
      
      const multipliers = {
        's': 1,
        'm': 60,
        'h': 3600,
        'd': 86400,
        'w': 604800
      };

      const seconds = value * multipliers[unit];
      return Math.floor(Date.now() / 1000) - seconds;
    }

    return Math.floor(new Date(timeStr).getTime() / 1000);
  }

  buildQuery(metric, options = {}) {
    const { 
      aggregation = 'avg',
      groupBy = [],
      rate = false,
      rateInterval = '5m'
    } = options;

    let query = metric;

    if (rate) {
      query = `rate(${query}[${rateInterval}])`;
    }

    if (aggregation && aggregation !== 'none') {
      query = `${aggregation}(${query})`;
    }

    if (groupBy.length > 0) {
      query += ` by (${groupBy.join(', ')})`;
    }

    return query;
  }

  async getMetrics() {
    try {
      const response = await axios.get(`${this.baseUrl}/api/v1/label/__name__/values`, {
        timeout: 10000
      });

      if (response.data.status === 'success') {
        return response.data.data;
      }

      return [];
    } catch (error) {
      console.error('Error fetching Prometheus metrics:', error.message);
      return [];
    }
  }
}

module.exports = PrometheusDataSource;