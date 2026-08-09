# ACE Education migration to `/ready`

Migration date: 2026-08-09

## What is live in this repository

- The former `jobsk.pro` public landing page is rebuilt from its Bolt source under `ready-src/`.
- Railway builds it into `ready/` and the existing Node service serves it at `https://eduaccess.pro/ready`.
- The page content is a source-controlled snapshot exported from the Bolt `page_content` record.
- The overview video and poster are stored in `ready-src/public/media/` and deployed with the application.
- The overview video starts paused so a visitor click can begin playback with sound. The custom player includes explicit play/pause, rewind, stop, mute/unmute, and progress controls instead of relying on silent autoplay.
- CTA links continue to open the existing HubSpot scheduling page.
- Browser events use the existing GA4 tag. No application database is required for public page rendering.

## No-Supabase proof

The live source contains no Supabase package, environment variable, endpoint, or media URL. The old Bolt/Supabase source remains only in the separate private migration archive.

Run:

```powershell
rg -n -i "supabase|VITE_SUPABASE|@supabase" ready-src ready package.json server.js
npm test
npm audit --omit=dev
```

The search must return no matches, all tests must pass, and the production dependency audit must report zero vulnerabilities.

## Build and local proof

```powershell
npm install
npm run build
$env:PORT = "4177"
npm start
```

Then open `http://127.0.0.1:4177/ready/`. The automated tests verify the route, poster, MP4 MIME type, and byte-range video delivery.

## Rollback

Revert the migration commit and redeploy the previous Railway commit. This removes `/ready` while leaving the existing `eduaccess.pro` root site and other tools unchanged.

The `jobsk.pro` redirect is a separate DNS/domain action. If needed, remove that redirect without changing this Railway deployment.
