// Drive a built lesson in headless Chrome over CDP: screenshots + console errors + the event readout.
// Usage: node verify.mjs <url> <outDir> [cdpPort]
//   start Chrome first:  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless=new \
//     --user-data-dir=/tmp/lesson-chrome --use-angle=metal --remote-debugging-port=9333 about:blank &
import { writeFileSync, mkdirSync } from 'node:fs';
const [,, url = 'http://localhost:4173/', out = './shots', port = '9333'] = process.argv;
mkdirSync(out, { recursive: true });
const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
const ws = new WebSocket(list.find((t) => t.type === 'page').webSocketDebuggerUrl);
let id = 0; const pend = new Map(); const logs = [];
ws.onmessage = (m) => {
  const d = JSON.parse(m.data);
  if (d.id && pend.has(d.id)) { pend.get(d.id)(d); pend.delete(d.id); }
  if (d.method === 'Runtime.exceptionThrown') logs.push('EXCEPTION ' + (d.params.exceptionDetails.exception?.description ?? d.params.exceptionDetails.text));
  if (d.method === 'Runtime.consoleAPICalled' && ['error', 'warning'].includes(d.params.type)) logs.push(d.params.type + ' ' + d.params.args.map((a) => a.value ?? a.description).join(' '));
};
await new Promise((r) => (ws.onopen = r));
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const shot = async (name) => { const r = await send('Page.captureScreenshot', { format: 'png' }); writeFileSync(`${out}/${name}.png`, Buffer.from(r.result.data, 'base64')); };
const js = async (expression) => (await send('Runtime.evaluate', { expression })).result.result?.value;
await send('Runtime.enable'); await send('Page.enable');

await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
await send('Page.navigate', { url });
await sleep(6000); await shot('1-desktop');
const first = await js(`document.querySelector('[data-tap]')?.dataset.tap`);
if (first) { await js(`document.querySelector('[data-tap]').click()`); await sleep(1500); await shot('2-tap-' + first); }
if (await js(`!!document.querySelector('[data-act="event"]')`)) {
  await js(`document.querySelector('[data-act="event"]').click()`);
  await sleep(2000); await shot('3-event');
  await sleep(4000); await shot('4-event-end');
  console.log('readout:', await js(`document.querySelector('.readout').textContent`));
}
await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
await send('Page.navigate', { url });
await sleep(6000); await shot('5-mobile');
console.log(logs.join('\n') || 'no console errors or warnings');
console.log('screenshots in', out);
process.exit(0);
