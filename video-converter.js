import { FFmpeg } from "./vendor/ffmpeg/index.js";

const coreBase = new URL("./vendor/ffmpeg-core-mt/", import.meta.url);
const maxVideoSize = 100 * 1024 * 1024;
const maxVideoDuration = 10 * 60;
let ffmpeg;
let ffmpegLoad;

async function createWasmUrl() {
  const manifestResponse = await fetch(new URL("wasm-parts.json", coreBase));
  if (!manifestResponse.ok) {
    throw new Error(`Could not load the video engine manifest (${manifestResponse.status}).`);
  }
  const manifest = await manifestResponse.json();
  if (
    manifest.contentType !== "application/wasm" ||
    !Array.isArray(manifest.parts) ||
    manifest.parts.length === 0 ||
    manifest.parts.some((part) => typeof part !== "string" || !/^ffmpeg-core\.wasm\.part-\d{3}$/.test(part))
  ) {
    throw new Error("The video engine WASM parts manifest is invalid.");
  }
  const chunks = await Promise.all(manifest.parts.map(async (part) => {
    const response = await fetch(new URL(part, coreBase));
    if (!response.ok) {
      throw new Error(`Could not load a video engine part (${response.status}).`);
    }
    return response.arrayBuffer();
  }));
  return URL.createObjectURL(new Blob(chunks, { type: manifest.contentType }));
}

async function getFFmpeg(showMessage) {
  if (!crossOriginIsolated || typeof SharedArrayBuffer === "undefined") {
    throw new Error("Multi-threaded video conversion requires a cross-origin isolated HTTPS page with the configured COOP and COEP response headers.");
  }
  if (!ffmpegLoad) {
    ffmpeg = new FFmpeg();
    const activeFFmpeg = ffmpeg;
    ffmpeg.on("log", ({ message }) => {
      if (/error/i.test(message)) console.warn("FFmpeg:", message);
    });
    ffmpeg.on("progress", ({ progress }) => {
      if (Number.isFinite(progress)) {
        showMessage(`Converting video… ${Math.max(0, Math.min(99, Math.round(progress * 100)))}%`);
      }
    });
    ffmpegLoad = (async () => {
      const wasmURL = await createWasmUrl();
      try {
        await activeFFmpeg.load({
          coreURL: new URL("ffmpeg-core.js", coreBase).href,
          wasmURL,
          workerURL: new URL("ffmpeg-core.worker.js", coreBase).href
        });
      } finally {
        URL.revokeObjectURL(wasmURL);
      }
    })();
    ffmpegLoad.catch(() => {
      ffmpegLoad = undefined;
      ffmpeg = undefined;
    });
  }
  showMessage("Loading the multi-threaded FFmpeg engine… This first download is about 33 MB.");
  await ffmpegLoad;
  return ffmpeg;
}

export async function convertVideo(file, outputFormat, showMessage) {
  if (file.size > maxVideoSize) throw new Error("Video files must be 100 MB or smaller in this browser converter.");
  if (!["MP4", "MP3", "WAV"].includes(outputFormat)) {
    throw new Error("Video export is available as MP4, MP3, or WAV.");
  }

  const video = document.createElement("video");
  const sourceUrl = URL.createObjectURL(file);
  video.preload = "metadata";
  video.src = sourceUrl;
  try {
    await new Promise((resolve, reject) => {
      video.addEventListener("loadedmetadata", resolve, { once: true });
      video.addEventListener("error", () => reject(new Error("This browser can't read the video metadata. Try an MP4, MOV, WebM, MKV, or AVI file.")), { once: true });
      video.load();
    });
    if (!Number.isFinite(video.duration) || video.duration <= 0) {
      throw new Error("The video duration could not be read.");
    }
    if (video.duration > maxVideoDuration) {
      throw new Error("Videos must be 10 minutes or shorter in this browser converter.");
    }
  } finally {
    video.removeAttribute("src");
    video.load();
    URL.revokeObjectURL(sourceUrl);
  }

  const engine = await getFFmpeg(showMessage);
  const extension = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "video";
  const uniqueId = crypto.randomUUID();
  const inputPath = `input-${uniqueId}.${extension}`;
  const outputPath = `output-${uniqueId}.${outputFormat.toLowerCase()}`;
  const outputOptions = outputFormat === "MP4"
    ? [
        "-map", "0:v:0",
        "-map", "0:a:0?",
        "-vf", "scale=w='min(1920,iw)':h='min(1080,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2",
        "-c:v", "libx264", "-preset", "ultrafast", "-crf", "27",
        "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart"
      ]
    : [
        "-map", "0:a:0",
        "-vn",
        ...(outputFormat === "MP3"
          ? ["-c:a", "libmp3lame", "-b:a", "192k"]
          : ["-c:a", "pcm_s16le", "-ar", "44100", "-ac", "2"])
      ];

  try {
    showMessage("Preparing video for conversion…");
    await engine.writeFile(inputPath, new Uint8Array(await file.arrayBuffer()));
    if (outputFormat !== "MP4") {
      showMessage("Checking for an audio track…");
      const audioCheck = await engine.exec(["-i", inputPath, "-map", "0:a:0", "-frames:a", "1", "-f", "null", "-"]);
      if (audioCheck !== 0) {
        throw new Error("This video does not contain an audio track to extract.");
      }
    }
    showMessage("Converting video… 0%");
    const exitCode = await engine.exec([
      "-i", inputPath,
      ...outputOptions,
      "-threads", "4",
      outputPath
    ]);
    if (exitCode !== 0) {
      throw new Error(`FFmpeg could not convert this video to ${outputFormat}. Try another input or output format.`);
    }
    const validationCode = await engine.exec(["-v", "error", "-i", outputPath, "-f", "null", "-"]);
    if (validationCode !== 0) {
      throw new Error(`FFmpeg created a ${outputFormat} file that it could not validate. Try another output format or input video.`);
    }
    const output = await engine.readFile(outputPath);
    showMessage("Preparing your converted video…");
    const mimeType = outputFormat === "MP4" ? "video/mp4" : outputFormat === "MP3" ? "audio/mpeg" : "audio/wav";
    return new Blob([output], { type: mimeType });
  } finally {
    await Promise.all(
      [inputPath, outputPath].map((path) => engine.deleteFile(path).catch(() => undefined))
    );
  }
}
