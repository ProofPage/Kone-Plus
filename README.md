# Kone Plus 🔑

A powerful and lightweight userscript designed for **[kone.gg](https://kone.gg/)** and supported file hosting platforms. It automatically decodes Base64-encoded links in posts and comments, provides interactive link health status cards, and automates password entry across various file sharing services.

Version **3.1.0** uses real-time background DOM rendering checks to accurately detect link status and password requirements without relying on fragile third-party APIs.

---

## ✨ Features

- **⚡ Automatic Base64 Decoding**
  - Detects single or recursively encoded Base64 strings within posts and comments.
  - Seamlessly transforms decoded text into rich, interactive link cards without breaking layout formatting.

- **🔗 Real-Time Link Health Checks (DOM Rendering Inspection)**
  - Opens supported links in temporary, hidden background tabs sequentially to inspect rendered DOM elements using the browser's existing session.
  - Accurately detects expired pages, password prompts, and live downloads across Single Page Applications (SPAs) and dynamic sites (Gofile, Workupload, UploadNow, Transfer.it, MEGA, KIO, Google Docs/Drive).
  - Background probe tabs are isolated: they only inspect the rendered page and never enter passwords, execute download buttons, or run auto-submit routines.
  - Probes cleanly close their tabs immediately upon detecting status or reaching timeout.
  - Color-coded status badges:
    - 🟢 Green: Active / Alive (`링크 정상`, `정상 (비밀번호 필요)`, `공유 파일 확인됨`, etc.)
    - 🔴 Red: Expired / Dead (`링크 만료 또는 삭제`)
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
| **KIO** | `kio.ac`, `kiosk.ac` | Rendered collection check, automated password attempt |
| **Gofile** | `gofile.io` | Rendered file list & status check, automated folder unlock |
| **Mega** | `mega.nz` | Rendered share status check, decryption password auto-entry |
| **PikPak** | `mypikpak.com` | Share code status check, password auto-entry |
| **Workupload** | `workupload.com` | Rendered share status check, automated password form submission |
| **Transfer.it** | `transfer.it` | Rendered missing transfer check, dialog password auto-entry |
| **Link Lock** | `jstrieb.github.io` | Encrypted-link status badge, client-side password decrypt retry |
| **UploadNow** | `uploadnow.io` | Rendered expired/password-protected/shared-folder detection, password autofill |
| **Google Docs / Drive** | `docs.google.com`, `drive.google.com` | Rendered missing-file and access-required detection |

---

## 🚀 Installation

1. Install a userscript manager extension in your browser:
   - [Violentmonkey](https://violentmonkey.github.io/) (Recommended)
   - [Tampermonkey](https://www.tampermonkey.net/)
2. Open the userscript installation URL:
   - Click to install [`Kone_Plus.user.js`](https://raw.githubusercontent.com/ProofPage/Kone-Plus/main/Kone_Plus.user.js).
3. Confirm the installation prompt in your userscript manager, accepting `GM_openInTab` and `GM_deleteValue` for background tab checks.
4. Navigate to **kone.gg** and click the **Key (🔑)** button in the top navigation bar to configure your default passwords.

## Validation

Run the dependency-free checks with Node.js:

```sh
node --check Kone_Plus.user.js
node tests/link-status.cjs
node tests/background-probes.cjs
node tests/probe-routing.cjs
node tests/password-attempts.cjs
node tests/linklock-retry.cjs
node tests/manual-download.cjs
```

---

## 📱 Mobile Browser Compatibility

Specifically optimized for mobile environments (e.g., Samsung Internet, Kiwi Browser, Firefox Mobile):
- Touch-friendly tap targets and controls.
- Virtual keyboard does not automatically pop up upon opening the password manager modal.
- Adaptive width layouts prevent button clipping on narrow viewports.

---

## 📄 License

Distributed under the [MIT License](LICENSE).
