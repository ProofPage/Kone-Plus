# Kone Plus 🔑

A powerful and lightweight userscript designed for **[kone.gg](https://kone.gg/)** and supported file hosting platforms. It automatically decodes Base64-encoded links in posts and comments, provides interactive link health status cards, and automates password entry across various file sharing services.

Version **3.2.0** uses direct passive HTTP GET requests to check link status and password requirements without opening destination tabs or calling fragile proprietary backend APIs.

---

## ✨ Features

- **⚡ Automatic Base64 Decoding**
  - Detects single or recursively encoded Base64 strings within posts and comments.
  - Seamlessly transforms decoded text into rich, interactive link cards without breaking layout formatting.

- **🔗 Passive Link Status (Direct Web Scraping / Non-API)**
  - **No Automatic Tabs**: Decoding and checking never open destination tabs or browser windows. Only manually clicking a link opens it.
  - **Direct URL Inspection (Non-API)**: Performs lightweight, direct background HTTP GET requests to the link's own URL rather than third-party backend API endpoints.
  - Parses response status codes and text/DOM patterns across all major file hosts (Gofile, KIO, UploadNow, Transfer.it, Workupload, Google Docs/Drive, MEGA, PikPak).
  - Accurately identifies expired files (`링크 만료`), live shares (`링크 정상`), password requirements (`정상 (비번 필요)`), and permission barriers.
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
| **KIO** | `kio.ac`, `kiosk.ac` | Direct collection status check, automated password attempt |
| **Gofile** | `gofile.io` | Direct content check, automated folder unlock |
| **Mega** | `mega.nz` | Direct link check, decryption password auto-entry |
| **PikPak** | `mypikpak.com` | Direct share code status check, password auto-entry |
| **Workupload** | `workupload.com` | Direct file status & password-protection check, automated password form submission |
| **Transfer.it** | `transfer.it` | Direct transfer check, dialog password auto-entry |
| **Link Lock** | `jstrieb.github.io` | Encrypted-link status badge, client-side password decrypt retry |
| **UploadNow** | `uploadnow.io` | Direct folder/expired check, password autofill |
| **Google Docs / Drive** | `docs.google.com`, `drive.google.com` | Direct missing-file & permission detection |

---

## 🚀 Installation

1. Install a userscript manager extension in your browser:
   - [Violentmonkey](https://violentmonkey.github.io/) (Recommended)
   - [Tampermonkey](https://www.tampermonkey.net/)
2. Open the userscript installation URL:
   - Click to install [`Kone_Plus.user.js`](https://raw.githubusercontent.com/ProofPage/Kone-Plus/main/Kone_Plus.user.js).
3. Confirm the installation prompt in your userscript manager.
4. Navigate to **kone.gg** and click the **Key (🔑)** button in the top navigation bar to configure your default passwords.

## Validation

Run the dependency-free checks with Node.js:

```sh
node --check Kone_Plus.user.js
node tests/direct-status.cjs
node tests/link-status.cjs
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
