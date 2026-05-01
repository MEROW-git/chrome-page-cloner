# Website Study Analyzer

A Chrome Extension for ethical frontend study. Analyzes pages you have permission to inspect and generates local static page snapshots. All processing happens entirely in your browser — no data is ever sent to external servers.

## Features

- **Active Tab Analysis** — Inspect the current page with one click
- **Simplified DOM Extraction** — Tag name, ID, classes, text preview, depth, and bounding boxes
- **Computed Style Data** — Font family, size, weight, color, background, spacing, layout properties
- **Design Token Detection** — Automatically extracts color palettes, typography scales, and spacing patterns
- **Popup UI** — Clean, fast interface showing page overview, colors, fonts, spacing, and DOM preview
- **Export JSON** — Download structured analysis data for offline study
- **Clone Website** — Download a static local HTML snapshot of the current page, preserving real DOM, text, images, links, and computed styles where possible

## Privacy & Security

This extension is built with privacy as a core principle:

- **No external network requests** — All processing is local
- **No data collection** — No cookies, passwords, tokens, or auth data is accessed
- **No storage access** — Does not read localStorage, sessionStorage, or hidden form values
- **Static snapshots only** — Scripts are removed and forms are disabled in cloned pages
- **Ethical by design** — Creates local study snapshots; respect site terms and copyright

## Installation

### Install as Unpacked Extension (Developer Mode)

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable **Developer mode** using the toggle in the top-right corner
3. Click **Load unpacked**
4. Select the `website-study-analyzer` folder containing these files
5. The extension icon will appear in your Chrome toolbar
6. Pin the extension for easy access (click the puzzle icon → pin)

### File Structure

```
website-study-analyzer/
├── manifest.json       # Extension manifest (MV3)
├── popup.html          # Popup UI markup
├── popup.css           # Popup styles
├── popup.js            # Popup controller logic
├── content.js          # In-page DOM analysis script
├── background.js       # Service worker (MV3 compliance)
├── icons/              # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
└── README.md           # This file
```

## How to Use

1. Navigate to any public website you want to study
2. Click the **Website Study Analyzer** icon in the Chrome toolbar
3. The popup will automatically analyze the page
4. Review the detected colors, fonts, spacing patterns, and DOM structure
5. Click **Export JSON** to download the raw analysis data
6. Click **Clone Website** to download a static HTML snapshot for educational reference

## Testing Steps

### Basic Functionality

1. **Install the extension** using the steps above
2. **Visit a public website** (e.g., example.com, wikipedia.org, or a documentation site)
3. **Click the extension icon** — you should see the analysis popup with:
   - Page title and hostname
   - Element count
   - Detected color palette with swatches
   - Typography list with samples
   - Spacing patterns
   - Collapsible DOM tree preview
4. **Click "Export JSON"** — a save dialog should appear; save and verify the JSON contains the expected structure
5. **Click "Clone Website"** — save the HTML file, open it in a browser, and verify it shows a static visual snapshot of the current page

### Error Handling

1. **Chrome system pages** — Navigate to `chrome://extensions/` and click the icon; you should see a friendly error message explaining that system pages cannot be analyzed
2. **Restricted pages** — Try `chrome://settings/`; the extension should gracefully refuse
3. **Very large pages** — The extension limits analysis to 500 elements and 12 levels of depth to prevent freezing

### Edge Cases

- Pages with heavy JavaScript frameworks (React, Vue, Angular)
- Pages with iframes (iframes are intentionally skipped)
- Pages with SVG-heavy content (SVGs are skipped)
- Single-page applications after navigation
- Pages with display:none or visibility:hidden content (hidden elements are skipped)

## Known Limitations

- **Max 500 elements analyzed** — Prevents freezing on very large pages
- **Max depth of 12 levels** — Deeply nested structures beyond this are truncated
- **Text preview limited to 80 characters** — Long text content is truncated
- **Hidden elements skipped** — Elements with `display:none`, `visibility:hidden`, or `opacity:0` are ignored
- **iframes not analyzed** — Content inside cross-origin iframes is inaccessible; same-origin iframes are skipped by design
- **Dynamic content** — Content loaded after initial page load (infinite scroll, lazy loading) may not be captured
- **Color accuracy** — Colors are converted to hex where possible; some CSS color values may remain in original format
- **Clone is static** — JavaScript is removed, forms are disabled, and dynamic app behavior will not run in the downloaded file
- **Asset availability depends on URLs** — The cloned HTML points to original image, stylesheet, and font URLs; assets may not load offline or if a site blocks direct access
- **Chrome only** — This extension uses Manifest V3 APIs specific to Chromium-based browsers
- **No font file extraction** — Font names are detected but font files are never downloaded

## Permissions Used

| Permission | Purpose |
|------------|---------|
| `activeTab` | Access the currently active tab when the user clicks the extension icon |
| `scripting` | Inject the content analysis script into the active tab |
| `downloads` | Save exported JSON and generated clone HTML files to your computer |
| `<all_urls>` | Allow analysis of any URL the user navigates to (required for content script registration) |

## Development

This extension uses plain JavaScript, HTML, and CSS with no external dependencies or build step. To modify:

1. Edit the source files directly
2. Go to `chrome://extensions/`
3. Click the reload icon on the Website Study Analyzer card
4. Test your changes immediately

## License

This tool is provided for educational and ethical frontend study purposes only. Respect website terms of service and copyright when using this extension.
