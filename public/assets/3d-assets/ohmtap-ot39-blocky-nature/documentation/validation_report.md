# Validation report

Checked: 2026-11-20 17:17 UTC by `validate.py` (automated).

| Check | Result |
|---|---|
| Manifest rows (images) | 76 |
| PNG files checked (1x + 2x) | 152 |
| Valid rows | 76 |
| Invalid rows | 0 |
| Missing files | 0 |
| Duplicate file groups | 0 |
| PNGs not listed in manifest | 0 |
| Atlas files missing | 0 |
| Rows with warnings (manual review) | 0 |

**Overall: PASSED**

## What was checked
File exists; valid PNG (verify + full decode); RGBA mode; exact size from the manifest; not empty; not an opaque rectangle; transparent corners; no visible pixels on the canvas border unless the asset is flagged as tiling / open-ended; duplicate SHA-256 hashes; PNGs on disk missing from the manifest; license info present; atlas files present.

## What this report cannot tell you
Automated checks do not judge visual quality, style consistency, readability or whether tiling seams look right. Those were reviewed by eye on contact sheets during production.

