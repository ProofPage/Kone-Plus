const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../Kone_Plus.user.js'), 'utf8');
const initialStart = source.indexOf('  const initialProbeKey =');
const initial = source.slice(initialStart, source.indexOf('\n', initialStart));
const routingStart = source.indexOf('    const pendingProbe =');
const routing = source.slice(routingStart, source.indexOf('    if (probeKey &&', routingStart));
const key = source.slice(source.indexOf('    function _kchKey('), source.indexOf('    function getChannelUrlMap('));
const canonical = 'https://transfer.it/t/example';
const task = { id: 'kone-probe-test', expiresAt: 2000 };
function route(original, visibility, record) {
  const context = vm.createContext({
    URL, location: { href: original },
    document: { visibilityState: visibility }, Date: { now: () => 1000 },
    GM_getValue: name => {
      assert.equal(name, 'kone-probe-task:' + canonical);
      return record;
    },
  });
  vm.runInContext(key + initial, context);
  context.location.href = canonical; // Simulate the host removing the query.
  return vm.runInContext(routing + ';probeKey;', context);
}
assert.equal(route(canonical + '?kone_plus_probe=kone-probe-original', 'visible', null), 'kone-probe-original');
assert.equal(route(canonical, 'hidden', task), 'kone-probe-test');
assert.equal(route(canonical, 'visible', task), null);
assert.equal(route(canonical, 'hidden', { ...task, expiresAt: 999 }), null);
assert.equal(route(canonical, 'hidden', null), null);
console.log('5 probe routing checks passed: early URL capture, redirected hidden tab, foreground isolation, expiry, missing task');
