# 🖐 VirtualMouse AI

<div align="center">

![Python](https://img.shields.io/badge/Python-3.10%2B-3776AB?style=for-the-badge&logo=python&logoColor=white)
![MediaPipe](https://img.shields.io/badge/MediaPipe-0.10+-00D4FF?style=for-the-badge)
![React](https://img.shields.io/badge/React-19-61DAFB?style=for-the-badge&logo=react&logoColor=black)
![OpenCV](https://img.shields.io/badge/OpenCV-4.x-5C3EE8?style=for-the-badge&logo=opencv)
![IBM WatsonX](https://img.shields.io/badge/IBM-WatsonX_AI-7C3AED?style=for-the-badge)
![License](https://img.shields.io/badge/License-MIT-10B981?style=for-the-badge)

**Control your entire computer with hand gestures — no mouse, no keyboard, no hardware.**  
Works across Chrome, File Explorer, VS Code, Notepad, Desktop, Taskbar — everywhere.

[🚀 Quick Start](#-quick-start) · [🎮 Gestures](#-gestures) · [📦 Installation](#-installation) · [🖥 Deploy](#-deployment)

</div>

---

## ✨ Features

| Feature | Details |
|---|---|
| 🖥 **System-Wide Control** | Controls the real OS cursor — works in every app, not just the browser |
| 📷 **Always-On-Top Mini Camera** | 320×240 overlay window pinned to top-right, stays visible in all apps |
| ✋ **21-Point Hand Tracking** | MediaPipe Hands detects 21 landmarks per hand at 30+ FPS |
| 🖱 **Full Mouse Control** | Move, Left Click, Right Click, Drag & Drop, Scroll Up/Down |
| 📜 **Zone-Based Scroll** | Raise ✌️ hand to top zone = scroll up, lower = scroll down. No jitter |
| 🤖 **IBM WatsonX AI** | Llama 3.3 70B provides real-time gesture tips in the React dashboard |
| ⚙ **Adjustable Sensitivity** | Live sensitivity control with + / - keys (0.3× to 4.0×) |
| 🎯 **Click-on-Release** | Pinch fires on release — no accidental spam clicks |
| 🧲 **Drag & Drop** | Hold left pinch 0.8s → drag → release to drop |
| 🌓 **Dark / Light Mode** | Persisted theme toggle in the React dashboard |
| 💻 **Cross-Platform** | Windows (primary), macOS, Linux |

---

## 🏗 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  Option A — Pure Python (RECOMMENDED, works everywhere)         │
│                                                                   │
│  Webcam → OpenCV → MediaPipe Hands → Gesture Engine             │
│                                          ↓                       │
│                                      PyAutoGUI → OS Cursor       │
│                                  (Chrome, Explorer, VS Code...)  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  Option B — React Dashboard + Python Relay                       │
│                                                                   │
│  Browser (MediaPipe WASM) → WebSocket → Python Server           │
│                                              ↓                   │
│                                          PyAutoGUI → OS Cursor   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎮 Gestures

| Gesture | Hand Shape | Action |
|---|---|---|
| ☝️ | Index finger extended | **Move cursor** |
| 🤏 | Thumb + Index pinch → **release** | **Left click** |
| 🤞 | Thumb + Middle pinch → **release** | **Right click** |
| ✊ | Hold left pinch for **0.8 s** | **Drag & Drop** (release to drop) |
| ✌️ | Index + Middle up, hand **raised** | **Scroll Up** |
| ✌️ | Index + Middle up, hand **lowered** | **Scroll Down** |
| ✊ | Full fist (all fingers curled) | **Pause cursor** |

### Scroll Zones (shown on camera when ✌️ is detected)

```
┌──────────────────────┐
│  ▲ SCROLL UP (30%)  │  ← raise ✌️ hand here
├──────────────────────┤
│  -- dead zone (40%) │  ← no scroll in middle
├──────────────────────┤
│  ▼ SCROLL DOWN (30%)│  ← lower ✌️ hand here
└──────────────────────┘
```

---

## 📦 Installation

### Prerequisites
- **Python 3.10 or higher**
- **Node.js 16+** (only for React dashboard)
- A **webcam**
- **Windows 10/11** (macOS/Linux also supported)

### Step 1 — Clone the repo

```bash
git clone https://github.com/sriyagna123/Virtual-Mouse.git
cd Virtual-Mouse
```

### Step 2 — Install Python packages

```bash
pip install mediapipe opencv-python pyautogui numpy websockets
```

> The hand landmark model (`hand_landmarker.task`, ~7.6 MB) is **downloaded automatically** on first run.

### Step 3 — Install React dependencies (optional, for dashboard)

```bash
cd virtual-mouse
npm install
```

---

## 🚀 Quick Start

### Option A — Standalone Python App (Recommended)

This is the **simplest and most powerful** option. One command, works everywhere:

```bash
cd Virtual-Mouse/virtual-mouse
python server/virtual_mouse.py
```

Or on Windows, double-click:
```
virtual-mouse/server/START_VIRTUAL_MOUSE.bat
```

**You'll see a small 320×240 camera window appear in the top-right corner of your screen.**  
It stays always on top. Move your hand in front of the camera — the cursor follows everywhere.

#### Command-line options

```
python server/virtual_mouse.py --sensitivity 1.8 --alpha 0.15 --scroll-speed 6 --camera 0
```

| Flag | Default | Description |
|---|---|---|
| `--sensitivity` | `1.5` | Cursor speed multiplier (0.3–4.0) |
| `--alpha` | `0.20` | EMA smoothing (lower = smoother, default good for most) |
| `--scroll-speed` | `5` | Scroll lines per step |
| `--camera` | `0` | Camera index (try `1` or `2` if camera not found) |

#### Keyboard shortcuts (camera window must be focused)

| Key | Action |
|---|---|
| `Q` / `ESC` | Quit |
| `P` | Pause / Resume tracking |
| `+` / `=` | Increase sensitivity |
| `-` | Decrease sensitivity |
| `S` | Toggle stats overlay (FPS, confidence) |
| `F` | Toggle always-on-top |

---

### Option B — React Dashboard + Python Relay

Run both in separate terminals:

**Terminal 1 — Python WebSocket relay:**
```bash
cd Virtual-Mouse/virtual-mouse
python server/mouse_server.py
```

**Terminal 2 — React app:**
```bash
cd Virtual-Mouse/virtual-mouse
npm start
```

Open [http://localhost:3000](http://localhost:3000) → click **Launch App** → click **▶ Start Camera**.

The React dashboard shows:
- Live webcam feed with landmark skeleton overlay
- Current gesture name + confidence %
- FPS counter
- IBM WatsonX AI gesture tips
- Sensitivity slider
- Click log
- Gesture reference guide

---

## 🖥 Deployment

### Deploy React Dashboard (GitHub Pages / Vercel / Netlify)

**Build the production bundle:**
```bash
cd virtual-mouse
npm run build
```

#### Vercel (Easiest — 1 click)
1. Go to [vercel.com](https://vercel.com) → **New Project**
2. Import `https://github.com/sriyagna123/Virtual-Mouse`
3. Set **Root Directory** to `virtual-mouse`
4. Framework: **Create React App**
5. Click **Deploy** — done ✅

#### Netlify
1. Go to [netlify.com](https://netlify.com) → **Add new site** → **Import from Git**
2. Connect GitHub → select `Virtual-Mouse`
3. **Base directory:** `virtual-mouse`
4. **Build command:** `npm run build`
5. **Publish directory:** `virtual-mouse/build`
6. Click **Deploy** ✅

#### GitHub Pages
```bash
cd virtual-mouse
npm install gh-pages --save-dev
```

Add to `package.json`:
```json
"homepage": "https://sriyagna123.github.io/Virtual-Mouse",
"scripts": {
  "predeploy": "npm run build",
  "deploy": "gh-pages -d build"
}
```

Then deploy:
```bash
npm run deploy
```

> **Note:** The Python server (`virtual_mouse.py`) runs locally — it cannot be deployed to a cloud server since it needs to access your webcam and OS mouse. The React dashboard is the web UI; the Python script is the desktop agent.

---

## 📁 Project Structure

```
Virtual-Mouse/
└── virtual-mouse/
    ├── server/
    │   ├── virtual_mouse.py        ← 🐍 Standalone Python app (USE THIS)
    │   ├── mouse_server.py         ← WebSocket relay for React dashboard
    │   ├── hand_landmarker.task    ← MediaPipe model (auto-downloaded)
    │   ├── START_VIRTUAL_MOUSE.bat ← Windows launcher (double-click)
    │   └── START_VIRTUAL_MOUSE.sh  ← macOS/Linux launcher
    │
    ├── src/
    │   ├── App.js                  ← Root: theme + routing
    │   ├── index.js                ← React entry
    │   ├── index.css               ← Glassmorphism styles
    │   ├── components/
    │   │   ├── LandingPage.jsx     ← Marketing landing page
    │   │   ├── VirtualMouseApp.jsx ← Main workspace layout
    │   │   ├── Header.jsx          ← Status bar + theme toggle
    │   │   ├── FloatingCamera.jsx  ← Draggable mini camera widget
    │   │   ├── WebcamFeed.jsx      ← Camera + skeleton overlay
    │   │   ├── ControlPanel.jsx    ← Sensitivity + calibration
    │   │   ├── GestureGuide.jsx    ← AI tips + gesture reference
    │   │   └── VirtualCursor.jsx   ← Custom cursor overlay
    │   └── hooks/
    │       ├── useHandTracking.js  ← MediaPipe Hands + gesture SM
    │       ├── useVirtualMouse.js  ← Browser overlay cursor
    │       ├── useSystemMouse.js   ← WebSocket → Python bridge
    │       └── useWatsonX.js       ← IBM WatsonX AI integration
    │
    ├── public/
    │   └── index.html
    ├── package.json
    ├── tailwind.config.js
    └── README.md
```

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Hand Detection | **MediaPipe Hands 0.10** (Tasks API, LIVE_STREAM mode) |
| Camera Input | **OpenCV 4** |
| OS Mouse Control | **PyAutoGUI** |
| Python Bridge | **asyncio WebSockets** |
| React UI | **React 19** + **Tailwind CSS v3** |
| AI Assistant | **IBM WatsonX** (Llama 3.3 70B) |
| Smoothing | **Exponential Moving Average (EMA)** |

---

## 🔧 Troubleshooting

| Problem | Fix |
|---|---|
| `No module named 'cv2'` | `pip install opencv-python` |
| `No module named 'mediapipe'` | `pip install mediapipe` |
| Camera not found | Try `--camera 1` or `--camera 2` |
| Cursor moves in wrong direction | Camera may be positioned differently — try physically rotating it |
| Cursor too shaky | Lower `--alpha` to `0.10` for more smoothing |
| Scroll not working | Make ✌️ gesture, then raise hand above top 30% line shown on camera |
| X button doesn't close | Press `Q` or `ESC` in the camera window |
| Always-on-top not working | Press `F` in the camera window to toggle |
| `AttributeError: module 'mediapipe' has no attribute 'solutions'` | You have MediaPipe 0.10+. Use `virtual_mouse.py` (not the old version) |

---

## 🔒 Privacy

- **Zero video sent to any server.** All camera processing runs entirely on your local machine.
- The Python app never sends video frames over the network.
- Only gesture text labels are sent to IBM WatsonX (React dashboard only, optional feature).

---

## ⚠️ Fail-Safe

**At any time, slam your physical mouse to the TOP-LEFT corner of the screen.**  
PyAutoGUI will immediately raise a `FailSafeException` and stop all cursor control.

---

## 📄 License

MIT License © 2025 [Sriyagna Ganesh](https://github.com/sriyagna123)

---

<div align="center">
Built with ❤️ using Python, MediaPipe, OpenCV, React & IBM WatsonX AI
</div>
