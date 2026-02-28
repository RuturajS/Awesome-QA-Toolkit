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
- **Whole Screen Capture**: Toggle in settings to capture the entire desktop/OS instead of just the tab.

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
- **Hover Mode**: Inspect any element on the page.
  - Shows width, height, position in pixels.
  - Displays padding, margin, and CSS properties.
  - Green outline highlights the element.
- **Measure Mode** (Press `M` key):
  - Click and drag to measure distances between any two points.
  - Shows total distance, horizontal/vertical components.
  - Displays angle of measurement.
  - Visual line with start/end point markers.
- **Keyboard Shortcuts**:
  - `M` - Toggle between Hover and Measure modes.
  - `C` - Clear current measurement.
  - `ESC` - Exit measurement tool.
- Perfect for verifying layouts, spacing, and alignment.

### 5. ⏰ URL Scheduler
- **Automated Browsing**: Schedule URLs to open automatically at a specific date/time or after a set delay.
- **Modes**:
  - **Single Mode**: Schedule one URL with a precise timer.
  - **Bulk Mode**: Paste a list of URLs to open them all simultaneously at the scheduled time.
- **Use Cases**: Setup test environments before work starts, coordinate release checks.

### 6. 🔗 URL Extractor
- **Asset Audit**: Detailed extraction of all links and assets on the current page.
- **Smart Filters**:
  - **Internal/External**: Separate local links from third-party ones.
  - **Assets**: Isolate Images, Scripts (JS), and Stylesheets (CSS).
- **Export Grid**: Download extracted lists as JSON, CSV, TXT, or Copy to Clipboard.

### 7. 📸 Auto Screenshot
- **Time-Lapse Capture**: Automate screenshot taking over time.
- **Modes**:
  - **Interval**: Take a screenshot every X seconds for Y iterations.
  - **Specific Time**: Schedule a single shot for a future moment.
- **Organization**: Automatically saves files to a custom subfolder in your Downloads.
- **Use Cases**: Monitoring long-running background processes or UI changes.

### 8. 🔍 Keyword Spotter
- **Content Verification**: Find specific text or patterns on the page.
- **Regex Support**: Use power-user Regular Expressions (e.g., `\d{5}`) or simple text.
- **Modes**:
  - **Find Once**: Highlight all current matches instantly.
  - **Watch Mode**: Continuously monitor the page and log when new matches appear (great for dynamic SPAs).
- **Match Logging**: Detailed logs of when and where keywords were found, exportable to JSON.

### 9. 📌 Note Tagger
- **On-Page Annotations**: Leave persistent sticky notes directly on web elements.
- **Workflow**:
  1. Toggle "Start Tagging".
  2. Right-click any element.
  3. Type your note.
- **Visibility Control**: Toggle note markers on/off to keep the view clean.
- **Management**: View, browse, and delete notes from the extension sidebar.

### 10. 🍪 Cookie & Storage Manager
- **Import/Export**: Easily move cookies and local storage data between environments.
- **JSON Format**: Export all site data to a clean JSON file.
- **Editing**: Modify keys and values directly during the import process.
- **Session Debugging**: Quickly clear or reset specific storage keys without opening DevTools.

### 11. 🧩 Form Filler / Test Data Generator
- **Fake Data**: Generate names, emails, phone numbers, and random strings.
- **Custom Rules**: Define rules for specific fields (e.g., "Must be 10 digits").
- **Multiple Profiles**: Save different test personas (e.g., "Guest User", "Admin").
- **One-Click Fill**: Fill entire complex forms instantly.
- **Keyboard Shortcuts**:
  - `Ctrl+Shift+F` — Fill form
  - `Ctrl+Shift+X` — Clear form

### 12. Console Error Collector
- **Invisible Monitoring**: Backwards-compatible interceptor catches errors even if DevTools is closed.
- **Page Crash Detection**: Automatically logs unhandled promise rejections and JS runtime errors.
- **Count Badges**: Real-time count of Errors, Warnings, and Info messages.
- **Export Logs**: Download the full console history as a JSON report for bug reports.

### 13. 🌐 Bulk URL Opener
- **Multi-Tab Launch**: Open dozens of URLs simultaneously in background tabs.
- **Source Options**:
  - **Export Tabs**: Grab all currently open tab URLs.
  - **History**: Load recent URLs from your browser history.
  - **Import**: Upload a `.txt` file of URLs to open.
- **Smart Throttling**: Configure a delay (ms) between opening tabs to prevent system lag.
- **Deduplication**: Automatically cleans your list of duplicate entries.


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

## 🐛 Issues & Feedback
Found a bug or have a feature request?
[**Create an Issue on GitHub**](https://github.com/ruturajs/QA-Tools-kit/issues)
