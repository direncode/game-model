// k6 load test: /api/v1/lo/analyze
// Run: k6 run tests/load/k6/lo_analyze_load.js --env HOST=http://localhost:8000
//
// Targets from SLO.md:
//   p95 < 400ms for 300-survivor inputs
//   error rate < 0.1%
//   RPS ≥ 50 on a single backend pod

import http from 'k6/http';
import { check, sleep } from 'k6';
import { SharedArray } from 'k6/data';

export const options = {
  stages: [
    { duration: '30s', target: 10 },   // ramp up
    { duration: '1m',  target: 50 },   // steady
    { duration: '30s', target: 100 },  // spike
    { duration: '30s', target: 0  },   // ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<400', 'p(99)<1000'],
    http_req_failed:   ['rate<0.001'],
  },
};

const HOST = __ENV.HOST || 'http://localhost:8000';

// 50 synthetic survivors constructed inline to avoid external file load
const survivors = new SharedArray('survivors', () => {
  const out = [];
  for (let i = 0; i < 50; i++) {
    out.push({
      entity: {
        name: `synthetic__event__sample_${i}`,
        type: 'event',
      },
      cluster: i % 8,
      fingerprint_48bit: i.toString(2).padStart(48, '0'),
      flips: i % 12,
      scores: {
        anomaly: (i * 37 % 100) / 100.0,
        composite: (i * 41 % 100) / 100.0,
        diversity: 0.5,
        reconstruction: 0.9,
      },
    });
  }
  return out;
});

export default function () {
  const payload = JSON.stringify({
    corpus_id: `load_test_${__VU}_${__ITER}`,
    survivors: survivors,
  });
  const res = http.post(
    `${HOST}/api/v1/lo/analyze`,
    payload,
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(res, {
    'status 200': (r) => r.status === 200,
    'has convergence_index': (r) => r.json('convergence_index') !== undefined,
  });
  sleep(0.1);
}
