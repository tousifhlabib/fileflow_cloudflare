# Fileflow — Cloudflare Pages

Fileflow is a static, browser-based file conversion website. Conversion files are processed in the visitor's browser; conversion libraries may be downloaded from third-party CDNs.

## Local development

Requirements: Node.js 16 or later and npm.

```powershell
npm ci
npm run build
```

The static output is written to `dist/`. The build splits the FFmpeg WASM into 20 MiB static parts so every uploaded asset stays below Cloudflare Pages' 25 MiB per-file limit. The browser fetches those parts and reassembles the same WASM engine locally before video conversion; the video conversion formats and limits are unchanged.

To preview the site locally, serve `dist/` over HTTP and configure the COOP/COEP headers from `_headers`. Video conversion requires HTTPS (or localhost) and cross-origin isolation.

## Deploy from GitHub to Cloudflare Pages

1. Push the contents of this folder to a GitHub repository.
2. In Cloudflare, create a **Pages** project connected to that GitHub repository.
3. Use the following build settings:
   - Framework preset: **None**
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Root directory: the repository root if this folder's contents are at the root; otherwise `fileflow_Cloudflare`.

The default canonical URL is `https://fileflow-cloudflare.pages.dev` (use `fileflow-cloudflare` as the Pages project name). If Cloudflare assigns a different hostname or you use a custom domain, add a Pages environment variable named `SITE_URL` with the final HTTPS origin, for example `https://www.example.com`. The build uses it for canonical tags, `robots.txt`, and `sitemap.xml`.

The build copies `_headers` into `dist/`. Cloudflare Pages uses this file to set COOP/COEP for the multi-threaded FFmpeg converter, plus additional security headers. Verify these headers and test conversions on the deployed domain after deployment. `vercel.json` is not used by Cloudflare Pages.

## AdSense

Ads are disabled by default. Do not enable them until an approved publisher account, applicable consent experience, and reviewed privacy disclosures are in place. The build expects `ADSENSE_ENABLED=true`, a valid `ADSENSE_PUBLISHER_ID`, `ADSENSE_CONSENT_CONFIGURED=true`, and `ADSENSE_PRIVACY_REVIEWED=true` before generating an enabled configuration and `ads.txt`.

## Third-party software and licensing

The bundled `@ffmpeg/core-mt` package identifies its license as GPL-2.0-or-later. Its corresponding source, build inputs, notices, and distribution obligations must be verified and addressed for the exact binary before commercial distribution or monetization. See `licenses.html`; that page is a disclosure, not proof of compliance or legal advice.
