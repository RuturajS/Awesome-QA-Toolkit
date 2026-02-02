# QA Tool Kit Extension

A robust, all-in-one Chrome Extension designed for QA engineers and developers. It provides one-click page scanning, screenshot annotation, and screen recording capabilities in a minimal, compact interface.

## 🚀 Features

### 1. 🔍 One-Click Page Scanner
- Instantly analyzes the current page for:
  - **Broken Links**: Detects 4xx/5xx errors, empty hrefs, and unsafe javascript:void links.
  - **Image Audits**: Identifies broken images, missing alt text, large files (>200KB), and unoptimized formats (JPG/PNG).
  - **Performance**: Flags slow-loading assets (>1s) and excessive font usage.
  - **UI/Layout**: Checks for horizontal overflow and missing mobile viewports.
- **Detailed Metadata**: Expand issues to see "Actual" vs "Expected" values.
- **Search & Filter**: Quickly find specific issues using the search bar.
- **Export**: Download reports in JSON, CSV, TXT, or Excel (XLS) formats.

### 2. 📸 Smart Screenshot Tool
- **Capture Area**: Drag to select any part of the screen.
- **Annotate**: Built-in **Red Pen** drawing tool to highlight bugs.
- **Shortcuts**:
  - `Ctrl+Shift+Y` (or `Cmd+Shift+Y`): Activate screenshot tool instantly.
  - `Enter` or `Ctrl+C`: Copy selected area to clipboard.
  - `Esc`: Cancel selection.
- **Actions**: One-click **Copy to Clipboard** or **Save to Disk**.

### 3. 🎥 Screen Recorder
- Record your screen, window, or specific tab.
- **Persistent Recording**: Uses a dedicated helper window - recording continues even when you navigate to different pages.
- **Iframe Support**: Cursor tracking and click highlights work inside iframes and across all frames.
- **Visual Annotations** (Optional):
  - **Cursor Trail**: Red fading trail follows your mouse movements.
  - **Click Highlights**: Red ripple effects appear on clicks and persist for 2 seconds.
- Integrated **Stop Recording** floating button.
- Automatically saves recordings as `.webm` video files.
- Resilient error handling for interruptions.

### 4. 📏 Measurement Tool
- **Hover Mode**: Inspect any element on the page
  - Shows width, height, position in pixels
  - Displays padding, margin, and CSS properties
  - Green outline highlights the element
- **Measure Mode** (Press `M` key):
  - Click and drag to measure distances between any two points
  - Shows total distance, horizontal/vertical components
  - Displays angle of measurement
  - Visual line with start/end point markers
- **Keyboard Shortcuts**:
  - `M` - Toggle between Hover and Measure modes
  - `C` - Clear current measurement
  - `ESC` - Exit measurement tool
- Perfect for verifying layouts, spacing, and alignment

### 4. 🎨 Modern & Compact UI
- **Monochrome Design**: A clean, professional black-and-white interface.
- **Optimized Layout**: Compact footprint with sticky headers and collapsible focus views.
- **Author Credits**: "Ruturaj Sharbidre" in the footer.

## 🛠 Installation

1. Clone or download this repository.
2. Open Chrome and navigate to `chrome://extensions/`.
3. Enable **Developer mode** in the top right corner.
4. Click **Load unpacked**.
5. Select the project folder (`QA-Tools`).

## 📖 Usage Guide

- **Scanning**: Click the extension icon and hit **"Scan Page"**. Browsed detected issues in the table. Click any row for details.
- **Screenshot**: Click the **Camera Icon** button or press `Ctrl+Shift+Y`. Drag to select. Use the floating menu to Draw, Copy, or Save.
- **Recording**: Click the **Video Icon** button. Select the screen to share. Click the floating "Stop" button to finish and download.

## 👤 Author
**Ruturaj Sharbidre**
