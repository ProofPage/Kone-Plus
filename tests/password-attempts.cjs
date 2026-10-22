const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../Kone_Plus.user.js'), 'utf8');
const start = source.indexOf("      if (siteCfg.mode === 'gofile' || siteCfg.mode === 'generic')");
const code = source.slice(start, source.indexOf('      // WORKUPLOAD 모드', start));

async function run(mode, result, initialValue = '') {
  let input = { value: initialValue, closest: () => null };
  let error = '', now = 0, observer;
  const submitted = [];
  let pendingError = false;
  const button = { disabled: false, textContent: 'Unlock', click() {
    submitted.push(input.value);
    if (result === 'success') input = null;
    if (result === 'reject') error = 'incorrect password';
    if (result === 'retained-error') { error = ''; pendingError = true; }
    observer(); // DOM 변경 알림이 겹쳐도 중복 제출하지 않음
  } };
  const scope = { querySelectorAll: () => [button] };
  const context = {
    siteCfg: { mode, inputSel: 'input', btnSel: 'button', errorPat: [/incorrect/] },
    getInputEl: () => input,
    getEffectivePwList: () => ['first', 'second'],
    setNativeValue: (el, value) => { el.value = value; if (result !== 'retained-error') error = ''; },
    findPwError: () => error,
    getScope: () => scope, isVisible: () => true, normText: text => text,
    submitViaEnter: () => assert.fail('Expected visible button'),
    Date: { now: () => (now += 1000) },
    MutationObserver: class { constructor(callback) { observer = callback; } observe() {} },
    document: { documentElement: {} },
    setTimeout: callback => { if (pendingError) { error = 'incorrect password'; pendingError = false; } callback(); },
  };
  vm.runInNewContext(code, context);
  for (let i = 0; i < 100; i++) await Promise.resolve();
  return submitted;
}
(async () => {
  const scopeCode = source.slice(source.indexOf('      function getScope('), source.indexOf('      function findPwError('));
  const body = {};
  const unlock = { textContent: 'Unlock', visible: true };
  const eye = { textContent: '', visible: true };
  const panel = { parentElement: body, querySelectorAll: () => [eye, unlock] };
  const group = { parentElement: panel, querySelectorAll: () => [eye] };
  const context = {
    document: { body }, siteCfg: { btnSel: 'button' },
    isVisible: el => el.visible, normText: text => text.trim(),
  };
  vm.runInNewContext(scopeCode, context);
  assert.equal(context.getScope({ closest: () => null, parentElement: group }), panel);
  assert.equal(context.getScope({ closest: () => panel }), panel);
  assert.equal(context.getScope(null), body);
  unlock.textContent = '계속';
  assert.equal(context.getScope({ closest: () => null, parentElement: group }), panel);
  unlock.textContent = 'Continue';
  assert.equal(context.getScope({ closest: () => null, parentElement: group }), panel);
  for (const mode of ['generic', 'gofile']) {
    assert.deepEqual(await run(mode, 'success'), ['first']);
    assert.deepEqual(await run(mode, 'reject'), ['first', 'second']);
    assert.deepEqual(await run(mode, 'pending'), ['first']);
    assert.deepEqual(await run(mode, 'pending', 'manual'), []);
    assert.deepEqual(await run(mode, 'retained-error'), ['first', 'second']);
  }
  console.log('10 password attempt checks and 5 submit scope checks passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
