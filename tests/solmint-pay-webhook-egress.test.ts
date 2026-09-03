import assert from 'node:assert/strict';
import test from 'node:test';

import { assertPublicResolution, buildPinnedHttpsOptions, isPublicIp } from '../services/pay-webhook-egress';

test('webhook egress rejects private, special-use and non-routable addresses', () => {
  for (const ip of [
    '0.0.0.1', '10.0.0.1', '100.64.0.1', '127.0.0.1', '169.254.10.10',
    '172.16.0.1', '192.0.0.1', '192.0.2.10', '192.168.1.1', '198.18.0.1',
    '198.51.100.10', '203.0.113.10', '224.0.0.1', '::', '::1', 'fe80::1',
    'fc00::1', 'fd12::1', 'ff02::1', '2001:db8::1', '::ffff:127.0.0.1',
  ]) assert.equal(isPublicIp(ip), false, ip);
  assert.equal(isPublicIp('1.1.1.1'), true);
  assert.equal(isPublicIp('2606:4700:4700::1111'), true);
});

test('webhook egress fails closed when DNS returns any private address', () => {
  assert.throws(() => assertPublicResolution(['1.1.1.1', '10.0.0.1']));
  assert.deepEqual(assertPublicResolution(['1.1.1.1', '8.8.8.8']), ['1.1.1.1', '8.8.8.8']);
});

test('pinned HTTPS transport uses the resolved IP while preserving TLS SNI and Host', () => {
  const target = new URL('https://hooks.example.com/path?q=1');
  const options = buildPinnedHttpsOptions(target, '1.1.1.1', 5, 'v1=test');
  assert.equal(options.hostname, '1.1.1.1');
  assert.equal(options.servername, 'hooks.example.com');
  assert.equal(options.headers.Host, 'hooks.example.com');
  assert.equal(options.headers['X-SolMint-Signature'], 'v1=test');
  assert.equal(options.path, '/path?q=1');
  assert.equal(options.rejectUnauthorized, true);
});

test('pinned transport rejects redirect-capable target metadata and fragments', () => {
  assert.throws(() => buildPinnedHttpsOptions(new URL('https://hooks.example.com/path#fragment'), '1.1.1.1', 0));
  assert.throws(() => buildPinnedHttpsOptions(new URL('http://hooks.example.com/path'), '1.1.1.1', 0));
  assert.throws(() => buildPinnedHttpsOptions(new URL('https://hooks.example.com:8443/path'), '1.1.1.1', 0));
});
