const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../Kone_Plus.user.js'), 'utf8');
const start = source.indexOf('    let probeQueue = Promise.resolve();');
const code = source.slice(start, source.indexOf('    function getPwList()', start));
const flush = async () => { for (let i = 0; i < 20; i++) await Promise.resolve(); };
function environment(failOpen = false) {
  let now = 0, sequence = 0, timerId = 0;
  const timers = new Map(), values = new Map(), tabs = [], cache = new Map();
  const context = {
    URL, crypto: { randomUUID: () => `test-${++sequence}` },
    Date: { now: () => now }, _linkCheckCache: cache,
    GM_getValue: (key, fallback) => values.get(key) ?? fallback,
    GM_setValue: (key, value) => values.set(key, value),
    _kchKey: url => {
      const parsed = new URL(url);
      return parsed.origin + parsed.pathname;
    },
    GM_deleteValue: key => values.delete(key),
    GM_openInTab: (url, options) => {
      if (failOpen) throw new Error('Tabs unavailable');
      assert.equal(options.active, false);
      const tab = { url, closed: false, close() { this.closed = true; } };
      tabs.push(tab);
      return tab;
    },
    setInterval: fn => { timers.set(++timerId, fn); return timerId; },
    clearInterval: id => timers.delete(id),
    setLinkState: (card, alive, msg) => { card.state = { alive, msg }; },
  };
  vm.runInNewContext(code, context);
  return {
    tabs, values, cache, timers,
    check: (url, card) => context.checkRenderedLink(url, card),
    reply: (tab, result) => values.set(new URL(tab.url).searchParams.get('kone_plus_probe'), JSON.stringify(result)),
    tick: async (elapsed = 0) => {
      now += elapsed;
      for (const callback of [...timers.values()]) callback();
      await flush();
    },
  };
}
(async () => {
  const env = environment(), first = {}, duplicate = {}, queued = {};
  const url = 'https://uploadnow.io/f/dtZbqC1';
  env.check(url, first);
  env.check(url, duplicate);
  env.check('https://docs.google.com/document/d/test/edit', queued);
  await flush();
  assert.equal(env.tabs.length, 1);
  const target = new URL(env.tabs[0].url);
  assert.equal(target.pathname, '/en/share');
  assert.equal(target.searchParams.get('utm_source'), 'dtZbqC1');
  env.reply(env.tabs[0], { alive: true, msg: '정상 (비밀번호 필요)' });
  await env.tick();
  assert.equal(first.state.alive, true);
  assert.equal(duplicate.state.alive, true);
  assert.equal(env.tabs[0].closed, true);
  assert.equal(env.values.size, 1); // The queued second tab now owns its task record.
  assert.equal(env.cache.get(url).expiresAt, 60000);
  assert.equal(env.tabs.length, 2);
  env.reply(env.tabs[1], { alive: false, msg: '링크 만료 또는 삭제' });
  await env.tick();
  assert.equal(queued.state.alive, false);
  assert.equal(env.tabs[1].closed, true);
  assert.equal(env.values.size, 0);
  assert.equal(env.timers.size, 0);

  const timeout = environment(), timedCard = {};
  timeout.check(url, timedCard);
  await flush();
  await timeout.tick(25001);
  assert.equal(timedCard.state.alive, null);
  assert.equal(timeout.tabs[0].closed, true);
  assert.equal(timeout.cache.size, 0);
  assert.equal(timeout.timers.size, 0);

  const closed = environment(), closedCard = {};
  closed.check(url, closedCard);
  await flush();
  closed.tabs[0].closed = true;
  await closed.tick();
  assert.equal(closedCard.state.alive, null);
  assert.equal(closed.timers.size, 0);

  const unavailable = environment(true), unavailableCard = {};
  unavailable.check(url, unavailableCard);
  await flush();
  assert.equal(unavailableCard.state.alive, null);
  assert.equal(unavailable.timers.size, 0);
  console.log('Background probe checks passed: deduplication, queue, redirect URL, results, cache, cleanup, timeout, closed tab, unavailable API');
})().catch(error => { console.error(error); process.exitCode = 1; });
