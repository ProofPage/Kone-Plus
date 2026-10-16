# Kone Plus 🔑

A powerful and lightweight userscript designed for **[kone.gg](https://kone.gg/)** and supported file hosting platforms. It automatically decodes Base64-encoded links in posts and comments, provides interactive link health status cards, and automates password entry across various file sharing services.

---

## ✨ Features

- **⚡ Automatic Base64 Decoding**
  - Detects single or recursively encoded Base64 strings within posts and comments.
  - Seamlessly transforms decoded text into rich, interactive link cards without breaking layout formatting.

- **🔗 Real-Time Link Health Checks**
  - Automatically verifies whether shared links are active or expired (`kio.ac`, `gofile.io`, `mypikpak.com`, etc.).
  - Color-coded status badges:
    - 🟢 Green: Active / Alive
    - 🔴 Red: Expired / Dead
    - ⚪ Default: Generic link / Standby
  - Includes a one-click clipboard copy button for rapid URL sharing.

- **🔐 Smart Password Autofill & Manager**
  - **Header Quick Access**: Seamlessly integrates a key icon button into the kone.gg navigation bar.
  - **Global & Per-Channel Passwords**: Configure universal passwords or assign unique passcodes per channel (`# channel_name`).
  - **Mobile-Optimized UX**: Responsive modal window with horizontally scrollable pills navigation, full-width touch inputs, and no unwanted virtual keyboard popups on mobile browsers.
  - **Zero-Friction Host Unlocking**: Automatically detects password prompts on supported file hosts and injects saved passwords sequentially until access is granted.

---

## 🌐 Supported File Hosts

| Platform | Domain | Supported Features |
| :--- | :--- | :--- |
| **KIO** | `kio.ac`, `kiosk.ac` | Status check, automated password attempt |
| **Gofile** | `gofile.io` | Status check, automated folder unlock |
| **Mega** | `mega.nz` | Decryption password auto-entry |
| **PikPak** | `mypikpak.com` | Share code status check, password auto-entry |
| **Workupload** | `workupload.com` | Automated form post & download trigger |
| **Transfer.it** | `transfer.it` | Dialog input auto-entry & download trigger |
| **Link Lock** | `jstrieb.github.io` | Client-side password decrypt retry |

---

## 🚀 Installation

1. Install a userscript manager extension in your browser:
   - [Violentmonkey](https://violentmonkey.github.io/) (Recommended)
   - [Tampermonkey](https://www.tampermonkey.net/)
2. Open the userscript installation URL:
   - Click to install [`Kone_Plus.user.js`](https://raw.githubusercontent.com/ProofPage/Kone-Plus/main/Kone_Plus.user.js).
3. Confirm the installation prompt in your userscript manager.
4. Navigate to **kone.gg** and click the **Key (🔑)** button in the top navigation bar to configure your default passwords.

---

## 📱 Mobile Browser Compatibility

Specifically optimized for mobile environments (e.g., Samsung Internet, Kiwi Browser, Firefox Mobile):
- Touch-friendly tap targets and controls.
- Virtual keyboard does not automatically pop up upon opening the password manager modal.
- Adaptive width layouts prevent button clipping on narrow viewports.

---

## 📄 License

Distributed under the [MIT License](LICENSE).
