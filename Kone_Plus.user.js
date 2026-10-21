// ==UserScript==
// @name         Kone Plus
// @namespace    https://github.com/ProofPage/Kone-Plus
// @version      3.0.1
// @description  Base64 decoder for kone.gg and password auto-fill for file hosts (kio, mega, pikpak, gofile, transfer, etc.)
// @author       Page
// @homepageURL  https://github.com/ProofPage/Kone-Plus
// @supportURL   https://github.com/ProofPage/Kone-Plus/issues
// @updateURL    https://raw.githubusercontent.com/ProofPage/Kone-Plus/main/Kone_Plus.user.js
// @downloadURL  https://raw.githubusercontent.com/ProofPage/Kone-Plus/main/Kone_Plus.user.js
// @match        *://kone.gg/*
// @match        *://*.kone.gg/*
// @match        *://kio.ac/*
// @match        *://kiosk.ac/*
// @match        *://mega.nz/*
// @match        *://transfer.it/*
// @match        *://gofile.io/*
// @match        *://workupload.com/*
// @match        *://uploadnow.io/*
// @match        *://www.uploadnow.io/*
// @match        *://mypikpak.com/*
// @match        *://jstrieb.github.io/*
// @run-at       document-start
// @grant        GM_xmlhttpRequest
// @grant        GM_registerMenuCommand
// @grant        GM_getValue
// @grant        GM_setValue
// @connect      *
// @license      MIT
// ==/UserScript==

(function () {
  'use strict';

  const host = location.hostname.replace(/^www\./, '');

  function domReady(fn) {
    if (document.readyState !== 'loading') fn();
    else document.addEventListener('DOMContentLoaded', fn, { once: true });
  }

  domReady(function () {
    const DONE_ATTR = 'data-b64d';
    const MIN_B64 = 8;

    const PW_SITES = {
      'uploadnow.io': {
        inputSel: 'input.input_floating[type="password"]',
        btnSel: 'button[class*="buttons_lg__"]',
        errorPat: [/incorrect|invalid password|wrong password/i],
        mode: 'generic', triggerDelay: 1500, btnDelay: 500,
      },
      'kio.ac': {
        inputSel: '.overflow-auto.max-w-full.grow.p-1 input:nth-of-type(1)',
        btnSel: '.flex.flex-col-reverse button:nth-of-type(1)',
        errorPat: [/비밀번호가 일치하지 않/, /incorrect password/i, /invalid password/i],
        mode: 'kio',
      },
      'kiosk.ac': {
        inputSel: '.input.shadow-xl.flex-grow',
        btnSel: '.btn.btn-ghost.w-full.mt-2.rounded-md',
        errorPat: [/비밀번호가 일치하지 않/, /incorrect/i],
        mode: 'kio',
      },
      'mega.nz': {
        inputSel: 'input[name="decrypt-link"], #password-decrypt-input',
        btnSel: 'button.decrypt-button, .mega-component.decrypt-button',
        errorPat: [/invalid password/i, /incorrect/i, /wrong password/i],
        mode: 'generic', triggerDelay: 2500, btnDelay: 500,
      },
      'transfer.it': {
        inputSel: 'input[name="msg-dialog-input"]',
        btnSel: 'button.it-button.xl-size.js-positive-btn',
        dlBtnSel: 'section.it-box.lg-shadow.modal.ready-to-download-box button.it-button.xl-size.js-download',
        errorPat: [/incorrect password/i, /wrong password/i, /invalid/i],
        mode: 'transfer', triggerDelay: 1500,
      },
      'gofile.io': {
        inputSel: 'form[data-fm="password"] input, input[name="password"], input[type="password"], #filesErrorPasswordInput',
        btnSel: 'form[data-fm="password"] button[type="submit"], form[data-fm="password"] button, #filesErrorPasswordButton',
        errorPat: [/incorrect password/i, /wrong/i, /invalid/i],
        mode: 'gofile', triggerDelay: 800, btnDelay: 300,
      },
      'workupload.com': {
        inputSel: '#passwordprotected_file_password',
        btnSel: '#passwordprotected_file_submit',
        dlBtnSel: '.btn.btn-prio:not(.fa-unlock)',
        mode: 'formpost', triggerDelay: 1000,
      },
      'mypikpak.com': {
        inputSel: '.el-input__inner[placeholder*="비밀번호"], .el-input__inner[placeholder*="password"], .el-input__inner',
        btnSel: '.pp-primary-button, .el-button--primary.pp-primary-button',
        errorPat: [/incorrect/i, /wrong/i, /invalid/i, /일치하지 않/, /틀렸/],
        mode: 'generic', triggerDelay: 1500, btnDelay: 500,
      },
      'jstrieb.github.io': {
        inputSel: '#password',
        btnSel: '#unlockbutton',
        errorSel: '.error.red-border, .error',
        retryText: /try again|다시\s*시도/i,
        mode: 'linklock', triggerDelay: 800,
      },
    };

    /* ================================================================
       비밀번호 저장소
    ================================================================ */
    function getPwList() {
      try {
        const r = GM_getValue('pwList', null);
        const p = r ? JSON.parse(r) : [];
        return Array.isArray(p) ? p : [];
      } catch (e) { return []; }
    }
    function savePwList(arr) { GM_setValue('pwList', JSON.stringify((arr || []).filter(Boolean))); }

    function getChannelCode() {
      try { const m = location.pathname.match(/^\/s\/([^/?#]+)/); return m ? m[1] : null; }
      catch (e) { return null; }
    }
    function _kchKey(u) {
      try {
        const x = new URL(/^https?:\/\//i.test(u) ? u : 'https://' + u);
        if (x.hostname.replace(/^www\./, '') === 'uploadnow.io') {
          const id = x.pathname.match(/^\/f\/([^/]+)/)?.[1] ||
            (/^\/(?:[a-z]{2}\/)?share\/?$/.test(x.pathname) ? x.searchParams.get('utm_source') : null);
          if (id) return 'https://uploadnow.io/f/' + id;
        }
        return x.origin + x.pathname;
      }
      catch (e) { return String(u).split(/[?#]/)[0]; }
    }
    function getChannelUrlMap() {
      try {
        const r = GM_getValue('channelUrlMap', null);
        const m = r ? JSON.parse(r) : {};
        return (m && typeof m === 'object' && !Array.isArray(m)) ? m : {};
      } catch (e) { return {}; }
    }
    function setChannelForUrl(url, ch) {
      if (!ch || !url) return;
      const m = getChannelUrlMap();
      m[_kchKey(url)] = { ch, ts: Date.now() };
      const keys = Object.keys(m);
      if (keys.length > 300) keys.sort((a,b)=>(m[a].ts||0)-(m[b].ts||0)).slice(0, keys.length - 300).forEach(k => delete m[k]);
      try { GM_setValue('channelUrlMap', JSON.stringify(m)); } catch (e) {}
    }
    function getChannelForCurrentSite() {
      const rec = getChannelUrlMap()[_kchKey(location.href)];
      return rec ? rec.ch : null;
    }
    function getChannelPwMap() {
      try {
        const r = GM_getValue('channelPw', null);
        const m = r ? JSON.parse(r) : {};
        return (m && typeof m === 'object' && !Array.isArray(m)) ? m : {};
      } catch (e) { return {}; }
    }
    function saveChannelPwMap(m) { try { GM_setValue('channelPw', JSON.stringify(m)); } catch (e) {} }

    function getEffectivePwList() {
      const out = [];
      const ch = getChannelForCurrentSite();
      if (ch) { const list = getChannelPwMap()[ch]; if (Array.isArray(list)) out.push(...list); }
      const g = getPwList(); if (Array.isArray(g)) out.push(...g);
      return [...new Set(out.filter(Boolean))];
    }

    /* ================================================================
       비밀번호 관리 UI (모달)
    ================================================================ */
    function openPwManager() {
      if (document.getElementById('b64d-pw-manager')) return;

      function closePm() {
        document.getElementById('b64d-pw-manager')?.remove();
        document.getElementById('b64d-pw-backdrop')?.remove();
        document.removeEventListener('keydown', onEsc);
      }

      function onEsc(e) {
        if (e.key === 'Escape') closePm();
      }
      document.addEventListener('keydown', onEsc);

      function renderList(listEl) {
        listEl.innerHTML = '';
        const pws = getPwList() || [];
        if (!pws.length) {
          listEl.innerHTML = '<div class="b64dpm-empty">(등록된 비번 없음)</div>';
          return;
        }
        pws.forEach((pw, i) => {
          const item = document.createElement('div');
          item.className = 'b64dpm-item';
          item.innerHTML = `<span class="b64dpm-num">${i + 1}</span><span class="b64dpm-pw">${pw}</span><button class="b64dpm-del" title="삭제">✕</button>`;
          item.querySelector('.b64dpm-del').addEventListener('click', () => {
            savePwList((getPwList() || []).filter((_, j) => j !== i));
            renderList(listEl);
          });
          listEl.appendChild(item);
        });
      }

      const panel = document.createElement('div');
      panel.id = 'b64d-pw-manager';
      panel.dataset.theme = document.documentElement.classList.contains('dark') ? 'dark' : 'light';
      panel.innerHTML = `
        <div class="b64ds-header"><span>🔑 비밀번호 관리</span><button class="b64ds-close">✕</button></div>
        <div class="b64dpm-body">
          <div class="b64dpm-tabs">
            <button class="b64dpm-tab on" id="b64-tab-g">기본 비번</button>
            <button class="b64dpm-tab" id="b64-tab-c">채널별 비번</button>
          </div>
          <div class="b64dpm-pane" id="b64-pane-g">
            <div class="b64dpm-note">공통으로 자동 시도할 비밀번호 목록입니다.</div>
            <div class="b64dpm-list" id="b64-g-list"></div>
            <div class="b64dpm-input-row">
              <input class="b64dpm-input" id="b64-g-in" type="text" placeholder="추가할 비번 (쉼표 구분)" autocomplete="off">
              <button class="b64dpm-add" id="b64-g-add">추가</button>
            </div>
            <button class="b64dpm-clear" id="b64-g-clr">전체 삭제</button>
          </div>
          <div class="b64dpm-pane b64dpm-hide" id="b64-pane-c">
            <div class="b64dpm-note">해당 채널에서 기본 비번보다 먼저 시도됩니다.</div>
            <div class="b64dpm-chpills" id="b64-c-pills"></div>
            <div class="b64dpm-chcontent" id="b64-c-detail"></div>
          </div>
        </div>
      `;

      panel.querySelector('.b64ds-close').addEventListener('click', closePm);
      panel.addEventListener('click', e => e.stopPropagation());

      const gList = panel.querySelector('#b64-g-list');
      const gIn = panel.querySelector('#b64-g-in');
      const gAdd = panel.querySelector('#b64-g-add');
      const gClr = panel.querySelector('#b64-g-clr');

      const doAddG = () => {
        const val = gIn.value.trim(); if (!val) return;
        const cur = getPwList() || [];
        savePwList([...new Set([...cur, ...val.split(',').map(s=>s.trim()).filter(Boolean)])]);
        gIn.value = ''; renderList(gList);
      };
      gAdd.addEventListener('click', doAddG);
      gIn.addEventListener('keydown', e => { if (e.key === 'Enter') doAddG(); });
      gClr.addEventListener('click', () => {
        if (confirm('전체 비밀번호를 삭제하시겠습니까?')) { savePwList([]); renderList(gList); }
      });

      const tabG = panel.querySelector('#b64-tab-g');
      const tabC = panel.querySelector('#b64-tab-c');
      const paneG = panel.querySelector('#b64-pane-g');
      const paneC = panel.querySelector('#b64-pane-c');
      let selCh = null;

      function renderChannel() {
        const pills = panel.querySelector('#b64-c-pills');
        const detail = panel.querySelector('#b64-c-detail');
        const map = getChannelPwMap();
        const chans = Object.keys(map).filter(ch => (map[ch] || []).length);
        if (selCh !== '__new__' && !chans.includes(selCh)) selCh = chans[0] || '__new__';

        pills.innerHTML = '';
        const addB = document.createElement('button');
        addB.className = 'b64dpm-chitem' + (selCh === '__new__' ? ' on' : '');
        addB.textContent = '＋ 새 채널';
        addB.addEventListener('click', () => { selCh = '__new__'; renderChannel(); });
        pills.appendChild(addB);

        chans.forEach(ch => {
          const btn = document.createElement('button');
          btn.className = 'b64dpm-chitem' + (ch === selCh ? ' on' : '');
          btn.textContent = '# ' + ch;
          btn.addEventListener('click', () => { selCh = ch; renderChannel(); });
          pills.appendChild(btn);
        });

        detail.innerHTML = '';
        if (selCh === '__new__') {
          detail.innerHTML = `
            <div class="b64dpm-chtitle">새 채널 등록</div>
            <div class="b64dpm-input-row"><input class="b64dpm-input" id="b64-cn-code" type="text" placeholder="채널 코드 (비우면 현재: ${getChannelCode()||''})"></div>
            <div class="b64dpm-input-row"><input class="b64dpm-input" id="b64-cn-pw" type="text" placeholder="비번 (쉼표 구분)"><button class="b64dpm-add" id="b64-cn-btn">등록</button></div>
          `;
          const doAddCn = () => {
            const codeIn = detail.querySelector('#b64-cn-code');
            const pwIn = detail.querySelector('#b64-cn-pw');
            const ch = (codeIn ? codeIn.value.trim() : '') || getChannelCode();
            const pws = (pwIn ? pwIn.value : '').split(',').map(s=>s.trim()).filter(Boolean);
            if (!ch) { alert('채널 코드를 입력해주세요.'); return; }
            if (!pws.length) { alert('비밀번호를 입력해주세요.'); return; }
            const m = getChannelPwMap();
            m[ch] = [...new Set([...(m[ch]||[]), ...pws])];
            saveChannelPwMap(m);
            if (pwIn) pwIn.value = '';
            selCh = ch;
            renderChannel();
          };
          detail.querySelector('#b64-cn-btn').addEventListener('click', doAddCn);
          detail.querySelector('#b64-cn-pw').addEventListener('keydown', e => { if (e.key === 'Enter') doAddCn(); });
          detail.querySelector('#b64-cn-code').addEventListener('keydown', e => { if (e.key === 'Enter') detail.querySelector('#b64-cn-pw').focus(); });
        } else if (selCh) {
          detail.innerHTML = `
            <div class="b64dpm-chtitle-row">
              <span class="b64dpm-chtitle"># ${selCh}</span>
              <button class="b64dpm-del-ch" id="b64-c-delall" title="이 채널 비번 전체 삭제">채널 삭제</button>
            </div>
            <div class="b64dpm-list" id="b64-c-items"></div>
            <div class="b64dpm-input-row"><input class="b64dpm-input" id="b64-c-in" type="text" placeholder="비번 추가"><button class="b64dpm-add" id="b64-c-add">추가</button></div>
          `;
          const cItems = detail.querySelector('#b64-c-items');
          (map[selCh]||[]).forEach((pw, i) => {
            const row = document.createElement('div');
            row.className = 'b64dpm-item';
            row.innerHTML = `<span class="b64dpm-pw">${pw}</span><button class="b64dpm-del" title="삭제">✕</button>`;
            row.querySelector('.b64dpm-del').addEventListener('click', () => {
              const m = getChannelPwMap(); m[selCh] = (m[selCh]||[]).filter((_, j) => j !== i);
              if (!m[selCh].length) delete m[selCh]; saveChannelPwMap(m); renderChannel();
            });
            cItems.appendChild(row);
          });
          const doAddC = () => {
            const inEl = detail.querySelector('#b64-c-in');
            const pws = (inEl ? inEl.value : '').split(',').map(s=>s.trim()).filter(Boolean);
            if (!pws.length) return;
            const m = getChannelPwMap();
            m[selCh] = [...new Set([...(m[selCh]||[]), ...pws])];
            saveChannelPwMap(m);
            if (inEl) inEl.value = '';
            renderChannel();
          };
          detail.querySelector('#b64-c-add').addEventListener('click', doAddC);
          detail.querySelector('#b64-c-in').addEventListener('keydown', e => { if (e.key === 'Enter') doAddC(); });
          detail.querySelector('#b64-c-delall').addEventListener('click', () => {
            if (confirm(`'# ${selCh}' 채널의 저장된 비번을 모두 삭제하시겠습니까?`)) {
              const m = getChannelPwMap(); delete m[selCh]; saveChannelPwMap(m);
              selCh = null; renderChannel();
            }
          });
        }
      }

      tabG.addEventListener('click', () => {
        tabG.classList.add('on'); tabC.classList.remove('on');
        paneG.classList.remove('b64dpm-hide'); paneC.classList.add('b64dpm-hide');
      });
      tabC.addEventListener('click', () => {
        tabC.classList.add('on'); tabG.classList.remove('on');
        paneC.classList.remove('b64dpm-hide'); paneG.classList.add('b64dpm-hide');
        renderChannel();
      });

      const bd = document.createElement('div');
      bd.id = 'b64d-pw-backdrop';
      bd.addEventListener('click', closePm);

      document.body.appendChild(bd);
      document.body.appendChild(panel);
      renderList(gList);
    }

    GM_registerMenuCommand('🔑 비밀번호 관리', openPwManager);

    /* ================================================================
       [돋보기] 와 [해] 사이에 정확히 버튼 삽입
    ================================================================ */
    function mountHeaderBtn() {
      if (!/kone\.gg/.test(location.hostname)) return;

      const existing = document.getElementById('b64d-header-pw-btn');
      if (existing && document.body.contains(existing)) return;

      const themeBtn = document.querySelector('button[aria-label="Toggle theme"]') ||
                       document.querySelector('header .lucide-sun, header .lucide-moon')?.closest('button') ||
                       document.querySelector('.lucide-sun, .lucide-moon')?.closest('button');

      const targetEl = themeBtn || document.querySelector('header .flex.items-center:last-child') || document.querySelector('header nav');
      if (!targetEl || !targetEl.parentNode) return;

      const btn = existing || document.createElement('button');
      btn.id = 'b64d-header-pw-btn';
      btn.type = 'button';
      btn.setAttribute('data-slot', 'button');
      btn.setAttribute('aria-label', '비밀번호 관리');
      btn.title = '비밀번호 관리';
      btn.className = themeBtn ? (themeBtn.className || '').trim() : 'inline-flex items-center justify-center';

      btn.innerHTML = `<span data-slot="button-content"><span data-slot="button-hit-area" data-size="icon" aria-hidden="true"></span><svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="lucide-icon lucide lucide-key size-4.5" style="pointer-events:none;"><circle cx="7.5" cy="15.5" r="4.5"/><path d="m21 2-9.6 9.6"/><path d="m15.5 7.5 3 3"/><path d="m18.5 4.5 3 3"/></svg></span>`;

      btn.onclick = function (e) {
        e.preventDefault();
        e.stopPropagation();
        openPwManager();
      };

      if (themeBtn) {
        themeBtn.insertAdjacentElement('beforebegin', btn);
      } else {
        targetEl.appendChild(btn);
      }
    }

    if (/kone\.gg/.test(location.hostname)) {
      setInterval(mountHeaderBtn, 300);
    }

    /* ================================================================
       CSS 스타일
    ================================================================ */
    if (!document.getElementById('b64d-style')) {
      const s = document.createElement('style');
      s.id = 'b64d-style';
      s.textContent = `
.b64-link{display:inline-flex;align-items:center;gap:8px;padding:6px 12px 6px 0;margin:4px 0;
  background:#f4f4f5;border:0.5px solid #d4d4d8;border-radius:8px;text-decoration:none;color:#18181b;
  font-size:13px;line-height:1.3;max-width:100%;box-sizing:border-box;overflow:hidden;
  transition:background .15s,border-color .15s;cursor:pointer;vertical-align:middle;-webkit-tap-highlight-color:transparent;}
#post-comment .b64-link{flex-basis:100%;max-width:520px;box-sizing:border-box;margin-top:4px;}
.b64-link .bl-icon{width:16px;height:16px;flex-shrink:0;opacity:.6;}
.b64-link .bl-text{display:flex;flex-direction:column;gap:1px;min-width:0;flex:1;}
.b64-link .bl-title{font-size:13px;font-weight:500;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.b64-link .bl-sub{font-size:11px;opacity:.65;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.b64-link .bl-arrow{flex-shrink:0;opacity:.5;font-size:12px;margin-left:2px;}
.b64-link.lk-checking .bl-arrow{animation:b64spin .8s linear infinite;display:inline-block;}
@keyframes b64spin{to{transform:rotate(360deg);}}

.b64-link.lk-alive{background:#f0fdf4;border-color:#86efac;color:#14532d;}
.b64-link.lk-dead{background:#fef2f2;border-color:#fca5a5;color:#7f1d1d;}

html.dark .b64-link{background:rgba(255,255,255,.08);border-color:rgba(209,213,219,.35);color:#e5e7eb;}
html.dark .b64-link.lk-alive{background:rgba(22,163,74,.14);border-color:rgba(74,222,128,.58);color:#86efac;}
html.dark .b64-link.lk-dead{background:rgba(220,38,38,.14);border-color:rgba(248,113,113,.58);color:#fca5a5;}

.bl-copy{align-self:stretch;display:flex;align-items:center;justify-content:center;
  padding:0 10px 0 12px;flex-shrink:0;cursor:pointer;opacity:.35;
  border-right:1px solid rgba(0,0,0,.1);transition:opacity .15s,background .15s,color .15s;
  min-width:36px;-webkit-tap-highlight-color:transparent;}
.bl-copy.bl-copy-ok{opacity:1 !important;color:#16a34a;}
html.dark .bl-copy{border-right-color:rgba(255,255,255,.12);}

#b64d-header-pw-btn{display:inline-flex!important;align-items:center!important;justify-content:center!important;
  width:36px!important;height:36px!important;min-width:36px!important;min-height:36px!important;
  border-radius:9999px!important;border:none!important;background:transparent!important;color:inherit!important;
  cursor:pointer!important;padding:0!important;margin:0!important;flex-shrink:0!important;line-height:1!important;
  -webkit-tap-highlight-color:transparent;}
#b64d-header-pw-btn:hover,#b64d-header-pw-btn:active{background-color:rgba(127,127,127,.15)!important;}

#b64d-pw-manager{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);
  width:440px;max-width:calc(100vw - 24px);max-height:85vh;border-radius:16px;
  background:#18181b;color:#fafafa;box-shadow:0 20px 50px rgba(0,0,0,.75);
  z-index:2147483642;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;font-size:13px;
  display:flex;flex-direction:column;overflow:hidden;box-sizing:border-box;}
#b64d-pw-manager *,#b64d-pw-manager *::before,#b64d-pw-manager *::after{box-sizing:border-box;}
#b64d-pw-manager[data-theme="light"]{background:#ffffff;color:#18181b;}
#b64d-pw-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:2147483641;backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);}
.b64ds-header{display:flex;align-items:center;justify-content:space-between;padding:12px 16px;background:rgba(127,127,127,.1);font-weight:700;font-size:15px;flex-shrink:0;}
.b64ds-close{background:none;border:none;color:inherit;opacity:.65;cursor:pointer;font-size:18px;line-height:1;padding:0;width:34px;height:34px;display:inline-flex;align-items:center;justify-content:center;border-radius:8px;transition:opacity .15s,background .15s;-webkit-tap-highlight-color:transparent;}
.b64ds-close:active{background:rgba(127,127,127,.2);}
.b64dpm-body{padding:14px 16px;display:flex;flex-direction:column;gap:8px;flex:1;min-height:0;overflow:hidden;}
.b64dpm-tabs{display:flex;gap:4px;background:rgba(127,127,127,.15);border-radius:999px;padding:3px;margin-bottom:4px;flex-shrink:0;}
.b64dpm-tab{flex:1;font-size:13px;font-weight:500;padding:8px 0;border-radius:999px;border:none;cursor:pointer;background:none;color:inherit;opacity:.6;transition:all .15s;text-align:center;-webkit-tap-highlight-color:transparent;}
.b64dpm-tab.on{background:rgba(127,127,127,.25);opacity:1;font-weight:700;}
.b64dpm-pane{display:flex;flex-direction:column;height:330px;max-height:calc(85vh - 130px);min-height:0;}
.b64dpm-hide{display:none!important;}
.b64dpm-note{font-size:11px;opacity:.65;margin-bottom:8px;line-height:1.4;flex-shrink:0;}
.b64dpm-list{flex:1;overflow-y:auto;display:flex;flex-direction:column;gap:6px;padding:2px 0;min-height:80px;-webkit-overflow-scrolling:touch;}
.b64dpm-empty{font-size:12px;opacity:.6;padding:28px 2px;text-align:center;}
.b64dpm-item{display:flex;align-items:center;padding:8px 10px;border-radius:8px;background:rgba(127,127,127,.1);min-width:0;}
.b64dpm-num{flex:0 0 20px;text-align:center;font-size:12px;opacity:.5;}
.b64dpm-pw{flex:1;min-width:0;margin-left:8px;font-family:monospace;font-size:13px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.b64dpm-del{background:none;border:none;color:#ef4444;cursor:pointer;font-size:16px;padding:4px 8px;flex-shrink:0;opacity:.8;display:inline-flex;align-items:center;justify-content:center;border-radius:6px;transition:opacity .15s;-webkit-tap-highlight-color:transparent;}
.b64dpm-input-row{display:flex;gap:6px;margin-top:8px;flex-shrink:0;width:100%;min-width:0;box-sizing:border-box;}
.b64dpm-input{flex:1;min-width:0;padding:9px 12px;border-radius:8px;font-size:13px;border:1px solid rgba(127,127,127,.3);background:transparent;color:inherit;outline:none;box-sizing:border-box;transition:border-color .15s,box-shadow .15s;-webkit-appearance:none;}
.b64dpm-input:focus{border-color:#0284c7;box-shadow:0 0 0 2px rgba(2,132,199,.25);}
.b64dpm-add{flex-shrink:0;white-space:nowrap;padding:0 16px;height:38px;border-radius:8px;cursor:pointer;font-size:13px;font-weight:600;border:none;background:#0284c7;color:#fff;display:inline-flex;align-items:center;justify-content:center;transition:background .15s;-webkit-tap-highlight-color:transparent;}
.b64dpm-add:active{background:#0369a1;}
.b64dpm-clear{padding:8px 12px;border-radius:8px;cursor:pointer;font-size:12px;border:1px solid #ef4444;background:transparent;color:#ef4444;margin-top:6px;text-align:center;flex-shrink:0;transition:background .15s;-webkit-tap-highlight-color:transparent;}
.b64dpm-clear:active{background:rgba(239,68,68,.15);}
.b64dpm-chpills{display:flex;gap:6px;overflow-x:auto;padding:2px 2px 8px 2px;flex-shrink:0;scrollbar-width:none;-webkit-overflow-scrolling:touch;}
.b64dpm-chpills::-webkit-scrollbar{display:none;}
.b64dpm-chitem{display:inline-flex;align-items:center;padding:7px 14px;border-radius:999px;border:none;background:rgba(127,127,127,.12);color:inherit;cursor:pointer;font-size:12px;white-space:nowrap;flex-shrink:0;transition:all .15s;-webkit-tap-highlight-color:transparent;}
.b64dpm-chitem.on{background:#0284c7;color:#fff;font-weight:600;}
.b64dpm-chcontent{display:flex;flex-direction:column;flex:1;min-height:0;min-width:0;margin-top:4px;}
.b64dpm-chtitle-row{display:flex;align-items:center;justify-content:space-between;margin-bottom:6px;flex-shrink:0;}
.b64dpm-chtitle{font-size:13px;font-weight:700;margin-bottom:6px;}
.b64dpm-del-ch{background:none;border:1px solid rgba(239,68,68,.5);color:#ef4444;font-size:11px;border-radius:6px;padding:3px 8px;cursor:pointer;transition:background .15s;-webkit-tap-highlight-color:transparent;}

/* 데스크톱(PC) 호버 스타일 */
@media (hover: hover) and (pointer: fine) {
  .b64-link:hover{background:#e4e4e7;border-color:#a1a1aa;}
  html.dark .b64-link:hover{background:rgba(255,255,255,.13);border-color:rgba(209,213,219,.55);}
  .bl-copy:hover{opacity:.85;background:rgba(0,0,0,.07);}
  html.dark .bl-copy:hover{background:rgba(255,255,255,.09);}
  .b64ds-close:hover{opacity:1;background:rgba(127,127,127,.15);}
  .b64dpm-del:hover{opacity:1;background:rgba(239,68,68,.1);}
  .b64dpm-add:hover{background:#0369a1;}
  .b64dpm-clear:hover{background:rgba(239,68,68,.1);}
  .b64dpm-chitem:hover{background:rgba(127,127,127,.2);}
  .b64dpm-chitem.on:hover{background:#0284c7;}
  .b64dpm-del-ch:hover{background:rgba(239,68,68,.15);}
}

/* 모바일 & 좁은 화면 최적화 */
@media (max-width: 640px) {
  #b64d-pw-manager{width:min(420px, calc(100vw - 20px));max-height:88vh;border-radius:14px;}
  .b64dpm-body{padding:12px 14px;}
  .b64dpm-input{font-size:16px!important;} /* iOS/안드로이드 자동 줌 방지 */
  .b64dpm-add{height:42px;min-width:60px;font-size:14px;}
  .b64ds-close{width:36px;height:36px;font-size:20px;}
  .b64dpm-del{padding:6px 10px;font-size:16px;}
  .b64-link{padding:8px 12px 8px 0;font-size:13px;}
  .bl-copy{padding:0 12px 0 14px;min-width:44px;}
}
`;
      (document.head || document.documentElement).appendChild(s);
    }

    /* ================================================================
       Base64 디코딩 코어
    ================================================================ */
    const DEC_STRICT = new TextDecoder('utf-8', { fatal: true });
    const DEC_LENIENT = new TextDecoder('utf-8', { fatal: false });

    function looksLikeB64(str) {
      const norm = str.replace(/-/g, '+').replace(/_/g, '/');
      const unpadded = norm.replace(/=+$/, '');
      if (unpadded.length < MIN_B64 || unpadded.length % 4 === 1) return false;
      return /^[A-Za-z0-9+/]+$/.test(unpadded);
    }

    function isProbablyText(str) {
      if (!str || str.length === 0) return false;
      let bad = 0, repl = 0;
      for (const ch of str) {
        const c = ch.codePointAt(0);
        if (c < 0x09 || (c > 0x0d && c < 0x20) || c === 0x7f || (c >= 0x80 && c <= 0x9f)) bad++;
        if (c === 0xfffd) repl++;
      }
      if (repl > 0 || bad / str.length >= 0.08) return false;

      // Meaningful content: contains Korean, URL, supported host domain, or readable sentence
      const hasKorean = /[가-힣]/.test(str);
      const hasUrl = /(?:https?:\/\/|www\.)\S/i.test(str);
      const hasHost = /\b(kio\.ac|kiosk\.ac|mega\.nz|gofile\.io|mypikpak\.com|transfer\.it|workupload\.com)\b/i.test(str);
      if (hasKorean || hasUrl || hasHost) return true;

      // If it's plain text, avoid single English words that happen to decode into weird ASCII
      return /^[A-Za-z0-9\s.,!?:;/@_#\-\+\(\)\[\]]+$/.test(str) && (str.includes(' ') || str.length <= 30);
    }

    function b64DecodeCore(norm) {
      const unpadded = norm.replace(/=+$/, '');
      const rem = unpadded.length % 4;
      let s = unpadded;
      if (rem === 2) s += '==';
      else if (rem === 3) s += '=';
      const bytes = Uint8Array.from(atob(s), c => c.charCodeAt(0));
      try { return DEC_STRICT.decode(bytes); }
      catch (e) { return DEC_LENIENT.decode(bytes); }
    }

    function decodeB64Once(str) {
      const compact = str.replace(/\s+/g, '');
      if (!looksLikeB64(compact)) return null;
      try { return b64DecodeCore(compact.replace(/-/g, '+').replace(/_/g, '/')); }
      catch (e) { return null; }
    }

    function fullyDecode(str) {
      let cur = str, best = null;
      for (let i = 0; i < 8; i++) {
        const d = decodeB64Once(cur);
        if (!d || !isProbablyText(d)) break;
        best = d; cur = d;
      }
      return best;
    }

    const B64_MATCH_RE = new RegExp(`[A-Za-z0-9+/\\-_]{${MIN_B64},}={0,2}`, 'g');
    const URL_RE = /((?:https?:\/\/|www\.)(?:(?!https?:\/\/)[^\s<>"'()ᄀ-ᇿ　-㿿぀-ヿ㄰-㆏㐀-䶿一-鿿ꥠ-꥿가-퟿豈-﫿＀-￯])+)/gi;

    function findAllMatches(raw) {
      const hits = [];
      B64_MATCH_RE.lastIndex = 0;
      const toks = [];
      let m;
      while ((m = B64_MATCH_RE.exec(raw)) !== null) {
        toks.push({ index: m.index, end: m.index + m[0].length, text: m[0] });
      }

      let last = 0, i = 0;
      while (i < toks.length) {
        if (toks[i].index < last) { i++; continue; }
        let j = i;
        while (j + 1 < toks.length && !/=$/.test(toks[j].text) && /^\s+$/.test(raw.slice(toks[j].end, toks[j+1].index))) {
          j++;
        }
        let consumed = false;
        if (j > i) {
          const seg = raw.slice(toks[i].index, toks[j].end);
          const dec = fullyDecode(seg);
          if (dec) {
            hits.push({ index: toks[i].index, length: toks[j].end - toks[i].index, decoded: dec });
            last = toks[j].end; i = j + 1; consumed = true;
          }
        }
        if (!consumed) {
          const dec = fullyDecode(toks[i].text);
          if (dec) {
            hits.push({ index: toks[i].index, length: toks[i].text.length, decoded: dec });
            last = toks[i].end;
          }
          i++;
        }
      }
      return hits;
    }

    /* ================================================================
       링크 생존 확인 및 카드 생성
    ================================================================ */
    const _linkCheckCache = new Map();

    function setLinkState(el, alive, msg) {
      el.classList.remove('lk-checking', 'lk-alive', 'lk-dead');
      if (alive === true) el.classList.add('lk-alive');
      else if (alive === false) el.classList.add('lk-dead');
      const sub = el.querySelector('.bl-sub');
      const arr = el.querySelector('.bl-arrow');
      if (sub) sub.textContent = msg;
      if (arr) arr.innerHTML = alive === true ? '✓' : alive === false ? '!' : '↗';
    }

    function checkLink(url, cardEl) {
      if (_linkCheckCache.has(url)) {
        const { alive, msg } = _linkCheckCache.get(url);
        setLinkState(cardEl, alive, msg);
        return;
      }

      let h = '';
      try { h = new URL(url).hostname.replace(/^www\./, ''); } catch (e) { return; }

      cardEl.classList.add('lk-checking');
      const arr = cardEl.querySelector('.bl-arrow');
      if (arr) arr.innerHTML = '⟳';

      if (h === 'kio.ac' || h.endsWith('.kio.ac') || h === 'kiosk.ac') {
        GM_xmlhttpRequest({
          method: 'GET', url, timeout: 3500,
          onload(res) {
            const body = (res.responseText || '').toLowerCase();
            if (res.status !== 404 && res.status !== 410 && (res.status < 200 || res.status >= 300)) {
              setLinkState(cardEl, null, `${h} · 확인 불가 (HTTP ${res.status})`);
              return;
            }
            const dead = res.status === 404 || res.status === 410 || body.includes('컬렉션을 찾을 수 없음') || body.includes('만료되었습니다') || body.includes('존재하지 않는');
            const info = { alive: !dead, msg: dead ? `${h} · 링크 만료` : `${h} · 링크 정상` };
            _linkCheckCache.set(url, info);
            setLinkState(cardEl, info.alive, info.msg);
          },
          onerror() { setLinkState(cardEl, null, `${h} · 연결 실패`); },
          ontimeout() { setLinkState(cardEl, null, `${h} · 응답 없음`); },
        });
      } else if (h === 'mypikpak.com') {
        const m = new URL(url).pathname.match(/^\/s\/([^/?#]+)/);
        if (!m) { setLinkState(cardEl, null, h); return; }
        GM_xmlhttpRequest({
          method: 'GET',
          url: `https://api-drive.mypikpak.com/drive/v1/share?share_id=${m[1]}&thumbnail_size=SIZE_MEDIUM&pass_code=&device_id=b64`,
          headers: { 'X-Client-Id': 'YNxT9w7GMdWvEOKa', 'Accept': 'application/json' },
          timeout: 3500,
          onload(res) {
            if (res.status === 404 || res.status === 410) {
              setLinkState(cardEl, false, 'mypikpak · 링크 만료');
              return;
            }
            if (res.status < 200 || res.status >= 300) {
              setLinkState(cardEl, null, `mypikpak · 확인 불가 (HTTP ${res.status})`);
              return;
            }
            try {
              const d = JSON.parse(res.responseText);
              if (['OK', 'PASS_CODE_REQUIRED'].includes(d.share_status)) {
                const pass = d.share_status === 'PASS_CODE_REQUIRED';
                const info = { alive: true, msg: pass ? 'mypikpak · 정상 (비번 필요)' : 'mypikpak · 링크 정상' };
                _linkCheckCache.set(url, info);
                setLinkState(cardEl, info.alive, info.msg);
                return;
              }
            } catch (e) {}
            setLinkState(cardEl, null, 'mypikpak · 확인 불가');
          },
          onerror() { setLinkState(cardEl, null, h); },
          ontimeout() { setLinkState(cardEl, null, h); },
        });
      } else if (h === 'uploadnow.io') {
        const parsed = new URL(url);
        const id = parsed.pathname.match(/^\/f\/([^/]+)/)?.[1] ||
          (/^\/(?:[a-z]{2}\/)?share\/?$/.test(parsed.pathname) ? parsed.searchParams.get('utm_source') : null);
        if (!id) { setLinkState(cardEl, null, h + ' · 상태 확인 미지원'); return; }
        GM_xmlhttpRequest({
          method: 'POST', url: 'https://uploadnow.io/api/file/search/folder-content',
          headers: { 'Content-Type': 'application/json' },
          data: JSON.stringify({ folderId: id, limit: 40, sortField: 'updateDate', sortDirection: 'desc' }),
          timeout: 5000,
          onload(res) {
            let d;
            try { d = JSON.parse(res.responseText); }
            catch (e) { setLinkState(cardEl, null, h + ' · 확인 불가'); return; }
            const locked = Array.isArray(d.codes) && d.codes.includes('PASSWORD_REQUIRED');
            const dead = res.status === 404 && typeof d.error === 'string' && /folder .* does not exist/i.test(d.error);
            const alive = locked ? true : dead ? false : null;
            const msg = h + (locked ? ' · 정상 (비번 필요)' : dead ? ' · 링크 만료 또는 삭제' : ' · 확인 불가');
            if (alive !== null) _linkCheckCache.set(url, { alive, msg });
            setLinkState(cardEl, alive, msg);
          },
          onerror() { setLinkState(cardEl, null, h + ' · 연결 실패'); },
          ontimeout() { setLinkState(cardEl, null, h + ' · 응답 없음'); },
        });
      } else if (h === 'gofile.io') {
        GM_xmlhttpRequest({
          method: 'GET', url, timeout: 4000,
          onload(res) {
            const body = (res.responseText || '').toLowerCase();
            const dead = res.status === 404 || res.status === 410 || (res.status === 200 && body.includes('this content does not exist'));
            const info = { alive: dead ? false : null, msg: dead ? 'gofile.io · 링크 만료' : 'gofile.io · 확인 불가 (동적 페이지)' };
            _linkCheckCache.set(url, info);
            setLinkState(cardEl, info.alive, info.msg);
          },
          onerror() { setLinkState(cardEl, null, 'gofile.io · 연결 실패'); },
          ontimeout() { setLinkState(cardEl, null, 'gofile.io · 응답 없음'); },
        });
      } else {
        setLinkState(cardEl, null, h + ' · 상태 확인 미지원');
      }
    }

    function makeLinkCard(rawUrl) {
      const trimmed = String(rawUrl || '').trim();
      const url = /^https?:\/\//i.test(trimmed) ? trimmed : 'https://' + trimmed;
      let h = '';
      try { h = new URL(url).hostname; } catch (e) { h = trimmed; }

      if (/kone\.gg$/.test(h)) {
        const a = document.createElement('a');
        a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
        a.setAttribute(DONE_ATTR, ''); a.textContent = trimmed;
        a.style.cssText = 'color:inherit;text-decoration:underline;word-break:break-all;';
        return a;
      }

      const ch = getChannelCode();
      if (ch) setChannelForUrl(url, ch);

      const a = document.createElement('a');
      a.href = url; a.target = '_blank'; a.rel = 'noopener noreferrer';
      a.setAttribute(DONE_ATTR, '');
      a.className = 'b64-link';
      a.innerHTML = `
        <span class="bl-copy" title="링크 복사"><svg class="bl-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg></span>
        <span class="bl-icon-wrap"><svg class="bl-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></span>
        <span class="bl-text">
          <span class="bl-title">${esc(trimmed)}</span>
          <span class="bl-sub">${esc(h)}</span>
        </span>
        <span class="bl-arrow">↗</span>
      `;

      setTimeout(() => checkLink(url, a), 100);
      return a;
    }

    function esc(s) {
      return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    }

    document.addEventListener('click', e => {
      const btn = e.target.closest && e.target.closest('.bl-copy');
      if (!btn) return;
      e.preventDefault(); e.stopPropagation();
      const card = btn.closest('a[href]');
      if (!card) return;
      const onOk = () => {
        btn.classList.add('bl-copy-ok');
        setTimeout(() => btn.classList.remove('bl-copy-ok'), 1500);
      };
      if (navigator.clipboard?.writeText) {
        navigator.clipboard.writeText(card.href).then(onOk).catch(() => {});
      } else {
        const ta = document.createElement('textarea');
        ta.value = card.href; ta.style.cssText = 'position:fixed;opacity:0;';
        document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove();
        onOk();
      }
    }, true);

    function buildNodes(text) {
      const b64Hits = findAllMatches(text);
      if (b64Hits.length) {
        const out = []; let pos = 0;
        for (const h of b64Hits) {
          if (h.index > pos) out.push(...buildNodes(text.slice(pos, h.index)));
          out.push(...buildNodes(h.decoded));
          pos = h.index + h.length;
        }
        if (pos < text.length) out.push(...buildNodes(text.slice(pos)));
        return out;
      }

      const matches = [];
      let m; URL_RE.lastIndex = 0;
      while ((m = URL_RE.exec(text)) !== null) {
        matches.push({ index: m.index, end: m.index + m[0].length, raw: m[0] });
      }

      const nodes = []; let last = 0;
      function appendText(t) {
        if (!t) return;
        const lines = t.split('\n');
        for (let i = 0; i < lines.length; i++) {
          if (lines[i]) nodes.push(document.createTextNode(lines[i]));
          if (i < lines.length - 1) nodes.push(document.createElement('br'));
        }
      }

      for (const mt of matches) {
        if (mt.index > last) appendText(text.slice(last, mt.index));
        let url = mt.raw;
        const trail = (url.match(/[.,;:!?)\]}'"]+$/) || [''])[0];
        if (trail) url = url.slice(0, -trail.length);
        nodes.push(makeLinkCard(url));
        if (trail) appendText(trail);
        last = mt.end;
      }
      if (last < text.length) appendText(text.slice(last));
      return nodes;
    }

    /* ================================================================
       DOM 탐색 및 교체
    ================================================================ */
    const processedRaws = new Map();

    function processContentNode(node) {
      if (!node.parentNode) return;
      const raw = node.nodeValue;
      if (!raw || !raw.trim()) return;

      let anc = node.parentNode;
      while (anc) {
        if (anc.nodeType === Node.ELEMENT_NODE) {
          if (anc.hasAttribute(DONE_ATTR) || anc.nodeName === 'A') return;
        }
        anc = anc.parentNode;
      }

      const key = raw.trim();
      if (processedRaws.has(key)) {
        const prev = processedRaws.get(key)?.deref();
        if (prev && document.contains(prev) && prev.parentNode === node.parentNode) {
          const h = document.createElement('span');
          h.setAttribute(DONE_ATTR, ''); h.style.display = 'none'; h.textContent = raw;
          node.parentNode.replaceChild(h, node);
          return;
        }
        processedRaws.delete(key);
      }

      const hits = findAllMatches(raw);
      const hasUrl = /(?:https?:\/\/|www\.)\S/i.test(raw);
      if (!hits.length && !hasUrl) return;

      const frag = document.createDocumentFragment();
      buildNodes(raw).forEach(n => frag.appendChild(n));

      const wrap = document.createElement('span');
      wrap.setAttribute(DONE_ATTR, '');
      wrap.style.cssText = 'all:unset;display:contents;';
      wrap.appendChild(frag);

      processedRaws.set(key, new WeakRef(wrap));
      node.parentNode.replaceChild(wrap, node);
    }

    function walkAndProcess(root, handler) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
        acceptNode(node) {
          const p = node.parentNode;
          if (!p) return NodeFilter.FILTER_REJECT;
          const tag = p.nodeName;
          if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'TEXTAREA' || tag === 'INPUT') return NodeFilter.FILTER_REJECT;
          if (!node.nodeValue || !node.nodeValue.trim()) return NodeFilter.FILTER_REJECT;
          let anc = p;
          while (anc && anc !== root) {
            if (anc.nodeType === Node.ELEMENT_NODE) {
              if (anc.contentEditable === 'true' || anc.hasAttribute(DONE_ATTR)) return NodeFilter.FILTER_REJECT;
            }
            anc = anc.parentNode;
          }
          return NodeFilter.FILTER_ACCEPT;
        },
      });
      const nodes = []; let n;
      while ((n = walker.nextNode())) nodes.push(n);
      nodes.forEach(handler);
    }

    function trySiblingMerge(root) {
      const BLOCK = new Set(['P', 'DIV', 'LI', 'BLOCKQUOTE']);

      function applyMerge(els) {
        if (els.length < 2) return false;
        const combined = els.map(e => (e.textContent||'').trim()).filter(Boolean).join('\n');
        const stripped = combined.replace(/\s+/g, '');
        let hits = findAllMatches(combined);
        let src = combined;
        if (!hits.length && stripped.length >= MIN_B64) {
          const h2 = findAllMatches(stripped);
          if (h2.length) { hits = h2; src = stripped; }
        }
        if (!hits.length) return false;

        let res = '', p = 0;
        for (const { index, length, decoded } of hits) {
          res += src.slice(p, index) + decoded; p = index + length;
        }
        res += src.slice(p);

        const wrap = document.createElement('span');
        wrap.setAttribute(DONE_ATTR, '');
        wrap.style.cssText = 'all:unset;display:contents;';
        buildNodes(res).forEach(nd => wrap.appendChild(nd));

        els[0].innerHTML = '';
        els[0].appendChild(wrap);
        for (let i = 1; i < els.length; i++) els[i].remove();
        return true;
      }

      function scan(parent) {
        let run = [];
        const flushRun = () => { if (run.length >= 2) applyMerge(run); run = []; };
        for (const ch of Array.from(parent.children)) {
          const txt = (ch.textContent || '').trim();
          const isB64 = txt.replace(/\s/g, '').length >= MIN_B64 && !/[가-힣]/.test(txt) && !ch.querySelector('img, button');
          if (BLOCK.has(ch.nodeName) && !ch.querySelector('[' + DONE_ATTR + ']') && isB64) {
            run.push(ch);
          } else {
            flushRun();
            if (ch.children.length) scan(ch);
          }
        }
        flushRun();
      }

      scan(root);
    }

    function convertPlainLinks(contentRoots) {
      contentRoots.forEach(root => {
        root.querySelectorAll('a[href]').forEach(a => {
          if (a.hasAttribute(DONE_ATTR) || a.querySelector('img, video, iframe, svg')) return;
          const href = a.href || '';
          let h = '';
          try { h = new URL(href).hostname; } catch (e) { return; }
          if (/kone\.gg$/.test(h)) return;

          if (PW_SITES[h] || PW_SITES[h.replace(/^www\./, '')]) {
            const card = makeLinkCard(href);
            a.setAttribute(DONE_ATTR, '');
            a.style.display = 'none';
            a.parentNode.insertBefore(card, a);
          }
        });
      });
    }

    let pending = false, mo = null;

    function getContentRoots() {
      if (/kone\.gg\/s\/[^/]+(?:\/[^/]+)?\/write/.test(location.href)) return new Set();
      const selectors = ['#post-article', '#post-comment', '.article-body', 'div.fr-view.article-content', 'p.text-sm.whitespace-pre-wrap'];
      const s = new Set();
      for (const sel of selectors) {
        document.querySelectorAll(sel).forEach(el => {
          if (!el.isContentEditable && !el.querySelector('.fr-element')) s.add(el);
        });
      }
      return s;
    }

    function flush() {
      pending = false;
      if (mo) mo.disconnect();
      if (!document.body) { observe(); return; }

      mountHeaderBtn();
      const roots = getContentRoots();
      roots.forEach(el => trySiblingMerge(el));
      roots.forEach(el => walkAndProcess(el, processContentNode));
      convertPlainLinks(roots);

      observe();
    }

    function schedule() {
      if (pending) return;
      pending = true;
      queueMicrotask(flush);
    }

    function observe() {
      if (!mo) {
        mo = new MutationObserver(mutations => {
          for (const mu of mutations) {
            for (const added of mu.addedNodes) {
              if (added.nodeType === Node.ELEMENT_NODE && added.hasAttribute(DONE_ATTR)) continue;
              schedule(); return;
            }
          }
        });
      }
      const root = document.body || document.documentElement;
      if (root) mo.observe(root, { childList: true, subtree: true });
    }

    let _lastUrl = location.href;
    function onUrlChange() {
      const cur = location.href;
      if (cur !== _lastUrl) {
        _lastUrl = cur;
        processedRaws.clear();
        mountHeaderBtn();
        schedule();
      }
    }
    window.addEventListener('popstate', onUrlChange);
    ['pushState', 'replaceState'].forEach(method => {
      const orig = history[method];
      history[method] = function (...args) { const r = orig.apply(this, args); onUrlChange(); return r; };
    });
    setInterval(onUrlChange, 300);

    if (/kone\.gg/.test(location.hostname)) {
      flush();
      observe();
      [150, 400, 1000].forEach(t => setTimeout(() => { mountHeaderBtn(); schedule(); }, t));
    }

    /* ================================================================
       다운로드 사이트 비밀번호 자동입력 실행부
    ================================================================ */
    const siteCfg = host === 'uploadnow.io' && !/^\/(?:f\/|(?:[a-z]{2}\/)?share(?:\/|$))/.test(location.pathname) ? null : PW_SITES[host];
    if (siteCfg) {
      function normText(t) { return String(t||'').replace(/\s+/g,' ').trim(); }

      function isVisible(el) {
        if (!el) return false;
        const s = window.getComputedStyle(el);
        const r = el.getBoundingClientRect();
        return s.display !== 'none' && s.visibility !== 'hidden' && r.width > 0 && r.height > 0;
      }

      function setNativeValue(el, value) {
        el.focus();
        const proto = Object.getPrototypeOf(el);
        const desc = Object.getOwnPropertyDescriptor(proto, 'value') || Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value');
        if (desc?.set) desc.set.call(el, value); else el.value = value;
        if (el._valueTracker) el._valueTracker.setValue('');
        el.dispatchEvent(new InputEvent('input', { bubbles: true, data: value, inputType: 'insertText' }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
      }

      function submitViaEnter(input) {
        input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 13, bubbles: true, cancelable: true }));
        input.dispatchEvent(new KeyboardEvent('keyup', { key: 'Enter', keyCode: 13, bubbles: true }));
      }

      function getInputEl(sel) {
        return [...document.querySelectorAll(sel)].find(isVisible) || null;
      }

      function getScope(input) {
        if (!input) return document.body;
        return input.closest('[role="dialog"]') || input.closest('form') || input.closest('[class*="modal"]') || input.parentElement || document.body;
      }

      function findPwError(input, patterns) {
        const scope = getScope(input);
        for (const el of scope.querySelectorAll('div,p,span,strong,em,small,li')) {
          if (!isVisible(el)) continue;
          const t = normText(el.textContent);
          if (t && t.length < 120 && patterns.some(p => p.test(t))) return t;
        }
        return '';
      }

      // KIO 모드
      if (siteCfg.mode === 'kio') {
        const KIO = { phase: 'idle', lastInputEl: null, lastSubmitAt: 0, lastAttemptAt: 0, queue: [], idx: 0, tried: new Set(), active: null, lastAdvKey: '', GRACE: 3000, FALLBACK: 2000, RETRY_MS: 50, RETRY_MAX: 8 };

        function kioGetBtn(scope) {
          return [...(scope||document).querySelectorAll('button')].find(b => isVisible(b) && /^(확인|ok|confirm|submit|enter)$/i.test(normText(b.textContent))) || null;
        }

        function kioResetForNewModal(input) {
          if (KIO.lastInputEl === input) return;
          const lastAt = Math.max(KIO.lastAttemptAt, KIO.lastSubmitAt);
          if (KIO.active && ['attempting','submitted'].includes(KIO.phase) && lastAt > 0 && Date.now() - lastAt <= KIO.GRACE) {
            KIO.lastInputEl = input; return;
          }
          KIO.lastInputEl = input; KIO.phase = 'idle';
          KIO.queue = getEffectivePwList().filter(Boolean).map(v => ({ value: v }));
          KIO.idx = 0; KIO.tried = new Set(); KIO.active = null; KIO.lastAdvKey = '';
        }

        function kioClickWhenReady(expected, onSuccess) {
          let retries = 0;
          const attempt = () => {
            const input = getInputEl(siteCfg.inputSel); if (!input) return;
            const btn = kioGetBtn(getScope(input)); if (!btn) return;
            if (input.value !== expected) return;
            if (!btn.disabled) { btn.click(); KIO.lastSubmitAt = Date.now(); onSuccess(); return; }
            if (retries < KIO.RETRY_MAX) { retries++; setTimeout(attempt, KIO.RETRY_MS); }
            else { KIO.phase = 'submitted'; KIO.lastSubmitAt = Date.now(); }
          };
          queueMicrotask(attempt);
        }

        async function kioTryNext(input) {
          while (KIO.idx < KIO.queue.length) {
            const { value } = KIO.queue[KIO.idx];
            if (!value || KIO.tried.has(value)) { KIO.idx++; continue; }
            KIO.tried.add(value); KIO.active = { value };
            KIO.lastAdvKey = ''; KIO.lastAttemptAt = Date.now(); KIO.phase = 'attempting';
            setNativeValue(input, value);
            kioClickWhenReady(value, () => { KIO.phase = 'submitted'; });
            return;
          }
          KIO.phase = 'done'; KIO.active = null;
        }

        async function kioTick() {
          const input = getInputEl(siteCfg.inputSel); if (!input) return;
          if (!kioGetBtn(getScope(input))) return;
          kioResetForNewModal(input);

          if (['attempting','submitted'].includes(KIO.phase) && KIO.active && !normText(input.value)) {
            setNativeValue(input, KIO.active.value);
            KIO.phase = 'attempting'; KIO.lastAttemptAt = Date.now();
            kioClickWhenReady(KIO.active.value, () => { KIO.phase = 'submitted'; KIO.lastSubmitAt = Date.now(); });
            return;
          }

          const err = findPwError(input, siteCfg.errorPat);
          const key = KIO.active ? `${KIO.idx}:${err}` : '';

          if (err && KIO.phase === 'submitted' && KIO.active && input.value === KIO.active.value && key !== KIO.lastAdvKey) {
            KIO.lastAdvKey = key; KIO.idx++; await kioTryNext(input); return;
          }
          if (KIO.phase === 'idle') { await kioTryNext(input); return; }
          if (KIO.phase === 'attempting' && Date.now() - KIO.lastAttemptAt >= KIO.FALLBACK) { KIO.idx++; await kioTryNext(input); return; }
          if (KIO.phase === 'submitted' && Date.now() - KIO.lastSubmitAt >= 15000) { KIO.phase = 'done'; }
        }

        setInterval(kioTick, 100);
      }

      // 공유 비밀번호 입력: 중복 실행 방지, 명시적인 오류가 있을 때만 다음 비밀번호 시도
      if (siteCfg.mode === 'gofile' || siteCfg.mode === 'generic') {
        let running = false;
        const triedInputs = new WeakSet();
        const pause = ms => new Promise(resolve => setTimeout(resolve, ms));
        async function tryPasswords() {
          const first = getInputEl(siteCfg.inputSel);
          const pws = getEffectivePwList();
          if (running || !first || triedInputs.has(first) || !pws.length || first.value) return;
          running = true;
          try {
            for (const pw of pws) {
              const input = getInputEl(siteCfg.inputSel);
              if (!input) break;
              triedInputs.add(input);
              const previousError = findPwError(input, siteCfg.errorPat);
              setNativeValue(input, pw);
              await pause(siteCfg.btnDelay || 300);
              let cleared = !findPwError(input, siteCfg.errorPat);
              const scope = getScope(input);
              const btn = [...scope.querySelectorAll(siteCfg.btnSel)].find(b => isVisible(b) && !b.disabled) ||
                [...scope.querySelectorAll('button')].find(b => isVisible(b) && !b.disabled && /^(확인|ok|confirm|submit|enter|unlock|access)$/i.test(normText(b.textContent)));
              if (btn) btn.click();
              else {
                const form = input.closest('form');
                if (form?.requestSubmit) form.requestSubmit();
                else submitViaEnter(input);
              }
              const deadline = Date.now() + 15000;
              let rejected = false;
              while (Date.now() < deadline) {
                await pause(200);
                const current = getInputEl(siteCfg.inputSel);
                if (!current) break;
                triedInputs.add(current);
                if (current.value && current.value !== pw) return; // 사용자 입력을 덮어쓰지 않음
                const error = findPwError(current, siteCfg.errorPat);
                if (!error) cleared = true;
                if (error && (cleared || error !== previousError)) { rejected = true; break; }
              }
              if (!rejected) break; // 응답 지연을 비밀번호 오류로 추측하지 않음
            }
          } finally {
            const current = getInputEl(siteCfg.inputSel);
            if (current) triedInputs.add(current);
            running = false;
          }
        }
        const gObs = new MutationObserver(tryPasswords);
        gObs.observe(document.documentElement, { childList: true, subtree: true });
        setTimeout(tryPasswords, siteCfg.triggerDelay || 1500);
      }

      // WORKUPLOAD 모드
      if (siteCfg.mode === 'formpost') {
        const PERSIST_KEY = `_fpIdx_${location.hostname}${location.pathname}`;
        const pws = getEffectivePwList();
        const input = getInputEl(siteCfg.inputSel);
        if (!input) {
          if (siteCfg.dlBtnSel) {
            const dlBtn = document.querySelector(siteCfg.dlBtnSel);
            if (dlBtn && isVisible(dlBtn)) {
              GM_setValue(PERSIST_KEY, 0);
              setTimeout(() => dlBtn.click(), 500);
            }
          }
          return;
        }

        const idx = GM_getValue(PERSIST_KEY, 0);
        if (pws.length && idx < pws.length) {
          setTimeout(() => {
            const inp = getInputEl(siteCfg.inputSel);
            if (!inp) return;
            GM_setValue(PERSIST_KEY, idx + 1);
            setNativeValue(inp, pws[idx]);
            setTimeout(() => {
              const btn = document.querySelector(siteCfg.btnSel);
              if (btn && !btn.disabled) btn.click();
              else submitViaEnter(inp);
            }, siteCfg.btnDelay || 300);
          }, siteCfg.triggerDelay || 1000);
        } else {
          GM_setValue(PERSIST_KEY, 0);
        }
      }

      // TRANSFER.IT 모드
      if (siteCfg.mode === 'transfer') {
        let _tIdx = 0, _tDone = false, _tState = 'idle', _tSubmitAt = 0, _tGoneSeen = false;
        setInterval(() => {
          if (_tDone) return;
          const input = getInputEl(siteCfg.inputSel);
          if (_tState === 'submitted') {
            if (!input) { _tGoneSeen = true; return; }
            if (findPwError(input, siteCfg.errorPat)) {
              _tIdx++; _tGoneSeen = false;
              if (_tIdx >= getEffectivePwList().length) { _tDone = true; return; }
              _tState = 'idle'; return;
            }
            if (Date.now() - _tSubmitAt > 120000) { _tDone = true; return; }
            return;
          }
          if (!input) return;
          const pws = getEffectivePwList();
          if (_tIdx >= pws.length) { _tDone = true; return; }
          setNativeValue(input, pws[_tIdx]);
          _tState = 'submitted'; _tSubmitAt = Date.now(); _tGoneSeen = false;
          setTimeout(() => {
            const inp2 = getInputEl(siteCfg.inputSel);
            if (!inp2) return;
            const btn = document.querySelector(siteCfg.btnSel);
            if (btn && !btn.disabled) btn.click();
            else submitViaEnter(inp2);
          }, siteCfg.btnDelay || 250);
        }, 350);

        if (siteCfg.dlBtnSel) {
          setTimeout(() => {
            const dlBtn = document.querySelector(siteCfg.dlBtnSel);
            if (dlBtn && isVisible(dlBtn) && !getInputEl(siteCfg.inputSel)) dlBtn.click();
          }, siteCfg.triggerDelay || 1500);
        }
      }

      // LINK-LOCK 모드
      if (siteCfg.mode === 'linklock') {
        setTimeout(async () => {
          const pws = getEffectivePwList();
          for (const pw of pws) {
            if (!pw) continue;
            const retry = [...document.querySelectorAll('button')].find(x => isVisible(x) && /try again|다시\s*시도/i.test(normText(x.textContent)));
            if (retry) { retry.click(); await new Promise(r => setTimeout(r, 400)); }
            const input = getInputEl(siteCfg.inputSel);
            if (!input) break;
            setNativeValue(input, pw);
            await new Promise(r => setTimeout(r, 120));
            const btn = document.querySelector(siteCfg.btnSel);
            if (btn && !btn.disabled) btn.click();
            else submitViaEnter(input);
            await new Promise(r => setTimeout(r, 2000));
            if (!getInputEl(siteCfg.inputSel)) break;
          }
        }, siteCfg.triggerDelay || 800);
      }
    }
  });
})();
