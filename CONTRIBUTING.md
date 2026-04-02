# Contributing to vmedulife-marks-extension

Thank you for your interest in contributing to vmedulife-marks-extension!

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/amitgoesbrr/vmedulife-marks-extension.git`
3. Install in Chrome via `chrome://extensions/` (Developer mode → Load unpacked)

## Development Workflow

1. Make your changes in a feature branch
2. Test locally by loading the unpacked extension
3. Verify no console errors in Chrome DevTools
4. Submit a pull request

## Reporting Issues

When reporting issues, please include:

- Chrome version and OS
- Steps to reproduce
- Console output (any errors visible in DevTools `F12`)
- Screenshots of the panel vs. the official portal
- Whether the issue is with detection or display

### Issue Templates

**Bug Report:**
```
## Steps to Reproduce
1.
2.
3.

## Expected Behavior


## Actual Behavior


## Console Output
(paste any relevant console messages)

## Environment
- Chrome version:
- OS:
- Extension version:
```

**Feature Request:**
```
## Problem
(What problem does this solve?)

## Proposed Solution
(How should it work?)

## Alternatives Considered
(Any other approaches you've considered?)
```

## Code Style

- Use `'use strict'` in all JavaScript files
- Use `var` for variable declarations (ES5 compatible)
- Use `===` for comparisons
- Comment complex logic
- Keep functions small and focused

## Pull Request Process

1. Update documentation for any API changes
2. Add entry to CHANGELOG.md under `[Unreleased]`
3. Ensure DEBUG flags are `false` before submitting
4. Test on the VMedulife portal with real data
5. Request review from maintainers

## Areas Needing Contribution

- Support for additional VMedulife API endpoints
- Improved accessibility (ARIA labels, keyboard navigation)
- Mobile/responsive optimizations
- Additional visualization types
- Testing infrastructure

## License

By contributing, you agree that your contributions will be licensed under the same terms as the project.
