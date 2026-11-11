window.TextValidator = (() => {
  const normalize = value => String(value || "").replace(/\r\n?/g, "\n").replace(/[ \t\f\v]+/g, " ").replace(/\s*\n\s*/g, "\n").trim();

  function levenshtein(a, b) {
    if (a.length > 5000 || b.length > 5000) {
      const max = Math.max(a.length, b.length);
      return max ? Math.max(0, 1 - Math.abs(a.length - b.length) / max) : 1;
    }
    let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      const cur = [i];
      for (let j = 1; j <= b.length; j++) {
        cur[j] = Math.min(cur[j - 1] + 1, prev[j] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
      }
      prev = cur;
    }
    const denominator = Math.max(a.length, b.length);
    return denominator ? Math.max(0, 1 - prev[b.length] / denominator) : 1;
  }

  // Word-level LCS gives a readable ordered diff while preserving punctuation within tokens.
  function diffWords(expected, actual) {
    const a = expected.match(/\s+|[^\s]+/g) || [];
    const b = actual.match(/\s+|[^\s]+/g) || [];
    const aa = a.filter(x => !/^\s+$/.test(x));
    const bb = b.filter(x => !/^\s+$/.test(x));
    if (aa.length * bb.length > 1800000) {
      return { expected: [{ text: expected, type: "missing" }], actual: [{ text: actual, type: "extra" }] };
    }
    const dp = Array.from({ length: aa.length + 1 }, () => new Uint32Array(bb.length + 1));
    for (let i = aa.length - 1; i >= 0; i--) {
      for (let j = bb.length - 1; j >= 0; j--) {
        dp[i][j] = aa[i] === bb[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
      }
    }
    const left = [], right = [];
    let i = 0, j = 0;
    while (i < aa.length || j < bb.length) {
      if (i < aa.length && j < bb.length && aa[i] === bb[j]) {
        left.push({ text: aa[i], type: "same" }); right.push({ text: bb[j], type: "same" }); i++; j++;
      } else if (i < aa.length && (j === bb.length || dp[i + 1][j] >= dp[i][j + 1])) {
        left.push({ text: aa[i], type: "missing" }); i++;
      } else {
        right.push({ text: bb[j], type: "extra" }); j++;
      }
    }
    return { expected: left, actual: right };
  }

  function compare(expectedRaw, actualRaw) {
    const expected = normalize(expectedRaw);
    const actual = normalize(actualRaw);
    const diff = diffWords(expected, actual);
    const equal = expected === actual;
    const expectedWords = expected ? (expected.match(/\S+/g) || []).length : 0;
    const actualWords = actual ? (actual.match(/\S+/g) || []).length : 0;
    const missing = diff.expected.filter(x => x.type === "missing").length;
    const extra = diff.actual.filter(x => x.type === "extra").length;
    return {
      equal, similarity: Math.round(levenshtein(expected, actual) * 100),
      expectedWords, actualWords, missing, extra, diff, expected, actual
    };
  }
  return { compare, normalize };
})();
