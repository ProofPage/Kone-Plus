const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../Kone_Plus.user.js'), 'utf8');
const check = source.slice(source.indexOf('    function checkLink('), source.indexOf('    function makeLinkCard('));
const key = source.slice(source.indexOf('    function _kchKey('), source.indexOf('    function getChannelUrlMap('));
const cases = [
  ['https://kio.ac/c/test', { status: 403 }, null],
  ['https://kio.ac/c/test', { status: 500 }, null],
  ['https://kio.ac/c/test', { status: 404 }, false],
  ['https://kio.ac/c/test', { status: 200, responseText: '만료되었습니다' }, false],
  ['https://kio.ac/c/test', { status: 200, responseText: 'Collection' }, true],
  ['https://kio.ac/c/test', 'error', null],
  ['https://kio.ac/c/test', 'timeout', null],
  ['https://mypikpak.com/s/test', { status: 429 }, null],
  ['https://mypikpak.com/s/test', { status: 200, responseText: '{"share_status":"OK"}' }, true],
  ['https://mypikpak.com/s/test', { status: 200, responseText: '{"share_status":"PASS_CODE_REQUIRED"}' }, true],
  ['https://mypikpak.com/s/test', { status: 200, responseText: '{"share_status":"UNKNOWN"}' }, null],
  ['https://gofile.io/d/test', { status: 200, responseText: 'app' }, null],
  ['https://gofile.io/d/test', 'error', null],
  ['https://mega.nz/file/test', {}, null],
  ['https://uploadnow.io/f/dtZbqC1', { status: 403, responseText: '{"error":"This folder is password protected","codes":["PASSWORD_REQUIRED"]}' }, true],
  ['https://uploadnow.io/en/share?utm_source=dt3bqC2', { status: 404, responseText: '{"error":"uuid - folder \\"dt3bqC2\\" does not exist","codes":[]}' }, false],
  ['https://uploadnow.io/f/test', { status: 403, responseText: 'Forbidden' }, null],
  ['https://uploadnow.io/f/test', { status: 500, responseText: '{}' }, null],
  ['https://uploadnow.io/f/test', 'timeout', null],
];
for (const [url, response, expected] of cases) {
  let actual;
  const context = {
    url, URL, _linkCheckCache: new Map(),
    setLinkState: (element, alive) => { actual = alive; },
    GM_xmlhttpRequest: options => {
      if (new URL(url).hostname === 'uploadnow.io') {
        assert.equal(options.method, 'POST');
        assert.equal(JSON.parse(options.data).folderId, new URL(url).searchParams.get('utm_source') || new URL(url).pathname.split('/')[2]);
      }
      if (response === 'error') options.onerror();
      else if (response === 'timeout') options.ontimeout();
      else options.onload(response);
    },
  };
  vm.runInNewContext(check + ';checkLink(url,{classList:{add(){}},querySelector(){return null}});', context);
  assert.equal(actual, expected, url);
}
const context = { URL };
vm.runInNewContext(key, context);
assert.equal(context._kchKey('https://uploadnow.io/f/dtZbqC1'), context._kchKey('https://uploadnow.io/en/share?utm_source=dtZbqC1'));
assert.notEqual(context._kchKey('https://uploadnow.io/en/share?utm_source=dtZbqC1'), context._kchKey('https://uploadnow.io/en/share?utm_source=dt3bqC2'));
assert.equal(context._kchKey('https://kio.ac/c/test?x=1'), 'https://kio.ac/c/test');
console.log(`${cases.length} link status cases and 3 channel mapping checks passed`);
