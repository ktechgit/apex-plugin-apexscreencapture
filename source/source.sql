/*-------------------------------------
 * APEX Screen Capture functions
 * Original Version: 1.9.5 (21.10.2019)  - Daniel Hochleitner
 * Fork Version   : 1.9.6  (2025-04-29)  - Austin Huizinga
 * 1.9.6  - Added:
 *   - attribute_14 as "File Name" (DOM Selector color is now fixed) - custom download name
 *   - openWindow = 'D' -> direct download (no pop-up)
 *   - js improvements: useCORS, portrait PDF, fixed 10 mm PDF margins
 * 2.2.0  - Merged:
 *   - attribute_04 changed from backgroundColor to margin (mm)
 *   - Dynamic margin threaded through all PDF generation functions
 *   - Enhanced pdfShift error handling with full response body logging
 *   - Fixed orientation bug (pdfOrientation passed correctly to convertViaPdfShift)
 *-------------------------------------
*/
FUNCTION render_screencapture(p_dynamic_action IN apex_plugin.t_dynamic_action,
                              p_plugin         IN apex_plugin.t_plugin)
  RETURN apex_plugin.t_dynamic_action_render_result IS
  --
  -- plugin attributes
  l_result           apex_plugin.t_dynamic_action_render_result;
  l_html_elem        VARCHAR2(200) := p_dynamic_action.attribute_01;
  l_open_window      VARCHAR2(50) := p_dynamic_action.attribute_02;
  l_plsql            p_dynamic_action.attribute_03%TYPE := p_dynamic_action.attribute_03;
  l_margin           NUMBER := p_dynamic_action.attribute_04;
  l_width            NUMBER := p_dynamic_action.attribute_05;
  l_height           NUMBER := p_dynamic_action.attribute_06;
  l_letter_rendering VARCHAR2(50) := p_dynamic_action.attribute_07;
  l_allow_taint      VARCHAR2(50) := p_dynamic_action.attribute_08;
  l_logging          VARCHAR2(50) := p_dynamic_action.attribute_09;
  l_pdf_layout       VARCHAR2(50) := p_dynamic_action.attribute_10;
  l_pdfshift_key     VARCHAR(200) := :PDF_SHIFT_API_KEY;
  l_pdf_orientation  VARCHAR2(50) := p_dynamic_action.attribute_12;
  l_pdfshift_zoom    NUMBER       := p_dynamic_action.attribute_13;
  l_file_name        VARCHAR2(255) := p_dynamic_action.attribute_14;
  l_image_mime_type  VARCHAR2(50) := p_dynamic_action.attribute_15;
  -- js file vars
  l_apexscreencapture_js VARCHAR2(50);
  l_html2canvas_js       VARCHAR2(50);
  l_promise_js           VARCHAR2(50);
  l_domoutline_js        VARCHAR2(50);
  l_canvg_js             VARCHAR2(50);
  l_jspdf_js             VARCHAR2(50);
  --
BEGIN
  -- Debug
  IF apex_application.g_debug THEN
    apex_plugin_util.debug_dynamic_action(p_plugin         => p_plugin,
                                          p_dynamic_action => p_dynamic_action);
    -- set js/css filenames
    l_apexscreencapture_js := 'apexscreencapture';
    l_html2canvas_js       := 'html2canvas';
    l_promise_js           := 'es6-promise';
    l_domoutline_js        := 'jquery.dom-outline-1.0';
    l_canvg_js             := 'canvg-all';
    l_jspdf_js             := 'jspdf';
  ELSE
    -- minified
    l_apexscreencapture_js := 'apexscreencapture.min';
    l_html2canvas_js       := 'html2canvas.min';
    l_promise_js           := 'es6-promise.min';
    l_domoutline_js        := 'jquery.dom-outline-1.0.min';
    l_canvg_js             := 'canvg-all.min';
    l_jspdf_js             := 'jspdf.min';
  END IF;
  -- attribute defaults
  l_open_window      := nvl(l_open_window,
                            'Y');
  l_pdf_layout       := nvl(l_pdf_layout,
                             'SINGLE_A4');
  l_letter_rendering := nvl(l_letter_rendering,
                            'false');
  l_allow_taint      := nvl(l_allow_taint,
                            'false');
  l_image_mime_type  := nvl(l_image_mime_type,
                            'PNG');
  l_logging          := nvl(l_logging,
                            'false');
  l_pdf_orientation  := nvl(l_pdf_orientation,
                             'PORTRAIT');
  l_pdfshift_zoom    := nvl(l_pdfshift_zoom, 1);
  l_margin           := nvl(l_margin, 25);
  --
  -- add html2canvas js / screencapture js / jquery dom outline js (and promise for older browsers)
  apex_javascript.add_library(p_name           => l_promise_js,
                              p_directory      => p_plugin.file_prefix,
                              p_version        => NULL,
                              p_skip_extension => FALSE);

  --
  apex_javascript.add_library(p_name           => l_html2canvas_js,
                              p_directory      => p_plugin.file_prefix,
                              p_version        => NULL,
                              p_skip_extension => FALSE);
  --
  apex_javascript.add_library(p_name           => l_canvg_js,
                              p_directory      => p_plugin.file_prefix,
                              p_version        => NULL,
                              p_skip_extension => FALSE);
  -- add jsPDF lib for PDF outputs
  IF l_image_mime_type = 'PDF' THEN
    apex_javascript.add_library(p_name           => l_jspdf_js,
                                p_directory      => p_plugin.file_prefix,
                                p_version        => NULL,
                                p_skip_extension => FALSE);
  END IF;
  --
  apex_javascript.add_library(p_name           => l_apexscreencapture_js,
                              p_directory      => p_plugin.file_prefix,
                              p_version        => NULL,
                              p_skip_extension => FALSE);

  --
  l_result.javascript_function := 'apexScreenCapture.captureScreen';
  l_result.ajax_identifier     := apex_plugin.get_ajax_identifier;
  l_result.attribute_01        := l_html_elem;
  l_result.attribute_02        := l_open_window;
  l_result.attribute_03        := l_plsql;
  l_result.attribute_04        := l_margin;
  l_result.attribute_05        := l_width;
  l_result.attribute_06        := l_height;
  l_result.attribute_07        := l_letter_rendering;
  l_result.attribute_08        := l_allow_taint;
  l_result.attribute_09        := l_logging;
  l_result.attribute_10        := l_pdf_layout;
  l_result.attribute_11        := l_pdfshift_key;
  l_result.attribute_12        := l_pdf_orientation;
  l_result.attribute_13        := l_pdfshift_zoom;
  l_result.attribute_14        := l_file_name;
  l_result.attribute_15        := l_image_mime_type;
  --
  RETURN l_result;
  --
END render_screencapture;
--
--
-- AJAX function
--
--
FUNCTION ajax_screencapture(p_dynamic_action IN apex_plugin.t_dynamic_action,
                            p_plugin         IN apex_plugin.t_plugin) RETURN apex_plugin.t_dynamic_action_ajax_result IS
  --
  -- plugin attributes
  l_result apex_plugin.t_dynamic_action_ajax_result;
  l_plsql  p_dynamic_action.attribute_03%TYPE := p_dynamic_action.attribute_03;
  --
BEGIN
  -- execute PL/SQL
  apex_plugin_util.execute_plsql_code(p_plsql_code => l_plsql);
  --
  --
  RETURN l_result;
  --
END ajax_screencapture;
