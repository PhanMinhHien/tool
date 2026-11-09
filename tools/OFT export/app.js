const state = {
  file: null,
  original: "",
  converted: "",
  outputName: "converted.html",
};

const $ = (s) => document.querySelector(s);
const fileInput = $("#fileInput");
const dropzone = $("#dropzone");
const convertBtn = $("#convertBtn");

function escapePreview(str) {
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function addStyle(el, prop, value) {
  const current = el.getAttribute("style") || "";
  const re = new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*[^;]+;?`, "i");
  let next;
  if (re.test(current)) {
    next = current.replace(re, (m) => {
      const prefix = m.startsWith(";") ? ";" : "";
      return `${prefix} ${prop}: ${value};`;
    });
  } else {
    next = current.trim();
    if (next && !next.endsWith(";")) next += ";";
    next += ` ${prop}: ${value};`;
  }
  el.setAttribute("style", next.trim());
}

function hasRealContent(row) {
  const clone = row.cloneNode(true);
  clone.querySelectorAll("script,style").forEach((x) => x.remove());
  const text = (clone.textContent || "").replace(/\u00a0/g, "").trim();
  const hasMedia = !!clone.querySelector("img,svg,video,canvas,iframe");
  const hasLink = !!clone.querySelector("a[href]");
  return text.length > 0 || hasMedia || hasLink;
}

function isSpacerRow(row) {
  if (row.tagName !== "TR") return false;

  const cells = [...row.children].filter(
    (x) => x.tagName === "TD" || x.tagName === "TH",
  );

  if (cells.length !== 1) return false;

  const cell = cells[0];

  // Skip spacer cells that have colspan
  if (cell.hasAttribute("colspan")) return false;

  const height = cell.getAttribute("height");

  if (!height || !/^\d+(?:\.\d+)?$/.test(height.trim())) {
    return false;
  }

  const clone = cell.cloneNode(true);
  clone.querySelectorAll("script, style").forEach((x) => x.remove());

  const text = (clone.textContent || "")
    .replace(/\u00a0/g, "")
    .trim();

  if (text !== "") return false;

  if (clone.querySelector("img, svg, video, canvas, iframe, a[href]")) {
    return false;
  }

  return { cell, height: parseFloat(height) };
}

function firstContentCell(row) {
  const cells = [...row.children].filter(
    (x) => x.tagName === "TD" || x.tagName === "TH",
  );
  if (!cells.length) return null;
  return cells.find(hasRealContent) || cells[0];
}

function convertHTML(source) {
  const parser = new DOMParser();
  const doc = parser.parseFromString(source, "text/html");
  const changes = {
    body: 0,
    footer: 0,
    spacer: 0,
    top: 0,
    bottom: 0,
    emailPreHeader: 0,
    width550: 0,
    width550Css: 0,
    width560Css: 0,
    emToPx: 0,
    imageSources: 0,
    salutation: 0,
    templateContainer: 0,
    emptyTables: 0,
    ctaSpacer: 0,
    ctaLineHeight: 0,
    spacerDetails: [],
  };

  if ($("#ruleBody").checked) {
    const body = doc.body;
    if (body) {
      const style = body.getAttribute("style") || "";
      const fixed = style.replace(
        /background-color\s*:\s*\$\s*\{\s*BodyBGColor\s*\}/gi,
        "background-color:#f3f3eb",
      );
      if (fixed !== style) {
        body.setAttribute("style", fixed);
        changes.body = 1;
      }
    }
  }

  if ($("#ruleFooter").checked) {
    const footer = doc.querySelector(
      'tr.mktoModule#Footer, tr.mktoModule[id="Footer"]',
    );
    if (footer) {
      footer.remove();
      changes.footer = 1;
    }
  }

  // Remove the first .full-wrap table
 if ($("#rulePreHeader")?.checked) {
  const table = doc.querySelector("table.full-wrap");

  if (table) {
    table.remove();
    changes.emailPreHeader = 1;
  }
}

  // Outlook layout width adjustments.
  if ($("#ruleWidths")?.checked) {
    doc.querySelectorAll("[width]").forEach((el) => {
      if ((el.getAttribute("width") || "").trim() === "550") {
        el.setAttribute("width", "620");
        changes.width550++;
      }
    });

    doc.querySelectorAll("[style]").forEach((el) => {
      let style = el.getAttribute("style") || "";

      if (/width\s*:\s*550px\s*;?/i.test(style)) {
        style = style.replace(
          /width\s*:\s*550px\s*;?/gi,
          "width:620px;padding-left:35px;padding-right:35px;",
        );
        el.setAttribute("style", style);
        changes.width550Css++;
      }

      if (/width\s*:\s*560px\s*;?/i.test(style)) {
        style = style.replace(
          /width\s*:\s*560px\s*;?/gi,
          "width:620px;padding-left:30px;padding-right:30px;",
        );
        el.setAttribute("style", style);
        changes.width560Css++;
      }
    });
  }

  // Rewrite local image paths to the Marketo image host.
  if ($("#ruleImages")?.checked) {
    const imagePrefix = "https://info.email.also.com/rs/833-IPQ-934/images/";

    doc.querySelectorAll("img[src]").forEach((img) => {
      const src = img.getAttribute("src") || "";

      // Only rewrite relative/local paths. Absolute URLs and data URIs stay untouched.
      if (/^(?:https?:)?\/\//i.test(src) || /^data:/i.test(src)) return;

      const cleanSrc = src.split(/[?#]/)[0];
      const slashIndex = cleanSrc.lastIndexOf("/");
      if (slashIndex < 0) return;

      const fileName = cleanSrc.slice(slashIndex + 1);
      if (!fileName) return;

      img.setAttribute("src", imagePrefix + fileName);
      changes.imageSources++;
    });
  }

  // Replace the default salutation with the value entered by the user.
  if ($("#ruleSalutation")?.checked) {
  const salutation = ($("#salutationInput")?.value || "").trim();

  if (salutation) {
    const salutationElement = doc.getElementById("salutation");

    if (salutationElement) {
      salutationElement.textContent = salutation;
      changes.salutation++;
    }
  }
}

  // Convert CSS em values to px.
  // Formula: px = em × font-size.
  // Example: font-size:12px + line-height:1.5em = line-height:18px.
  // Convert CSS em values to px.
  // Fixed formula: 1em = 12px.
  // Example: 1.5em × 12px = 18px.
  function convertEmToPx(doc, changes) {
    const baseFontSizePx = 12;

    function replaceEm(value) {
      return value.replace(/(-?\d*\.?\d+)\s*em\b/gi, (match, emValue) => {
        const px = parseFloat(emValue) * baseFontSizePx;
        return `${Math.round(px * 100) / 100}px`;
      });
    }

    // Inline style=""
    doc.querySelectorAll("[style]").forEach((el) => {
      const originalStyle = el.getAttribute("style") || "";

      if (!/em\b/i.test(originalStyle)) return;

      const convertedStyle = replaceEm(originalStyle);

      if (convertedStyle !== originalStyle) {
        el.setAttribute("style", convertedStyle);
        changes.emToPx++;
      }
    });

    // <style> blocks
    doc.querySelectorAll("style").forEach((styleEl) => {
      const originalCss = styleEl.textContent || "";

      if (!/em\b/i.test(originalCss)) return;

      const convertedCss = replaceEm(originalCss);

      if (convertedCss !== originalCss) {
        styleEl.textContent = convertedCss;
        changes.emToPx++;
      }
    });
  }
  convertEmToPx(doc, changes);
   // Change CTA button line-height from 17px to 1.5rem.
  // Run after em-to-px conversion to preserve 1.5rem.
  doc.querySelectorAll(
    'tr.mktoModule[id^="Module-CTA"] div.mktoText table td[style]'
  ).forEach((td) => {
    const style = td.getAttribute("style") || "";

    if (/line-height\s*:\s*17px\s*;?/i.test(style)) {
      addStyle(td, "line-height", "1.25rem");
      changes.ctaLineHeight++;
    }
  });

  
// Force CTA button border-radius to 0px.
doc.querySelectorAll(
  'tr.mktoModule[id^="Module-CTA"] div.mktoText table[style]'
).forEach((table) => {
  let style = table.getAttribute("style") || "";

  const border = style.match(
    /(?:^|;)\s*border\s*:\s*([^;]+)/i
  );

  const td = table.querySelector("td:has(a)");
  if (!td) return;

  // Always force button corner radius to 0px.
  addStyle(td, "border-radius", "0px");

  // Preserve existing border if available.
  if (border) {
    addStyle(td, "border", border[1].trim());
  }

  // Remove border-radius and border from the table.
  style = style
    .replace(/(^|;)\s*border-radius\s*:\s*[^;]*/gi, "$1")
    .replace(/(^|;)\s*border\s*:\s*[^;]*/gi, "$1")
    .replace(/;{2,}/g, ";")
    .trim();

  table.setAttribute("style", style);
});

  if ($("#ruleSpacer").checked) {
    const rows = [...doc.querySelectorAll("tr")];

    for (const row of rows) {
      const spacer = isSpacerRow(row);
      if (!spacer || !row.parentElement) continue;

      const siblings = [...row.parentElement.children].filter(
        (x) => x.tagName === "TR",
      );
      const index = siblings.indexOf(row);

      let previous = null;
      for (let i = index - 1; i >= 0; i--) {
        if (hasRealContent(siblings[i])) {
          previous = siblings[i];
          break;
        }
      }

      let next = null;
      for (let i = index + 1; i < siblings.length; i++) {
        if (hasRealContent(siblings[i])) {
          next = siblings[i];
          break;
        }
      }

      // A spacer after real content belongs to the previous row.
      // A leading spacer belongs to the next row.
      let target = previous || next;
      let direction = previous ? "bottom" : "top";

      if (!target) continue;

      const cell = firstContentCell(target);
      if (!cell) continue;

      addStyle(
        cell,
        direction === "top" ? "padding-top" : "padding-bottom",
        `${spacer.height}px`,
      );

      row.remove();
      changes.spacer++;
      if (direction === "top") changes.top++;
      else changes.bottom++;

      changes.spacerDetails.push({
        height: spacer.height,
        direction,
        target: target.id || target.className || target.tagName.toLowerCase(),
      });
    }
  }
  // Replace specific Marketo CTA spacer module.
// This is always applied; no checkbox is needed.
doc.querySelectorAll(
  'div.mktoTextXedit[id="mod14CTA-buttontext1a"][mktoname="CTA"]'
).forEach((wrapper) => {
  const temp = doc.createElement("div");

  temp.innerHTML = `
<table width="100%" cellpadding="0" cellspacing="0" border="0" style="border-spacing: 0; mso-table-lspace: 0pt; mso-table-rspace: 0pt">
  <tbody>
    <tr>
      <td height="60" style="font-family: Verdana, sans-serif; line-height: 1px; font-size: 1px"></td>
    </tr>
  </tbody>
</table>`.trim();

  const replacement = temp.firstElementChild;

  wrapper.replaceWith(replacement);

  changes.ctaSpacer++;
});
  // Remove empty tables with no rows.
doc.querySelectorAll("table").forEach((table) => {
  const rows = table.querySelectorAll("tr");

  if (rows.length === 0 && !table.textContent.trim()) {
    table.remove();
    changes.emptyTables++;
  }
});

  // Add a NEW Outlook-safe template container.
// Existing tables/wrappers are kept unchanged.
if ($("#ruleTemplateContainer")?.checked) {
  const existingContainer = doc.querySelector("#template-container");

  if (!existingContainer && doc.body) {
    const containerTable = doc.createElement("table");

    containerTable.setAttribute("width", "100%");
    containerTable.setAttribute("cellpadding", "0");
    containerTable.setAttribute("cellspacing", "0");
    containerTable.setAttribute("border", "0");
    containerTable.setAttribute("align", "center");
    containerTable.setAttribute("class", "deviceWidth mktoContainer");
    containerTable.setAttribute("id", "template-container");
    containerTable.setAttribute("bgcolor", "#f3f3eb");

    containerTable.setAttribute(
      "style",
      "border-spacing: 0; " +
      "mso-table-lspace: 0pt; " +
      "mso-table-rspace: 0pt; " +
      "background-color: #f3f3eb;"
    );

    const tbody = doc.createElement("tbody");
    const tr = doc.createElement("tr");
    const td = doc.createElement("td");

    // Move all existing body content inside the new container.
    while (doc.body.firstChild) {
      td.appendChild(doc.body.firstChild);
    }

    tr.appendChild(td);
    tbody.appendChild(tr);
    containerTable.appendChild(tbody);
    doc.body.appendChild(containerTable);

    changes.templateContainer = 1;
  }
}
  
  // Keep a useful XHTML-style doctype if the source had one.
  let output = "<!DOCTYPE html>\n" + doc.documentElement.outerHTML;
  return { output, changes };
}

function showResults(changes) {
  $("#results").hidden = false;
  const totalChanges =
    changes.body +
    changes.footer +
    changes.ctaSpacer +
    changes.ctaLineHeight +
    changes.emailPreHeader +
    changes.width550 +
    changes.width550Css +
    changes.width560Css +
    changes.emToPx +
    changes.imageSources +
    changes.salutation +
    changes.templateContainer +
    changes.spacer;
  $("#resultSummary").textContent =
    `${totalChanges} transformation${totalChanges === 1 ? "" : "s"} applied.`;

  // $("#stats").innerHTML = [
  //   ["Body", changes.body, "background fixed"],
  //   ["Footer", changes.footer, "module removed"],
  //   ["Spacers", changes.spacer, "rows converted"],
  //   [
  //     "Padding",
  //     changes.top + changes.bottom,
  //     `${changes.top} top / ${changes.bottom} bottom`,
  //   ],
  // ]
  //   .map(
  //     ([n, v, s]) =>
  //       `<div class="stat"><strong>${v}</strong><span>${n} · ${s}</span></div>`,
  //   )
  //   .join("");

  const items = [];
  if (changes.body)
    items.push(
      `<div class="log-item"><b>✓ Body</b> <code>\${BodyBGColor}</code> → <code>#f3f3eb</code></div>`,
    );
  if (changes.footer)
    items.push(
      `<div class="log-item"><b>✓ Footer</b> Removed the complete <code>#Footer</code> module.</div>`,
    );
  if (changes.emailPreHeader)
    items.push(
      `<div class="log-item"><b>✓ emailPreHeader</b> Removed the following <code>table.full-wrap</code>.</div>`,
    );
  if (changes.width550)
    items.push(
      `<div class="log-item"><b>✓ Width attribute</b> Changed <code>width="550"</code> → <code>width="620"</code> (${changes.width550}).</div>`,
    );
  if (changes.width550Css)
    items.push(
      `<div class="log-item"><b>✓ CSS width</b> Changed <code>width:550px</code> → <code>width:620px</code> + 35px left/right padding (${changes.width550Css}).</div>`,
    );
  if (changes.width560Css)
    items.push(
      `<div class="log-item"><b>✓ CSS width</b> Changed <code>width:560px</code> → <code>width:620px</code> + 30px left/right padding (${changes.width560Css}).</div>`,
    );
  if (changes.emToPx) {
    items.push(
      `<div class="log-item"><b>✓ em → px</b> Converted CSS em values using fixed 12px base (1em = 12px).</div>`,
    );
  }
  if (changes.imageSources)
    items.push(
      `<div class="log-item"><b>✓ Images</b> Updated ${changes.imageSources} local image source${changes.imageSources === 1 ? "" : "s"} to <code>https://info.email.also.com/rs/833-IPQ-934/images/</code>.</div>`,
    );
  if (changes.salutation)
    items.push(
      `<div class="log-item"><b>✓ Salutation</b> Replaced <code>Dear ALSO Partner,</code> (${changes.salutation} occurrence${changes.salutation === 1 ? "" : "s"}).</div>`,
    );
  if (changes.templateContainer) {
  items.push(
    `<div class="log-item">
      <b>✓ Template Container</b>
      Added a new <code>#template-container</code> wrapper
      with <code>620px</code> width and
      <code>#f3f3eb</code> background.
    </div>`
  );
  }
  if (changes.emptyTables) {
  items.push(
    `<div class="log-item">
      <b>✓ Empty Tables</b>
      Removed ${changes.emptyTables} empty table${changes.emptyTables === 1 ? "" : "s"}.
    </div>`
  );
  }
  if (changes.ctaSpacer) {
  items.push(
    `<div class="log-item">
      <b>✓ CTA Spacer</b>
      Replaced ${changes.ctaSpacer} Marketo CTA spacer module${changes.ctaSpacer === 1 ? "" : "s"}
      with a 60px spacer table.
    </div>`
  );
  }
  if (changes.ctaLineHeight) {
  items.push(
    `<div class="log-item">
      <b>✓ CTA Line Height</b>
      Changed line-height from <code>17px</code> to
      <code>1.5rem</code> on ${changes.ctaLineHeight} CTA button cell(s).
    </div>`
  );
}
  changes.spacerDetails.forEach((x, i) => {
    items.push(
      `<div class="log-item"><b>✓ Spacer ${i + 1}</b> ${x.height}px → <code>padding-${x.direction}</code> on <code>${x.target}</code></div>`,
    );
  });
  if (!items.length)
    items.push(
      `<div class="log-item">No enabled rule found anything to change.</div>`,
    );
  $("#log").innerHTML = items.join("");

  $("#originalPreview").textContent = state.original;
  $("#convertedPreview").textContent = state.converted;
}

async function loadFile(file) {
  if (!file) return;
  if (!/\.html?$/i.test(file.name)) {
    alert("Please choose an HTML file.");
    return;
  }

  state.file = file;
  state.original = await file.text();
  state.outputName = file.name.replace(/\.html?$/i, "") + "_Outlook.html";

  $("#fileName").textContent = file.name;
  convertBtn.disabled = false;
}

fileInput.addEventListener("change", () => loadFile(fileInput.files[0]));

["dragenter", "dragover"].forEach((evt) => {
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.add("drag");
  });
});
["dragleave", "drop"].forEach((evt) => {
  dropzone.addEventListener(evt, (e) => {
    e.preventDefault();
    dropzone.classList.remove("drag");
  });
});
dropzone.addEventListener("drop", (e) => loadFile(e.dataTransfer.files[0]));

$("#resetRules").addEventListener("click", () => {
  $("#ruleBody").checked = true;
  $("#ruleFooter").checked = true;
  $("#rulePreHeader").checked = true;
  $("#ruleWidths").checked = true;
  $("#ruleSpacer").checked = true;
  $("#ruleEmToPx").checked = true;
  $("#ruleTemplateContainer").checked = true;
});

convertBtn.addEventListener("click", () => {
  if (!state.original) return;
  try {
    const result = convertHTML(state.original);
    state.converted = result.output;
    showResults(result.changes);
    $("#results").scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    console.error(err);
    alert("The HTML could not be converted. Please check the file structure.");
  }
});

$("#downloadBtn").addEventListener("click", () => {
  if (!state.converted) return;
  const blob = new Blob([state.converted], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = state.outputName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});
$("#copyBtn").addEventListener("click", async () => {
  if (!state.converted) return;

  try {
    await navigator.clipboard.writeText(state.converted);

    const btn = $("#copyBtn");
    const originalText = btn.textContent;

    btn.textContent = "Copied ✓";

    setTimeout(() => {
      btn.textContent = originalText;
    }, 1600);

  } catch (err) {
    console.error(err);

    // Fallback for browsers where Clipboard API is unavailable
    const textarea = document.createElement("textarea");

    textarea.value = state.converted;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    textarea.style.pointerEvents = "none";

    document.body.appendChild(textarea);

    textarea.focus();
    textarea.select();

    try {
      document.execCommand("copy");

      const btn = $("#copyBtn");
      const originalText = btn.textContent;

      btn.textContent = "Copied ✓";

      setTimeout(() => {
        btn.textContent = originalText;
      }, 1600);
    } catch (copyError) {
      console.error(copyError);
      alert("Unable to copy the converted HTML.");
    }

    textarea.remove();
  }
});