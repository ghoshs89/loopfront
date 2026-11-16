'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const asar = require('@electron/asar');
const root = process.argv[2] || path.join(__dirname, 'dist/win-unpacked');
const archive = path.join(root, 'resources/app.asar');
assert(fs.existsSync(path.join(root, 'Loopfront.exe')), 'Windows executable missing');
assert.deepEqual(asar.extractFile(archive, 'web/index.html'), fs.readFileSync(path.join(__dirname, '../web/index.html')));
const metadata = JSON.parse(asar.extractFile(archive, 'package.json'));
assert.equal(metadata.name, 'loopfront-desktop');
assert.equal(metadata.main, 'main.cjs');
if (process.env.LOOPFRONT_BUILD_NUMBER) assert.equal(metadata.version, '0.1.' + process.env.LOOPFRONT_BUILD_NUMBER);
for (const file of ['main.cjs', 'preload.cjs']) {
  assert.deepEqual(asar.extractFile(archive, file), fs.readFileSync(path.join(__dirname, file)));
}
console.log('Verified Windows executable, version, wrapper and identical shared game page: ' + metadata.version);
