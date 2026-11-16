'use strict';
const { contextBridge } = require('electron');
const version = process.argv.find(arg => arg.startsWith('--loopfront-version='))?.split('=')[1] || 'unknown';
contextBridge.exposeInMainWorld('LoopfrontDesktop', Object.freeze({ platform: process.platform, version }));
