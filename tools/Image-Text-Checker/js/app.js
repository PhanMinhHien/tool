(() => {
  const $ = (id) => document.getElementById(id);

  if (window.lucide) lucide.createIcons();

  const state = {
    file: null,
    previewUrl: null,
    expected: "",
    ocr: "",
    report: null,
    busy: false,
  };

  const elements = {
    expected: $("expectedText"),
    input: $("imageInput"),
    drop: $("dropZone"),
    preview: $("imagePreview"),
    prompt: $("uploadPrompt"),
    previewWrap: $("previewWrap"),
    check: $("checkBtn"),
    progress: $("progressPanel"),
    result: $("resultSection"),
    toast: $("toast"),
  };

  function toast(message) {
    elements.toast.textContent = message;
    elements.toast.classList.add("show");

    clearTimeout(toast.timer);

    toast.timer = setTimeout(
      () => elements.toast.classList.remove("show"),
      2400
    );
  }

  function setBusy(busy) {
    state.busy = busy;
    elements.check.disabled = busy;

    elements.check.innerHTML = busy
      ? '<span class="spinner"></span> Processing...'
      : '<i data-lucide="scan-search"></i> Run text check <i data-lucide="arrow-up-right"></i>';

    elements.check.style.opacity = busy ? ".65" : "1";
    elements.check.style.cursor = busy ? "wait" : "pointer";

    if (window.lucide) lucide.createIcons();
  }

  function setProgress(title, message, percent) {
    $("progressTitle").textContent = title;
    $("progressMessage").textContent = message;
    $("progressPercent").textContent = `${Math.round(percent)}%`;

    $("progressBar").style.width =
      `${Math.max(0, Math.min(100, percent))}%`;
  }

  function formatBytes(bytes) {
    return bytes < 1024 * 1024
      ? `${(bytes / 1024).toFixed(0)} KB`
      : `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }

  function selectFile(file) {
    if (!file) return;

    if (!/^image\/(png|jpeg|webp|bmp)$/.test(file.type)) {
      return toast(
        "Định dạng chưa hỗ trợ. Hãy chọn PNG, JPG, WEBP hoặc BMP."
      );
    }

    if (file.size > 15 * 1024 * 1024) {
      return toast("Ảnh vượt quá giới hạn 15 MB.");
    }

    if (state.previewUrl) {
      URL.revokeObjectURL(state.previewUrl);
    }

    state.file = file;
    state.previewUrl = URL.createObjectURL(file);

    elements.preview.src = state.previewUrl;
    elements.prompt.hidden = true;
    elements.previewWrap.hidden = false;

    $("imageName").textContent = file.name;
    $("imageMeta").textContent =
      `${file.name} · ${formatBytes(file.size)}`;

    elements.result.hidden = true;
  }

  function removeFile() {
    if (state.previewUrl) {
      URL.revokeObjectURL(state.previewUrl);
    }

    state.file = null;
    state.previewUrl = null;

    elements.input.value = "";
    elements.preview.src = "";
    elements.previewWrap.hidden = true;
    elements.prompt.hidden = false;

    $("imageMeta").textContent = "Chưa có hình ảnh";
  }

  function renderDiff(target, parts) {
    const frag = document.createDocumentFragment();

    parts.forEach((part, index) => {
      const node = document.createElement(
        part.type === "same" ? "span" : "mark"
      );

      node.className = part.type;
      node.textContent = part.text;

      frag.appendChild(node);

      if (index < parts.length - 1) {
        frag.appendChild(document.createTextNode(" "));
      }
    });

    target.replaceChildren(frag);
  }

  function buildReport(result) {
    const status = result.equal ? "MATCH" : "MISMATCH";

    return [
      "IMAGE TEXT CHECKER — VALIDATION REPORT",
      `Result: ${status}`,
      `Text similarity: ${result.similarity}%`,
      `Expected words: ${result.expectedWords}`,
      `Recognized words: ${result.actualWords}`,
      `Missing/different tokens: ${result.missing}`,
      `Extra/different tokens: ${result.extra}`,
      "",
      "EXPECTED TEXT:",
      result.expected,
      "",
      "OCR TEXT:",
      state.ocr || result.actual,
      "",
      "Note: OCR may misread blurry, small, stylized, or low-contrast text.",
    ].join("\n");
  }

  function showResult(result) {
    state.report = result;

    $("summaryCard").classList.toggle("mismatch", !result.equal);

    $("resultIcon").innerHTML = result.equal
      ? '<i data-lucide="check"></i>'
      : '<i data-lucide="alert-triangle"></i>';

    $("resultTitle").textContent = result.equal
      ? "Text matched"
      : "Text mismatch detected";

    $("resultSubtitle").textContent = result.equal
      ? "Toàn bộ nội dung OCR khớp với nội dung chuẩn sau khi chuẩn hóa khoảng trắng."
      : "Có nội dung khác biệt hoặc không đúng thứ tự. Hãy xem phần được đánh dấu bên dưới.";

    $("similarityValue").textContent = `${result.similarity}%`;
    $("expectedWords").textContent = result.expectedWords;
    $("recognizedWords").textContent = result.actualWords;
    $("missingCount").textContent = result.missing;
    $("extraCount").textContent = result.extra;

    renderDiff($("expectedDiff"), result.diff.expected);
    renderDiff($("ocrDiff"), result.diff.actual);

    elements.result.hidden = false;

    if (window.lucide) lucide.createIcons();

    elements.result.scrollIntoView({
      behavior: "smooth",
      block: "start"
    });
  }

  function setupLanguageSelector() {
    const select = $("ocrLanguage");

    if (!select || !window.OcrEngine) return;

    const groups = window.OcrEngine.getLanguages();

    if (!Array.isArray(groups) || !groups.length) return;

    select.replaceChildren();

    const autoOption = document.createElement("option");
    autoOption.value = "auto";
    autoOption.textContent = "✨ Auto Detect";

    select.appendChild(autoOption);

    for (const group of groups) {
      const optgroup = document.createElement("optgroup");
      optgroup.label = group.name;

      for (const [code, name] of group.items) {
        const option = document.createElement("option");

        option.value = code;
        option.textContent = `${name} (${code})`;

        optgroup.appendChild(option);
      }

      select.appendChild(optgroup);
    }

    autoOption.selected = true;

    let previous = new Set(["auto"]);

    select.addEventListener("change", () => {
      const current = new Set(
        Array.from(select.selectedOptions).map(
          option => option.value
        )
      );

      if (current.has("auto") && !previous.has("auto")) {
        Array.from(select.options).forEach(option => {
          option.selected = option.value === "auto";
        });
      } else if (current.has("auto")) {
        Array.from(select.options).forEach(option => {
          if (option.value === "auto") {
            option.selected = false;
          }
        });
      }

      if (!select.selectedOptions.length) {
        autoOption.selected = true;
      }

      previous = new Set(
        Array.from(select.selectedOptions).map(
          option => option.value
        )
      );
    });
  }

  async function runCheck() {
    const expected = elements.expected.value.trim();

    if (!expected) {
      return toast("Bạn cần nhập Expected Text trước.");
    }

    if (!state.file) {
      return toast("Bạn cần chọn một hình ảnh trước.");
    }

    if (state.busy) return;

    setBusy(true);

    elements.result.hidden = true;
    elements.progress.hidden = false;

    setProgress(
      "Preparing image...",
      "Đang xử lý ảnh trên trình duyệt",
      5
    );

    try {
      const imageVariants =
        await ImageProcessor.prepareVariants(state.file);

      const selectedLanguages = Array.from(
        $("ocrLanguage").selectedOptions
      ).map(option => option.value);

      const selectedLanguage =
        selectedLanguages.includes("auto") ||
        selectedLanguages.length === 0
          ? "auto"
          : selectedLanguages.join("+");

      setProgress(
        "Recognizing text...",
        "Đang phân tích bố cục và các vùng văn bản...",
        8
      );

  const recognizedResult = await OcrEngine.recognize(
  imageVariants,
  selectedLanguage,
  (status, progress) => {
    const percent = 10 + progress * 82;

    setProgress("Recognizing text...", status, percent);
  },
  expected,
);

      const recognized = recognizedResult.text;

      state.expected = expected;
      state.ocr = recognized;

      setProgress(
        "Comparing content...",
        "Đang đối chiếu toàn bộ nội dung theo thứ tự",
        96
      );

      const result = TextValidator.compare(
        expected,
        recognized
      );

      // OCR diagnostics
      const confidenceElement = $("ocrMeta");

      if (confidenceElement) {
        const confidence = recognizedResult.confidence;

        confidenceElement.textContent =
          `${recognizedResult.languageLabel} · ` +
          `${confidence}% confidence · ` +
          `${recognizedResult.regionsDetected} text lines · ` +
          `${recognizedResult.mode}`;

        confidenceElement.className =
          "ocr-meta " +
          (
            confidence >= 85
              ? "confidence-high"
              : confidence >= 60
                ? "confidence-medium"
                : "confidence-low"
          );
      }

      // Display OCR layout text
      const layoutElement = $("ocrLayoutText");

      if (layoutElement) {
        layoutElement.textContent = recognized;
      }

      // Display confidence for each OCR line
      const lineConfidenceElement = $("ocrLineConfidence");

      if (lineConfidenceElement) {
        lineConfidenceElement.replaceChildren();

        recognizedResult.lines.forEach((line, index) => {
          const item = document.createElement("div");

          item.className = "ocr-line-item";

          const content = document.createElement("span");
          content.textContent = `${index + 1}. ${line.text}`;

          const score = document.createElement("strong");
          score.textContent = `${line.confidence}%`;

          item.append(content, score);

          lineConfidenceElement.appendChild(item);
        });
      }

      setProgress(
        "Completed",
        "Đã hoàn tất kiểm tra",
        100
      );

      showResult(result);

      toast(
        result.equal
          ? "Nội dung khớp hoàn toàn."
          : "Đã phát hiện nội dung khác biệt."
      );

    } catch (error) {
      console.error(error);

      toast(
        error.message || "Có lỗi trong quá trình OCR."
      );

    } finally {
      setBusy(false);

      setTimeout(() => {
        elements.progress.hidden = true;
      }, 700);
    }
  }

  $("browseBtn").addEventListener("click", event => {
    event.stopPropagation();
    elements.input.click();
  });

  elements.drop.addEventListener("click", event => {
    if (!event.target.closest("button")) {
      elements.input.click();
    }
  });

  elements.drop.addEventListener("keydown", event => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      elements.input.click();
    }
  });

  elements.input.addEventListener("change", () => {
    selectFile(elements.input.files[0]);
  });

  $("removeImageBtn").addEventListener("click", event => {
    event.stopPropagation();
    removeFile();
  });

  elements.drop.addEventListener("dragover", event => {
    event.preventDefault();
    elements.drop.classList.add("dragover");
  });

  elements.drop.addEventListener("dragleave", () => {
    elements.drop.classList.remove("dragover");
  });

  elements.drop.addEventListener("drop", event => {
    event.preventDefault();
    elements.drop.classList.remove("dragover");
    selectFile(event.dataTransfer.files[0]);
  });

  elements.check.addEventListener("click", runCheck);

  elements.expected.addEventListener("input", () => {
    $("expectedCount").textContent =
      `${elements.expected.value.length.toLocaleString()} characters`;
  });

  $("clearTextBtn").addEventListener("click", () => {
    elements.expected.value = "";
    $("expectedCount").textContent = "0 characters";
  });

  $("resetBtn").addEventListener("click", () => {
    elements.result.hidden = true;
    elements.progress.hidden = true;

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  });

  document.querySelectorAll("[data-copy]").forEach(button => {
    button.addEventListener("click", async () => {
      const value =
        button.dataset.copy === "expected"
          ? state.expected
          : state.ocr;

      try {
        await navigator.clipboard.writeText(value);
        toast("Đã copy nội dung.");
      } catch {
        toast("Không thể copy tự động trên trình duyệt này.");
      }
    });
  });

  $("copyReportBtn").addEventListener("click", async () => {
    if (!state.report) return;

    try {
      await navigator.clipboard.writeText(
        buildReport(state.report)
      );

      toast("Đã copy báo cáo.");
    } catch {
      toast("Không thể copy tự động.");
    }
  });

  $("downloadReportBtn").addEventListener("click", () => {
    if (!state.report) return;

    const blob = new Blob(
      [buildReport(state.report)],
      { type:"text/plain;charset=utf-8" }
    );

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = "image-text-check-report.txt";
    a.click();

    URL.revokeObjectURL(url);
  });

  // Initialize OCR language selector
  setupLanguageSelector();

  window.addEventListener("beforeunload", () => {
    if (state.previewUrl) {
      URL.revokeObjectURL(state.previewUrl);
    }

    OcrEngine.terminate();
  });
})();