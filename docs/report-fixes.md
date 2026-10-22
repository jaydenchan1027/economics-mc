# October 22, 2026 report fixes

| Report finding | Change |
| --- | --- |
| 211 polluted D options | Removed only the trailing next-question citation from 60 Topic 1 and 151 Topic 2 options. All question IDs, answer keys, exam metadata, stems, and other option text are preserved. |
| Offline refresh failed | A versioned service worker caches the app and question text. Viewed scans are cached; settings can download the complete bank. The full offline badge requires all 1,068 scans, and a failed download can resume. |
| 39 questions have no text options | Marked these as **Scan-based options** on the question card and **Scan** in the section grid. Their original A–D diagrams remain visible and can be enlarged. No replacement option text was invented. |
| Large startup and 30-second timeout | Removed the HTML fetch/document.write bootstrap and 17 script segments. Approximately 1.1 MB of app files loads first; 19.55 MB of original WebP scans loads on demand or through the offline download. |
| CE Topic 5 has no questions | Disabled the card for mouse and keyboard activation in CE mode, with explanatory text. It remains available in AL and Both modes. |
| Ambiguous duplicate numbering | Queue progress remains **QUESTION 1 / 64**; the source identifier reads **TOPIC Q17**, with a set number where applicable. Shared references use stable question IDs instead of parsing the displayed label. |
| Outdated footer and source wording | Updated Topics 1–9, separate footer paragraphs, public-facing answer-key wording, and source-page labels. |
| Singular/plural and favicon | Counts show **1 QUESTION** where appropriate. Added an SVG favicon. |
| Imported backup loses last location | Restore a valid `prefs.last`, clear invalid locations safely, and save the viewed location when opening or navigating questions. |

## Verification

`node --test tests/data.test.cjs` checks bank totals (1,336 = 1,043 CE + 293 AL), stable IDs and answer metadata against the original bank's digest, option cleanliness, scan markers, all content-addressed images, and manifest freshness.

`python3 tests/browser.py` exercises Chromium at a GitHub Pages-style `/bank/` subpath. It covers answering, clearing and correcting mistakes, persistence, backup import/export/reset, resume, topic selection, queue numbering, shared-reference enlargement, 390px and desktop layouts, offline refresh and a new offline tab. It simulates one scan download failure, verifies the badge stays incomplete, retries only the missing file, and loads all 39 scan-based question images offline.

The 39 diagram-based questions continue to depend on their source scans. Download every scan before travelling without a connection. Browser storage settings and clearing site data affect offline availability; the badge reports the cache on the current device.
