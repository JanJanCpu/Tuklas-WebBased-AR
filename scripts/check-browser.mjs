// Run against a local Vite server and a dedicated Chrome --remote-debugging-port=9222 profile.
// Uses a real AR.js detector with a canvas camera stream; never accesses a physical camera.
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { modules } from '../backend/src/data/modules.ts';
const offline = process.env.TEST_OFFLINE === '1';
const origin = offline ? 'http://127.0.0.1:5186' : process.env.TEST_ORIGIN || 'http://localhost:5174';
// Stop the real server after preparation: even the worker cannot reach the network.
const server = offline ? createServer(async (request, response) => {
  const pathname = new URL(request.url, origin).pathname;
  try {
    const path = pathname === '/' ? '/index.html' : pathname;
    const data = await readFile(new URL('../frontend/dist' + path, import.meta.url));
    response.setHeader('Content-Type', ({ js: 'application/javascript', css: 'text/css', html: 'text/html', png: 'image/png', svg: 'image/svg+xml', webmanifest: 'application/manifest+json' })[path.split('.').pop()] || 'application/octet-stream');
    response.end(data);
  } catch { response.writeHead(404); response.end(); }
}) : null;
if (server) await new Promise(resolve => server.listen(5186, '127.0.0.1', resolve));
const pages = await (await fetch('http://127.0.0.1:9222/json/list')).json();
const page = pages.find(p => p.type === 'page');
const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }));
let sequence = 0;
const pending = new Map();
const errors = [];
socket.addEventListener('message', event => {
  const data = JSON.parse(event.data);
  if (data.id) { const task = pending.get(data.id); pending.delete(data.id); data.error ? task.reject(data.error) : task.resolve(data.result); }
  if (data.method === 'Runtime.exceptionThrown') errors.push(data.params.exceptionDetails.exception?.description || data.params.exceptionDetails.text);
});
const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++sequence; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
const evaluate = async expression => { const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true, userGesture: true }); if (r.exceptionDetails) throw Error(r.exceptionDetails.exception?.description || r.exceptionDetails.text); return r.result?.value; };
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(expression, timeout = 20000) { const end = Date.now() + timeout; while (Date.now() < end) { if (await evaluate(expression)) return; await sleep(150); } throw Error(`Timed out: ${expression}\n${await evaluate('document.body.innerText')}`); }
const click = async text => { await evaluate(`(() => { const button = [...document.querySelectorAll('button')].find(b => b.textContent.trim() === ${JSON.stringify(text)}); if (!button) throw Error('Missing button: ' + ${JSON.stringify(text)}); button.click(); })()`); await sleep(130); };
const card = async text => { await evaluate(`(() => { const button = [...document.querySelectorAll('.module-card')].find(b => b.textContent.includes(${JSON.stringify(text)})); if (!button) throw Error('Missing card'); button.click(); })()`); await sleep(130); };
await send('Page.enable'); await send('Runtime.enable');
await send('Network.enable');
await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
if (offline) await send('Storage.clearDataForOrigin', { origin, storageTypes: 'all' });
await evaluate(`try { sessionStorage.removeItem('testRole'); } catch { /* New about:blank profile. */ }`);
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await send('Page.addScriptToEvaluateOnNewDocument', { source: `
localStorage.setItem('tuklas-user', JSON.stringify({ id: 'browser-test-${Date.now()}-' + (sessionStorage.testRole || 'teacher'), username: 'test', name: 'Browser Test', role: sessionStorage.testRole || 'teacher', sectionId: null }));
localStorage.setItem('tuklas-token', 'test-only'); localStorage.setItem('tuklas-view-mode', 'ar');
const realFetch = window.fetch.bind(window);
${offline ? `Object.defineProperty(navigator, 'onLine', { configurable: true, get: () => sessionStorage.testOffline !== '1' });` : ''}
window.__records = [];
window.fetch = (input, init) => { const url = typeof input === 'string' ? input : input.url; if (url.includes('/api/')) { if (url.endsWith('/sync') && init?.body) { const incoming = JSON.parse(init.body).records; for (const record of incoming) if (!window.__records.some(r => r.id === record.id)) window.__records.push({...record, syncedAt: new Date().toISOString()}); } return Promise.resolve(new Response(JSON.stringify(url.endsWith('/modules') ? ${JSON.stringify(modules)} : { records: window.__records, feedback: window.__feedback || [], sections: [], students: [] }), { status: 200 })); } return realFetch(input, init); };
window.__markerVisible = true;
${offline ? `const mockFetch = window.fetch; window.fetch = (input, init) => { const url = typeof input === 'string' ? input : input.url; return !navigator.onLine && url.includes('/api/') ? Promise.reject(new TypeError('Offline API unavailable')) : mockFetch(input, init); };` : ''}
navigator.mediaDevices.getUserMedia = async () => {
 const canvas = document.createElement('canvas'); canvas.width = 640; canvas.height = 480;
 const ctx = canvas.getContext('2d'); const marker = new Image(); marker.src = '/assets/tuklas-marker.png'; await marker.decode();
 const draw = () => { ctx.fillStyle = 'white'; ctx.fillRect(0, 0, 640, 480); if (window.__markerVisible) ctx.drawImage(marker, 170, 90, 300, 300); }; draw();
 const timer = setInterval(draw, 50); const stream = canvas.captureStream(20);
 for (const track of stream.getTracks()) { const stop = track.stop.bind(track); track.stop = () => { clearInterval(timer); stop(); }; }
 return stream;
};` });
await send('Page.navigate', { url: origin });
await waitFor(`document.body.innerText.includes('Preview Lessons')`);
if (offline) {
  await waitFor(`!!navigator.serviceWorker.controller`);
  await waitFor(`document.body.innerText.includes('Preview Lessons')`);
  await click('Settings');
  await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('Prepare for Offline Use')).click()`);
  await waitFor(`document.body.innerText.includes('Ready: 12 experiments cached')`);
  const cached = await evaluate(`(async () => { const keys = await caches.keys(); const cache = await caches.open(keys.find(k => k.startsWith('tuklas-webar-'))); return (await cache.keys()).map(r => new URL(r.url).pathname); })()`);
  assert.ok(cached.some(path => path.includes('ScienceScene-')), 'Unvisited 3D chunk is precached');
  assert.ok(cached.some(path => path.includes('ar-threex-')), 'Unvisited AR chunk is precached');
  assert.ok(!cached.some(path => path.startsWith('/api/')), 'No API data cached');
  await evaluate(`sessionStorage.testOffline = '1'`);
  server.closeAllConnections();
  await new Promise(resolve => server.close(resolve));
  await send('Network.enable');
  await send('Network.setCacheDisabled', { cacheDisabled: true });
  await send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  await send('Network.overrideNetworkState', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 });
  await send('Page.reload');
  await waitFor(`document.body.innerText.includes('Preview Lessons') && !navigator.onLine`);
  assert.equal(await evaluate(`fetch('/not-cached-offline-probe').then(() => false, () => true)`), true, 'Uncached network request fails');
  console.log('PASS offline cold reload, unvisited AR/3D chunks precached, HTTP cache disabled.');
}
await mkdir('.browser-check/screens', { recursive: true });
const range = async (index, value) => { await evaluate(`(() => { const input = document.querySelectorAll('input[type=range]')[${index}]; Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, ${JSON.stringify(String(value))}); input.dispatchEvent(new Event('input', { bubbles: true })); })()`); await sleep(150); };
for (const experiment of modules) {
  await click('Preview Lessons');
  assert.equal(await evaluate(`document.querySelectorAll('.module-card').length`), 4);
  await card(experiment.quarter);
  await card(experiment.moduleTitle);
  await card(experiment.title);
  await click('Next');
  await waitFor(`document.querySelector('.three-scene canvas') !== null`);
  if (experiment.id === 'inertia') assert.equal(await evaluate(`!!document.querySelector('.fallback-mode') && !document.querySelector('.camera-status')`), true, 'First experiment opens in 3D even with a legacy camera preference');
  if (await evaluate(`document.body.innerText.includes('Use 3D Model')`)) await click('Use 3D Model');
  await sleep(500);
  // Sweep both inputs to their maxima and back to exercise state/scene transitions.
  await evaluate(`(() => { for (const input of document.querySelectorAll('input[type=range]')) { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, input.max); input.dispatchEvent(new Event('input', { bubbles: true })); input.dispatchEvent(new Event('change', { bubbles: true })); } })()`);
  await sleep(200); await click('Reset model');
  if (['series', 'parallel', 'home-circuit'].includes(experiment.id)) await click('Close switch');
  if (experiment.id === 'earth-scale') for (const layer of ['Inner core', 'Outer core', 'Mantle', 'Crust']) await click(`Add ${layer}`);
  if (experiment.id === 'bonding') {
    await click('Transfer to Cl');
    await waitFor(`document.querySelector('.data-readout').textContent.includes('1 electron transferred')`);
    await range(0, 1);
    await click('Place shared pair 1 in O–H'); await click('Place shared pair 2 in O–H');
    await waitFor(`document.querySelector('.data-readout').textContent.includes('2/2 shared pairs')`);
  }
  if (experiment.id === 'chemical-change') { await range(0, 2); await range(1, 2); await waitFor(`document.querySelector('.data-readout').textContent.includes('new substance')`); }
  if (experiment.id === 'replication') await evaluate(`(() => { for (const select of document.querySelectorAll('.base-choice select')) { const old = select.parentElement.querySelector('strong').textContent; select.value = {A:'T',T:'A',C:'G',G:'C'}[old]; select.dispatchEvent(new Event('change', { bubbles: true })); } })()`);
  await click('Run Trial');
  await evaluate(`document.querySelector('.ar-frame').scrollIntoView({ block: 'center' })`);
  await sleep(250);
  await writeFile(`.browser-check/screens/${experiment.id}-3d.png`, Buffer.from((await send('Page.captureScreenshot')).data, 'base64'));
  await click('Use Camera');
  await waitFor(`document.querySelector('.camera-status')?.textContent === 'Tuklas marker detected.'`, 30000);
  await waitFor(`[...document.querySelectorAll('button')].some(b => b.textContent === 'Run Trial' && !b.disabled)`);
  await evaluate(`document.querySelector('.ar-frame').scrollIntoView({ block: 'center' })`);
  await sleep(350);
  await writeFile(`.browser-check/screens/${experiment.id}-ar.png`, Buffer.from((await send('Page.captureScreenshot')).data, 'base64'));
  await evaluate('window.__markerVisible = false');
  await waitFor(`[...document.querySelectorAll('button')].some(b => b.textContent === 'Run Trial' && b.disabled)`);
  await evaluate('window.__markerVisible = true');
  await waitFor(`[...document.querySelectorAll('button')].some(b => b.textContent === 'Run Trial' && !b.disabled)`);
  assert.equal(await evaluate('document.documentElement.scrollWidth > window.innerWidth'), false, `${experiment.id}: horizontal overflow`);
  console.log(`PASS ${experiment.id}: mobile 3D, real marker detection, loss/reacquisition, trial gate`);
  await click('Home');
}
assert.deepEqual(errors, []);
console.log('PASS all twelve experiments without browser exceptions.');
if (offline) {
  // Hold a real marker load until after leaving AR to reproduce the disposal race.
  await evaluate(`(() => {
    const prototype = window.THREEx.ArToolkitContext.prototype;
    window.__originalArInit = prototype.init;
    prototype.init = function(ready) { window.__originalArInit.call(this, () => {
      const load = this.arController.loadMarker.bind(this.arController);
      this.arController.loadMarker = async url => {
        window.__markerPending = true;
        await new Promise(resolve => { window.__releaseMarker = resolve; });
        try { return await load(url); } finally { window.__markerFinished = true; }
      };
      ready();
    }); };
  })()`);
  await click('Preview Lessons'); await card(modules[0].quarter); await card(modules[0].moduleTitle); await card(modules[0].title); await click('Next');
  await waitFor('window.__markerPending === true');
  await click('Home');
  await evaluate('window.__releaseMarker()');
  await waitFor('window.__markerFinished === true');
  await sleep(250);
  assert.deepEqual(errors, []);
  await evaluate('window.THREEx.ArToolkitContext.prototype.init = window.__originalArInit');
  console.log('PASS leaving AR while the marker is still loading.');
}
// Verify saved stages belong to the selected experiment, including repeat observations.
await evaluate(`sessionStorage.testRole = 'student';`);
await send('Page.reload');
await waitFor(`document.body.innerText.includes('Progress Summary')`);
await click('Modules'); await card(modules[0].quarter); await card(modules[0].moduleTitle); await card(modules[0].title);
await evaluate(`document.querySelectorAll('fieldset input[type=radio]:first-of-type').forEach(input => { if (!document.querySelector('input[name="'+input.name+'"]:checked')) input.click(); })`);
await click('Next');
await waitFor(`document.querySelector('.three-scene canvas') !== null`);
await click('Run Trial'); await click('Run Trial');
const recordCheck = expression => `(async () => {
  const db = await new Promise((resolve, reject) => { const request = indexedDB.open('tuklas-poe', 1); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
  try {
    const all = await new Promise((resolve, reject) => { const request = db.transaction('records').objectStore('records').getAll(); request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error); });
    const savedRecords = all.filter(r => r.userId === (JSON.parse(localStorage.getItem('tuklas-user'))?.id || window.__lastUserId)).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return ${expression};
  } finally { db.close(); }
})()`;
const studentRecords = 'savedRecords';
await waitFor(recordCheck(`${studentRecords}.filter(r => r.moduleId === 'inertia' && r.stage === 'Observe').length === 1`));
await click('Continue');
await evaluate(`document.querySelectorAll('textarea:not([readonly])').forEach(input => { Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(input, 'At zero net force, the stationary cart remained at rest.'); input.dispatchEvent(new Event('input', { bubbles: true })); })`);
await click('Submit');
await waitFor(`document.body.innerText.includes('Great work!')`);
assert.deepEqual(await evaluate(recordCheck(`${studentRecords}.map(r => r.stage)`)), ['Predict', 'Observe', 'Explain']);
await click('Modules'); await card(modules[1].quarter); await card(modules[1].moduleTitle); await card(modules[1].title);
assert.equal(await evaluate(`document.querySelectorAll('.prediction-question').length`), 3);
assert.equal(await evaluate(`document.querySelectorAll('input[type=radio]:checked').length`), 0);
assert.equal(await evaluate(`window.__records.filter(r => r.moduleId === 'force-mass').length`), 0);
await click('Modules');
assert.equal(await evaluate(`document.querySelectorAll('.module-card').length`), 4, 'Modules navigation always opens Quarters');
assert.deepEqual(errors, []);
console.log('PASS student POE submission, repeat-trial deduplication and experiment isolation. Screenshots in .browser-check/screens.');
if (offline) {
  await send('Page.reload');
  await waitFor(`document.body.innerText.includes('Progress Summary')`);
  await click('Settings');
  await waitFor(`document.querySelectorAll('.record-card').length === 3`);
  assert.equal(await evaluate(recordCheck(`${studentRecords}.every(r => !r.syncedAt)`)), true);
  assert.equal(await evaluate('window.__records.length'), 0, 'No offline uploads');
  await evaluate(`window.__export = null; const create = URL.createObjectURL.bind(URL); URL.createObjectURL = blob => { window.__export = blob.text(); return create(blob); };`);
  await click('Export JSON');
  assert.equal(JSON.parse(await evaluate('window.__export')).length, 3);
  for (const path of ['/assets/tuklas-marker.png', '/assets/tuklas-marker.patt', '/assets/camera_para.dat']) {
    assert.equal(await evaluate(`fetch(${JSON.stringify(path)}).then(r => r.ok)`), true);
  }
  console.log('PASS offline POE persistence after reload, JSON export, marker and calibration downloads.');
  await send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await send('Network.overrideNetworkState', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await evaluate(`sessionStorage.removeItem('testOffline'); window.dispatchEvent(new Event('online'));`);
  await waitFor(recordCheck(`${studentRecords}.every(r => !!r.syncedAt) && window.__records.length === 3`));
  console.log('PASS reconnect uploads all three queued stages (mock API).');
  await evaluate(`(async () => { for (const name of await caches.keys()) { if (name.startsWith('tuklas-webar-')) await (await caches.open(name)).delete('/assets/tuklas-marker.patt'); } })()`);
  await evaluate(`[...document.querySelectorAll('button')].find(b => b.textContent.includes('Prepare for Offline Use')).click()`);
  await waitFor(`document.body.innerText.includes('Offline preparation failed. Check connection and browser storage.')`);
  assert.equal(await evaluate(`document.body.innerText.includes('Ready: 12 experiments cached')`), false);
  assert.deepEqual(errors, []);
  console.log('PASS missing offline file reports preparation failure instead of Ready.');
}
if (offline) {
  // Exercise real IndexedDB transactions in two same-origin JS contexts.
  const storageBundle = await build({ stdin: { contents: "export * from './frontend/src/lib/storage.ts'", resolveDir: process.cwd(), loader: 'ts' }, bundle: true, write: false, format: 'iife', globalName: 'AuditStorage' });
  const storageCode = storageBundle.outputFiles[0].text;
  await evaluate(storageCode + '; true');
  const storageResult = await evaluate(`(async () => {
    const frame = document.createElement('iframe'); document.body.append(frame);
    frame.contentWindow.eval(${JSON.stringify(storageCode)});
    const make = (id, userId) => ({ id, userId, role: 'student', module: 'Inertia', moduleId: 'inertia', mode: 'fallback', stage: 'Predict', text: id, createdAt: new Date().toISOString() });
    try {
      await Promise.all(Array.from({ length: 30 }, (_, index) => (index % 2 ? frame.contentWindow.AuditStorage : AuditStorage).saveRecord(make('concurrent-' + index, index < 20 ? 'storage-a' : 'storage-b'))));
      const counts = [(await AuditStorage.loadRecords('storage-a')).length, (await AuditStorage.loadRecords('storage-b')).length];
      await AuditStorage.clearRecords('storage-a');
      counts.push((await AuditStorage.loadRecords('storage-b')).length);
      await AuditStorage.clearRecords('storage-b');
      return counts;
    } finally { frame.remove(); }
  })()`);
  assert.deepEqual(storageResult, [20, 10, 10]);
  console.log('PASS concurrent IndexedDB saves across contexts and account-scoped deletion.');

  await evaluate(`window.__feedback = [{ id: 'grade', moduleId: 'inertia', score: 90, comment: 'Private student A feedback' }];`);
  await click('Modules'); await card(modules[0].quarter); await card(modules[0].moduleTitle); await card(modules[0].title);
  await waitFor(`!!document.querySelector('.locked-notice') && document.body.innerText.includes('Private student A feedback')`);
  await evaluate(`window.__previousRecords = window.__records; window.__records = []; window.__feedback = [];`);
  await waitFor(`!!document.querySelector('.prediction-question') && !!!document.querySelector('.locked-notice')`);
  assert.equal(await evaluate(recordCheck('savedRecords.length')), 0);
  assert.equal(await evaluate(`document.body.innerText.includes('Private student A feedback')`), false);
  console.log('PASS teacher reset unlocks an open activity and clears feedback without navigation.');
  await evaluate(`window.__originalPut = IDBObjectStore.prototype.put; IDBObjectStore.prototype.put = function() { throw new DOMException('Test quota limit', 'QuotaExceededError'); }; document.querySelectorAll('fieldset input[type=radio]:first-of-type').forEach(input => { if (!document.querySelector('input[name="'+input.name+'"]:checked')) input.click(); });`);
  await click('Next');
  await waitFor(`document.body.innerText.includes('Could not save your work')`);
  assert.equal(await evaluate(`!!document.querySelector('.prediction-question') && document.querySelectorAll('input[type=radio]:checked').length > 0`), true);
  assert.equal(await evaluate(recordCheck('savedRecords.length')), 0);
  await evaluate('IDBObjectStore.prototype.put = window.__originalPut');
  console.log('PASS failed local save keeps answers on screen and does not advance progress.');


  await evaluate(`(() => {
    const previousFetch = window.fetch;
    window.__holdMine = true;
    window.fetch = (input, init) => {
      const url = typeof input === 'string' ? input : input.url;
      if (url.endsWith('/sync/mine') && window.__expireSession) return Promise.resolve(new Response('{}', { status: 401 }));
      if (url.endsWith('/sync/mine') && window.__holdMine) {
        window.__heldMine = true;
        return new Promise(resolve => { window.__releaseMine = () => resolve(new Response(JSON.stringify({ records: window.__previousRecords, feedback: [{ id: 'stale-grade', moduleId: 'inertia', comment: 'Private student A feedback' }] }), { status: 200 })); });
      }
      return previousFetch(input, init);
    };
  })()`);
  await waitFor('window.__heldMine === true');
  await click('Logout');
  await waitFor(`!!document.querySelector('.auth-form')`);
  await evaluate(`localStorage.setItem('tuklas-user', JSON.stringify({ id: 'account-b', username: 'b', name: 'Student B', role: 'student', sectionId: null })); localStorage.setItem('tuklas-token', 'account-b-token'); localStorage.setItem('tuklas-view-mode', 'fallback'); window.__holdMine = false; window.dispatchEvent(new Event('storage'));`);
  await waitFor(`document.body.innerText.includes('Progress Summary')`);
  await evaluate('window.__releaseMine()');
  await sleep(200);
  await click('Modules'); await card(modules[0].quarter); await card(modules[0].moduleTitle); await card(modules[0].title);
  assert.equal(await evaluate(`!!document.querySelector('.prediction-question')`), true);
  assert.equal(await evaluate(`document.body.innerText.includes('Private student A feedback')`), false);
  assert.equal(await evaluate(recordCheck('savedRecords.length')), 0);
  console.log('PASS account switch rejects delayed records and feedback from the old account.');

  await evaluate(`document.querySelectorAll('fieldset input[type=radio]:first-of-type').forEach(input => { if (!document.querySelector('input[name="'+input.name+'"]:checked')) input.click(); })`);
  await click('Next');
  await waitFor(recordCheck('savedRecords.length === 1'));
  await evaluate(`window.__lastUserId = 'account-b'; window.__expireSession = true;`);
  await waitFor(`!!document.querySelector('.auth-form') && document.body.innerText.includes('Your session expired')`);
  assert.equal(await evaluate(`localStorage.getItem('tuklas-token')`), null);
  assert.equal(await evaluate(recordCheck('savedRecords.length')), 1);
  assert.deepEqual(errors, []);
  console.log('PASS expired session opens login immediately and preserves locally saved work.');
}
await evaluate(`sessionStorage.removeItem('testRole')`);
socket.close();
