
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
  let sourceLines = data.lines || [];

  // Fallback: lấy lines từ blocks nếu data.lines không có.
  if (!sourceLines.length && data.blocks) {
    sourceLines = [];

    for (const block of data.blocks) {
      for (const paragraph of block.paragraphs || []) {
        for (const line of paragraph.lines || []) {
          sourceLines.push(line);
        }
      }
    }
  }

  return sourceLines
    .filter(line => line.text?.trim())
    .map(line => {
      const words = (line.words || []).map(word => ({
        text: (word.text || "").trim(),
        confidence: Number(word.confidence || 0),

        bbox: word.bbox
          ? {
              x0: offsetX + word.bbox.x0 / scale,
              y0: offsetY + word.bbox.y0 / scale,
              x1: offsetX + word.bbox.x1 / scale,
              y1: offsetY + word.bbox.y1 / scale,
            }
          : null,
      }));

      return {
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

        words,
      };
    });
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

// =====================================
// TEXT VISUAL STYLE ANALYSIS
// =====================================

function getMedian(values) {
  const sorted = values
    .filter(Number.isFinite)
    .sort((a, b) => a - b);

  if (!sorted.length) return 0;

  const mid = Math.floor(sorted.length / 2);

  return sorted.length % 2
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}


function getLineHeight(line) {
  if (!line?.bbox) return 0;

  return Math.max(
    1,
    line.bbox.y1 - line.bbox.y0
  );
}


function estimateInkDensity(image, bbox) {
  if (!image || !bbox) return 0;

  try {
    const x0 = Math.max(0, Math.floor(bbox.x0));
    const y0 = Math.max(0, Math.floor(bbox.y0));

    const x1 = Math.min(
      image.width,
      Math.ceil(bbox.x1)
    );

    const y1 = Math.min(
      image.height,
      Math.ceil(bbox.y1)
    );

    const width = x1 - x0;
    const height = y1 - y0;

    if (width < 2 || height < 2) return 0;

    // Giảm kích thước để phân tích nhanh hơn.
    const scale = Math.min(
      1,
      180 / width,
      80 / height
    );

    const canvas = document.createElement("canvas");

    canvas.width = Math.max(1, Math.round(width * scale));
    canvas.height = Math.max(1, Math.round(height * scale));

    const ctx = canvas.getContext("2d", {
      willReadFrequently: true,
    });

    ctx.drawImage(
      image,
      x0,
      y0,
      width,
      height,
      0,
      0,
      canvas.width,
      canvas.height
    );

    const imageData = ctx.getImageData(
      0,
      0,
      canvas.width,
      canvas.height
    );

    const pixels = imageData.data;
    const w = canvas.width;
    const h = canvas.height;

    const luminance = (index) => {
      const r = pixels[index];
      const g = pixels[index + 1];
      const b = pixels[index + 2];

      return (
        0.299 * r +
        0.587 * g +
        0.114 * b
      );
    };

    // Lấy màu nền gần đường viền.
    const border = [];

    for (let x = 0; x < w; x += Math.max(1, Math.floor(w / 30))) {
      border.push(luminance((x * 4)));
      border.push(luminance(((h - 1) * w + x) * 4));
    }

    for (let y = 0; y < h; y += Math.max(1, Math.floor(h / 20))) {
      border.push(luminance((y * w) * 4));
      border.push(luminance((y * w + w - 1) * 4));
    }

    const background = getMedian(border);

    if (!background) return 0;

    let inkPixels = 0;
    let totalPixels = 0;

    const step = Math.max(
      1,
      Math.floor(Math.sqrt((w * h) / 5000))
    );

    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const index = (y * w + x) * 4;

        const value = luminance(index);

        if (Math.abs(value - background) >= 40) {
          inkPixels++;
        }

        totalPixels++;
      }
    }

    return inkPixels / Math.max(1, totalPixels);

  } catch (error) {
    console.warn("[OCR] Ink density analysis failed:", error);
    return 0;
  }
}


// =====================================
// ESTIMATE FONT SIZE AND WEIGHT
// =====================================

function analyzeTextStyles(lines, image) {
  const heights = lines
    .filter(line => line.bbox)
    .map(getLineHeight);

  const medianHeight = getMedian(heights) || 20;

  const enriched = lines.map(line => {
    const height = getLineHeight(line);

    const relativeSize = height / medianHeight;

    let fontSize = "medium";

    if (relativeSize >= 1.45) {
      fontSize = "large";
    } else if (relativeSize <= 0.70) {
      fontSize = "small";
    }

    return {
      ...line,

      style: {
        fontSizePx: Math.round(height),
        relativeSize,
        fontSize,

        inkDensity: estimateInkDensity(
          image,
          line.bbox
        ),

        weight: "normal",
      },
    };
  });

  // So sánh mật độ nét trong cùng nhóm kích thước.
  const sizeGroups = ["small", "medium", "large"];

  for (const size of sizeGroups) {
    const group = enriched.filter(
      line =>
        line.style.fontSize === size &&
        line.style.inkDensity > 0
    );

    const medianDensity = getMedian(
      group.map(line => line.style.inkDensity)
    );

    for (const line of group) {
      const density = line.style.inkDensity;

      // Đây là ước lượng tương đối, không phải font-weight thật.
      if (
        medianDensity > 0 &&
        density >= medianDensity * 1.22 &&
        density >= 0.025
      ) {
        line.style.weight = "bold";
      }
    }
  }

  return enriched;
}


// =====================================
// READING ORDER
// =====================================

function sortReadingOrder(lines) {
  return [...lines].sort((a, b) => {
    const ay = a.bbox?.y0 ?? 0;
    const by = b.bbox?.y0 ?? 0;

    const ah = getLineHeight(a) || 20;
    const bh = getLineHeight(b) || 20;

    const tolerance = Math.max(
      8,
      Math.min(ah, bh) * 0.45
    );

    if (Math.abs(ay - by) > tolerance) {
      return ay - by;
    }

    return (
      (a.bbox?.x0 ?? 0) -
      (b.bbox?.x0 ?? 0)
    );
  });
}
  
  // =====================================
// GROUP OCR LINES INTO CONTENT BLOCKS
// =====================================

function groupOcrBlocks(lines, image) {
  const usefulLines = lines
    .filter(isUsefulOcrLine)
    .filter(line => line.bbox);

  // Phân tích kiểu chữ.
  const styledLines = analyzeTextStyles(
    usefulLines,
    image
  );

  // Sắp xếp sơ bộ theo tọa độ.
  const sortedLines = sortReadingOrder(styledLines);

  const blocks = [];

  for (const line of sortedLines) {
    const lineBox = line.bbox;
    const lineHeight = getLineHeight(line);

    let bestBlock = null;
    let bestScore = Infinity;

    for (const block of blocks) {
      const previous = block.lines[
        block.lines.length - 1
      ];

      if (!previous?.bbox) continue;

      const previousBox = previous.bbox;
      const previousHeight = getLineHeight(previous);

      const verticalGap =
        lineBox.y0 - previousBox.y1;

      // Không ghép những dòng nằm cùng hàng
      // hoặc chồng lấn quá nhiều theo chiều dọc.
      if (
        verticalGap <
        -Math.max(lineHeight, previousHeight) * 0.35
      ) {
        continue;
      }

      // Khoảng cách tối đa giữa hai dòng cùng block.
      const maxGap = Math.max(
        previousHeight * 1.65,
        lineHeight * 1.45,
        28
      );

      if (verticalGap > maxGap) continue;

      // Kiểm tra kích thước font.
      const heightRatio =
        Math.min(lineHeight, previousHeight) /
        Math.max(lineHeight, previousHeight);

      if (heightRatio < 0.58) continue;

      // Kiểm tra độ đậm.
      if (
        line.style.weight !==
        previous.style.weight
      ) {
        continue;
      }

      // Kiểm tra vị trí ngang.
      const overlapX = Math.max(
        0,
        Math.min(lineBox.x1, previousBox.x1) -
        Math.max(lineBox.x0, previousBox.x0)
      );

      const widthA = Math.max(
        1,
        lineBox.x1 - lineBox.x0
      );

      const widthB = Math.max(
        1,
        previousBox.x1 - previousBox.x0
      );

      const horizontalOverlap =
        overlapX / Math.min(widthA, widthB);

      const leftDifference = Math.abs(
        lineBox.x0 - previousBox.x0
      );

      const sameAlignment =
        leftDifference <=
        Math.max(30, Math.min(lineHeight, previousHeight) * 1.8);

      // Hai dòng phải có liên hệ về bố cục.
      if (
        horizontalOverlap < 0.12 &&
        !sameAlignment
      ) {
        continue;
      }

      const gapScore =
        Math.max(0, verticalGap) / maxGap;

      const alignmentScore =
        1 - Math.min(1, horizontalOverlap);

      const score =
        gapScore +
        alignmentScore * 0.5 +
        (1 - heightRatio);

      if (score < bestScore) {
        bestScore = score;
        bestBlock = block;
      }
    }

    if (bestBlock) {
      bestBlock.lines.push(line);
    } else {
      blocks.push({
        lines: [line],
      });
    }
  }

  // =====================================
  // BUILD FINAL BLOCK DATA
  // =====================================

  const result = blocks.map((block, index) => {
    const blockLines = sortReadingOrder(block.lines);

    const boxes = blockLines
      .map(line => line.bbox)
      .filter(Boolean);

    const bbox = boxes.length
      ? {
          x0: Math.min(...boxes.map(box => box.x0)),
          y0: Math.min(...boxes.map(box => box.y0)),
          x1: Math.max(...boxes.map(box => box.x1)),
          y1: Math.max(...boxes.map(box => box.y1)),
        }
      : null;

    // Ghép các dòng trong cùng một vùng thành câu.
    const text = blockLines
      .map(line => line.text.trim())
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/gu, " ")
      .trim();

    const fontSizes = blockLines.map(
      line => line.style.fontSizePx
    );

    const averageFontSize = fontSizes.length
      ? fontSizes.reduce((sum, value) => sum + value, 0) /
        fontSizes.length
      : 0;

    const boldCount = blockLines.filter(
      line => line.style.weight === "bold"
    ).length;

    const weight =
      boldCount > blockLines.length / 2
        ? "bold"
        : "normal";

    const averageConfidence = blockLines.length
      ? blockLines.reduce(
          (sum, line) => sum + Number(line.confidence || 0),
          0
        ) / blockLines.length
      : 0;

    const medianLineHeight = getMedian(fontSizes);

    let fontSize = "medium";

    if (medianLineHeight / (getMedian(
      styledLines.map(getLineHeight)
    ) || 1) >= 1.45) {
      fontSize = "large";
    } else if (
      medianLineHeight / (getMedian(
        styledLines.map(getLineHeight)
      ) || 1) <= 0.70
    ) {
      fontSize = "small";
    }

    return {
      id: index + 1,

      text,

      confidence: averageConfidence,

      bbox,

      style: {
        fontSize,
        fontSizePx: Math.round(averageFontSize),
        weight,
      },

      lines: blockLines,
    };
  });

  return sortBlocksReadingOrder(result);
}


// =====================================
// SORT CONTENT BLOCKS
// =====================================

function sortBlocksReadingOrder(blocks) {
  return [...blocks].sort((a, b) => {
    const ay = a.bbox?.y0 ?? 0;
    const by = b.bbox?.y0 ?? 0;

    const ah = a.bbox
      ? a.bbox.y1 - a.bbox.y0
      : 20;

    const bh = b.bbox
      ? b.bbox.y1 - b.bbox.y0
      : 20;

    const tolerance = Math.max(
      12,
      Math.min(ah, bh) * 0.45
    );

    if (Math.abs(ay - by) > tolerance) {
      return ay - by;
    }

    return (
      (a.bbox?.x0 ?? 0) -
      (b.bbox?.x0 ?? 0)
    );
  });
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
// 5. BUILD CONTENT BLOCKS
// =====================================

onProgress("Analyzing text layout", 0.84);

const finalBlocks = groupOcrBlocks(
  finalLines,
  original
);


// =====================================
// 6. FINAL TEXT RECONSTRUCTION
// =====================================

// Giữ thứ tự các dòng bên trong từng block.
const orderedLines = finalBlocks.flatMap(
  block => block.lines
);

// Mỗi block là một đoạn nội dung riêng.
const finalText = finalBlocks
  .map(block => block.text)
  .filter(Boolean)
  .join("\n\n");

const finalConfidence = orderedLines.length
  ? orderedLines.reduce(
      (sum, line) => sum + Number(line.confidence || 0),
      0
    ) / orderedLines.length
  : best?.confidence || 0;


// =====================================
// 7. DEBUG OUTPUT
// =====================================

console.info("[OCR] Final blocks:", finalBlocks);
console.info("[OCR] Final text:", finalText);

console.table(
  finalBlocks.map((block, index) => ({
    block: index + 1,
    text: block.text,
    fontSize: block.style.fontSize,
    fontSizePx: block.style.fontSizePx,
    weight: block.style.weight,
    confidence: Math.round(block.confidence),
    x: Math.round(block.bbox?.x0 ?? 0),
    y: Math.round(block.bbox?.y0 ?? 0),
  }))
);

onProgress("OCR completed", 1);


// =====================================
// 8. RETURN RESULT
// =====================================

return {
  text: finalText,

  confidence: Math.round(finalConfidence),

  language,

  languageLabel: languageLabel(language),

  script: languageInfo.script || "Unknown",

  mode: best?.mode || "Multi-tile",

  variant: best?.variant || "Enhanced",

  // Số vùng nội dung, thay vì số dòng OCR.
  regionsDetected: finalBlocks.length,

  // Giữ lines để tương thích với giao diện hiện tại.
  lines: orderedLines.map(line => ({
    text: line.text,

    confidence: Math.round(line.confidence),

    bbox: line.bbox,

    style: line.style,
  })),

  // Dữ liệu bố cục mới.
  blocks: finalBlocks.map(block => ({
    id: block.id,

    text: block.text,

    confidence: Math.round(block.confidence),

    bbox: block.bbox,

    style: block.style,

    lines: block.lines.map(line => ({
      text: line.text,

      confidence: Math.round(line.confidence),

      bbox: line.bbox,

      style: line.style,
    })),
  })),

  // Giữ nguyên các kết quả OCR thay thế.
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
