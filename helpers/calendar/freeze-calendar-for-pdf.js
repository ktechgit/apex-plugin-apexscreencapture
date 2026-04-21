/*  DA: "Before PDF – Freeze Calendar at fixed width"
 *  Action: Execute JavaScript Code
 *  Fire Before: the Screen Capture (pdfShift) DA
 *
 *  Temporarily forces the calendar container to a fixed pixel width
 *  so that FullCalendar recalculates all its inline dimensions
 *  consistently, regardless of the user's browser viewport.
 *
 *  ── Width calculation ──
 *  A4 landscape = 297 mm,  minus 2 × margin (mm) = printable mm
 *  At 96 DPI  → printable px = printable_mm × (96 / 25.4)
 *  pdfShift zoom = 0.65  → effective content px = printable px / zoom
 *
 *  Example: margin = 25 mm, zoom = 0.65
 *    (297 - 50) × 3.7795 / 0.65 ≈ 1436 px
 *
 *  Adjust PDF_TARGET_WIDTH_PX if your margin or zoom differs.
 */

(function () {
  "use strict";

  // ── Configuration ─────────────────────────────────────────────
  var PDF_TARGET_WIDTH_PX = 1436;          // see calculation above
  var CALENDAR_STATIC_ID  = "EVENT_CALENDAR"; // APEX region static ID
  // ──────────────────────────────────────────────────────────────

  var calEl = document.getElementById(CALENDAR_STATIC_ID + "_calendar");
  if (!calEl) {
    console.warn("freeze-calendar: calendar element not found");
    return;
  }

  // 1. Save original inline styles so we can restore later
  window._pdfCalendarRestore = {
    width:    calEl.style.width,
    maxWidth: calEl.style.maxWidth,
    overflow: calEl.style.overflow
  };

  // 2. Force a fixed width on the calendar container
  calEl.style.width    = PDF_TARGET_WIDTH_PX + "px";
  calEl.style.maxWidth = PDF_TARGET_WIDTH_PX + "px";
  calEl.style.overflow = "hidden";

  // 3. Tell FullCalendar to recalculate at the new size.
  //    APEX FullCalendar 5 exposes the API on the jQuery widget data.
  try {
    var fc = apex.region(CALENDAR_STATIC_ID)
                 .widget()
                 .data("fullCalendar");  // FullCalendar Calendar API
    if (fc && typeof fc.updateSize === "function") {
      fc.updateSize();
      console.log("freeze-calendar: updateSize() called at " + PDF_TARGET_WIDTH_PX + "px");
    } else {
      // Fallback: trigger a window resize event so FC recalculates
      window.dispatchEvent(new Event("resize"));
      console.log("freeze-calendar: dispatched resize event");
    }
  } catch (e) {
    window.dispatchEvent(new Event("resize"));
    console.log("freeze-calendar: fallback resize dispatch", e);
  }
})();
