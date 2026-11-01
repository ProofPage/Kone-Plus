const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../Kone_Plus.user.js'), 'utf8');

const start = source.indexOf('    function checkLink(');
const classifier = source.slice(source.indexOf('    function classifyDirectResponse('), source.indexOf('    function setLinkState('));
const code = classifier + source.slice(start, source.indexOf("    document.addEventListener('click'", start));
const card = { setAttribute() {}, classList: { remove() {}, add() {} }, querySelector() { return null; } };
let state;
let requestSent;

const context = {
  URL, Date, DONE_ATTR: 'data-b64d',
  _linkCheckCache: new Map(),
  _linkRequests: new Map(),
  navigator: { userAgent: 'test-agent' },
  GM_xmlhttpRequest: request => { requestSent = request; },
  document: { createElement: () => card },
  getChannelCode: () => null,
  setLinkState: (el, alive, msg) => { state = { alive, msg }; },
  GM_openInTab: () => assert.fail('Must never open tabs'),
};

vm.runInNewContext(code, context);

// 1. URL 요청이 해당 URL 자체로 직접 전송되는지 확인 (API 엔드포인트 우회 없음)
const testUrl = 'https://gofile.io/d/test1234';
context.makeLinkCard(testUrl);
assert.equal(requestSent.url, testUrl);
assert.equal(requestSent.method, 'GET');
assert.equal(state.alive, null);

// 2. 응답 분류 로직 검증 (비-API 직접 HTML/텍스트 검사)
const cases = [
  ['gofile.io', 'https://gofile.io/d/123', 200, '<html>files list</html>', true, '링크 정상'],
  ['gofile.io', 'https://gofile.io/d/123', 200, 'This content does not exist', false, '링크 만료'],
  ['gofile.io', 'https://gofile.io/d/123', 404, 'Not Found', false, '링크 만료'],
  ['uploadnow.io', 'https://uploadnow.io/f/abc', 200, 'This link is expired or invalid.', false, '링크 만료'],
  ['uploadnow.io', 'https://uploadnow.io/f/abc', 200, 'This folder is password protected', true, '정상 (비번 필요)'],
  ['transfer.it', 'https://transfer.it/t/xyz', 200, '이런, 이 전송을 찾을 수 없습니다', false, '링크 만료'],
  ['workupload.com', 'https://workupload.com/file/1', 200, 'passwordprotected form', true, '정상 (비번 필요)'],
  ['workupload.com', 'https://workupload.com/file/1', 200, 'file not found', false, '링크 만료'],
  ['docs.google.com', 'https://docs.google.com/document/d/1', 200, 'Sorry, the file you have requested does not exist', false, '링크 만료'],
  ['docs.google.com', 'https://docs.google.com/document/d/1', 200, 'You need access', null, '접근 권한 필요'],
  ['kio.ac', 'https://kio.ac/c/1', 200, '컬렉션을 찾을 수 없음', false, '링크 만료'],
  ['kio.ac', 'https://kio.ac/c/1', 200, '컬렉션 다운로드', true, '링크 정상'],
  ['mega.nz', 'https://mega.nz/file/abc#P!key', 200, '<html>mega</html>', null, '비번 보호 링크'],
  ['mega.nz', 'https://mega.nz/file/abc#key', 200, '<html>mega</html>', true, '링크 정상'],
];

for (const [host, url, status, body, expectedAlive, expectedMsg] of cases) {
  const result = context.classifyDirectResponse(host, url, { status, responseText: body });
  assert.equal(result.alive, expectedAlive, `${host} alive mismatch`);
  assert.equal(result.msg, expectedMsg, `${host} msg mismatch`);
}

// 3. 소스코드 내 GM_openInTab 미존재 확인 (자동 탭 열림 방지 보장)
assert.doesNotMatch(source, /GM_openInTab/);
assert.doesNotMatch(source, /kone_plus_probe/);

console.log('Direct HTTP non-API checks passed: direct URL GET, exact classification across all hosts, no automatic tabs');
