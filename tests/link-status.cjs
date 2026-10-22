const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const source = fs.readFileSync(require('node:path').join(__dirname, '../Kone_Plus.user.js'), 'utf8');
const inspect = source.slice(source.indexOf('    function inspectSharePage('), source.indexOf('    // 조회용 탭'));
const key = source.slice(source.indexOf('    function _kchKey('), source.indexOf('    function getChannelUrlMap('));
const cases = [
  ['kio.ac', '컬렉션을 찾을 수 없음', false],
  ['kio.ac', 'Kiosk File Sharing', null],
  ['mypikpak.com', '공유가 만료되었습니다', false],
  ['gofile.io', 'This content does not exist', false],
  ['gofile.io', 'Gofile app', null],
  ['gofile.io', '23 items\nPreview\nDownload', true],
  ['transfer.it', '이런, 이 전송을 찾을 수 없습니다', false],
  ['mega.nz', 'Just a moment', null],
  ['uploadnow.io', 'This folder is password protected : Password Unlock', true],
  ['uploadnow.io', 'This link is expired or invalid.', false],
  ['uploadnow.io', 'Shared folder\n0 folders, 4 files (86.5 GB)', true],
  ['uploadnow.io', 'Forbidden', null],
  ['docs.google.com', 'You need access', null],
  ['docs.google.com', 'Sorry, the file you have requested does not exist', false],
  ['docs.google.com', 'Google Docs', null],
];
for (const [host, text, expected] of cases) {
  const context = {
    host, PW_SITES: {}, location: { pathname: '/d/test' },
    document: { body: { innerText: text }, querySelectorAll: () => [], querySelector: () => null },
  };
  const actual = vm.runInNewContext(inspect + ';inspectSharePage();', context);
  assert.equal(actual?.alive ?? null, expected, host + ': ' + text);
  if (text === 'You need access') assert.equal(actual.msg, '접근 권한 필요');
}
const publicDoc = {
  host: 'docs.google.com', PW_SITES: {}, location: { pathname: '/document/d/test/edit' },
  document: {
    body: { innerText: '전의 보유목록 수정 액세스 요청 공유 로그인 파일수정보기도구도움말' },
    querySelector: selector => selector === '.kix-appview-editor' ? { getClientRects: () => [{}] } : null,
    querySelectorAll: () => [],
  },
};
const publicResult = vm.runInNewContext(inspect + ';inspectSharePage();', publicDoc);
assert.equal(publicResult.alive, true);
assert.equal(publicResult.msg, '문서 열림');
for (const [host, selector, element] of [
  ['mega.nz', '.filename', { textContent: 'sample.txt', getClientRects: () => [{}] }],
  ['workupload.com', 'a[href]', { href: 'https://workupload.com/start/test', getClientRects: () => [{}] }],
]) {
  const context = {
    host, URL, PW_SITES: {}, location: { pathname: '/file/test', href: `https://${host}/file/test`, origin: `https://${host}` },
    document: { body: { innerText: '' }, querySelector: () => null, querySelectorAll: query => query === selector ? [element] : [] },
  };
  assert.equal(vm.runInNewContext(inspect + ';inspectSharePage();', context).alive, true, host);
}
const context = { URL };
vm.runInNewContext(key, context);
assert.equal(context._kchKey('https://uploadnow.io/f/dtZbqC1'), context._kchKey('https://uploadnow.io/en/share?utm_source=dtZbqC1'));
assert.notEqual(context._kchKey('https://uploadnow.io/en/share?utm_source=dtZbqC1'), context._kchKey('https://uploadnow.io/en/share?utm_source=dt3bqC2'));
assert.equal(context._kchKey('https://kio.ac/c/test?x=1'), 'https://kio.ac/c/test');
console.log(`${cases.length + 3} link status cases and 3 channel mapping checks passed`);
