const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../Kone_Plus.user.js'), 'utf8');
const start = source.indexOf('    function checkLink(');
const classifier = source.slice(source.indexOf('    function classifyLinkResponse('), source.indexOf('    function setLinkState('));
const code = classifier + source.slice(start, source.indexOf("    document.addEventListener('click'", start));
const card = { setAttribute() {}, style: {}, querySelector() { return null; } };
let state;
const context = {
  URL, Date, DONE_ATTR: 'data-b64d', _linkCheckCache: new Map(), _linkRequests: new Map(),
  atob, Uint8Array, TextDecoder,
  DOMParser: class {
    parseFromString(text) {
      return {
        querySelector: () => text.startsWith('KIO-FETCHED:') ? { textContent: text.slice(12) } : null,
        querySelectorAll: () => [],
        body: { textContent: text === 'SCRIPT-ONLY-ERROR' ? '' : text },
      };
    }
  },
  crypto: { randomUUID: () => 'test-device' },
  GM_xmlhttpRequest: request => { context.request = request; },
  document: { createElement: () => card },
  getChannelCode: () => null,
  setLinkState: (el, alive, msg, checking = false) => { state = { alive, msg, checking }; },
  checkRenderedLink: () => assert.fail('Status display must not navigate'),
  GM_openInTab: () => assert.fail('Status display must not open tabs'),
  setTimeout: () => assert.fail('No deferred navigation'),
};
vm.runInNewContext(code, context);
context.makeLinkCard('https://mega.nz/file/test');
assert.equal(card.href, 'https://mega.nz/file/test');
assert.equal(state.alive, null);
assert.match(state.msg, /確認中|확인 중/);
assert.equal(state.checking, true);
context.request.onload({ status: 200, responseText: 'not JSON' });
assert.equal(state.alive, null);
assert.equal(state.checking, false);
assert.match(state.msg, /만료 검증 불가/);
assert.doesNotMatch(card.innerHTML, /bl-check/);
context._linkCheckCache.set(card.href, { alive: false, msg: 'expired', expiresAt: Date.now() + 60000 });
context.makeLinkCard(card.href);
assert.equal(state.alive, false);
assert.equal(state.msg, 'expired');
for (const [host, status, body, alive, msg] of [
  ['mega.nz', 200, '[{"f":[]}]', true, '링크 정상'],
  ['mega.nz', 200, '[{"g":"https://example.test","at":"attributes"}]', true, '링크 정상'],
  ['mega.nz', 200, '[-9]', false, '링크 만료'],
  ['mega.nz', 200, '[-3]', null, '만료 검증 불가'],
  ['mega.nz', 200, '[{}]', null, '만료 검증 불가'],
  ['mega.nz', 403, 'denied', null, '확인 불가 (HTTP 403)'],
  ['mypikpak.com', 200, '{"share_status":"PASS_CODE_REQUIRED"}', true, '정상 (비번 필요)'],
  ['mypikpak.com', 200, '{"share_status":"EXPIRED"}', false, '링크 만료'],
  ['mypikpak.com', 200, '{"share_status":"UNKNOWN"}', null, '만료 검증 불가'],
  ['kio.ac', 200, '<html>app shell</html>', null, '만료 검증 불가'],
  ['kio.ac', 200, '컬렉션을 찾을 수 없음', false, '링크 만료'],
  ['kio.ac', 200, 'SCRIPT-ONLY-ERROR', null, '만료 검증 불가'],
  ['kio.ac', 503, 'server error', null, '확인 불가 (HTTP 503)'],
]) {
  const result = context.classifyLinkResponse(host, { status, responseText: body });
  assert.equal(result.alive, alive);
  assert.equal(result.msg, msg);
}
// Actual KIO /collection/get payload observed on both user-supplied live shares.
const protectedBody = 'o2Rjb2RleCFjb2xsZWN0aW9uOnByb3RlY3Rvcl9ub3RfcHJvdmlkZWRnbWVzc2FnZXZwcm90ZWN0b3Igbm9' +
  '0IHByb3ZpZGVkZG1ldGGhZHR5cGVocGFzc3dvcmQ=';
for (const host of ['kio.ac', 'kiosk.ac']) {
  const classify = (body, status = 418) => context.classifyLinkResponse(host, {
    status: 200, responseText: 'KIO-FETCHED:' + JSON.stringify({ status, body }),
  });
  const result = classify(protectedBody);
  assert.equal(result.alive, true);
  assert.equal(result.msg, '정상 (비번 필요)');
  assert.equal(classify(protectedBody, 500).alive, null);
  assert.equal(classify('invalid-base64').alive, null);
  assert.equal(classify(protectedBody.slice(0, 40)).alive, null);
}
context.checkLink('https://mega.nz/file/error', card);
context.request.onerror();
assert.equal(state.alive, null);
assert.match(state.msg, /연결 실패/);
context.checkLink('https://mega.nz/file/timeout', card);
context.request.ontimeout();
assert.equal(state.alive, null);
assert.match(state.msg, /응답 없음/);
assert.equal(context._linkRequests.size, 0);
for (const url of ['https://mega.nz/#P!encrypted', 'https://gofile.io/d/test', 'https://docs.google.com/document/d/test']) {
  context.request = null;
  context.checkLink(url, card);
  assert.equal(context.request, null);
  assert.equal(state.alive, null);
  assert.equal(state.checking, false);
  assert.equal(state.msg, new URL(url).hostname + ' · ' +
    (url.includes('#P!') ? '비번 보호 링크 (만료 미확인)' : '상태 조회 미지원'));
}
context.checkLink('https://jstrieb.github.io/link-lock/#encrypted', card);
assert.equal(state.msg, 'jstrieb.github.io · 암호화 링크 (만료 미확인)');

// Exercise the actual renderer, including clearing previous colors and busy state.
const render = {};
vm.runInNewContext(source.slice(source.indexOf('    function setLinkState('), start), render);
const classes = new Set(), attributes = {}, sub = {}, arrow = {};
const element = {
  classList: { remove: (...names) => names.forEach(name => classes.delete(name)), add: name => classes.add(name) },
  setAttribute: (name, value) => { attributes[name] = value; },
  querySelector: selector => selector === '.bl-sub' ? sub : arrow,
};
for (const [alive, checking, css, icon] of [
  [true, false, 'lk-alive', '✓'],
  [null, true, 'lk-checking', '⟳'],
  [false, false, 'lk-dead', '!'],
  [null, false, null, '↗'],
]) {
  render.setLinkState(element, alive, 'status', checking);
  assert.deepEqual([...classes], css ? [css] : []);
  assert.equal(attributes['aria-busy'], String(checking));
  assert.equal(arrow.textContent, icon);
  assert.equal(sub.textContent, 'status');
}
assert.doesNotMatch(source, /GM_openInTab|kone_plus_probe/);
console.log('Passive HTTP status checks passed: no tabs, exact messages, response/error handling, unsupported links, cache and cleanup');
