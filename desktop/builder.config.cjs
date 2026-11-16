'use strict';
const run = process.env.LOOPFRONT_BUILD_NUMBER;
if (run && !/^[1-9][0-9]*$/.test(run)) throw new Error('Invalid LOOPFRONT_BUILD_NUMBER');
module.exports = {
  appId: 'com.loopfront.desktop', productName: 'Loopfront',
  directories: { output: 'dist' },
  files: ['main.cjs', 'preload.cjs', 'package.json', { from: '../web', to: 'web', filter: ['index.html'] }],
  asar: true,
  ...(run ? { extraMetadata: { version: '0.1.' + run } } : {}),
  win: { target: [{ target: 'zip', arch: ['x64'] }], executableName: 'Loopfront', signAndEditExecutable: false },
  artifactName: 'loopfront-windows-${arch}-v${version}.${ext}',
  publish: null
};
