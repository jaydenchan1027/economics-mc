# October 22, 2026 report fixes

| Report finding | Change |
| --- | --- |
| Polluted D options | Cleaned 252 options: the 211 originally reported plus 41 found during the deeper audit (82 in Topic 1 and 170 in Topic 2). The additional markers used AL prefixes, combined question numbers, or "modified" suffixes. Two also contained the next question's preamble, which remains in that question's own context. All question IDs and answer keys are preserved. |
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

`python3 tests/browser.py` exercises a GitHub Pages-style `/bank/` subpath in Chromium, or Firefox with `ECON_BROWSER=firefox`. It covers answering, clearing and correcting mistakes, persistence, backup import/export/reset, resume, topic selection, queue numbering, shared-reference enlargement, small phone/landscape/desktop layouts, failed startup, offline refresh and a new offline tab. It simulates one scan download failure, verifies the badge stays incomplete, retries only the missing file, and loads all 39 scan-based question images offline.

## Further debugging

- Validate stored answers and imported backups so malformed records cannot crash startup, lock a question with an invalid choice, or inject markup into feedback.
- Preserve pending answers and export them if browser storage fills up. Merge individual answer edits with the latest saved records so a stale tab does not overwrite another tab's progress.
- Keep browser shortcuts such as Ctrl/Cmd+A from answering questions. Dialogs trap focus, block background quiz shortcuts, and restore focus when closed. Accessible option names include their full text.
- Show a retry screen if a required app script fails to load.
- Keep successful online scan responses usable when caching fails, serve scan URLs as images, isolate offline caches by project path, and allow retry after failed offline setup or cache eviction.

`tests/quiz_edge_cases.py` and `tests/offline_edge_cases.py` verify these failure paths with real browser interactions, simulated storage failures, and isolated service-worker fixtures.

## Source material still needed

Two existing Topic 6 scans cut off option D: **Q140 (2001 CE Q31, source PDF page 32)** and **Q214 (2011 CE Q33, source PDF page 48)**. Their OCR text is also incomplete. The original `sources/topic6.pdf` is absent from repository history and was not found in connected Drive. These questions are labeled **Incomplete scan** and advise learners to skip them; their missing option text has not been reconstructed. A complete Topic 6 PDF or full scans of those questions are required to finish this source repair.

The 39 diagram-based questions continue to depend on their source scans. Download every scan before travelling without a connection. Browser storage settings and clearing site data affect offline availability; the badge reports the cache on the current device.
