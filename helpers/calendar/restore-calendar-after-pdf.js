/*  DA: "After PDF – Restore Calendar"
 *  Action: Execute JavaScript Code
 *  Fire After: the Screen Capture (pdfShift) DA
 *
 *  Restores the calendar container to its original dimensions
 *  and lets FullCalendar re-layout for the actual viewport.
 */

(function () {
  "use strict";

  var CALENDAR_STATIC_ID = "EVENT_CALENDAR";

  var calEl = document.getElementById(CALENDAR_STATIC_ID + "_calendar");
  if (!calEl || !window._pdfCalendarRestore) {
    console.warn("restore-calendar: nothing to restore");
    return;
  }

  // 1. Restore original inline styles
  var saved = window._pdfCalendarRestore;
  calEl.style.width    = saved.width    || "";
  calEl.style.maxWidth = saved.maxWidth || "";
  calEl.style.overflow = saved.overflow || "";

  // 2. Let FullCalendar re-layout for the actual viewport
  try {
    var fc = apex.region(CALENDAR_STATIC_ID)
                 .widget()
                 .data("fullCalendar");
    if (fc && typeof fc.updateSize === "function") {
      fc.updateSize();
    } else {
      window.dispatchEvent(new Event("resize"));
    }
  } catch (e) {
    window.dispatchEvent(new Event("resize"));
  }

  // 3. Cleanup
  delete window._pdfCalendarRestore;
  console.log("restore-calendar: done");
})();
