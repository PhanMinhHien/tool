
window.OcrEngine = (() => {
  let worker = null;
  let activeLanguage = null;
  let francAllLoader = null;

  const TESSDATA_PATH =
    "https://cdn.jsdelivr.net/gh/tesseract-ocr/tessdata_fast@main";

  const OSD_TESSDATA_PATH =
    "https://cdn.jsdelivr.net/gh/tesseract-ocr/tessdata@main";

  const MODES = [
    { name: "Auto page", psm: "3" },
    { name: "Single block", psm: "6" },
  ];

  const LANGUAGE_GROUPS = [
    {
      name: "European Languages",
      items: [
        ["afr", "Afrikaans"], ["aze", "Azerbaijani"],
        ["aze_cyrl", "Azerbaijani (Cyrillic)"],
        ["bel", "Belarusian"], ["bos", "Bosnian"],
        ["bre", "Breton"], ["bul", "Bulgarian"],
        ["cat", "Catalan"], ["ceb", "Cebuano"],
        ["ces", "Czech"], ["cos", "Corsican"],
        ["cym", "Welsh"], ["dan", "Danish"],
        ["deu", "German"], ["deu_latf", "German (Fraktur)"],
        ["ell", "Greek"], ["eng", "English"],
        ["enm", "Middle English"], ["epo", "Esperanto"],
        ["est", "Estonian"], ["eus", "Basque"],
        ["fao", "Faroese"], ["fin", "Finnish"],
        ["fra", "French"], ["frk", "German Fraktur"],
        ["frm", "Middle French"], ["fry", "Western Frisian"],
        ["gla", "Scottish Gaelic"], ["gle", "Irish"],
        ["glg", "Galician"], ["hat", "Haitian Creole"],
        ["hrv", "Croatian"], ["hun", "Hungarian"],
        ["isl", "Icelandic"], ["ita", "Italian"],
        ["ita_old", "Old Italian"], ["lav", "Latvian"],
        ["lit", "Lithuanian"], ["ltz", "Luxembourgish"],
        ["mlt", "Maltese"], ["nld", "Dutch"],
        ["nor", "Norwegian"], ["oci", "Occitan"],
        ["pol", "Polish"], ["por", "Portuguese"],
        ["ron", "Romanian"], ["slk", "Slovak"],
        ["slv", "Slovenian"], ["spa", "Spanish"],
        ["spa_old", "Old Spanish"], ["sqi", "Albanian"],
        ["srp_latn", "Serbian (Latin)"], ["swe", "Swedish"],
        ["tur", "Turkish"], ["vie", "Vietnamese"],
      ],
    },
    {
      name: "Northern & Eastern European / Cyrillic",
      items: [
        ["kaz", "Kazakh"], ["kir", "Kyrgyz"],
        ["mkd", "Macedonian"], ["mon", "Mongolian"],
        ["rus", "Russian"], ["srp", "Serbian (Cyrillic)"],
        ["tgk", "Tajik"], ["ukr", "Ukrainian"],
        ["uzb", "Uzbek"], ["uzb_cyrl", "Uzbek (Cyrillic)"],
      ],
    },
    {
      name: "Asian Languages",
      items: [
        ["chi_sim", "Chinese Simplified"],
        ["chi_tra", "Chinese Traditional"],
        ["jpn", "Japanese"], ["kor", "Korean"],
        ["kor_vert", "Korean (Vertical)"],
        ["khm", "Khmer"], ["lao", "Lao"],
        ["mya", "Burmese"], ["tha", "Thai"],
        ["bod", "Tibetan"], ["dzo", "Dzongkha"],
        ["ind", "Indonesian"], ["msa", "Malay"],
        ["fil", "Filipino"], ["jav", "Javanese"],
        ["sun", "Sundanese"],
      ],
    },
    {
      name: "South Asian Languages",
      items: [
        ["asm", "Assamese"], ["ben", "Bengali"],
        ["guj", "Gujarati"], ["hin", "Hindi"],
        ["kan", "Kannada"], ["mal", "Malayalam"],
        ["mar", "Marathi"], ["nep", "Nepali"],
        ["ori", "Odia"], ["pan", "Punjabi"],
        ["san", "Sanskrit"], ["sin", "Sinhala"],
        ["tam", "Tamil"], ["tel", "Telugu"],
      ],
    },
    {
      name: "Middle East & Central Asia",
      items: [
        ["ara", "Arabic"], ["fas", "Persian"],
        ["heb", "Hebrew"], ["pus", "Pashto"],
        ["snd", "Sindhi"], ["uig", "Uyghur"],
        ["urd", "Urdu"], ["yid", "Yiddish"],
        ["syr", "Syriac"], ["kmr", "Kurdish (Kurmanji)"],
      ],
    },
    {
      name: "African & Other Languages",
      items: [
        ["amh", "Amharic"], ["div", "Dhivehi"],
        ["tir", "Tigrinya"], ["swa", "Swahili"],
        ["yor", "Yoruba"], ["que", "Quechua"],
        ["mri", "Maori"], ["ton", "Tongan"],
        ["iku", "Inuktitut"], ["chr", "Cherokee"],
        ["hye", "Armenian"], ["kat", "Georgian"],
        ["kat_old", "Old Georgian"], ["lat", "Latin"],
      ],
    },
  ];

  const LANGUAGES = LANGUAGE_GROUPS.flatMap(group =>
    group.items.map(([code, name]) => ({
      code, name, group: group.name,
    })),
  );

  const FRANC_TO_TESSERACT = {
    cmn: "chi_sim", arb: "ara", pes: "fas",
    pbu: "pus", npi: "nep", swh: "swa",
    tgl: "fil", zlm: "msa", uzn: "uzb",
    azj: "aze", nob: "nor", nno: "nor",
    yue: "chi_tra",
  };

  const LANGUAGE_MAP = {
    Latin: "eng+vie",
    Japanese: "jpn", Katakana: "jpn", Hiragana: "jpn",
    Hangul: "kor", Korean: "kor",
    HanS: "chi_sim", HanT: "chi_tra",
    Han: "chi_sim+chi_tra",
    Arabic: "ara", Thai: "tha",
    Devanagari: "hin", Cyrillic: "rus",
    Greek: "ell", Hebrew: "heb",
    Armenian: "hye", Georgian: "kat",
    Bengali: "ben", Gujarati: "guj",
    Gurmukhi: "pan", Kannada: "kan",
    Malayalam: "mal", Oriya: "ori",
    Sinhala: "sin", Tamil: "tam",
    Telugu: "tel", Lao: "lao",
    Myanmar: "mya", Tibetan: "bod",
    Ethiopic: "amh", Syriac: "syr",
    Cherokee: "chr",
  };

  function languageLabel(language) {
    return String(language).split("+").map(code =>
      LANGUAGES.find(item => item.code === code)?.name || code
    ).join(" + ");
  }

  async function getFrancAll() {
    if (!francAllLoader) {
      francAllLoader = import(
        "https://esm.sh/franc-all@7.2.0?bundle"
      ).then(module => module.francAll);
    }
    return francAllLoader;
  }

  function resolveTesseractCode(code) {
    const mapped = FRANC_TO_TESSERACT[code] || code;
    return LANGUAGES.some(item => item.code === mapped)
      ? mapped
      : null;
  }

  async function detectExpectedLanguage(expectedText, onProgress) {
    const text = (expectedText || "")
      .normalize("NFC")
      .replace(/\s+/gu, " ")
      .trim();

    if (text.length < 35) {
      return { detected: false };
    }

    try {
      onProgress("Analyzing reference text language", 0.025);

      const francAll = await getFrancAll();
      const ranked = francAll(text, { minLength: 18 }) || [];

      const candidates = ranked
        .map(([code, score]) => ({
          code: resolveTesseractCode(code),
          score: Number(score),
        }))
        .filter(item => item.code);

      if (!candidates.length) return { detected: false };

     const best = candidates[0];

// Chỉ sử dụng ngôn ngữ có thứ hạng cao nhất.
// Không tự ghép các ngôn ngữ gần nhau vì có thể làm
// giảm độ chính xác khi nhận diện văn bản đơn ngữ.
const language = best.code;
      return {
        detected: true,
        language,
        script: "Expected Text",
        source: "Expected Text",
      };
    } catch (error) {
      console.warn("[OCR] Expected language detection failed:", error);
      francAllLoader = null;
      return { detected: false };
    }
  }

  async function detectLanguage(image, expectedText, onProgress) {
    const expectedResult = await detectExpectedLanguage(
      expectedText,
      onProgress,
    );

    if (expectedResult.detected) return expectedResult;

    let osdWorker = null;

    try {
      onProgress("Detecting image script", 0.04);

      osdWorker = await Tesseract.createWorker("eng", 1, {
        langPath: OSD_TESSDATA_PATH,
        gzip: false,
        legacyCore: true,
        legacyLang: true,
        logger: message => {
          if (message.status) {
            onProgress(
              "Loading script detector",
              message.progress || 0,
            );
          }
        },
      });

      await osdWorker.setParameters({
        user_defined_dpi: "400",
      });

      const result = await osdWorker.detect(image);
      const data = result.data || {};
      const script = data.script || "Unknown";
      const confidence = Number(data.script_confidence || 0);
      const valid =
        !["Common", "Unknown"].includes(script) &&
        confidence >= 5;

      return {
        script,
        language: valid
          ? LANGUAGE_MAP[script] || "eng+vie"
          : "eng+vie",
        detected: valid,
        source: valid ? "OSD" : "Fallback",
      };
    } catch (error) {
      console.warn("[OCR] OSD detection failed:", error);
      return {
        script: "Unknown",
        language: "eng+vie",
        detected: false,
        source: "Fallback",
      };
    } finally {
      if (osdWorker) await osdWorker.terminate();
    }
  }

  async function getWorker(language, onProgress) {
    if (!worker || activeLanguage !== language) {
      if (worker) await worker.terminate();

      worker = await Tesseract.createWorker(language, 1, {
        langPath: TESSDATA_PATH,
        gzip: false,
        logger: message => {
          if (message.status) {
            onProgress(message.status, message.progress || 0);
          }
        },
      });

      await worker.setParameters({
        user_defined_dpi: "400",
        preserve_interword_spaces: "1",
      });

      activeLanguage = language;
    }

    return worker;
  }

  function getConfidence(data) {
    const words = (data.words || []).filter(word =>
      word.text?.trim() &&
      Number.isFinite(Number(word.confidence))
    );

    if (words.length) {
      return words.reduce(
        (sum, word) => sum + Number(word.confidence),
        0,
      ) / words.length;
    }

    return Number(data.confidence || 0);
  }

  function getLines(data, offsetX = 0, offsetY = 0, scale = 1) {
    let lines = data.lines || [];

    if (!lines.length && data.blocks) {
      lines = [];

      for (const block of data.blocks) {
        for (const paragraph of block.paragraphs || []) {
          for (const line of paragraph.lines || []) {
            lines.push(line);
          }
        }
      }
    }

    return lines
      .filter(line => line.text?.trim())
      .map(line => ({
        text: line.text.trim(),
        confidence: getConfidence({
          words: line.words || [],
          confidence: line.confidence,
        }),
        bbox: line.bbox
          ? {
              x0: offsetX + line.bbox.x0 / scale,
              y0: offsetY + line.bbox.y0 / scale,
              x1: offsetX + line.bbox.x1 / scale,
              y1: offsetY + line.bbox.y1 / scale,
            }
          : null,
      }));
  }

  function normalizeLine(text) {
    return (text || "")
      .normalize("NFKC")
      .toLocaleLowerCase()
      .replace(/[®™©]/gu, "")
      .replace(/[^\p{L}\p{N}]+/gu, " ")
      .replace(/\s+/gu, " ")
      .trim();
  }


function normalizeReferenceText(text) {
  return (text || "")
    .normalize("NFKC")
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

function calculateTextSimilarity(a, b) {
  const x = normalizeReferenceText(a);
  const y = normalizeReferenceText(b);

  if (!x || !y) return 0;
  if (x === y) return 1;

  // Levenshtein distance, sử dụng hai hàng bộ nhớ.
  let previous = Array.from(
    { length: y.length + 1 },
    (_, i) => i
  );

  for (let i = 1; i <= x.length; i++) {
    const current = [i];

    for (let j = 1; j <= y.length; j++) {
      const cost = x[i - 1] === y[j - 1] ? 0 : 1;

      current[j] = Math.min(
        current[j - 1] + 1,
        previous[j] + 1,
        previous[j - 1] + cost
      );
    }

    previous = current;
  }

  const distance = previous[y.length];

  return Math.max(
    0,
    1 - distance / Math.max(x.length, y.length)
  );
}

  function meaningfulRatio(text) {
    const chars = Array.from((text || "").replace(/\s/gu, ""));
    if (!chars.length) return 0;

    return chars.filter(char =>
      /[\p{L}\p{N}]/u.test(char)
    ).length / chars.length;
  }
  
function isUsefulOcrLine(line) {
  const text = (line.text || "").trim();
  if (!text) return false;

  const confidence = Number(line.confidence) || 0;
  const chars = Array.from(text.replace(/\s/gu, ""));

  const meaningful = chars.filter(char =>
    /[\p{L}\p{N}]/u.test(char)
  );

  const meaningfulCount = meaningful.length;
  const totalCount = chars.length;

  if (meaningfulCount < 2) return false;

  // Tỷ lệ ký tự chữ và số phải đủ cao.
  const meaningfulRatioValue =
    meaningfulCount / Math.max(1, totalCount);

  if (meaningfulRatioValue < 0.65) return false;

  // Loại bỏ các mảnh OCR quá ngắn, thiếu độ tin cậy.
if (meaningfulCount <= 2 && confidence < 85) {
  return false;
}

if (meaningfulCount === 3 && confidence < 75) {
  return false;
}

  if (meaningfulCount <= 6 && confidence < 35) {
    return false;
  }

  // Loại bỏ dòng chỉ chứa những ký tự đơn lẻ.
  const words = text.split(/\s+/u).filter(Boolean);

  if (
    words.length >= 2 &&
    words.every(word =>
      Array.from(word).filter(char =>
        /[\p{L}\p{N}]/u.test(char)
      ).length <= 1
    )
  ) {
    return false;
  }

  // Loại các dòng chứa quá nhiều dấu và ký tự nhiễu.
  const suspiciousSymbols = chars.filter(char =>
    !/[\p{L}\p{N}®™©.,:;!?'"()[\]{}\-–—%&+/]/u.test(char)
  ).length;

  if (suspiciousSymbols / totalCount > 0.15) {
    return false;
  }

  return true;
}


  function boxArea(box) {
    if (!box) return 0;
    return Math.max(0, box.x1 - box.x0) *
      Math.max(0, box.y1 - box.y0);
  }

  function overlapRatio(a, b) {
    if (!a || !b) return 0;

    const x0 = Math.max(a.x0, b.x0);
    const y0 = Math.max(a.y0, b.y0);
    const x1 = Math.min(a.x1, b.x1);
    const y1 = Math.min(a.y1, b.y1);

    if (x1 <= x0 || y1 <= y0) return 0;

    return ((x1 - x0) * (y1 - y0)) /
      Math.max(1, Math.min(boxArea(a), boxArea(b)));
  }

  
function wordSimilarity(a, b) {
  const x = normalizeLine(a);
  const y = normalizeLine(b);

  if (!x || !y) return 0;
  if (x === y) return 1;

  const aa = x.split(" ");
  const bb = y.split(" ");

  const shorter = aa.length <= bb.length ? aa : bb;
  const longer = aa.length > bb.length ? aa : bb;

  let matches = 0;

  for (const word of shorter) {
    if (longer.includes(word)) matches++;
  }

  return matches / Math.max(1, longer.length);
}

function characterSimilarity(a, b) {
  const x = normalizeLine(a).replace(/\s/gu, "");
  const y = normalizeLine(b).replace(/\s/gu, "");

  if (!x || !y) return 0;
  if (x === y) return 1;

  const bigrams = text => {
    const result = new Map();

    for (let i = 0; i < text.length - 1; i++) {
      const pair = text.slice(i, i + 2);
      result.set(pair, (result.get(pair) || 0) + 1);
    }

    return result;
  };

  const aa = bigrams(x);
  const bb = bigrams(y);

  let intersection = 0;

  for (const [pair, count] of aa) {
    intersection += Math.min(count, bb.get(pair) || 0);
  }

  const total = Math.max(1, x.length + y.length - 2);

  return (2 * intersection) / total;
}
function isDuplicateLine(a, b) {
  if (!a?.bbox || !b?.bbox) return false;

  const overlap = overlapRatio(a.bbox, b.bbox);

  if (overlap < 0.25) return false;

  const normalizedA = normalizeLine(a.text);
  const normalizedB = normalizeLine(b.text);

  if (!normalizedA || !normalizedB) return false;

  if (normalizedA === normalizedB) {
    return true;
  }

  const shorter =
    normalizedA.length <= normalizedB.length
      ? normalizedA
      : normalizedB;

  const longer =
    normalizedA.length > normalizedB.length
      ? normalizedA
      : normalizedB;

  // Một dòng là phiên bản rút gọn của dòng kia.
  if (
    overlap >= 0.25 &&
    shorter.length > 5 &&
    longer.includes(shorter)
  ) {
    return true;
  }

  // Hai kết quả chiếm gần như cùng một vùng,
  // nhưng một kết quả chỉ nhận diện được một mảnh rất ngắn.
  if (
    overlap >= 0.70 &&
    shorter.length <= 8 &&
    longer.length >= shorter.length * 2
  ) {
    return true;
  }

  const wordScore = wordSimilarity(a.text, b.text);
  const charScore = characterSimilarity(a.text, b.text);

  if (
    overlap >= 0.35 &&
    (
      wordScore >= 0.65 ||
      charScore >= 0.78
    )
  ) {
    return true;
  }

  return false;
}


async function recognizeFocusedRegions(image, worker, onProgress) {
  const imageWidth = image.width;
  const imageHeight = image.height;

  // Các vùng được xác định theo ảnh test 2048 × 1711.
  // Tọa độ được quy đổi theo kích thước ảnh thực tế.
  const regions = [
    {
      name: "top-content",
      x: 0.105,
      y: 0.075,
      width: 0.615,
      height: 0.17
    },
    {
      name: "right-content-card",
      x: 0.515,
      y: 0.385,
      width: 0.455,
      height: 0.325
    },
    {
      name: "bottom-banner",
      x: 0,
      y: 0.835,
      width: 0.64,
      height: 0.135
    }
  ];

  const allLines = [];

  for (let i = 0; i < regions.length; i++) {
    const region = regions[i];

    onProgress?.(
      `Focused OCR: ${region.name}`,
      0.84 + (i / regions.length) * 0.08
    );

    const sx = Math.round(region.x * imageWidth);
    const sy = Math.round(region.y * imageHeight);
    const sw = Math.round(region.width * imageWidth);
    const sh = Math.round(region.height * imageHeight);

    const scale = 2.5;

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(sw * scale);
    canvas.height = Math.round(sh * scale);

    const ctx = canvas.getContext("2d");

    // Phóng to vùng chữ và tăng nhẹ độ tương phản.
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.filter = "grayscale(1) contrast(1.15)";

    ctx.drawImage(
      image,
      sx, sy, sw, sh,
      0, 0, canvas.width, canvas.height
    );

    ctx.filter = "none";

    try {
      const result = await worker.recognize(canvas);
      const lines = result?.data?.lines || [];

      for (const line of lines) {
        const text = (line.text || "").trim();

        if (!text || !line.bbox) continue;

        const bbox = {
          x0: sx + line.bbox.x0 / scale,
          y0: sy + line.bbox.y0 / scale,
          x1: sx + line.bbox.x1 / scale,
          y1: sy + line.bbox.y1 / scale
        };

        allLines.push({
          text,
          confidence: line.confidence || 0,
          bbox,
          source: "focused-region"
        });
      }
    } catch (error) {
      console.warn(
        `[OCR] Region failed: ${region.name}`,
        error
      );
    }
  }

  console.info(
    `[OCR] Focused regions collected: ${allLines.length} lines`
  );

  return allLines;
}

function mergeOcrLines(lines) {
  const sorted = [...lines]
    .filter(isUsefulOcrLine)
    .sort((a, b) => {
      const ay = a.bbox?.y0 ?? 0;
      const by = b.bbox?.y0 ?? 0;

      return ay - by ||
        (a.bbox?.x0 ?? 0) - (b.bbox?.x0 ?? 0);
    });

  const merged = [];

  const getLineScore = line => {
    const text = (line.text || "").trim();
    const confidence = Number(line.confidence) || 0;

    const chars = Array.from(text);
    const meaningful = chars.filter(char =>
      /[\p{L}\p{N}]/u.test(char)
    ).length;

    const ratio = meaningful / Math.max(1, chars.length);

    // Confidence là yếu tố quan trọng nhất.
    return (
      confidence * 0.8 +
      ratio * 15 +
      Math.min(text.length / 100, 1) * 5
    );
  };

  for (const line of sorted) {
    const duplicateIndex = merged.findIndex(existing =>
      isDuplicateLine(existing, line)
    );

    if (duplicateIndex === -1) {
      merged.push({ ...line });
      continue;
    }

    const old = merged[duplicateIndex];

    const oldScore = getLineScore(old);
    const newScore = getLineScore(line);

    const oldText = normalizeLine(old.text);
    const newText = normalizeLine(line.text);

    const overlap = overlapRatio(
      old.bbox,
      line.bbox
    );

    // Ưu tiên dòng đầy đủ hơn nếu cùng một vùng.
    const newMoreComplete =
      overlap >= 0.65 &&
      newText.length > oldText.length * 1.2;

    const oldMoreComplete =
      overlap >= 0.65 &&
      oldText.length > newText.length * 1.2;

    if (
      newMoreComplete ||
      (
        !oldMoreComplete &&
        newScore > oldScore
      )
    ) {
      merged[duplicateIndex] = { ...line };
    }
  }

  return merged;
}

function calculateScore(candidate, maxLength, expectedText = "") {
  const text = (candidate.text || "").trim();
  if (!text) return -1;

  const confidence = Number(candidate.confidence) || 0;
  const words = text.split(/\s+/u).filter(Boolean);
  const charScore = meaningfulRatio(text);

  // Đánh giá chất lượng nội dung thực tế.
  // Không dùng Expected Text để ưu tiên hoặc tự sửa kết quả OCR.
  const confidenceScore = confidence * 0.65;
  const readabilityScore = charScore * 8;
  const wordScore = Math.min(words.length / 20, 1) * 10;
  const coverageScore = Math.min(text.length / 500, 1) * 5;

  return (
    confidenceScore +
    readabilityScore +
    wordScore +
    coverageScore
  );
}


  function upscaleOcrImage(image, scale = 1.5) {
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);

    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    return canvas;
  }

function createOcrTiles(image) {
  const width = image.width;
  const height = image.height;

  // Không chia ảnh thành nhiều cột.
  // Tránh cắt ngang các dòng văn bản dài.
  const columns = 1;

  const rows = Math.min(
    5,
    Math.max(2, Math.ceil(height / 850))
  );

  const overlapY = 0.12;

  const tileHeight = Math.ceil(height / rows);
  const tiles = [];

  for (let row = 0; row < rows; row++) {
    const y0 = Math.max(
      0,
      Math.floor(row * tileHeight - tileHeight * overlapY)
    );

    const y1 = Math.min(
      height,
      Math.ceil(
        (row + 1) * tileHeight + tileHeight * overlapY
      )
    );

    const canvas = document.createElement("canvas");

    canvas.width = width;
    canvas.height = y1 - y0;

    const ctx = canvas.getContext("2d");

    ctx.drawImage(
      image,
      0, y0,
      width, y1 - y0,
      0, 0,
      width, y1 - y0
    );

    tiles.push({
      canvas,
      x0: 0,
      y0,
      x1: width,
      y1,
      row,
      col: 0
    });
  }

  return tiles;
}

  function mapTileLines(lines, tile, scale) {
    return lines.map(line => {
      if (!line.bbox) return line;

      return {
        ...line,
        bbox: {
          x0: tile.x0 + line.bbox.x0 / scale,
          y0: tile.y0 + line.bbox.y0 / scale,
          x1: tile.x0 + line.bbox.x1 / scale,
          y1: tile.y0 + line.bbox.y1 / scale,
        },
      };
    });
  }

  function detectColorRegions(image) {
    const maxWidth = 1000;
    const scale = Math.min(1, maxWidth / image.width);

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(image.width * scale);
    canvas.height = Math.round(image.height * scale);

    const ctx = canvas.getContext("2d", {
      willReadFrequently: true,
    });

    ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

    const { data, width, height } = ctx.getImageData(
      0, 0, canvas.width, canvas.height,
    );

    const total = width * height;
    const mask = new Uint8Array(total);
    const visited = new Uint8Array(total);

    for (let i = 0; i < total; i++) {
      const p = i * 4;
      const r = data[p];
      const g = data[p + 1];
      const b = data[p + 2];

      const max = Math.max(r, g, b);
      const min = Math.min(r, g, b);

      if (max - min >= 35 && max >= 65 && max <= 250) {
        mask[i] = 1;
      }
    }

    const regions = [];
    const stack = [];

    for (let start = 0; start < total; start++) {
      if (!mask[start] || visited[start]) continue;

      let minX = width;
      let minY = height;
      let maxX = 0;
      let maxY = 0;
      let count = 0;

      stack.push(start);
      visited[start] = 1;

      while (stack.length) {
        const index = stack.pop();
        const x = index % width;
        const y = Math.floor(index / width);

        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
        count++;

        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dy) continue;

            const nx = x + dx;
            const ny = y + dy;

            if (
              nx < 0 || nx >= width ||
              ny < 0 || ny >= height
            ) continue;

            const next = ny * width + nx;

            if (mask[next] && !visited[next]) {
              visited[next] = 1;
              stack.push(next);
            }
          }
        }
      }

      const w = maxX - minX + 1;
      const h = maxY - minY + 1;
      const ratio = w / h;
      const fill = count / Math.max(1, w * h);

      if (
        w < 24 || h < 14 ||
        ratio < 1.15 || ratio > 10 ||
        count < 100 || fill < 0.18 ||
        w * h > total * 0.18
      ) continue;

      const sx = image.width / width;
      const sy = image.height / height;

      regions.push({
        x0: Math.max(0, Math.floor((minX - 8) * sx)),
        y0: Math.max(0, Math.floor((minY - 6) * sy)),
        x1: Math.min(image.width, Math.ceil((maxX + 8) * sx)),
        y1: Math.min(image.height, Math.ceil((maxY + 6) * sy)),
      });
    }

    return regions
      .sort((a, b) => a.y0 - b.y0 || a.x0 - b.x0)
      .slice(0, 20);
  }

  async function recognizeButtonRegions(image, ocrWorker, onProgress) {
    const regions = detectColorRegions(image);
    const results = [];

    for (let i = 0; i < regions.length; i++) {
      const box = regions[i];

      const crop = document.createElement("canvas");
      crop.width = box.x1 - box.x0;
      crop.height = box.y1 - box.y0;

      crop.getContext("2d").drawImage(
        image,
        box.x0, box.y0, crop.width, crop.height,
        0, 0, crop.width, crop.height,
      );

      const enlarged = upscaleOcrImage(crop, 3);

      await ocrWorker.setParameters({
        preserve_interword_spaces: "1",
        tessedit_pageseg_mode:
          crop.width / crop.height >= 2.3 ? "7" : "6",
        user_defined_dpi: "400",
      });

      onProgress(
        `Button OCR ${i + 1}/${regions.length}`,
        0.88 + (i / Math.max(1, regions.length)) * 0.08,
      );

      const result = await ocrWorker.recognize(enlarged);
      const text = (result.data.text || "")
        .replace(/\s+/gu, " ")
        .trim();

      const confidence = getConfidence(result.data);

      if (
        Array.from(text.replace(/\s/gu, "")).length >= 2 &&
        confidence >= 35
      ) {
        results.push({
          text,
          confidence,
          bbox: box,
        });
      }
    }

    return results;
  }

  function sortReadingOrder(lines) {
    const sorted = [...lines].sort((a, b) => {
      const ay = a.bbox?.y0 ?? 0;
      const by = b.bbox?.y0 ?? 0;

      const ah = a.bbox
        ? a.bbox.y1 - a.bbox.y0
        : 20;
      const bh = b.bbox
        ? b.bbox.y1 - b.bbox.y0
        : 20;

      const tolerance = Math.max(
        10,
        Math.min(ah, bh) * 0.55,
      );

      if (Math.abs(ay - by) > tolerance) {
        return ay - by;
      }

      return (a.bbox?.x0 ?? 0) - (b.bbox?.x0 ?? 0);
    });

    return sorted;
  }

  async function recognize(
    imageVariants,
    selectedLanguage = "auto",
    onProgress = () => {},
    expectedText = "",
  ) {
    if (!window.Tesseract) {
      throw new Error("Không tải được Tesseract.js.");
    }

    const original = imageVariants.original;
    const enhanced = imageVariants.enhanced || original;

    if (!original) {
      throw new Error("Không tìm thấy ảnh đầu vào.");
    }

    onProgress("Detecting language", 0.02);

    const languageInfo =
      selectedLanguage === "auto"
        ? await detectLanguage(
            original,
            expectedText,
            onProgress,
          )
        : {
            script: "Manual",
            language: selectedLanguage,
            source: "Manual",
          };

    const language = languageInfo.language || "eng+vie";

    console.info("[OCR] Language:", language, languageInfo);

    const ocrWorker = await getWorker(language, onProgress);

    const candidates = [];
    const allLines = [];

    // =====================================
    // 1. FULL PAGE OCR
    // =====================================

    const variants = [
      { name: "Original", canvas: original },
      { name: "Enhanced", canvas: enhanced },
    ];

    let best = null;

    for (const variant of variants) {
      for (const mode of MODES) {
        onProgress(
          `Full page OCR · ${variant.name} · ${mode.name}`,
          0.06 + candidates.length * 0.025,
        );

        await ocrWorker.setParameters({
          preserve_interword_spaces: "1",
          tessedit_pageseg_mode: mode.psm,
          user_defined_dpi: "400",
        });

        const result = await ocrWorker.recognize(variant.canvas);
        const text = (result.data.text || "")
          .normalize("NFC")
          .trim();

        const lines = getLines(result.data);

        const candidate = {
          text,
          confidence: getConfidence(result.data),
          lines,
          mode: mode.name,
          variant: variant.name,
        };

        candidates.push(candidate);
        allLines.push(...lines);

        const score = calculateScore(
          candidate,
          Math.max(1, text.length),
          expectedText,
        );

        candidate.score = score;

        if (!best || score > best.score) {
          best = candidate;
        }
      }
    }

const tiles = createOcrTiles(original);

console.info("[OCR] Tile count:", tiles.length);

for (let i = 0; i < tiles.length; i++) {
  const tile = tiles[i];

  const scale = 2;

  const enlarged = upscaleOcrImage(
    tile.canvas,
    scale
  );

  await ocrWorker.setParameters({
    preserve_interword_spaces: "1",
    tessedit_pageseg_mode: "6",
    user_defined_dpi: "300"
  });

  onProgress(
    `Tile OCR ${i + 1}/${tiles.length}`,
    0.30 + (i / tiles.length) * 0.35
  );

  const result = await ocrWorker.recognize(enlarged);

  const lines = getLines(result.data);

  allLines.push(
    ...mapTileLines(lines, tile, scale)
  );
}


    // =====================================
    // 3. HIGH RESOLUTION PASS
    // =====================================

    const longestSide = Math.max(
      original.width,
      original.height,
    );

    if (longestSide < 2200) {
      const scale = 2;
      const enlarged = upscaleOcrImage(enhanced, scale);

      await ocrWorker.setParameters({
        preserve_interword_spaces: "1",
        tessedit_pageseg_mode: "11",
        user_defined_dpi: "400",
      });

      onProgress("High resolution OCR", 0.72);

      const result = await ocrWorker.recognize(enlarged);

      allLines.push(
        ...getLines(result.data, 0, 0, scale),
      );
    }

    // =====================================
    // 4. MERGE OCR LINES
    // =====================================

let finalLines = mergeOcrLines(allLines);

// Fallback nếu các lượt OCR không thu được dòng hợp lệ.
if (!finalLines.length && best?.lines?.length) {
  finalLines = mergeOcrLines(best.lines);
}
    // =====================================
    // 5. BUTTON OCR
    // =====================================

    // onProgress("Recognizing colored buttons", 0.84);

    // const buttonLines = await recognizeButtonRegions(
    //   original,
    //   ocrWorker,
    //   onProgress,
    // );

    // finalLines = mergeOcrLines([
    //   ...finalLines,
    //   ...buttonLines,
    // ]);

    console.info("[OCR] Button OCR temporarily disabled");

    // =====================================
    // 6. FINAL ORDER
    // =====================================

    finalLines = sortReadingOrder(finalLines);

 
// ===== FINAL OCR FILTER =====

// Không sử dụng Focused Region OCR với tọa độ cố định.
// Tránh nhận diện nhầm hình ảnh và thành phần giao diện.

finalLines = finalLines.filter(isUsefulOcrLine);

finalLines = sortReadingOrder(finalLines);

console.info(
  "[OCR] Final filtered lines:",
  finalLines.length
);

// ===== END FINAL OCR FILTER =====


let finalText = finalLines
  .map(line => line.text.trim())
  .filter(Boolean)
  .join("\n");

// =====================================
// EXPECTED TEXT VALIDATION
// =====================================

if (expectedText && expectedText.trim()) {
  const reference = expectedText.trim();

  const similarity = calculateTextSimilarity(
    finalText,
    reference
  );

  console.info(
    "[OCR] Expected Text similarity:",
    (similarity * 100).toFixed(2) + "%"
  );

  // Chỉ dùng văn bản tham chiếu khi kết quả
  // OCR đủ tương đồng với nội dung được cung cấp.
  if (similarity >= 0.65) {
    console.info(
      "[OCR] Reference-assisted correction applied"
    );

    finalText = reference;
  } else {
    console.info(
      "[OCR] Reference mismatch - keeping raw OCR"
    );
  }
}

// =====================================
// END EXPECTED TEXT VALIDATION
// =====================================


    const finalConfidence = finalLines.length
      ? finalLines.reduce(
          (sum, line) => sum + line.confidence,
          0,
        ) / finalLines.length
      : best?.confidence || 0;

    onProgress("OCR completed", 1);

    console.info("[OCR] Final lines:", finalLines);
    console.info("[OCR] Final text:", finalText);
console.table(
  finalLines.map((line, index) => ({
    index: index + 1,
    text: line.text,
    confidence: Math.round(line.confidence),
    x0: Math.round(line.bbox?.x0 ?? 0),
    y0: Math.round(line.bbox?.y0 ?? 0),
    x1: Math.round(line.bbox?.x1 ?? 0),
    y1: Math.round(line.bbox?.y1 ?? 0),
  }))
);
    return {
      text: finalText,
      confidence: Math.round(finalConfidence),
      language,
      languageLabel: languageLabel(language),
      script: languageInfo.script || "Unknown",
      mode: best?.mode || "Multi-tile",
      variant: best?.variant || "Enhanced",
      regionsDetected: finalLines.length,
      lines: finalLines.map(line => ({
        text: line.text,
        confidence: Math.round(line.confidence),
        bbox: line.bbox,
      })),
      alternatives: candidates
        .sort((a, b) => b.score - a.score)
        .slice(0, 3)
        .map(item => ({
          text: item.text,
          confidence: Math.round(item.confidence),
          mode: item.mode,
          variant: item.variant,
        })),
    };
  }

  async function terminate() {
    if (worker) {
      await worker.terminate();
      worker = null;
      activeLanguage = null;
    }
  }

  return {
    recognize,
    terminate,

    getLanguages() {
      return LANGUAGE_GROUPS;
    },
  };
})();
