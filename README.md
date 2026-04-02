# vmedulife-marks-extension

A Chrome Extension (Manifest V3) that reveals hidden numeric marks on the VMedulife student portal (`portal.vmedulife.com`). The portal displays letter grades (A, B, C, etc.), but the underlying API contains full numeric mark data including internal, external, and practical scores.

## Features

- **Detailed Mark Breakdown** — View exact numeric scores for theory and practical subjects
- **Internal vs External Analysis** — Compare mid-semester exam performance against semester exams
- **Performance Visualization** — Bar chart comparing all subjects at a glance
- **Quick Stats Dashboard** — SGPA, total credits, subject count, and pass/fail status
- **Privacy-First** — 100% local processing, no data sent to any server

## Supported Portals

- `*.vmedulife.com`

## Installation

### Prerequisites

- Google Chrome (version 88 or later)
- Developer mode enabled in Chrome

### Steps

1. Download or clone this repository to your local machine
2. Open Google Chrome and navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in the top-right corner)
4. Click **Load unpacked**
5. Select the `vmedulife-marks-extension` directory
6. The extension icon will appear in your Chrome toolbar

## Usage

1. Open the VMedulife portal at `https://portal.vmedulife.com`
2. Log in and navigate to your **Results** page
3. The marks panel will automatically slide in from the right when results load
4. Click the **Close** button, click outside the panel, or press `Escape` to dismiss
5. Visit the Results page again to reopen the panel

## Architecture

```
vmedulife-marks-extension/
├── manifest.json       # Chrome Extension manifest (MV3)
├── interceptor.js      # Network interceptor (MAIN world)
├── ui.js               # UI panel renderer (ISOLATED world)
├── CHANGELOG.md        # Version history
├── CONTRIBUTING.md     # Contribution guidelines
└── icons/
    ├── icon16.png
    ├── icon48.png
    └── icon128.png
```

### How It Works

The extension uses a two-script architecture:

1. **interceptor.js** (runs in the MAIN world)
   - Hooks `XMLHttpRequest` and `fetch` to intercept API responses
   - Monitors requests to `studentResult.php`
   - Validates responses contain marks data
   - Stores data in a hidden DOM element (`#vmedulife-marks-store`)
   - Dispatches a custom DOM event `vmedulife-marks-detected`

2. **ui.js** (runs in the ISOLATED world)
   - Listens for the `vmedulife-marks-detected` event
   - Parses stored JSON data
   - Renders a dark-themed slide-in panel with:
     - Quick stats (SGPA, credits, subject count, pass/fail)
     - Subject-wise result table
     - Theory subjects detailed breakdown (Internal/External)
     - Practical subjects breakdown
     - Internal vs External comparison
     - Performance bar chart

### Data Field Mapping

The extension maps VMedulife API response fields to human-readable names:

| API Field | Description |
|-----------|-------------|
| `col_7493` | Grade (O, E, A, B, C, D, F) |
| `col_1096` | Overall marks obtained |
| `col_1474` | Maximum marks |
| `col_3187` | Percentage |
| `col_9639` | Grade Point (GP) |
| `col_3695` | Credits |
| `col_6152` | Obtained Credits |
| `col_4044` | Credit Points |
| `col_9026` / `col_1498` | Internal scored / max (theory: 40) |
| `col_5396` / `col_2403` | External scored / max (theory: 60) |
| `col_5138` | External percentage |
| `col_5753` | Theory percentage |
| `col_7978` / `col_6954` | Practical max / scored |
| `col_6297` | Practical percentage |

## Privacy & Security

- **100% Local** — All processing happens in your browser
- **No External Requests** — No data is sent to any server
- **Domain Restricted** — Only activates on `*.vmedulife.com` domains
- **No Page Modification** — Does not alter the original portal pages
- **No Tracking** — No analytics, telemetry, or data collection

## Troubleshooting

### Panel doesn't appear

1. Ensure you're on the VMedulife Results page
2. Check the Chrome DevTools Console (`F12` → Console) for errors
3. Verify the extension is enabled in `chrome://extensions/`
4. Try refreshing the results page
5. Check that you don't have another extension blocking scripts

### Panel shows "timed out"

1. The API response wasn't detected within 60 seconds
2. The VMedulife portal may have updated their API
3. Try navigating away and back to the Results page

### Showing incorrect marks

1. The VMedulife portal may have changed their API response format
2. Report the issue on the GitHub repository with:
   - Browser console output (any `interceptor` or `ui.js` logs)
   - Screenshots of the panel vs. the official portal

### Extension stops working after portal update

The VMedulife portal may update their system, causing the extension to break. Please report issues on the GitHub repository with details about what stopped working.

## Contributing

Contributions are welcome! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Changelog

See [CHANGELOG.md](CHANGELOG.md) for version history.

## License

This project is for educational and personal use. The extension is provided as-is.
