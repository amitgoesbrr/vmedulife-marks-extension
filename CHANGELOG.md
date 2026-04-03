# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

## [1.1.0] - 2026-04-03

### Added

- **PDF Download** — New "PDF" button in the panel header opens a print-ready page with all marks data, styled with Inter font, grade badges, and all 5 data sections. Users can save as PDF via Chrome's print dialog.
- **CSV Download** — New "CSV" button in the panel header downloads a comprehensive CSV file with student info, all subject marks, internal/external breakdowns, and practical scores. Opens directly in Excel/Google Sheets.
- **Download buttons** — Color-coded action buttons (red for PDF, green for CSV) placed in the header alongside the close button for easy access.
- **Print-ready layout** — PDF export includes student header, stats dashboard, subject-wise table, theory detail, practical breakdown, and internal vs external comparison with auto-generated footer.
- **Smart filenames** — CSV files auto-named as `marks_StudentName_SemX.csv` for easy organization.

## [1.0.1] - 2026-04-02

### Changed

- **Extension renamed** — Changed name from "GradePeek" to "vmedulife-marks-extension" for clarity and consistency.

### Fixed

- **DEBUG flag enabled in production** — Both `interceptor.js` and `ui.js` had `DEBUG=true` which logged student data to console. Now disabled by default for privacy.
- **Dead code in getObservation()** — Removed unreachable code branch that would never execute due to earlier condition.
- **hasFired flag not resetting on SPA navigation** — Added `pageshow` event listener to reset the flag when pages are restored from bfcache, enabling re-detection on portal navigations.
- **NaN crash in theory table** — `extPct.toFixed(1)` would throw TypeError when API returned invalid data. Now shows 'N/A' for invalid values.
- **NaN propagation across all tables and chart** — Added NaN checks throughout subject-wise result, theory detail, practical, comparison tables, stats, and chart sections. Invalid values now display 'N/A' instead of crashing.
- **Grade type safety** — `grade.toUpperCase()` would crash if API returned numeric grade. Now uses `String()` wrapper to ensure safe conversion.
- **Empty subjects silent failure** — When no subjects were found, extension silently returned with no user feedback. Now shows a user-friendly error panel explaining the issue.
- **MutationObserver leak** — Observer was not properly disconnected after panel rendered. Fixed to always disconnect after data is processed.
- **Store element accumulation** — Multiple `#vmedulife-marks-store` elements could accumulate on rapid pageshow events. Now removes existing store before creating a new one.
- **intPct Infinity validation** — Added `isFinite()` check on computed `intPct` to prevent Infinity values from API anomalies.
- **extPct Infinity validation** — Added `isFinite()` check on `extPct` to ensure valid numeric values.
- **SGPA Infinity handling** — Changed `isNaN()` to `!isFinite()` for SGPA display to catch Infinity values.
- **pageshow stale store cleanup** — pageshow handler now removes existing store element to prevent stale data on bfcache restore.
- **Error panel for parse/build failures** — `parseResult()` and `buildPanel()` errors now show user-friendly error panel instead of silently failing.

### Documentation

- Complete rewrite of README.md with professional documentation
- Added CONTRIBUTING.md with contribution guidelines
- Added CHANGELOG.md to track version history
- Professional JSDoc comments added to interceptor.js and ui.js with @fileoverview, @description, @param, @returns, @type annotations

## [1.0.0] - 2026-04-02

### Added

- Initial release
- Chrome Extension (Manifest V3) for VMedulife portal
- Intercepts `studentResult.php` API responses
- Displays detailed marks (internal, external, practical scores)
- Dark-themed slide-in panel UI
- Quick stats dashboard (SGPA, credits, pass/fail)
- Subject-wise result table
- Theory subjects detailed breakdown
- Practical subjects breakdown
- Internal vs External comparison
- Performance bar chart visualization
- 100% local processing, no external data transmission
