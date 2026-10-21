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
  const button = { disabled: false, textContent: 'Unlock', click() {
    submitted.push(input.value);
    if (result === 'success') input = null;
    if (result === 'reject') error = 'incorrect password';
    observer(); // DOM 변경 알림이 겹쳐도 중복 제출하지 않음
  } };
  const scope = { querySelectorAll: () => [button] };
  const context = {
    siteCfg: { mode, inputSel: 'input', btnSel: 'button', errorPat: [/incorrect/] },
    getInputEl: () => input,
    getEffectivePwList: () => ['first', 'second'],
    setNativeValue: (el, value) => { el.value = value; error = ''; },
    findPwError: () => error,
    getScope: () => scope, isVisible: () => true, normText: text => text,
    submitViaEnter: () => assert.fail('Expected visible button'),
    Date: { now: () => (now += 1000) },
    MutationObserver: class { constructor(callback) { observer = callback; } observe() {} },
    document: { documentElement: {} },
    setTimeout: callback => { callback(); },
  };
  vm.runInNewContext(code, context);
  for (let i = 0; i < 100; i++) await Promise.resolve();
  return submitted;
}
(async () => {
  for (const mode of ['generic', 'gofile']) {
    assert.deepEqual(await run(mode, 'success'), ['first']);
    assert.deepEqual(await run(mode, 'reject'), ['first', 'second']);
    assert.deepEqual(await run(mode, 'pending'), ['first']);
    assert.deepEqual(await run(mode, 'pending', 'manual'), []);
  }
  console.log('8 password attempt checks passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
