// APEX Screen Capture
// Author: Daniel Hochleitner - updated by Austin Huizinga
// Version: 2.0.0

const MARGIN_MM = 10; // side + top/bottom margin
const JPEG_QUALITY = 0.9; // 0-1 smaller → stronger compression
const A4_WIDTH_MM = 210; // portrait width
const A4_HEIGHT_MM = 297; // portrait height
const PDF_MAX_MM = 5080; // Max pdf height in mm
const A4_CONTENT_WIDTH_MM = A4_WIDTH_MM - 2 * MARGIN_MM; // content width
const A4_CONTENT_HEIGHT_MM = A4_HEIGHT_MM - 2 * MARGIN_MM; // content height
const PX_PER_MM = 96 / 25.4; // jsPDF’s dpi assumption
const DEFAULT_FILENAME = "screencapture"; // default file name

const CLOB_CHUNK_SIZE = 30000; // max. size of f01 array elements

const ICON_BASE = apex_img_dir || "/i/"; // UT image dir (APEX adds apex_img_dir)

const PDFSHIFT_KEY = "####";
const USE_PDFSHIFT_SANDBOX = true; // use sandbox mode (no credits deducted, watermark)

const UT_CSS_URL =
  "https://app.springsolutions.com/i/themes/theme_42/22.2/css/Core.min.css";
const FONT_APEX_CSS =
  "https://app.springsolutions.com/i/libraries/font-apex/2.2.1/css/font-apex.min.css";

// global namespace
var apexScreenCapture = {
  /* -------------------------------------------------------------------- */
  /*  Util                                                                */
  /* -------------------------------------------------------------------- */

  /**
   * Parse a booleanish string.
   * @param   {string} str   Boolean string 'true' or 'false'
   * @returns {boolean|undefined} `true`, `false`, or `undefined` if not convertible.
   */
  parseBoolean(str) {
    if (typeof str !== "string") return undefined;
    const s = str.trim().toLowerCase();
    if (s === "true") return true;
    if (s === "false") return false;
    return undefined;
  },
  /**
   * Split a large CLOB-like string into chunks that fit APEX f01 arrays.
   * @param   {string}  clob        Very large base64 / text string.
   * @param   {number}  chunkSize   Maximum size per element
   * @returns {string[]}            Array of sliced strings.
   */
  clob2Array(clob, chunkSize) {
    /** @type {string[]} */
    const out = [];
    for (let i = 0; i < clob.length; i += chunkSize) {
      out.push(clob.slice(i, i + chunkSize));
    }
    return out;
  },
  /**
   * Extract Base64 part from a data-URI.
   * @param   {string} dataURI
   * @returns {string}
   */
  dataURI2base64(dataURI) {
    return dataURI.substring(dataURI.indexOf(",") + 1);
  },
  /**
   * Replace every <svg> inside `container` with a temporary <canvas>
   * (needed because html2canvas cannot rasterise inline SVG).
   * @param {string|HTMLElement|jQuery} containerSelector
   * @param {Function}                 done  Callback after conversion.
   */
  svg2canvas: function (containerSelector, callback) {
    try {
      var canvas, xml;
      var svgElements = $(containerSelector).find("svg");
      //replace all svgs with a temp canvas
      svgElements.each(function () {
        canvas = document.createElement("canvas");
        canvas.className = "tempCanvas";
        // Set proper width / height of SVG
        $(this).attr("width", $(this).innerWidth());
        $(this).attr("height", $(this).innerHeight());
        //convert SVG into a XML string
        xml = new XMLSerializer().serializeToString(this);
        // Removing the name space as IE throws an error
        xml = xml.replace(/xmlns=\"http:\/\/www\.w3\.org\/2000\/svg\"/, "");

        //draw the SVG onto a canvas
        canvg(canvas, xml);
        $(canvas).insertAfter(this);
        //hide the SVG element
        $(this).attr("class", "tempHide");
        $(this).hide();
      });
      callback();
    } catch (err) {
      callback();
    }
  },
  /**
   * Generate a single custom-height PDF page (Layout “C”).
   * @private
   * @param   {HTMLCanvasElement} canvas
   * @returns {jsPDF}
   */
  _pdfOnePage(canvas) {
    const scale = A4_CONTENT_WIDTH_MM / (canvas.width / PX_PER_MM);
    const drawHmm = (canvas.height / PX_PER_MM) * scale;
    const pageHmm = drawHmm + 2 * MARGIN_MM;

    const pdf = new jsPDF("p", "mm", [A4_WIDTH_MM, pageHmm]);
    pdf.addImage(
      canvas.toDataURL("image/jpeg", JPEG_QUALITY),
      "JPEG",
      MARGIN_MM,
      MARGIN_MM,
      A4_CONTENT_WIDTH_MM,
      drawHmm,
      null,
      "FAST"
    );
    return pdf;
  },
  /**
   * Generate a multi-page A4 PDF (true 10 mm top/bottom margins).
   * @private
   * @param   {HTMLCanvasElement} canvas
   * @returns {jsPDF}
   */
  _pdfMultiPage(canvas) {
    const pdf = new jsPDF("p", "mm", "a4");
    const scale = A4_CONTENT_WIDTH_MM / canvas.width; // px → mm
    const slicePx = Math.floor(A4_CONTENT_HEIGHT_MM / scale);
    const pages = Math.ceil(canvas.height / slicePx);

    for (let p = 0, ySrc = 0; p < pages; p++, ySrc += slicePx) {
      if (p > 0) {
        pdf.addPage();
      }

      const hPx = Math.min(slicePx, canvas.height - ySrc); // last slice
      const slice = document.createElement("canvas");
      Object.assign(slice, { width: canvas.width, height: hPx });
      slice
        .getContext("2d")
        .drawImage(canvas, 0, ySrc, canvas.width, hPx, 0, 0, canvas.width, hPx);

      pdf.addImage(
        slice.toDataURL("image/jpeg", JPEG_QUALITY),
        "JPEG",
        MARGIN_MM,
        MARGIN_MM,
        A4_CONTENT_WIDTH_MM,
        hPx * scale,
        null,
        "FAST"
      );
    }
    return pdf;
  },
  /**
   * Generate a single-page A4 PDF (Layout “S”).
   * @private
   * @param   {HTMLCanvasElement} canvas
   * @returns {jsPDF}
   */
  _pdfOneA4Page(canvas) {
    const pdf = new jsPDF("p", "mm", "a4");
    const pageW = pdf.internal.pageSize.getWidth() - 2 * MARGIN_MM;
    const pageH = pdf.internal.pageSize.getHeight() - 2 * MARGIN_MM;
    const ratio = canvas.width / canvas.height;
    const imgW = ratio > pageW / pageH ? pageW : pageH * ratio;
    const imgH = imgW / ratio;
    const offX = (pageW - imgW) / 2 + MARGIN_MM;
    const offY = (pageH - imgH) / 2 + MARGIN_MM;

    pdf.addImage(
      canvas.toDataURL("image/jpeg", JPEG_QUALITY),
      "JPEG",
      offX,
      offY,
      imgW,
      imgH,
      null,
      "FAST"
    );

    return pdf;
  },
  /**
   * Decide which PDF variant to build.
   * @param   {HTMLCanvasElement} canvas
   * @param   {"CONT_PAGE"|"MULTI_PAGE_A4"|"SINGLE_A4"|undefined} layout  CONT_PAGE = continuous, MULTI_PAGE_A4 = multipage, SINGLE_A4/default = fit page
   * @returns {jsPDF}
   */
  createPDF(canvas, layout) {
    const ratio = canvas.width / canvas.height;
    const drawW = A4_WIDTH_MM - 2 * MARGIN_MM;
    const drawH = drawW / ratio;
    const totalH = drawH + 2 * MARGIN_MM;

    if (layout === "CONT_PAGE" && totalH <= PDF_MAX_MM) {
      // continuous page up to 5080mm
      return apexScreenCapture._pdfOnePage(canvas);
    }
    if (layout === "MULTI_PAGE_A4" || totalH > PDF_MAX_MM) {
      /** multi-page A4 */
      return apexScreenCapture._pdfMultiPage(canvas);
    } else {
      /* default: single standard A4 page */
      return apexScreenCapture._pdfOneA4Page(canvas);
    }
  },
  /* ---- collectStyleSheets() : returns full <link> + <style> HTML ---- */
  /**
   * Collect every stylesheet the current page loads from /i/ and return
   * fully-qualified <link> tags plus inline CSS rules.  Query strings
   * (?v=22.2.4) are stripped so pdfShift treats the URL as static.
   */
  collectAPEXStyleSheets() {
    const links = Array.from(
      document.querySelectorAll('link[rel="stylesheet"]')
    )
      .filter((link) => link.href.includes("/i/"))
      .map((link) => {
        const clean = link.href.split("?")[0]; // drop ?v=… or ?ver=…
        return `<link rel="stylesheet" href="${clean}">`;
      })
      .join("\n");

    const inlineCss = Array.from(document.styleSheets)
      .map((ss) => {
        try {
          return Array.from(ss.cssRules)
            .map((r) => r.cssText)
            .join("\n");
        } catch (e) {
          console.error(ss + ": " + e);
          return "";
        } // CORS-protected, skip
      })
      .join("\n");

    const ret = `${links}\n<style>\n${inlineCss}\n</style>`;
    console.log(ret);

    return ret;
  },

  buildHtmlShell(fragmentHtml) {
    const ret = `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta charset="utf-8">
          <title>APEX Capture</title>
  
          <base href="https://app.springsolutions.com/i/">
          <link rel="stylesheet" href="${FONT_APEX_CSS}">
          <link rel="stylesheet" href="${UT_CSS_URL}">
  
          <style>
            ${Array.from(document.styleSheets)
              .map((s) => {
                try {
                  return Array.from(s.cssRules)
                    .map((r) => r.cssText)
                    .join("\n");
                } catch (e) {
                  return "";
                }
              })
              .join("\n")}
          </style>
        </head>
        <body>
          ${fragmentHtml /* The actual content to render */}
        </body>
      </html>
    `;

    console.log(ret);
    return ret;
  },
  /**
   * Convert an HTML snippet with pdfShift (sandbox) and download.
   * @param {string} htmlSource   The HTML you want rendered.
   * @param {string} fileName     Download name (defaults → capture.pdf)
   * @param {Function} done       Optional callback when finished.
   */
  convertViaPdfShift(htmlSource, fileName, done) {
    const authHeader = "Basic " + btoa("api:" + PDFSHIFT_KEY);

    fetch("https://api.pdfshift.io/v3/convert/pdf", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify({
        source: htmlSource,
        sandbox: USE_PDFSHIFT_SANDBOX, // <── no credits deducted
        margin: MARGIN_MM || "mm",
      }),
    })
      .then((r) => {
        if (!r.ok) throw new Error(r.status);
        return r.blob();
      })
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = Object.assign(document.createElement("a"), {
          href: url,
          download: fileName,
        });
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        done();
      })
      .catch((e) => {
        console.error("pdfShift error", e);
        done();
      });
  },

  /* -------------------------------------------------------------------- */
  /*  Main public helpers                                                 */
  /* -------------------------------------------------------------------- */

  /**
   * Convert a canvas to either an image or a PDF and deliver it
   * (download, open tab, or upload to APEX collection).
   * @param  {string}                                             ajaxIdentifier  APEX plugin Ajax ID (upload to DB mode).
   * @param  {HTMLCanvasElement}                                  canvas
   * @param  {"DIRECT_DOWNLOAD"|"NEW_TAB"|"DB_DOWNLOAD"}          openWindow      D = download, T = new tab, "B" = upload.
   * @param  {string}                                             mimeType        image/png, image/jpeg, application/pdf
   * @param  {string}                                             fileName        Base file name without extension.
   * @param  {"CONT_PAGE"|"MULTI_PAGE_A4"|"SINGLE_A4"|undefined}  pdfLayout       Continuous, Multi-page or default.
   * @param  {Function}                                           done            Callback after completion.
   */
  getImage(
    ajaxIdentifier,
    canvas,
    openWindow,
    mimeType,
    fileName,
    pdfLayout,
    done = () => {}
  ) {
    let pdf, dataURI;
    if (mimeType === "application/pdf") {
      pdf = apexScreenCapture.createPDF(canvas, pdfLayout);
      dataURI = pdf.output("datauristring");
    } else {
      dataURI = canvas.toDataURL(mimeType);
    }

    /* --- Direct download --- */
    if (openWindow === "DIRECT_DOWNLOAD") {
      if (pdf) {
        pdf.save(filename);
      } /* image */ else {
        const a = Object.assign(document.createElement("a"), {
          href: dataURI,
          download: filename,
        });
        document.body.appendChild(a);
        a.click();
        a.remove();
      }
      return done();
    }

    /* --- Open in new tab --- */
    if (openWindow === "NEW_TAB") {
      if (pdf) {
        window.open(pdf.output("bloburl"), "_blank");
      } /* image */ else {
        window.open().document.write(`<img src="${dataURI}" />`);
      }
      return done();
    }

    /* --- Upload to DB via APEX plugin --- */
    const base64 = apexScreenCapture.dataURI2base64(dataURI);
    const f01 = apexScreenCapture.clob2Array(base64, CLOB_CHUNK_SIZE);

    apex.server.plugin(
      ajaxIdentifier,
      { f01, x01: mimeType },
      {
        dataType: "html",
        success: () => {
          $("body").trigger("screencapture-saved-db");
          done();
        },
        error: (_xhr, msg) => {
          $("body").trigger("screencapture-error-db");
          console.error("getImage apex.server.plugin error:", msg);
          done();
        },
      }
    );
  },
  /**
   * Wrapper around html2canvas with SVG pre-processing and APEX spinner.
   * @param {...any} see call from captureScreen
   */
  doHtml2Canvas(
    htmlElem,
    openWindow,
    ajaxId,
    background,
    width,
    height,
    letterRendering,
    allowTaint,
    mimeType,
    logging,
    fileName,
    pdfLayout
  ) {
    /* Show spinner */
    const $spinner = apex.util
      .showSpinner($("body"))
      .attr("data-html2canvas-ignore", "true");

    /* Convert embedded SVGs first */
    apexScreenCapture.svg2canvas("body", () => {
      html2canvas($(htmlElem), {
        background,
        width,
        height,
        letterRendering,
        allowTaint,
        useCORS: true,
        logging,
        onrendered: (canvas) => {
          apexScreenCapture.getImage(
            ajaxId,
            canvas,
            openWindow,
            mimeType,
            fileName,
            pdfLayout,
            () => $spinner.remove() // always remove spinner
          );
        },
      });

      /* Cleanup temp canvases / hidden SVGs */
      $("body").find(".asc-temp-canvas").remove();
      $("body").find(".asc-temp-hide").show().removeClass("asc-temp-hide");
    });
  },
  /* -------------------------------------------------------------------- */
  /*  Entry point called by the Dynamic Action plugin                     */
  /* -------------------------------------------------------------------- */
  captureScreen() {
    const cfg = this.action; // provided by APEX DA
    const jQuerySelector = cfg.attribute01; // HTML element to capture
    const downloadType = cfg.attribute02; // Download type
    const backgroundColor = cfg.attribute04; // hex color string
    const widthInPixels = cfg.attribute05; // optional forced width
    const heightInPixels = cfg.attribute06; // optional forced height
    const doLetterRendering = apexScreenCapture.parseBoolean(cfg.attribute07);
    const doAllowTaint = apexScreenCapture.parseBoolean(cfg.attribute08);
    const doLogging = apexScreenCapture.parseBoolean(cfg.attribute09);
    const pdfLayout = cfg.attribute10;
    const fileName = cfg.attribute14; // file name for direct download
    const imageType = cfg.attribute15; // PNG / JPEG / PDF

    const mimeType =
      imageType === "PNG"
        ? "image/png"
        : imageType === "JPEG"
        ? "image/jpeg"
        : imageType === "PDF"
        ? "application/pdf"
        : "image/png";

    const safeBase = (
      typeof fileName === "string" && fileName.trim().length
        ? fileName.trim() // user-supplied
        : DEFAULT_FILENAME
    ) // fallback
      .replace(/[\\/:*?"<>|]/g, "_");

    const ext =
      imageType === "PDF" ? ".pdf" : imageType === "JPEG" ? ".jpg" : ".png";

    const sanitizedFileName =
      safeBase + (downloadType === "PDFSHIFT" ? "pdf" : ext);

    // Size of selected element (or full viewport for "body")
    let elemWidthPx, elemHeightPx;
    if (jQuerySelector !== "body") {
      elemWidthPx = $(jQuerySelector).innerWidth();
      elemHeightPx = $(jQuerySelector).innerHeight();
    } else {
      elemWidthPx = document.documentElement.clientWidth;
      elemHeightPx = document.documentElement.clientHeight;
    }
    if (widthInPixels) {
      elemWidthPx = parseInt(widthInPixels, 10);
    }
    if (heightInPixels) {
      elemHeightPx = parseInt(heightInPixels, 10);
    }

    // Debug console logging
    if (doLogging) {
      console.table({
        jQuerySelector,
        downloadType,
        backgroundColor,
        elemWidthPx,
        elemHeightPx,
        doLetterRendering,
        doAllowTaint,
        mimeType,
        fileName,
        sanitizedFileName,
        pdfLayout,
        FONT_APEX_CSS,
        UT_CSS_URL,
      });
    }

    if (downloadType === "PDFSHIFT") {
      /* Show spinner */
      const $spinner = apex.util
        .showSpinner($("body"))
        .attr("data-html2canvas-ignore", "true");

      const fragmentClean = $(jQuerySelector)
        .clone(true, true) // deep clone
        .find("[data-html2canvas-ignore]") // ← the only filter
        .remove() // delete those nodes
        .end() // back to cloned root
        .prop("outerHTML");

      const htmlDoc = apexScreenCapture.buildHtmlShell(
        $(jQuerySelector).prop("outerHTML")
      );
      apexScreenCapture.convertViaPdfShift(htmlDoc, sanitizedFileName, () =>
        $spinner.remove()
      );
      return;
    }

    // Call html2canvas
    apexScreenCapture.doHtml2Canvas(
      jQuerySelector, // element to rasterise
      downloadType,
      cfg.ajaxIdentifier, // APEX Ajax plug-in ID
      backgroundColor,
      elemWidthPx,
      elemHeightPx,
      doLetterRendering,
      doAllowTaint,
      mimeType,
      doLogging,
      sanitizedFileName,
      pdfLayout
    );
  },
};
