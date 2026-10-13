---
connie-page-id: "876871686"
connie-title: "HowTo: Focus PDF Export with Plugin (PDFScreenCapture)"
connie-dont-change-parent-page: true
---

# HowTo: Focus PDF Export with Plugin (PDFScreenCapture)

Use the Spring APEX Screen Capture plugin's **PDFShift** path to export Focus report HTML with its formatting. This guide covers reusable setup, interactive-report handling, optional page numbering, and a complete grouped-report example from [GB-19](https://springsolutions.atlassian.net/browse/GB-19).

PDFShift converts a cloned report fragment and its available styles. It does not query the database, apply pending filter edits, or fetch unloaded report pages. Display all matching rows before export and wait for the report refresh to finish.

## 1. Import the plugin

1. Get the reviewed [plugin export](../../source/spring-apex-to-pdf-v2.2.sql).
2. In the target APEX application, open **Shared Components → Plug-ins → Import** and import the SQL export.
3. Keep the installed plugin's source files synchronized with [`server/`](../../server/) and its renderer with [`source/source.sql`](../../source/source.sql).

Only JavaScript source is maintained in Git. APEX owns generated minified variants. The renderer loads source files in both debug and normal modes, so the import works without a separate minification step. This trades smaller normal-mode downloads for a single, consistent source path.

## 2. Get the PDFShift API key

1. In LastPass, open **Shared-Spring → PDFShift PDF Shift**, using the **vendor-accounts@springsolutions.com** account.
2. Use that saved login to sign in to [PDFShift API Keys](https://app.pdfshift.io/env/apikeys).
3. Locate **Legal Tech** and use its copy-token control. Do not use the **CIP** key for this setup.
4. Provision the copied token in the target application's parameter store through the normal credential setup process.

![Shared Spring PDFShift login in LastPass](assets/pdfshift-lastpass.png)

![PDFShift API Keys with the Legal Tech copy control highlighted and token values redacted](assets/pdfshift-api-keys.png)

### Application item and computation

Create the application item **`PDF_SHIFT_API_KEY`**. The plugin binds to that exact name. The existing parameter-store convention uses **`PDFSHIFT_API_KEY`** without the extra underscore; these are different identifiers.

Create an application computation after authentication using **SQL Query (return single value)**:

```sql
select p_value
from system_parameters
where p_name = 'PDFSHIFT_API_KEY'
```

The query must return exactly one nonempty value. Use a computation error message such as `Unable to retrieve PDFShift API key from system_parameters`.

## 3. Configure the report and Export PDF button

1. Wrap the report content in a nonvisual region if no suitable parent exists. Set its **Static ID** to `reptBody`, without the hash.
2. Create **Export PDF** in the top-right area above the filters/data grid. Set its action to **Defined by Dynamic Action**.
3. Create a click dynamic action on the button. Add a true action using **APEX Screen Capture (w/ PDFShift)** and disable **Fire on Initialization**.
4. Select the settings below. Wait for any asynchronous report refresh before capture.

| Setting | Configuration |
| --- | --- |
| JQuery Selector | `#reptBody`, or the actual wrapper Static ID prefixed with `#`. |
| Download Type | **PDFShift**. |
| Orientation | Portrait or landscape for the report. Wide reports may need landscape. |
| Margin / Zoom | Fit all columns and leave space for any footer; verify the resulting PDF. Avoid an empty/zero margin with the current request fallback. |
| File Name | A descriptive report filename without an extension. PDFShift mode adds `.pdf`. |

For an interactive report, the generated content container may be a better export target than the outer region. With region Static ID `reptBody`, that target is `#reptBody_content`. Use the actual `#<static_id>_content` present in the DOM; the `_content` suffix is not a separate Static ID to configure.

### Exclude controls, not report data

Add this to the **Custom Attributes** of buttons or child regions that should not appear in the PDF:

```html
data-html2canvas-ignore="true"
```

PDFShift mode explicitly removes descendants bearing the attribute. Presence is enough: a value of `"false"` still excludes a descendant. The selected export root itself is not removed. The plugin already excludes the interactive-report toolbar and controls; add a printable applied-filter summary if readers need it in the PDF.

## 4. Interactive Report Handling

Interactive reports need preparation because their on-screen sticky-header structure is not the same as a printable table. Use the following approach for a report that exports all rendered rows in one PDFShift conversion. Region IDs and group-marker classes are report-specific; the plugin does not perform these preparation steps automatically.

### Capture complete, current data

Apply filters and wait for the report refresh to finish. Configure the report to display all matching rows, not only the current report page. Select the generated `#<static_id>_content` container when it contains the data you need without surrounding controls. Do not start a refresh and export immediately: capture would use the old DOM.

### Prepare the native table heading

Before the plugin action:

1. Remove detached sticky-header copies and their placeholders. Leaving them in the capture can produce misaligned or duplicated headings.
2. Reset the data table's sticky-header margin offset. A zero-margin override alone did not fix continuation-page overlap in GB-19, but removes the leftover on-screen positioning offset.
3. If the native column-heading row is in `<tbody>`, move it into a `<thead>` on that same data table. Repeated headings require a real table header; styling a body row alone is insufficient.

These operations change the live report, not just the export clone. The GB-19 example below shows the complete preparation and restoration sequence. Its sticky cleanup uses page-wide selectors inherited from the working setup; on pages with multiple reports, scope cleanup to the intended report and inspect where APEX places its header copies before reusing it.

### Allow page flow without splitting body rows

Use `display: table-header-group` and `break-inside: avoid` on `<thead>`. Also use `break-inside: avoid; page-break-inside: avoid;` on **individual body rows**. Protecting the heading alone did not prevent overlap on continuation pages in GB-19; adding body-row protection corrected the reported failure.

Do not prevent breaks inside the entire table or `<tbody>`: long reports and groups must still span pages. A row taller than a printable page cannot be kept together, so unusually long cells need separate layout consideration.

The plugin copies accessible page CSS into the HTML shell. **Keep pagination rules outside `@media print`.** PDFShift defaults to screen media, and the plugin does not send `use_print: true`. Page-break rules affect paginated output without introducing page gaps on the normal scrolling page.

### Start each group on a new page

Give group-header rows a distinct HTML marker. Target the containing `tr`, not an inline label, and exclude subtotal/grand-total markers. CSS has no standard text-contains selector; matching names is not a reliable grouping contract.

Use a sibling selector to break before every group after the first. This assumes all group headers share a table-body parent and the report preserves group order. Long groups then spill across pages naturally. If `:has` is unavailable, JavaScript can mark the same header rows with a class; that changes selector compatibility, not table fragmentation behavior.

### Restore interactive behavior after capture

Add a separate **Execute JavaScript Code** action after the plugin action to refresh the report region. This rebuilds the normal sticky header and restores scrolling behavior. The current PDFShift path clones and serializes the report synchronously before starting its network request, so this later refresh does not alter the captured document.

This ordering is specific to the current plugin: if capture becomes asynchronous in a future version, restoration must wait until serialization completes.

### Optional borders through page-break whitespace

A table or wrapper border may continue through blank space before a forced page break. To remove a table-level border while retaining row/cell borders, try `border: 0` on the report's `table.a-IRR-table`, leaving `td` and `th` borders intact. If the line remains, inspect the surrounding APEX wrapper's computed borders rather than removing all descendant borders. This cosmetic adjustment was proposed separately; it is not required for the working pagination setup below.

## 5. Continuous Page X of Y

The updated plugin supports an optional bottom-right footer without consuming another APEX dynamic-action attribute. Import the updated SQL export or update the installed JavaScript before using this option.

In the Export PDF dynamic action, immediately before the plugin action, set the flag on the **exact element selected for capture**:

```javascript
document
  .getElementById('reptBody_content')
  .setAttribute('data-pdf-page-numbers', 'true');
```

Replace the ID if the plugin captures a different element. The plugin reads the root element's attribute, not a descendant's. Only the exact string `"true"` enables numbering; an absent attribute or any other value omits the footer and preserves existing behavior. For a later export without numbering, remove the attribute or set it to `"false"`. Set the flag on each export because a report refresh rebuilds the captured element.

The footer reads **Page X of Y**, right-aligned with bottom and right padding. Its inline styles and reserved footer height are defined in [`convertViaPdfShift`](../../server/apexscreencapture.js). Report CSS does not style the footer. Convert all groups in **one request** so numbering remains global; separate conversions restart numbering unless additional PDF post-processing is implemented. Austin confirmed the configured export works for GB-19; validate fit and spacing when adapting it to another report.

See [PDFShift header/footer variables](https://docs.pdfshift.io/docs/header-footer) and the [conversion API](https://docs.pdfshift.io/api-reference/convert-to-pdf).

## 6. Full example: GB-19 Open A/R Aging with Split %

Austin confirmed this report's configured export works, including the continuation-page fix. This example assembles the configuration in one place; it is not evidence that every other report has the same DOM or grouping semantics.

![Open AR Aging report filters and column headings; client data and developer tools excluded](assets/gb-ar-filters.png)

### Report and Focus page configuration

Use the existing report from [GB-14](https://springsolutions.atlassian.net/browse/GB-14), with the PDF requirements in [GB-19](https://springsolutions.atlassian.net/browse/GB-19). Complete the plugin import and API-key application item/computation from sections 1–2 first.

| Location | Configuration | Purpose |
| --- | --- | --- |
| Report wrapper region | Static ID `reptWrap`; template **Blank with Attributes** | Contains PDF title and interactive report without extra region chrome. |
| PDF title child region | Static ID `pdfTitle`; template **Blank with Attributes** | Hidden on screen, shown only during capture. |
| Report region → Static ID | `openARSplitPct` | Stable identifier for capture, CSS, and region refresh. |
| Interactive report → displayed rows | All matching rows | PDFShift captures the DOM, not unloaded report pages. |
| Report description column | Display `DESCR_CELL`; Escape Special Characters off | Renders the query's hierarchy and group-marker HTML. Dynamic text must remain escaped in SQL. |
| Report order | Preserve `SORT_KEY` order | Keeps each shareholder's headers, detail rows, and totals together. |
| Export PDF button | Top-right above filters/grid; Defined by Dynamic Action | Runs preparation, capture, and restoration in order. |
| Capture action → JQuery Selector | `#reptWrap` | Captures both the PDF title and interactive report. Table preparation still targets `openARSplitPct_content`. |
| Capture action → Download Type | PDFShift | Uses HTML conversion rather than canvas capture. |
| Capture action → Orientation | Landscape for this wide report | Gives aging, total, and percentage columns room. |
| Capture action → Margin / Zoom | Fit to the report and padded footer | These remain report-specific; retain the values that fit the installed report. |
| Capture action → File Name | `&P11_PDF_FILENAME.` | Uses the computed name at page rendering; plugin adds `.pdf`. |
| Click dynamic action | Fire on Initialization off | Export runs on button click, not page initialization. |

Apply filters and finish the report refresh before clicking Export PDF. If a button also applies filters, capture must run after that refresh completes, not merely after initiating it.

### PDF title and submitted-filter computations

GB-19 applies filters by submitting and rerendering the page. Create hidden page items `P11_REPT_SUBTEXT` and `P11_PDF_FILENAME`, with **Before Header** computations of type **SQL Query (return single value)**. Submitted filters are in session state before these computations run, and substitutions resolve when the title and plugin action render. JavaScript item updates alone would not refresh those substitutions; this configuration depends on the full-page submission flow.

The final title is literal text, so no `P11_REPT_NAME` item is needed. Put this in the `pdfTitle` region's HTML Code:

```html
<div class="rept-heading">
  <h1 id="reptName">Open A/R Aging — Split %</h1>
  <p id="reptSubtext">&P11_REPT_SUBTEXT!HTML.</p><br/>
</div>
```

The `!HTML` substitution escapes the summary safely. Configure `P11_REPT_SUBTEXT` with:

```sql
select
    case
        when :P11_END_DATE is null then 'All dates'
        else 'Issued through ' || :P11_END_DATE
    end
    || ' · ' ||
    case upper(nvl(:P11_DEPT_SCOPE, 'ALL'))
        when 'EXCL' then 'Excluding internal'
        when 'ONLY' then 'Internal only'
        else 'All departments'
    end
    || ' · Shareholder: ' || nvl(:P11_SHAREHOLDER, 'All')
    || ' · Client: ' ||
    case
        when :P11_CLIENT is null then 'All'
        else nvl(
            (select c.name
               from contacts c
              where c.id = to_number(
                  :P11_CLIENT default null on conversion error
              )),
            :P11_CLIENT
        )
    end
    || ' · Matter: ' ||
    case
        when :P11_MATTER is null then 'All'
        else nvl(
            (select m.display_number
               from matters m
              where m.id = to_number(
                  :P11_MATTER default null on conversion error
              )),
            :P11_MATTER
        )
    end as subtext
from dual
```

This resolves client/matter IDs to readable labels, describes department scope, and distinguishes unrestricted filters. **Issued through** describes the bill issue-date cutoff: the report's aging buckets still use `sysdate`, not the chosen end date.

Configure `P11_PDF_FILENAME` with:

```sql
select
    'Open_AR_Aging_Split_'
    || case
        when :P11_END_DATE is null then 'All_Dates'
        else nvl(
            to_char(
                to_date(
                    :P11_END_DATE default null on conversion error,
                    'MM/DD/YYYY'
                ),
                'YYYY-MM-DD'
            ),
            'Invalid_Date'
        )
    end as filename
from dual
```

The filename uses the issue-date cutoff, or `All_Dates`, without an extension. Ensure Clear Filters resets session-state filter values before the Before Header computations.

### SQL markers used by the export

The existing query emits `SH_HEADER`, `SH_TOTAL`, and `GRAND` rows. Their `DESCR_CELL` markup distinguishes group starts from totals:

```html
<!-- SH_HEADER -->
<span class="gb-l0"><strong>Shareholder name</strong></span>

<!-- SH_TOTAL -->
<span class="gb-l0 gb-tot"><strong>Total shareholder name</strong></span>

<!-- GRAND -->
<span class="gb-l0 gb-grand"><strong>Report Totals</strong></span>
```

Names above are placeholders. The SQL uses `apex_escape.html` for shareholder, client, and matter text; keep that escaping when the column renders HTML. Do not hide the marker column or reorder groups with an interactive-report sort when exporting this layout.

### Page CSS → Inline

Keep these rules outside `@media print`:

```css
.gb-l0 { padding-left: 0; }
.gb-l1 { padding-left: 1.5rem; }
.gb-l2 { padding-left: 3rem; }
.gb-l3 { padding-left: 4.5rem; }
.gb-tot { font-weight: 600; }
.gb-grand { text-transform: uppercase; letter-spacing: .04em; }

/* Break before every shareholder after the first, not their totals. */
#openARSplitPct_content tr:has(.gb-l0:not(.gb-tot):not(.gb-grand))
  ~ tr:has(.gb-l0:not(.gb-tot):not(.gb-grand)) {
  break-before: page;
  page-break-before: always;
}

/* Repeat native column headings on continuation pages. */
#openARSplitPct_content thead {
  display: table-header-group;
  break-inside: avoid;
}

#openARSplitPct_content thead tr {
  break-inside: avoid;
  break-after: avoid;
}

/* Keep each body row intact without keeping the whole group together. */
#openARSplitPct_content tbody > tr {
  break-inside: avoid;
  page-break-inside: avoid;
}

#pdfTitle .rept-heading {
  text-align: center;
  margin-bottom: 1rem;
}

#pdfTitle .rept-heading h1 {
  margin: 0;
  font-size: 1.25rem;
  line-height: 1.3;
  font-weight: 700;
}

#pdfTitle .rept-heading p {
  margin: .4rem 0 0;
  font-size: .85rem;
  line-height: 1.5;
}

/* Active in exported HTML while title is shown for capture. */
html:has(#pdfTitle.pdf-export-visible),
body:has(#pdfTitle.pdf-export-visible) {
  background: #fff !important;
  background-image: none !important;
}

#reptWrap:has(#pdfTitle.pdf-export-visible),
#pdfTitle.pdf-export-visible {
  background: #fff !important;
  background-image: none !important;
}

#pdfTitle {
  display: none;
}

#pdfTitle.pdf-export-visible {
  display: block;
}
```

| CSS rule | What it does |
| --- | --- |
| `gb-l0` through `gb-l3` | Preserves shareholder, client, matter, and detail indentation. |
| `gb-tot` / `gb-grand` | Preserves total emphasis and identifies rows that must not trigger shareholder breaks. |
| Header-row `:has(...) ~ tr:has(...)` | Selects later shareholder header rows sharing the same parent. Skips the first to avoid a leading blank page. |
| `<thead>` rules | Allows the native column heading to repeat and keeps it together. Requires the JavaScript promotion below. |
| `tbody > tr` rules | Keeps body rows from splitting at page boundaries. This addition fixed the reported repeated-header overlap; margin reset alone did not. |
| `.rept-heading` rules | Centers the title and summary, with a smaller heading and readable line spacing. |
| `pdf-export-visible` display rules | Hides the title on screen and shows it during serialization into the exported document. |
| Export-visible background rules | Paints the exported page, wrapper, and title white, including empty space below the report. Does not remove table-header shading or change the normal application theme. |

Selecting a smaller capture region does not isolate it from theme CSS: the plugin creates a new HTML body with APEX styles. The temporary title class scopes the white-background override to the exported document. Avoid setting every descendant background to white, which would erase report shading. Austin confirmed the title and background rules work in GB-19.

### JavaScript → Function and Global Variable Declaration

Add the helper used by the working report:

```javascript
function disableStickyHeaders() {
  $('.js-stickyTableHeader').remove();
  $('.js-stickyWidget-placeholder').remove();
  $('.a-IRR-table').css('margin-top', '0');
}
```

This helper removes on-screen header copies/placeholders and resets their table offset. It uses page-wide selectors; adapt its scope before using it on a page with multiple interactive reports.

### Export PDF click dynamic action: three ordered true actions

**Action 1 — Execute JavaScript Code**, immediately before the plugin:

```javascript
document
  .getElementById('pdfTitle')
  .classList.add('pdf-export-visible');

disableStickyHeaders();

const row = document
  .querySelector('#openARSplitPct_content th.a-IRR-header')
  ?.closest('tr');

if (row && row.parentElement.tagName !== 'THEAD') {
  const table = row.closest('table');
  const thead = table.tHead || table.createTHead();
  thead.appendChild(row);
}

document
  .querySelectorAll('#openARSplitPct_content table.a-IRR-table')
  .forEach(table => {
    table.style.setProperty('margin-top', '0px', 'important');
  });

document
  .getElementById('reptWrap')
  .setAttribute('data-pdf-page-numbers', 'true');
```

| Preparation step | What it does |
| --- | --- |
| Show `pdfTitle` | Includes the heading/summary in capture and activates export-only white backgrounds. |
| `disableStickyHeaders()` | Removes detached sticky headings that previously produced misaligned PDF columns. |
| Find `th.a-IRR-header` and move its row | GB-19's native heading was in `<tbody>`. Promotes the existing row into the same table's `<thead>` so it can repeat. Does not duplicate the row. |
| Inline zero-margin override | Prevents ordinary sticky-widget margin updates from restoring the negative offset before capture. |
| `data-pdf-page-numbers="true"` | Enables the plugin's optional bottom-right footer on the exact capture root. No extra dynamic-action attribute is needed. |

**Action 2 — APEX Screen Capture (w/ PDFShift)**, using the settings above. This clones and serializes the prepared report, then submits one document to PDFShift. All shareholder pages share one page-number sequence.

**Action 3 — Execute JavaScript Code**, after the plugin:

```javascript
document
  .getElementById('pdfTitle')
  .classList.remove('pdf-export-visible');

apex.region('openARSplitPct').refresh();
```

Removing the class hides the live title and restores the normal background. The serialized export retains the class and its title because the plugin already copied the HTML. Refresh rebuilds the normal interactive report after live DOM preparation, avoiding the disappearing-header behavior on subsequent scrolling. Do not refresh between preparation and capture. The footer flag is reapplied by Action 1 on every export.

### Why this report does not cycle the shareholder filter

All groups already exist in the rendered report, so one capture is sufficient. Also, GB-19's supplied filter is matter-based:

```sql
where (:P11_SHAREHOLDER is null
         or matter_id in (select r2.matter_id from res r2
                           where r2.shareholder = :P11_SHAREHOLDER))
```

Selecting a shareholder retains all splits on matching matters, including other shareholders' rows. Cycling the filter and concatenating exports could duplicate groups and amounts. Preserve those report semantics; do not change the SQL predicate just to simplify PDF generation.

## Adapting the example to another report

| Requirement | Implementation boundary |
| --- | --- |
| Top-right Export PDF button | APEX page configuration. |
| Applied filters and complete result | Capture after Apply Filters/refresh, with every matching row rendered. Displaying all rows addresses pagination, not stale or unapplied filters. |
| Indents, colors, shading | HTML and available styles are captured; compare actual PDF against the report, including inherited styles, fonts, and column widths. |
| Group page starts and spillover | Adapt the group-marker selector to the report's HTML and preserve order. GB-20 needs its own markup inspection; do not assume GB-19 classes. |
| Continuous Page X of Y | Opt in on the actual capture root using the updated plugin. Fit the footer to that report's margins. |

## Acceptance checks and screenshots to collect

Use the existing checks below when adapting this setup. GB-19's success does not verify another report's completeness or layout. Capture screenshots from the actual APEX configuration and resulting PDFs, using approved non-sensitive data.

- **Placement:** Capture the full report header showing Export PDF at top-right above filters/grid. Existing GB and SJRM reference screenshots are attached to [GB-19](https://springsolutions.atlassian.net/browse/GB-19) and [GB-20](https://springsolutions.atlassian.net/browse/GB-20).
- **Completeness:** Use a filter combination spanning more than one on-screen report page. Compare exported row counts and monetary totals against the complete filtered report, not only the visible page. Repeat after changing and applying filters; compare exported shareholder groups with those in the applied report.
- **Page boundaries:** Export a short shareholder, a multi-page shareholder, and another short shareholder in that order. Capture the end/start boundary: each shareholder starts a new page, long groups spill naturally, and no content is lost. Check near-page-end rows and the final page for clipping or blank pages.
- **Page numbering:** Capture first, shareholder-boundary, and last PDF pages. Verify every footer uses global numbering and the last reads Page N of N.
- **Formatting:** Compare report and PDF screenshots with indents, colored text, shading, subtotals, and long values. Confirm export controls are excluded and all columns fit.

## References

- [Spring plugin repository](https://github.com/ktechgit/apex-plugin-apexscreencapture)
- [PDFShift API Keys](https://app.pdfshift.io/env/apikeys)
- [GB-19: Open A/R Aging export](https://springsolutions.atlassian.net/browse/GB-19)
- [GB-20: Cash Receipts Detail export](https://springsolutions.atlassian.net/browse/GB-20)
- Underlying reports: [GB-14](https://springsolutions.atlassian.net/browse/GB-14), [GB-13](https://springsolutions.atlassian.net/browse/GB-13).
- [Article update and requirement review](https://ampcode.com/threads/T-01a13224-0a01-74f8-82ad-db0d4734200a)
