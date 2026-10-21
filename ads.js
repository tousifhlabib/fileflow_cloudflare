(() => {
  const config = window.FILEFLOW_ADSENSE;
  if (!config?.enabled) return;

  if (!config.consentConfigured || !config.privacyReviewed) {
    console.error("AdSense is enabled without confirmed consent and privacy configuration. Ads will not load.");
    return;
  }
  if (!/^ca-pub-\d{16}$/.test(config.publisherId)) {
    console.error("AdSense is enabled, but its publisher ID is invalid. Check ADSENSE_PUBLISHER_ID in the Vercel build environment.");
    return;
  }

  const script = document.createElement("script");
  script.async = true;
  script.crossOrigin = "anonymous";
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${config.publisherId}`;
  script.onerror = () => console.error("Google AdSense could not be loaded. Check the publisher configuration, consent setup, and cross-origin isolation compatibility.");
  document.head.append(script);
})();
