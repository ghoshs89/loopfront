'use strict';
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const asar = require('@electron/asar');
const { NtExecutable, NtExecutableResource, Resource } = require('resedit');
const root = process.argv[2] || path.join(__dirname, 'dist/win-unpacked');
const archive = path.join(root, 'resources/app.asar');
assert(fs.existsSync(path.join(root, 'Loopfront.exe')), 'Windows executable missing');
assert.deepEqual(asar.extractFile(archive, 'web/index.html'), fs.readFileSync(path.join(__dirname, '../web/index.html')));
const metadata = JSON.parse(asar.extractFile(archive, 'package.json'));
assert.equal(metadata.name, 'loopfront-desktop');
assert.equal(metadata.main, 'main.cjs');
if (process.env.LOOPFRONT_BUILD_NUMBER) assert.equal(metadata.version, '0.1.' + process.env.LOOPFRONT_BUILD_NUMBER);
for (const file of ['main.cjs', 'preload.cjs', 'assets/icon.ico']) {
  assert.deepEqual(asar.extractFile(archive, file), fs.readFileSync(path.join(__dirname, file)));
}
const resources = NtExecutableResource.from(NtExecutable.from(fs.readFileSync(path.join(root, 'Loopfront.exe'))));
const info = Resource.VersionInfo.fromEntries(resources.entries)[0];
assert(info, 'Executable version resources missing');
const strings = info.getStringValues(info.getAllLanguagesForStringValues()[0]);
assert.equal(strings.ProductName, 'Loopfront');
assert.equal(strings.FileDescription, 'Loopfront');
assert.equal(strings.ProductVersion.split('.').slice(0, 3).join('.'), metadata.version);
const icons = fs.readFileSync(path.join(__dirname, 'assets/icon.ico'));
const embedded = resources.entries.filter(entry => entry.type === 3).map(entry => Buffer.from(entry.bin));
for (let i = 0; i < icons.readUInt16LE(4); i++) {
  const entry = 6 + i * 16, start = icons.readUInt32LE(entry + 12), size = icons.readUInt32LE(entry + 8);
  assert(embedded.some(icon => icon.equals(icons.subarray(start, start + size))), 'Embedded icon differs from source');
}
console.log('Verified Loopfront EXE branding, icons, version, wrapper and identical shared game page: ' + metadata.version);
