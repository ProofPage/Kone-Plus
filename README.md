# Kone Plus 🔑

A powerful and lightweight userscript designed for **[kone.gg](https://kone.gg/)** and supported file hosting platforms. It automatically decodes Base64-encoded links in posts and comments, provides interactive link health status cards, and automates password entry across various file sharing services.

---

## ✨ Features

- **⚡ Automatic Base64 Decoding**
  - Detects single or recursively encoded Base64 strings within posts and comments.
  - Seamlessly transforms decoded text into rich, interactive link cards without breaking layout formatting.

- **🔗 Real-Time Link Health Checks**
  - Opens supported links in temporary background tabs, one at a time, to inspect the rendered page using the browser's existing session.
  - Does not classify an HTTP error, JavaScript shell, timeout, or permission prompt as an expired file.
  - Status checks never enter passwords or trigger downloads. Tabs are closed after a result or timeout.
  - Color-coded status badges:
    - 🟢 Green: Active / Alive
    - 🔴 Red: Expired / Dead
    - ⚪ Default: Checking, access required, or file status not established
  - Recognized results are cached for 60 seconds within the current page.
  - Includes a one-click clipboard copy button for rapid URL sharing.

- **🔐 Smart Password Autofill & Manager**
  - **Header Quick Access**: Seamlessly integrates a key icon button into the kone.gg navigation bar.
  - **Global & Per-Channel Passwords**: Configure universal passwords or assign unique passcodes per channel (`# channel_name`).
  - **Mobile-Optimized UX**: Responsive modal window with horizontally scrollable pills navigation, full-width touch inputs, and no unwanted virtual keyboard popups on mobile browsers.
  - **Host Unlocking**: Detects supported password prompts and submits saved passwords. Gofile and generic adapters advance only after a new, explicit password error; a slow response is not treated as a wrong password.
  - UploadNow short links and redirected share URLs retain the same channel password association.
  - Download buttons are never clicked automatically. After unlocking, choose downloads manually.

---

## 🌐 Supported File Hosts

| Platform | Domain | Supported Features |
| :--- | :--- | :--- |
| **KIO** | `kio.ac`, `kiosk.ac` | Status check, automated password attempt |
| **Gofile** | `gofile.io` | Status check, automated folder unlock |
| **Mega** | `mega.nz` | Rendered share status check, decryption password auto-entry |
| **PikPak** | `mypikpak.com` | Share code status check, password auto-entry |
| **Workupload** | `workupload.com` | Rendered share status check, automated password form submission |
| **Transfer.it** | `transfer.it` | Dialog password auto-entry; manual download |
| **Link Lock** | `jstrieb.github.io` | Encrypted-link status check, client-side password decrypt retry |
| **UploadNow** | `uploadnow.io` | Password autofill, rendered expired/password-protected/shared-folder detection |
| **Google Docs / Drive** | `docs.google.com`, `drive.google.com` | Rendered missing-file and access-required detection; no password submission |

Status support means that the script can inspect the page, not that every possible page state is recognized. Unrecognized states remain neutral instead of displaying a fabricated green or red badge. Google access requests are not proof that a file is deleted. Other hosts also use neutral results when no supported file or password prompt is detected.

---

## 🚀 Installation

1. Install a userscript manager extension in your browser:
   - [Violentmonkey](https://violentmonkey.github.io/) (Recommended)
   - [Tampermonkey](https://www.tampermonkey.net/)
2. Open the userscript installation URL:
   - Click to install [`Kone_Plus.user.js`](https://raw.githubusercontent.com/ProofPage/Kone-Plus/main/Kone_Plus.user.js).
3. Confirm the installation prompt in your userscript manager.
4. Navigate to **kone.gg** and click the **Key (🔑)** button in the top navigation bar to configure your default passwords.
5. When updating to 3.0.2, accept the new `GM_openInTab` and `GM_deleteValue` permissions. Without the updated script and grants, background status checks cannot operate.

The script requests Violentmonkey's `@inject-into content` context and Tampermonkey's `@sandbox DOM` context. It only needs DOM and userscript-manager APIs, not page JavaScript globals. This avoids relying on `eval` or fetching local test code on sites with restrictive CSP/Trusted Types rules. Tampermonkey's actual context also depends on which sandbox contexts are enabled in its settings. No site CSP is disabled, and the script no longer requests unrestricted cross-origin HTTP access.

Background tabs load third-party pages and may run their normal scripts or advertisements. Checks are sequential and may take up to 25 seconds each. Browser or extension restrictions, a login redirect, and unsupported page layouts can prevent a definitive result. Passwords are stored by the userscript manager, not uploaded to a separate service.

## Validation

Run the dependency-free checks with Node.js:

```sh
node --check Kone_Plus.user.js
node tests/link-status.cjs
node tests/password-attempts.cjs
node tests/background-probes.cjs
node tests/probe-routing.cjs
node tests/linklock-retry.cjs
node tests/manual-download.cjs
```

Live Mixdog browser checks with `replay` successfully unlocked UploadNow, KIO, and a Base64-decoded Gofile share without starting a download. The Gofile folder displayed 23 items. These checks injected the working source with a test storage adapter; they do not verify Tampermonkey/Violentmonkey installation or cross-tab grants.

Decoded board links also provided a publicly readable Google document and an expired Transfer.it share. A Google Drive folder redirected to Google sign-in, so its file status was not established.

Google Docs and Transfer.it were additionally checked with direct browser DOM inspection, without `eval`, localhost requests, or CSP modifications. The public document exposes a visible `.kix-appview-editor`; its “request edit access” control is not treated as a missing-file or read-access error. Transfer.it displays its explicit missing/expired-transfer message. Full extension-installed cross-tab validation remains separate from these DOM and source-level checks.

Subsequent checks installed the local 3.0.2 script in Chrome with Tampermonkey 5.5.1. Kone displayed UploadNow as password-protected; opening it automatically submitted the saved `replay` password and displayed four files. Kone also displayed the Google document as open. Transfer.it initially timed out because its probe marker was lost; after reinstalling the corrected source, its Kone card correctly displayed “expired or deleted.” These checks used the real extension and shared storage, not test GM adapters.

Additional Chrome/Tampermonkey checks verified the remaining three adapters:

| Platform | Observed result | Scope |
| :--- | :--- | :--- |
| MEGA | Public file status confirmed; a live password-protected `GIF` folder automatically opened in Chrome/Tampermonkey | Fixed Korean “Continue” scope, Korean error recognition, and retained-but-hidden error text. After reinstalling the corrected script and adding the published password through its manager, a new protected-link tab automatically opened the folder without manual password input or submission. The folder is currently empty; no download was started |
| Workupload | Kone card displayed “download link confirmed”; a separate browser session displayed the password gate | A disposable 113-byte text file protected with `replay` was uploaded with one-day retention; Chrome automatically unlocked it and downloaded the test file |
| Link Lock | Kone card displayed “encrypted link (password required)”; the official demo opened its destination after trying `replay`, then `hackernews` | Fixed retry handling when an incorrect password replaces the input with a “Try again” button |

The three cards above were exercised using test links inserted locally into the Kone page DOM, not published posts. The Workupload download observation predates removal of automatic download clicks. Workupload and Transfer.it now stop after password submission; users choose downloads manually. Regression tests check that both adapters leave download controls untouched on public pages and after unlocking. Background status probes do not submit passwords or click download buttons. No downloaded third-party files were executed. These checks establish the observed cases, not every host state or browser configuration.

The live MEGA protected-folder example and its password `123.admin.30S` are published in [section 4.4.1 of this research article](https://www.techscience.com/cmc/v73n1/47796/html). Its underlying folder handle is `yVAA1DQQ`. Older protected examples found during testing decrypted correctly but pointed to deleted or disabled content; they were not counted as live-share successes.

Probe identities are captured at document start. Hidden tabs can also recover an unexpired task identity from userscript storage when a host removes URL parameters; ordinary foreground visits do not consume this fallback. Task records are removed on completion or timeout.

`node tests/serve-live.cjs` serves only the working script at `http://127.0.0.1:18764/script.js` for local browser testing. Stop the process after testing.

`tests/background-probes.cjs` exercises the actual queue function with simulated userscript-manager APIs. It checks duplicate suppression, sequential tabs, redirect normalization, result delivery, cache expiry timestamps, storage/timer cleanup, timeouts, manually closed tabs, and unavailable tab APIs. It does not replace testing with an installed userscript manager.

---

## 📱 Mobile Browser Compatibility

Specifically optimized for mobile environments (e.g., Samsung Internet, Kiwi Browser, Firefox Mobile):
- Touch-friendly tap targets and controls.
- Virtual keyboard does not automatically pop up upon opening the password manager modal.
- Adaptive width layouts prevent button clipping on narrow viewports.

---

## 📄 License

Distributed under the [MIT License](LICENSE).
