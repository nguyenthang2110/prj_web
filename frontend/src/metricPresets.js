// frontend/src/metricPresets.js

export const METRIC_PRESETS = {
  prometheus: [
    {
      id: 'cpu_usage',
      label: 'CPU usage (%) - trung bình 5 phút',
      type: 'graph',
      query: `
100 - (avg by (instance) (
  irate(node_cpu_seconds_total{mode="idle"}[5m])
) * 100)
`.trim()
    },
    {
      id: 'memory_usage',
      label: 'RAM usage (%)',
      type: 'graph',
      query: `
100 * (
  1 - (node_memory_MemAvailable_bytes / node_memory_MemTotal_bytes)
)
`.trim()
    },
    {
      id: 'http_requests',
      label: 'HTTP requests rate (rps)',
      type: 'graph',
      query: `
sum by (instance) (
  rate(http_requests_total[5m])
)
`.trim()
    }
  ],

  postgres: [
    {
      id: 'cpu_usage_pg',
      label: 'CPU usage từ bảng host_metrics (PostgreSQL)',
      type: 'graph',
      query: `
SELECT
  ts AS "time",
  cpu_usage AS "value"
FROM host_metrics
WHERE ts BETWEEN $__from AND $__to
ORDER BY ts
`.trim()
    },
    {
      id: 'memory_usage_pg',
      label: 'RAM usage từ host_metrics (PostgreSQL)',
      type: 'graph',
      query: `
SELECT
  ts AS "time",
  memory_usage AS "value"
FROM host_metrics
WHERE ts BETWEEN $__from AND $__to
ORDER BY ts
ORDER BY ts
`.trim()
    }
  ],

  mock: [
    {
      id: 'mock_cpu',
      label: 'Mock CPU usage',
      type: 'graph',
      query: 'mock_cpu'
    },
    {
      id: 'mock_ram',
      label: 'Mock RAM usage',
      type: 'graph',
      query: 'mock_ram'
    }
  ]
};