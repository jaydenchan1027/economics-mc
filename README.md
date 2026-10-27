# Economics MC Practice Bank

Mobile-friendly Economics past-paper question bank covering **Topics 1–9** and **1,336 MC questions** from CE/AL past papers.

- Table of contents by Topic → I, II, III…
- Exam-paper selection: CE / AL / Both
- Instant answer marking using the included answer keys
- Progress and mistake review saved in local browser storage
- Original scans for every question, including shared charts and tables
- Scan-based options labeled in the section list and question card
- Offline refresh and an optional download of every scan
- Light study dashboard with responsive topic cards, clear progress, and readable answer feedback

## GitHub Pages

https://jaydenchan1027.github.io/economics-mc/

This is a static GitHub Pages application with no build step or production dependencies. `index.html`, `app.css`, `app.js`, and `data.js` form the app. The 1,068 original WebP scans in `assets/scans/` load on demand. The initial app files total approximately **1.1 MB before compression**, compared with roughly 28 MB of HTML and data scripts in the previous version. `original.html` redirects old bookmarks to the complete bank.

After a successful online visit, the service worker saves the app and question text. Viewed scans are cached automatically. To prepare the complete bank, open **Practice settings → Download all scans for offline use** (about 20 MB). The badge changes from **TEXT SAVED OFFLINE** to **OFFLINE READY** only when every scan is saved. Interrupted downloads retain their completed files; retry to download only the remaining scans. Offline support requires HTTPS or localhost and available browser storage. Clearing site data removes the offline download.

Your progress is saved per browser and is not synchronized between devices. Export it before clearing browser data.

Two Topic 6 questions (Q140 and Q214) have clipped source scans and are labeled **Incomplete scan**. Skip these until complete source images are supplied; see the [source repair notes](docs/report-fixes.md#source-material-still-needed).

## Development and checks

Serve the repository with `python3 -m http.server 8000`, then visit `http://localhost:8000`.

After changing app files or scans, regenerate the versioned offline manifest:

```sh
python3 scripts/update-cache.py
node --test tests/data.test.cjs
```

For browser regression checks, install Python Playwright (`python3 -m pip install -r requirements-dev.txt`) and browsers (`python3 -m playwright install chromium firefox`). Run `python3 tests/browser.py`, `python3 tests/quiz_edge_cases.py`, and `python3 tests/offline_edge_cases.py`. Set `ECON_BROWSER=firefox` to run the base and quiz checks in Firefox. The Chromium tests also use an installed `chromium`, or the executable selected by `CHROMIUM_PATH`.

The checks cover the 1,336 original IDs and answers, data cleanup, scan references, quiz and mistake review, backup import/export/reset, resume location, mobile layout, shared diagrams, and offline refresh at a project subpath. An interrupted offline download is tested before retrying and opening all 39 scan-based questions' images offline.

See [the report fix notes](docs/report-fixes.md) for the changes based on the October 22, 2026 audit.

**Rights:** The past-paper materials may be copyrighted. Confirm publication rights before making this site publicly accessible.
