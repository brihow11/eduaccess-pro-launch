# /games shared assets

Written by: Howie

Shared pieces for every arcade game under `/games/`. Keep them dependency-free
(no CDN, no external fonts, no tracking).

## Job Seeker Pro banner

Every `/games` page shows a slim Job Seeker Pro (Scout AI) banner at the very
top that links to https://jspro.ai in a new tab. Colors match jspro.ai: navy
`#0A1628`, cream `#FAF8F3`, accent red `#8B1A1A`.

Include it like this (paths are absolute so they work from any game folder):

```html
<head>
  <link rel="stylesheet" href="/games/shared/banner.css">
</head>
<body>
  <div data-jsp-banner></div>   <!-- optional: where to mount; else it is prepended to <body> -->
  ...
  <script src="/games/shared/banner.js" defer></script>
</body>
```

Layout help for full-screen games:

- `--jsp-banner-h` (CSS, on `:root`) is the banner's design height: 44px, or 34px on
  phones and short landscape screens. Use `calc(100dvh - var(--jsp-banner-h))` for the
  play area.
- `--jsp-banner-real-h` is set by `banner.js` to the measured height after mount.
- `banner.js` fires a `jsp-banner-ready` event on `window` after it mounts, so a game
  can re-run its resize logic.

Do not change the link target or remove the banner from a game page.
