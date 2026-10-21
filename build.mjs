import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";

const root = process.cwd();
const output = join(root, "dist");
const siteUrl = new URL(process.env.SITE_URL || "https://fileflow-tools.pages.dev");
if (siteUrl.protocol !== "https:" || siteUrl.pathname !== "/" || siteUrl.search || siteUrl.hash) {
  throw new Error("SITE_URL must be an HTTPS origin, such as https://fileflow-delta.vercel.app.");
}
const canonicalOrigin = siteUrl.origin;
const pages = [
  "index.html",
  "image.html",
  "audio.html",
  "video.html",
  "document.html",
  "about.html",
  "contact.html",
  "guides.html",
  "privacy.html",
  "terms.html",
  "licenses.html",
  "app.js",
  "ads.js",
  "adsense-config.js",
  "video-converter.js",
  "styles.css",
  "favicon.svg",
  "_headers",
  "robots.txt",
  "sitemap.xml"
];

await rm(output, { recursive: true, force: true });
await mkdir(output, { recursive: true });

for (const file of pages) {
  await cp(join(root, file), join(output, file));
}

await cp(join(root, "google595fed6a27c75de4.html"), join(output, "google595fed6a27c75de4.html"));  for (const file of ["robots.txt", "sitemap.xml"]) {
  const filePath = join(output, file);
  const content = await readFile(filePath, "utf8");
  await writeFile(
    filePath,
    content
      .replaceAll("https://fileflow-delta.vercel.app", canonicalOrigin)
      .replaceAll("https://fileflow-cloudflare.pages.dev", canonicalOrigin)
  );
}

const googleVerification = process.env.GOOGLE_SITE_VERIFICATION?.trim() || "";
if (googleVerification && !/^[A-Za-z0-9_-]+$/.test(googleVerification)) {
  throw new Error("GOOGLE_SITE_VERIFICATION must be the token from Google's HTML tag verification method.");
}

for (const file of pages.filter((name) => name.endsWith(".html"))) {
  const pagePath = join(output, file);
  let html = await readFile(pagePath, "utf8");
  const adScripts = '  <script src="adsense-config.js" defer></script>\n  <script src="ads.js" defer></script>\n';
  if (!html.includes("</head>")) throw new Error(`Cannot add production metadata to ${file}: missing </head>.`);
  html = html.replaceAll('href="index.html"', 'href="/"');
  const pageUrl = file === "index.html"
    ? `${canonicalOrigin}/`
    : `${canonicalOrigin}/${file.replace(/\.html$/, "")}`;
  const title = html.match(/<title>(.*?)<\/title>/i)?.[1]?.trim();
  const description = html.match(/<meta name="description" content="([^"]+)"/i)?.[1]?.trim();
  if (!title || !description) {
    throw new Error(`Cannot add search metadata to ${file}: title and meta description are required.`);
  }
  const metadata = [
    `  <meta property="og:type" content="website">`,
    `  <meta property="og:site_name" content="Fileflow">`,
    `  <meta property="og:title" content="${title}">`,
    `  <meta property="og:description" content="${description}">`,
    `  <meta property="og:url" content="${pageUrl}">`,
    `  <meta name="twitter:card" content="summary">`,
    ...(googleVerification ? [`  <meta name="google-site-verification" content="${googleVerification}">`] : [])
  ].join("\n");
  const canonicalLink = `  <link rel="canonical" href="${pageUrl}">\n`;
  const structuredData = file === "index.html"
    ? `  <script type="application/ld+json">${JSON.stringify({
        "@context": "https://schema.org",
        "@type": "WebSite",
        name: "Fileflow",
        url: `${canonicalOrigin}/`,
        description
      }).replaceAll("<", "\\u003c")}</script>\n`
    : "";
  html = html.replace("</head>", `${canonicalLink}${metadata}\n${structuredData}${adScripts}</head>`);
  await writeFile(pagePath, html);
}

const adsenseEnabled = process.env.ADSENSE_ENABLED === "true";
const publisherId = process.env.ADSENSE_PUBLISHER_ID || "";
if (adsenseEnabled && !/^ca-pub-\d{16}$/.test(publisherId)) {
  throw new Error("ADSENSE_ENABLED=true requires ADSENSE_PUBLISHER_ID in the format ca-pub-0000000000000000.");
}
const consentConfigured = process.env.ADSENSE_CONSENT_CONFIGURED === "true";
const privacyReviewed = process.env.ADSENSE_PRIVACY_REVIEWED === "true";
if (adsenseEnabled && !consentConfigured) {
  throw new Error("Before enabling AdSense, configure and verify the required consent experience. Set ADSENSE_CONSENT_CONFIGURED=true only after that review.");
}
if (adsenseEnabled && !privacyReviewed) {
  throw new Error("Before enabling AdSense, review and update privacy.html for the actual advertising providers and disclosures. Set ADSENSE_PRIVACY_REVIEWED=true only after that review.");
}
await writeFile(
  join(output, "adsense-config.js"),
  `window.FILEFLOW_ADSENSE = ${JSON.stringify({
    enabled: adsenseEnabled,
    publisherId: adsenseEnabled ? publisherId : "",
    consentConfigured: adsenseEnabled && consentConfigured,
    privacyReviewed: adsenseEnabled && privacyReviewed
  })};\n`
);
if (adsenseEnabled) {
  await writeFile(join(output, "ads.txt"), `google.com, ${publisherId.slice("ca-pub-".length)}, DIRECT, f08c47fec0942fa0\n`);
} else {
  console.log("AdSense is disabled. Set ADSENSE_ENABLED=true and ADSENSE_PUBLISHER_ID after account setup and consent review.");
}

for (const [source, destination] of [
  ["@ffmpeg/ffmpeg/dist/esm", "vendor/ffmpeg"],
  ["@ffmpeg/core-mt/dist/esm", "vendor/ffmpeg-core-mt"]
]) {
  const sourceDirectory = join(root, "node_modules", source);
  const destinationDirectory = join(output, destination);
  await mkdir(destinationDirectory, { recursive: true });
  const entries = await readdir(sourceDirectory);
  for (const entry of entries) {
    if (entry === "ffmpeg-core.wasm") {
      const wasm = await readFile(join(sourceDirectory, entry));
      const chunkSize = 20 * 1024 * 1024;
      const parts = [];
      for (let offset = 0; offset < wasm.length; offset += chunkSize) {
        const partName = `ffmpeg-core.wasm.part-${String(parts.length).padStart(3, "0")}`;
        await writeFile(join(destinationDirectory, partName), wasm.subarray(offset, offset + chunkSize));
        parts.push(partName);
      }
      await writeFile(
        join(destinationDirectory, "wasm-parts.json"),
        `${JSON.stringify({ contentType: "application/wasm", parts })}\n`
      );
    } else if (/\.js$/.test(entry)) {
      await cp(join(sourceDirectory, entry), join(destinationDirectory, entry));
    }
  }
}

console.log(`Built Fileflow static site at ${output}`);
