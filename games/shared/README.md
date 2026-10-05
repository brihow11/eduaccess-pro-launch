# /games shared assets

Written by: Howie

Shared pieces for every arcade game under `/games/`. Keep them dependency-free
(no CDN, no external fonts, no tracking).

## Job Seeker Pro banner

Every `/games` page shows a slim Job Seeker Pro (Scout AI) banner at the very
top that links to https://www.jspro.ai in a new tab, with UTM tags
(`utm_source=eduaccess&utm_medium=game&utm_campaign=games-banner&utm_content=<hub|defender|joust>`).
The tagline is quoted from the published www.jspro.ai home page; do not invent product claims. Colors match jspro.ai: navy
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

Do not change the link target (www.jspro.ai with these UTM tags) or remove the banner from a game page.

## Scout AI splash (between waves and on game over)

`scout-splash.css` + `scout-splash.js` show a full-screen Job Seeker Pro Scout AI
splash after every wave and on game over. Each splash features three of six
published Scout features (rotating, so consecutive splashes differ), a "Try Scout
free" button to `https://www.jspro.ai/?utm_source=eduaccess&utm_medium=game&utm_campaign=<game>&utm_content=splash-<wave|gameover>`
(new tab, so the game survives) and a Continue button (Enter, Space or C; tap on mobile).

```js
ScoutSplash.show({ kind: 'defender' | 'joust', campaign: 'joust', tag: 'wave3',
  title: 'WAVE 3 CLEARED', sub: 'Score 12000', contLabel: 'Next wave',
  onContinue: function () { /* resume the game */ } });
ScoutSplash.isOpen(); // true while showing
```
