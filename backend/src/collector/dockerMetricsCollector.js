const http = require('http');
const { Pool } = require('pg');

const fs = require('fs');

const {
  TARGET_CONTAINER = 'grafana-backend',
  DATABASE_URL,
  COLLECT_INTERVAL_MS = 30000,
  METRICS_TABLE = 'metrics',
  DOCKER_SOCKET = '/var/run/docker.sock'
} = process.env;

if (!DATABASE_URL) {
  console.error('❌ DATABASE_URL is required');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

async function fetchContainerStats(container) {
  const safeName = encodeURIComponent(container);
  const path = `/containers/${safeName}/stats?stream=false`;
  console.log(
    `[collector] fetching stats socket=${DOCKER_SOCKET} path=${path}`
  );

  return new Promise((resolve, reject) => {
    const req = http.request(
      {
        socketPath: DOCKER_SOCKET,
        path,
        method: 'GET',
        timeout: 5000
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            const data = JSON.parse(body);
            resolve(data);
          } catch (err) {
            console.error('[collector] parse error body:', body);
            reject(err);
          }
        });
      }
    );

    req.on('timeout', () => {
      req.destroy(new Error('Docker stats request timeout'));
    });
    req.on('error', (err) => {
      reject(err);
    });
    req.end();
  });
}

function computeCpuPercent(stats) {
  const cpuDelta =
    stats.cpu_stats.cpu_usage.total_usage -
    stats.precpu_stats.cpu_usage.total_usage;
  const systemDelta =
    stats.cpu_stats.system_cpu_usage - stats.precpu_stats.system_cpu_usage;
  const onlineCpus = stats.cpu_stats.online_cpus || 1;

  if (cpuDelta > 0 && systemDelta > 0) {
    return (cpuDelta / systemDelta) * onlineCpus * 100;
  }
  return 0;
}

async function saveMetric(metricName, value, ts) {
  await pool.query(
    `INSERT INTO ${METRICS_TABLE} (metric_name, timestamp, value)
     VALUES ($1, $2, $3)`,
    [metricName, ts, value]
  );
}

async function collectOnce() {
  try {
    const stats = await fetchContainerStats(TARGET_CONTAINER);
    const cpuPercent = computeCpuPercent(stats);
    const memoryUsage = stats.memory_stats?.usage || 0;
    const now = new Date();

    await saveMetric('cpu_usage', cpuPercent, now);
    await saveMetric('memory_usage', memoryUsage, now);

    console.log(
      `[collector] ${now.toISOString()} cpu=${cpuPercent.toFixed(
        2
      )}% mem=${memoryUsage}`
    );
  } catch (err) {
    console.error('[collector] collect error:', err.message);
    console.error('[collector] full error:', err);
  }
}

async function main() {
  console.log(
    `[collector] starting for container="${TARGET_CONTAINER}" interval=${COLLECT_INTERVAL_MS}ms`
  );
  console.log(`[collector] docker socket: ${DOCKER_SOCKET} exists=${fs.existsSync(DOCKER_SOCKET)}`);
  try {
    await pool.query('SELECT 1');
    console.log('[collector] DB connection OK');
  } catch (err) {
    console.error('[collector] DB connection error:', err.message);
    throw err;
  }
  await collectOnce();
  setInterval(collectOnce, Number(COLLECT_INTERVAL_MS));
}

main().catch((err) => {
  console.error('[collector] fatal:', err);
  process.exit(1);
});
