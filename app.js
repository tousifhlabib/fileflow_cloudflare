const formatsByPage = {
  home: {
    image: ["PNG", "JPG", "WebP"],
    audio: ["MP3", "WAV"],
    video: ["MP4", "MP3", "WAV"],
    document: ["PDF", "DOCX", "XLSX", "CSV", "TXT"]
  },
  image: ["PNG", "JPG", "WebP"],
  audio: ["MP3", "WAV"],
  video: ["MP4", "MP3", "WAV"],
  document: ["PDF", "DOCX", "XLSX", "CSV", "TXT", "HTML"]
};

const imageMimeTypes = {
  PNG: "image/png",
  JPG: "image/jpeg",
  WebP: "image/webp"
};
const imageExtensions = {
  "image/png": "PNG",
  "image/jpeg": "JPG",
  "image/webp": "WebP"
};
const maxImageSize = 25 * 1024 * 1024;
const libraryUrls = {
  mammoth: "https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.9.0/mammoth.browser.min.js",
  pdfjs: "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js",
  xlsx: "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js",
  jspdf: "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
  docx: "https://unpkg.com/docx@8.5.0/build/index.umd.js",
  lamejs: "https://cdnjs.cloudflare.com/ajax/libs/lamejs/1.2.1/lame.min.js",
};
const libraryPromises = new Map();
const documentTargets = {
  pdf: ["TXT", "DOCX"],
  docx: ["TXT", "PDF", "HTML"],
  xlsx: ["CSV", "PDF", "TXT"],
  xls: ["CSV", "PDF", "TXT"],
  csv: ["XLSX", "PDF", "TXT"],
  txt: ["DOCX", "PDF", "HTML"]
};

const loadLibrary = (name) => {
  const globals = {
    mammoth: () => window.mammoth,
    pdfjs: () => window.pdfjsLib,
    xlsx: () => window.XLSX,
    jspdf: () => window.jspdf?.jsPDF,
    docx: () => window.docx?.Document,
    lamejs: () => window.lamejs?.Mp3Encoder,
  };
  if (globals[name]()) return Promise.resolve();
  if (!libraryPromises.has(name)) {
    const promise = new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = libraryUrls[name];
      script.async = true;
      script.crossOrigin = "anonymous";
      script.onload = () => globals[name]()
        ? resolve()
        : reject(new Error(`The ${name} conversion library did not initialize.`));
      script.onerror = () => reject(new Error(`Could not load the ${name} conversion library. Check your internet connection and try again.`));
      document.head.append(script);
    });
    libraryPromises.set(name, promise);
    promise.catch(() => libraryPromises.delete(name));
  }
  return libraryPromises.get(name);
};

document.querySelectorAll(".menu-toggle").forEach((button) => {
  button.addEventListener("click", () => {
    const expanded = button.getAttribute("aria-expanded") === "true";
    button.setAttribute("aria-expanded", String(!expanded));
    document.querySelector(".main-nav")?.classList.toggle("is-open", !expanded);
  });
});

document.querySelectorAll("[data-converter]").forEach((converter) => {
  const page = converter.dataset.category || document.body.dataset.page || "home";
  const fileInput = converter.querySelector('input[type="file"]');
  const uploadZone = converter.querySelector(".upload-zone");
  const fileControls = converter.querySelector(".file-controls");
  const formatSelect = converter.querySelector(".format-select");
  const message = converter.querySelector(".conversion-message");
  const fileName = converter.querySelector(".selected-file-name");
  const fileSize = converter.querySelector(".selected-file-size");
  const convertButton = converter.querySelector(".convert-button");
  let selectedFile;
  const formats = page === "home" ? Object.values(formatsByPage).flat() : formatsByPage[page];

  if (!fileInput || !uploadZone || !fileControls || !formatSelect || !message || !fileName || !fileSize || !convertButton || !formats) return;
  const pageHints = {
    audio: {
      accept: "audio/*",
      private: "Processed on your device",
      upload: "Browser-supported audio · MP3, WAV, M4A, AAC, OGG, FLAC",
      footLeft: "♫ Export to MP3 or WAV",
      footRight: "MP3 encoder loads from a CDN",
      hero: "Convert browser-supported audio to MP3 or WAV. Your file is processed locally; supported input codecs depend on your browser.",
      note: "Audio files are decoded and re-encoded locally as WAV or MP3. Supported input codecs depend on your browser. MP3 encoding loads a small library from a CDN."
    },
    video: {
      accept: "video/*",
      private: "Processed on your device",
      upload: "MP4, MOV, WebM, MKV, AVI · Max 100 MB · Up to 10 minutes",
      footLeft: "▷ Export video or extract audio",
      footRight: "Processed on your device",
      hero: "Convert video to MP4 or extract its audio as MP3 or WAV, right in your browser.",
      converterHeading: "Convert video or extract its audio.",
      note: "Video conversion uses the multi-threaded FFmpeg WebAssembly engine locally in your browser. The first conversion downloads the engine (about 33 MB). Videos are limited to 100 MB and 10 minutes. MP4 output is scaled to fit within 1920×1080 without upscaling smaller videos. Audio exports as 192 kbps MP3 or 44.1 kHz stereo WAV; WAV files can be much larger. Requires the configured cross-origin isolation headers."
    },
    document: {
      accept: ".pdf,.docx,.xlsx,.xls,.csv,.txt",
      private: "Processed on your device",
      upload: "PDF, DOCX, XLSX, XLS, CSV, TXT · Internet required for conversion libraries",
      footLeft: "▤ PDF · DOCX · XLSX · CSV · TXT",
      footRight: "Files stay on your device",
      hero: "Convert common PDF, DOCX, XLSX, XLS, CSV, and TXT files to supported formats. Processing stays local; libraries load on demand.",
      note: "Supported conversions include PDF, DOCX, XLSX, XLS, CSV, and TXT pairs shown in the selector. Conversion libraries load from CDNs, so an internet connection is needed. Spreadsheet conversions use the first sheet; document exports focus on text and may not preserve layout, and scanned PDFs are not OCR-processed."
    }
  };
  if (pageHints[page]) {
    fileInput.accept = pageHints[page].accept;
    const privateNote = converter.closest(".category-converter")?.querySelector(".private-note");
    if (privateNote) privateNote.lastChild.textContent = pageHints[page].private;
    const uploadHint = converter.querySelector(".upload-hint");
    if (uploadHint) uploadHint.textContent = pageHints[page].upload;
    const converterFoot = converter.querySelector(".converter-foot");
    if (converterFoot) {
      const footItems = converterFoot.querySelectorAll("span");
      if (footItems[0]) footItems[0].textContent = pageHints[page].footLeft;
      if (footItems[1]) footItems[1].textContent = pageHints[page].footRight;
    }
    const heroDescription = document.querySelector(".category-hero-content > p");
    if (heroDescription) heroDescription.textContent = pageHints[page].hero;
    const converterHeading = converter.closest(".category-converter")?.querySelector(".section-heading h2");
    if (converterHeading && pageHints[page].converterHeading) converterHeading.textContent = pageHints[page].converterHeading;
    const detailNote = document.querySelector(".engine-note");
    if (detailNote) detailNote.textContent = pageHints[page].note;
  }

  const showMessage = (text, kind = "info") => {
    message.textContent = text;
    message.className = `conversion-message is-visible ${kind}`;
    message.hidden = false;
  };
  const clearMessage = () => {
    message.textContent = "";
    message.className = "conversion-message";
    message.hidden = true;
  };
  const getFileFormat = (file) => {
    const extension = file.name.split(".").pop()?.toLowerCase();
    return imageExtensions[file.type] || extension?.toUpperCase() || "";
  };
  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} bytes`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };
  const getFileCategory = (file) => {
    if (file.type.startsWith("image/") || /\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name)) return "image";
    if (file.type.startsWith("audio/") || /\.(mp3|wav|m4a|aac|ogg|flac)$/i.test(file.name)) return "audio";
    if (file.type.startsWith("video/") || /\.(mp4|mov|webm|avi|mkv)$/i.test(file.name)) return "video";
    if (/\.(pdf|docx?|xlsx?|csv|txt|html)$/i.test(file.name)) return "document";
    return null;
  };
  const documentOutputOptions = (file) => {
    const extension = file.name.split(".").pop()?.toLowerCase() || "";
    const targets = documentTargets[extension] || [];
    return targets.filter((format) => format !== extension.toUpperCase());
  };
  const getFormatsForFile = (file, category) => {
    if (category === "document") return documentOutputOptions(file);
    if (category === "audio") {
      const source = getFileFormat(file);
      return ["WAV", "MP3"].filter((format) => format !== source);
    }
    if (category === "video") {
      return ["MP4", "MP3", "WAV"];
    }
    return formatsByPage[category] || formats;
  };
  const getOutputExtension = (format) => format.toLowerCase() === "jpg" ? "jpg" : format.toLowerCase();
  const downloadBlob = (blob, filename) => {
    if (!blob || blob.size === 0) throw new Error("The conversion returned an empty file.");
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.append(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };
  const outputName = (file, format) => {
    const base = file.name.replace(/\.[^.]+$/, "") || "converted-file";
    return `${base}.${getOutputExtension(format)}`;
  };
  const setOptions = (options, sourceFormat, includeSource = false) => {
    formatSelect.replaceChildren(...options.map((format) => {
      const option = document.createElement("option");
      option.value = format;
      option.textContent = format;
      return option;
    }));
    const matchingOption = [...formatSelect.options].find((option) => option.value.toLowerCase() === sourceFormat.toLowerCase());
    if (!includeSource && matchingOption && formatSelect.options.length > 1) matchingOption.remove();
  };

  const setFile = (file) => {
    if (!file) return;
    selectedFile = file;
    clearMessage();
    fileName.textContent = file.name;
    fileSize.textContent = formatFileSize(file.size);
    const category = page === "home" ? getFileCategory(file) : page;
    const options = page === "home" && category ? getFormatsForFile(file, category) : getFormatsForFile(file, page);
    setOptions(options, getFileFormat(file), page === "video");

    uploadZone.hidden = true;
    fileControls.hidden = false;
    if (page === "home" && category !== "image") {
      convertButton.disabled = true;
      showMessage(category
        ? `The ${category} converter is on its own page. Open the ${category} guide to choose from the conversions supported in your browser.`
        : "We couldn't identify this file type. Choose an image to convert here, or explore the format guides.", "info");
      return;
    }
    if (page === "image" && (!file.type.startsWith("image/") && !/\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name))) {
      convertButton.disabled = true;
      showMessage("That file does not look like a supported image. Choose a PNG, JPG, WebP, GIF, or BMP image.", "error");
      return;
    }
    if ((page === "image" || (page === "home" && category === "image")) && file.size > maxImageSize) {
      convertButton.disabled = true;
      showMessage("This image is larger than the 25 MB limit. Choose a smaller image to continue.", "error");
      return;
    }
    if (page === "video" && file.size > 100 * 1024 * 1024) {
      convertButton.disabled = true;
      showMessage("This video is larger than the 100 MB limit. Choose a smaller video to continue.", "error");
      return;
    }
    if (page === "image" && !options.length) {
      convertButton.disabled = true;
      showMessage("Choose a PNG, JPG, or WebP image to convert.", "error");
      return;
    }
    if (!options.length) {
      convertButton.disabled = true;
      showMessage(page === "video"
        ? "This browser does not support video conversion for this file."
        : `There are no supported output formats for this ${page} file. Try a different source file.`,
      "error");
      return;
    }
    convertButton.disabled = false;
    if (page === "audio") showMessage("Audio is converted locally. Supported input codecs depend on your browser.", "info");
    if (page === "video") showMessage("Video conversion uses a multi-threaded FFmpeg engine in your browser. The first conversion downloads the engine.", "info");
    if (page === "document") showMessage("Your document stays on this device. Conversion libraries load from a CDN, so an internet connection is needed.", "info");
    if (page === "image" && /\.gif$/i.test(file.name)) showMessage("Animated GIF conversion uses the first frame only.", "info");
  };

  fileInput.addEventListener("change", () => setFile(fileInput.files?.[0]));
  converter.querySelector(".remove-file")?.addEventListener("click", () => {
    selectedFile = undefined;
    fileInput.value = "";
    fileControls.hidden = true;
    uploadZone.hidden = false;
    convertButton.disabled = false;
    clearMessage();
  });
  uploadZone.addEventListener("dragover", (event) => {
    event.preventDefault();
    uploadZone.classList.add("is-dragging");
  });
  uploadZone.addEventListener("dragleave", (event) => {
    if (!uploadZone.contains(event.relatedTarget)) uploadZone.classList.remove("is-dragging");
  });
  uploadZone.addEventListener("drop", (event) => {
    event.preventDefault();
    uploadZone.classList.remove("is-dragging");
    setFile(event.dataTransfer?.files[0]);
  });

  convertButton.addEventListener("click", async () => {
    const file = selectedFile;
    const outputFormat = formatSelect.value;
    if (!file || !outputFormat) return;

    const category = page === "home" ? getFileCategory(file) : page;
    if (category !== "image" && category !== "audio" && category !== "video" && category !== "document") {
      showMessage("We can't identify this file type yet.", "error");
      return;
    }
    if (page === "home" && category !== "image") {
      showMessage("Open the dedicated converter page to convert this file type.", "info");
      return;
    }
    if (category === "image" && file.size > maxImageSize) {
      showMessage("This image is larger than the 25 MB limit. Choose a smaller image to continue.", "error");
      return;
    }
    if (category === "video" && file.size > 100 * 1024 * 1024) {
      showMessage("This video is larger than the 100 MB limit. Choose a smaller video to continue.", "error");
      return;
    }

    convertButton.disabled = true;
    try {
      if (category === "image") {
        showMessage("Converting your image…");
        const blob = await convertImage(file, outputFormat);
        downloadBlob(blob, outputName(file, outputFormat));
      } else if (category === "audio") {
        showMessage(`Converting audio to ${outputFormat}…`);
        const blob = await convertAudio(file, outputFormat, showMessage);
        downloadBlob(blob, outputName(file, outputFormat));
      } else if (category === "video") {
        showMessage(`Converting video to ${outputFormat}…`);
        const { convertVideo } = await import("./video-converter.js");
        const blob = await convertVideo(file, outputFormat, showMessage);
        downloadBlob(blob, outputName(file, outputFormat));
      } else {
        showMessage(`Converting document to ${outputFormat}…`);
        const blob = await convertDocument(file, outputFormat);
        downloadBlob(blob, outputName(file, outputFormat));
      }
      showMessage(`Done! Your ${outputFormat} file has been downloaded.`, "success");
    } catch (error) {
      showMessage(error instanceof Error ? error.message : "We couldn't convert this file. Try another file or format.", "error");
    } finally {
      convertButton.disabled = false;
    }
  });
});

async function convertImage(file, outputFormat) {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error("The source image could not be decoded.");
  });
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is not available in this browser.");
    if (outputFormat === "JPG") {
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, canvas.width, canvas.height);
    }
    context.drawImage(bitmap, 0, 0);
    return await new Promise((resolve, reject) => {
      canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error("The browser could not create this image format.")), imageMimeTypes[outputFormat]);
    });
  } finally {
    bitmap.close();
  }
}

async function convertAudio(file, outputFormat, showMessage) {
  if (file.size > 100 * 1024 * 1024) throw new Error("Audio files must be 100 MB or smaller in this browser converter.");
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextClass) throw new Error("This browser does not support audio conversion.");
  const audioContext = new AudioContextClass();
  let decoded;
  try {
    const data = await file.arrayBuffer();
    decoded = await audioContext.decodeAudioData(data);
  } catch {
    throw new Error("This browser can't decode this audio file. Try an MP3, WAV, M4A, or another browser-supported audio format.");
  } finally {
    await audioContext.close();
  }
  if (decoded.duration > 30 * 60) throw new Error("Audio files must be 30 minutes or shorter in this browser converter.");
  if (outputFormat === "WAV") return encodeWav(decoded);
  if (outputFormat === "MP3") {
    showMessage("Loading the MP3 encoder…");
    await loadLibrary("lamejs");
    return encodeMp3(decoded);
  }
  throw new Error(`Audio export to ${outputFormat} is not supported.`);
}

function encodeWav(audioBuffer) {
  const channelCount = Math.min(audioBuffer.numberOfChannels, 2);
  const frameCount = audioBuffer.length;
  const bytesPerSample = 2;
  const blockAlign = channelCount * bytesPerSample;
  const dataLength = frameCount * blockAlign;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);
  const writeString = (offset, value) => [...value].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
  writeString(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, channelCount, true);
  view.setUint32(24, audioBuffer.sampleRate, true);
  view.setUint32(28, audioBuffer.sampleRate * blockAlign, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, dataLength, true);
  const channels = Array.from({ length: channelCount }, (_, channel) => audioBuffer.getChannelData(channel));
  let offset = 44;
  for (let frame = 0; frame < frameCount; frame++) {
    for (let channel = 0; channel < channelCount; channel++) {
      const sample = Math.max(-1, Math.min(1, channels[channel][frame]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7fff, true);
      offset += bytesPerSample;
    }
  }
  return new Blob([buffer], { type: "audio/wav" });
}

function encodeMp3(audioBuffer) {
  const Encoder = window.lamejs?.Mp3Encoder;
  if (!Encoder) throw new Error("The MP3 encoder could not be loaded.");
  const channels = Math.min(audioBuffer.numberOfChannels, 2);
  const encoder = new Encoder(channels, audioBuffer.sampleRate, 128);
  const channelData = Array.from({ length: channels }, (_, channel) => audioBuffer.getChannelData(channel));
  const sampleCount = audioBuffer.length;
  const chunkSize = 1152;
  const chunks = [];
  const left = new Int16Array(chunkSize);
  const right = channels === 2 ? new Int16Array(chunkSize) : null;
  const toInt16 = (value) => Math.max(-32768, Math.min(32767, Math.round(value * (value < 0 ? 32768 : 32767))));
  for (let start = 0; start < sampleCount; start += chunkSize) {
    const length = Math.min(chunkSize, sampleCount - start);
    for (let index = 0; index < length; index++) {
      left[index] = toInt16(channelData[0][start + index]);
      if (right) right[index] = toInt16(channelData[1][start + index]);
    }
    const encoded = channels === 2
      ? encoder.encodeBuffer(left.subarray(0, length), right.subarray(0, length))
      : encoder.encodeBuffer(left.subarray(0, length));
    if (encoded.length) chunks.push(encoded);
  }
  const finalChunk = encoder.flush();
  if (finalChunk.length) chunks.push(finalChunk);
  return new Blob(chunks, { type: "audio/mpeg" });
}

async function convertDocument(file, outputFormat) {
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  if (extension === "pdf") {
    await loadLibrary("pdfjs");
    const pdfjs = window.pdfjsLib;
    const workerResponse = await fetch("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js");
    if (!workerResponse.ok) throw new Error("Could not load the PDF processing worker.");
    pdfjs.GlobalWorkerOptions.workerSrc = URL.createObjectURL(new Blob([await workerResponse.text()], { type: "text/javascript" }));
    const document = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
    const pages = [];
    for (let pageNumber = 1; pageNumber <= document.numPages; pageNumber++) {
      const page = await document.getPage(pageNumber);
      const content = await page.getTextContent();
      pages.push(content.items.map((item) => item.str).join(" "));
    }
    const text = pages.join("\n\n");
    if (outputFormat === "TXT") return new Blob([text], { type: "text/plain;charset=utf-8" });
    if (outputFormat === "DOCX") return createDocx(text);
  }

  if (extension === "docx") {
    await loadLibrary("mammoth");
    const buffer = await file.arrayBuffer();
    if (outputFormat === "HTML") {
      const result = await window.mammoth.convertToHtml({ arrayBuffer: buffer });
      return new Blob([`<!doctype html><meta charset="utf-8"><article>${result.value}</article>`], { type: "text/html;charset=utf-8" });
    }
    const result = await window.mammoth.extractRawText({ arrayBuffer: buffer });
    if (outputFormat === "TXT") return new Blob([result.value], { type: "text/plain;charset=utf-8" });
    if (outputFormat === "PDF") return createPdf(result.value);
  }

  if (extension === "txt") {
    const text = await file.text();
    if (outputFormat === "DOCX") return createDocx(text);
    if (outputFormat === "PDF") return createPdf(text);
    if (outputFormat === "HTML") {
      const escaped = text.replace(/[&<>"]/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;" })[character]);
      return new Blob([`<!doctype html><meta charset="utf-8"><pre>${escaped}</pre>`], { type: "text/html;charset=utf-8" });
    }
  }

  if (extension === "csv" || extension === "xlsx" || extension === "xls") {
    await loadLibrary("xlsx");
    const XLSX = window.XLSX;
    const workbook = extension === "csv"
      ? XLSX.read(await file.text(), { type: "string" })
      : XLSX.read(await file.arrayBuffer(), { type: "array" });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    if (!firstSheet) throw new Error("This spreadsheet does not contain a worksheet.");
    if (outputFormat === "CSV") return new Blob([XLSX.utils.sheet_to_csv(firstSheet)], { type: "text/csv;charset=utf-8" });
    if (outputFormat === "TXT") return new Blob([XLSX.utils.sheet_to_csv(firstSheet, { FS: "\t" })], { type: "text/plain;charset=utf-8" });
    if (outputFormat === "XLSX") {
      const result = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(result, firstSheet, "Sheet1");
      return new Blob([XLSX.write(result, { bookType: "xlsx", type: "array" })], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
    }
    if (outputFormat === "PDF") return createPdf(XLSX.utils.sheet_to_csv(firstSheet));
  }

  throw new Error(`Conversion from ${extension.toUpperCase()} to ${outputFormat} is not supported in this browser converter.`);
}

async function createPdf(text) {
  await loadLibrary("jspdf");
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: "pt", format: "a4" });
  const margin = 42;
  const lineHeight = 15;
  const maxWidth = pdf.internal.pageSize.getWidth() - margin * 2;
  let y = margin;
  for (const line of text.split(/\r?\n/)) {
    const wrapped = pdf.splitTextToSize(line || " ", maxWidth);
    if (y + wrapped.length * lineHeight > pdf.internal.pageSize.getHeight() - margin) {
      pdf.addPage();
      y = margin;
    }
    pdf.text(wrapped, margin, y);
    y += wrapped.length * lineHeight;
  }
  return pdf.output("blob");
}

async function createDocx(text) {
  await loadLibrary("docx");
  const { Document, Paragraph, Packer, TextRun } = window.docx;
  const children = text.split(/\r?\n/).map((line) => new Paragraph({ children: [new TextRun(line)] }));
  const document = new Document({ sections: [{ children }] });
  return Packer.toBlob(document);
}
