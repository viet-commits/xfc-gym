# Unused but unique assets

Moved out of `public/` so they are no longer deployed, but kept because they are the only
copy of their content:

- `dion-douglas-c.jpg` — a coach headshot in the same format as the four on the Coaches
  page. Nobody named Dion Douglas appears on the site; confirm whether a profile is missing.
- `gym-action.jpg` / `.webp` — 1142x1663 portrait training shot.
- `xfc-banner-logo.png` / `.webp` — 700x700 logo. Larger than the 96x96 `xfc-logo.png` the
  nav currently uses, which is why the nav logo is soft on high-density screens.
- `footer-bg.jpg` — 1920x2000 abstract polygon texture, not a photograph.

Everything else removed in this pass was either a byte-identical duplicate of a retained
file or a PNG superseded by a smaller WebP.

## Broken video files (moved 29 Jul 2026)

`13.mp4`, `15.mp4`, `21.mp4` were served on `/videos/` behind `<video>` players, but they
are **fragmented-MP4 media segments without an initialisation header** (each begins with a
`moof` box; there is no `ftyp`/`moov`). No browser can play them — every visitor saw three
dead players. Their `mfhd` sequence numbers (1, 2, 4) suggest they are consecutive
segments of a single streamed video, saved mid-download. The Videos page now links to the
gym's Instagram and YouTube instead. If the original full videos can be re-exported, they
can go back behind native players.
