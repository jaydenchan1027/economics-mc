"""Regenerate the worker manifest whenever shipped app files change."""
import hashlib
import json
from pathlib import Path

root = Path(__file__).resolve().parent.parent
shell = ['index.html', 'app.css', 'data.js', 'app.js', 'shared-fix.js', 'offline.js', 'favicon.svg']
scans = sorted(str(path.relative_to(root)) for path in (root / 'assets/scans').glob('*.webp'))
digest = hashlib.sha256()
for name in shell + ['sw.js'] + scans:
    digest.update(name.encode())
    digest.update((root / name).read_bytes())
manifest = {'version': digest.hexdigest()[:16], 'shell': shell, 'scans': scans}
(root / 'offline-manifest.js').write_text('self.ECON_OFFLINE_MANIFEST=' + json.dumps(manifest, separators=(',', ':')) + ';\n')
print(f'Cache {manifest["version"]}: {len(shell)} app files, {len(scans)} scans')
