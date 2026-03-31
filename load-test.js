import http from 'k6/http';
import { check, sleep } from 'k6';

export const options = {
  vus:      10,
  duration: '30s',
};

export default function () {
  const res = http.post(
    'http://localhost:3000/analyze',
    JSON.stringify({ source: 'https://github.com/nestjs/nest' }),
    { headers: { 'Content-Type': 'application/json' } },
  );
  check(res, {
    'status is 202': (r) => r.status === 202,
    'jobId present':  (r) => JSON.parse(r.body).jobId !== undefined,
  });
  sleep(1);
}