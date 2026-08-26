import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const readJson = (file) => JSON.parse(fs.readFileSync(path.join(root, file), 'utf8'));

test('production package is configured for Node 22', () => {
  const pkg = readJson('package.json');
  assert.equal(pkg.engines?.node, '22.x');
  assert.equal(pkg.scripts?.build, 'vite build');
  assert.equal(pkg.scripts?.check, 'npm run build && npm test');
});

test('deployment configuration is present', () => {
  assert.ok(fs.existsSync(path.join(root, 'netlify.toml')));
  assert.ok(fs.existsSync(path.join(root, 'netlify/functions/ai-coach.mjs')));
  assert.ok(fs.existsSync(path.join(root, 'netlify/functions/tournament-scan.mjs')));
  assert.ok(fs.existsSync(path.join(root, 'netlify/functions/tournament-scan-scheduled.mjs')));
});

test('core application files are present', () => {
  assert.ok(fs.existsSync(path.join(root, 'src/App.tsx')));
  assert.ok(fs.existsSync(path.join(root, 'src/types.ts')));
  assert.ok(fs.existsSync(path.join(root, 'src/lib')));
  assert.ok(fs.existsSync(path.join(root, 'src/services')));
});

test('security-sensitive repository hygiene is intact', () => {
  const envExample = fs.readFileSync(path.join(root, '.env.example'), 'utf8');
  assert.ok(!/service_role/i.test(envExample), 'service_role must not be present in .env.example');
  assert.ok(fs.existsSync(path.join(root, 'SECURITY.md')));
});
