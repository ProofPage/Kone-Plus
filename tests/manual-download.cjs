const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const source = fs.readFileSync(path.join(__dirname, '../Kone_Plus.user.js'), 'utf8');
const start = source.indexOf("      if (siteCfg.mode === 'formpost')");
const code = source.slice(start, source.indexOf('      // LINK-LOCK 모드', start));

for (const mode of ['formpost', 'transfer']) {
  for (const protectedPage of [false, true]) {
    let input = protectedPage ? { value: '' } : null;
    let submits = 0, downloads = 0;
    const timers = [], intervals = [];
    const download = { click: () => { downloads++; } };
    const submit = { disabled: false, click: () => { submits++; input = null; } };
    vm.runInNewContext(`(function () { ${code} })()`, {
      siteCfg: { mode, inputSel: '#password', btnSel: '#unlock', dlBtnSel: '#download', errorPat: [] },
      location: { hostname: 'test.example', pathname: '/file/test' },
      getEffectivePwList: () => ['replay'],
      getInputEl: () => input,
      GM_getValue: (key, fallback) => fallback,
      GM_setValue: () => {},
      setNativeValue: (el, value) => { el.value = value; },
      findPwError: () => '',
      isVisible: () => true,
      document: { querySelector: selector => selector === '#unlock' ? submit : download },
      submitViaEnter: () => assert.fail('Expected password submit button'),
      setTimeout: callback => { timers.push(callback); },
      setInterval: callback => { intervals.push(callback); },
    });
    function flush() {
      while (timers.length) timers.shift()();
    }
    intervals.forEach(tick => tick());
    flush();
    // Continue observing after the password prompt disappears.
    intervals.forEach(tick => tick());
    flush();
    assert.equal(submits, protectedPage ? 1 : 0, `${mode}: password submission`);
    assert.equal(downloads, 0, `${mode}: download must require a user click`);
  }
}
console.log('4 manual-download checks passed: public and password-protected Workupload/Transfer.it');
