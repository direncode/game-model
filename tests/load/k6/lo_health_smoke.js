// k6 health smoke — runs at high concurrency, confirms /health never 5xxs
// Run: k6 run tests/load/k6/lo_health_smoke.js --env HOST=http://localhost:8000

import http from 'k6/http';
import { check } from 'k6';

export const options = {
  vus: 200,
  duration: '1m',
  thresholds: {
    http_req_duration: ['p(95)<30', 'p(99)<100'],
    http_req_failed:   ['rate<0.0001'],
  },
};

const HOST = __ENV.HOST || 'http://localhost:8000';

export default function () {
  const res = http.get(`${HOST}/api/v1/lo/health`);
  check(res, { 'status 200': (r) => r.status === 200 });
}
