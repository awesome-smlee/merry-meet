import test from 'node:test';
import assert from 'node:assert/strict';
import { isAllowedRequestOrigin } from '../lib/request-origin.mjs';

test('development accepts the requested host, while rejecting cross-origin requests', t => {
  const previous = process.env.NODE_ENV;
  t.after(() => { if (previous === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previous; });
  process.env.NODE_ENV = 'development';
  const request = (origin, host = 'localhost:4173') => new Request('http://0.0.0.0:4173/api/rooms', { headers: { origin, host } });
  assert.equal(isAllowedRequestOrigin(request('http://localhost:4173')), true);
  assert.equal(isAllowedRequestOrigin(request('http://127.0.0.1:4173', '127.0.0.1:4173')), true);
  assert.equal(isAllowedRequestOrigin(request('http://evil.example')), false);
  assert.equal(isAllowedRequestOrigin(request('http://localhost:4174')), false);
  assert.equal(isAllowedRequestOrigin(request('https://localhost:4173')), false);
  assert.equal(isAllowedRequestOrigin(request('http://evil.example', 'localhost:4173@evil.example')), false);
  process.env.NODE_ENV = 'production';
  assert.equal(isAllowedRequestOrigin(request('http://localhost:4173')), false);
  assert.equal(isAllowedRequestOrigin(new Request('https://meet.example/api/rooms', { headers: { origin: 'https://meet.example' } })), true);
});
