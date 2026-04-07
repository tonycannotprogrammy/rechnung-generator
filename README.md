# Rechnung Generator

A native desktop application for creating, managing, and archiving professional invoices (Rechnungen) with SEPA QR codes — built with Tauri.

![Rechnung Generator](src-tauri/icons/icon.png)

---

## ⬇️ Download & Install

### macOS (Apple Silicon)

1. Download **[Rechnung Generator_0.1.0_aarch64.dmg](https://github.com/tonycannotprogrammy/rechnung-generator/releases/latest/download/Rechnung.Generator_0.1.0_aarch64.dmg)**
2. Open the `.dmg` file
3. Drag **Rechnung Generator** into your **Applications** folder
4. On first launch: Right-click the app → **Open** → **Open** (macOS Gatekeeper prompt for unsigned apps)

### Windows

**Option A — Installer (recommended):**
1. Download **[Rechnung Generator_0.1.0_x64-setup.exe](https://github.com/tonycannotprogrammy/rechnung-generator/releases/latest/download/Rechnung.Generator_0.1.0_x64-setup.exe)**
2. Run the installer — it will set up the app and create a Start Menu shortcut

**Option B — MSI package:**
1. Download **[Rechnung Generator_0.1.0_x64_en-US.msi](https://github.com/tonycannotprogrammy/rechnung-generator/releases/latest/download/Rechnung.Generator_0.1.0_x64_en-US.msi)**
2. Double-click to install via Windows Installer

> **Note:** Windows SmartScreen may show a warning for unsigned apps. Click **More info** → **Run anyway**.

### All Releases

Browse all versions: **[github.com/tonycannotprogrammy/rechnung-generator/releases](https://github.com/tonycannotprogrammy/rechnung-generator/releases)**

---

## ✨ Features

- **Invoice Creation** — Professional German invoices with line items, tax rates, and totals
- **SEPA QR Codes** — Banking-compliant EPC QR codes for instant mobile payments
- **PDF Export** — High-quality A4 PDF generation with proper print margins
- **Automated Filing** — PDFs are auto-sorted into `/Receipts/YYYY/MM/` folders
- **Receipt Archive** — Searchable registry with status tracking (Draft → Finalized → Sent → Archived)
- **Analytics Dashboard** — Visual expense breakdown by vendor
- **Recipient & Template Management** — Save frequent clients and service line items
- **Email Integration** — Open your default mail client with pre-filled subject & body
- **Dark Mode** — Smooth light/dark theme toggle
- **JSON Backup** — Full import/export of all data (compatible with the legacy web version)

---

## 🛠 Development

### Prerequisites
- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/) (stable)

### Run locally
```bash
npm install
npm run tauri dev
```

### Build for production
```bash
npm run tauri build
```

Output will be in `src-tauri/target/release/bundle/`.

---

## 📁 Project Structure

```
├── src/                  # Frontend (HTML/CSS/JS)
│   ├── index.html        # App layout & tabs
│   ├── styles.css        # Design system
│   └── app.js            # Application logic + Tauri IPC
├── src-tauri/            # Backend (Rust)
│   └── src/
│       ├── lib.rs        # Plugin registration & command handlers
│       ├── commands.rs   # IPC commands (save, print, email, etc.)
│       └── registry.rs   # Receipt data schema & JSON persistence
└── .github/workflows/
    └── build.yml         # CI: auto-build macOS + Windows on tag push
```

---

## 📄 License

Private use. All rights reserved.
