const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../Kone_Plus.user.js'), 'utf8').replace(/\r\n/g, '\n');
const start = source.indexOf("      if (siteCfg.mode === 'linklock')");
const code = source.slice(start, source.indexOf('\n    }\n  });', start));
async function run(correct) {
  let state = 'input';
  const input = { value: '' }, attempts = [];
  const retry = { textContent: 'Try again', click: () => { state = 'input'; } };
  const submit = { disabled: false, click: () => {
    attempts.push(input.value);
    state = input.value === correct ? 'unlocked' : 'retry';
  } };
  vm.runInNewContext(code, {
    siteCfg: { mode: 'linklock', retryText: /try again/i, inputSel: '#password', btnSel: '#unlockbutton' },
    document: { querySelectorAll: () => state === 'retry' ? [retry] : [], querySelector: () => submit },
    isVisible: () => true, normText: x => x.trim(),
    getInputEl: () => state === 'input' ? input : null,
    getEffectivePwList: () => ['replay', 'hackernews'],
    setNativeValue: (el, value) => { el.value = value; },
    submitViaEnter: () => assert.fail('Unexpected Enter fallback'),
    setTimeout: fn => { fn(); },
  });
  for (let i = 0; i < 50; i++) await Promise.resolve();
  return { state, attempts };
}
(async () => {
  assert.deepEqual(await run('hackernews'), { state: 'unlocked', attempts: ['replay', 'hackernews'] });
  assert.deepEqual(await run('replay'), { state: 'unlocked', attempts: ['replay'] });
  assert.deepEqual(await run('different'), { state: 'retry', attempts: ['replay', 'hackernews'] });
  console.log('3 Link Lock retry checks passed');
})().catch(error => { console.error(error); process.exitCode = 1; });
