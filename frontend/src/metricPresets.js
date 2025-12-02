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
    }
  ],

  postgres: [
    {
      id: 'cpu_usage_pg',
      label: 'CPU usage (PostgreSQL metrics table)',
      type: 'graph',
      query: `
SELECT
  timestamp AS "time",
  value AS "value"
FROM metrics
WHERE metric_name = 'cpu_usage'
  AND timestamp BETWEEN $__from AND $__to
ORDER BY timestamp
`.trim()
    },
    {
      id: 'memory_usage_pg',
      label: 'RAM usage (PostgreSQL metrics table)',
      type: 'graph',
      query: `
SELECT
  timestamp AS "time",
  value AS "value"
FROM metrics
WHERE metric_name = 'memory_usage'
  AND timestamp BETWEEN $__from AND $__to
ORDER BY timestamp
`.trim()
    }
  ],
  // No mock presets
};
