# Oracle APEX Dynamic Action Plugin - APEX Screen Capture

[![APEX Community](https://cdn.rawgit.com/Dani3lSun/apex-github-badges/78c5adbe/badges/apex-community-badge.svg)](https://github.com/Dani3lSun/apex-github-badges) [![APEX Plugin](https://cdn.rawgit.com/Dani3lSun/apex-github-badges/b7e95341/badges/apex-plugin-badge.svg)](https://github.com/Dani3lSun/apex-github-badges)
[![APEX Built with Love](https://cdn.rawgit.com/Dani3lSun/apex-github-badges/7919f913/badges/apex-love-badge.svg)](https://github.com/Dani3lSun/apex-github-badges)

This plugin allows you to take "screenshots/captures" of pages or parts of it, directly on the users browser.
The screenshot is based on the DOM and as such may not be 100% accurate to the real representation as it does not make an actual screenshot, but builds the screenshot based on the information available on the page.

This plugin also allows PDFShift integration for more accurate HTML rendering.

**Works best in modern browsers** 

[For more informations visit html2canvas](https://github.com/niklasvh/html2canvas)
[PDFShift](https://pdfshift.io/)


## Changelog

#### Spring 2.1 - PDFShift Integration
#### Spring 2.0 - CORS support, force vertical orientation, replace DOM Selector color option with filename option, add direct download option

---

#### 1.9.5 - Added option to export screenshot as a PDF file

#### 1.9.4 - get proper width/height of elements if JQuery Selector != body

#### 1.9.3 - added support for capturing SVG

#### 1.9.2 - fixed a bug there the DOM Selector picked the wrong region

#### 1.9.1 - added option to choose the mime type (PNG or JPEG) of the image which gets saved to DB

#### 1.9 - performance improvements when saving image / added wait spinner to visualize progress / fixed error when opening image in new tab in IE

#### 1.8 - added APEX events to plugin, so you can react with other DA on this (for saved to DB & error saving to DB)/ cleaned up js code with own namespace

#### 1.7 - added minified css/js files for normal mode and full files for debug mode

#### 1.6 - performance improvements(removed redundant AJAX call) / split the clob into a 30k param array (OHS 32k limit for params)

#### 1.5 - removed the save to item functionality / instead added a AJAX function which saves the resulting image to Database using custom PL/SQL code

#### 1.4 - Added options to pick a border color of your choice / fill the selector´s content with light transparent color (based on border color)

#### 1.3 - Added options to choose a filter of graphical DOM selector / Hide label of graphical DOM selector

#### 1.2 - Added possibility to capture part of screen with a graphical DOM selector (Choose DIV with your mouse cursor)

#### 1.1 - Set default width/height to browser dimensions for JQuery selectors

#### 1.0 - Initial Release


## Install

- Import plugin file "spring-apex-screen-capture-v2.1.0.sql" from source directory into your application
- (Optional) Deploy the JS files from "server" directory on your webserver and change the "File Prefix" to webservers folder.


## Plugin Settings

The plugin settings are highly customizable and you can change:
- **JQuery Selector** - Enter the JQuery Selector that should be captured
- **Download Type** - Choose whether the image should be opened in a new window, directly downloaded, saved to DB using custom PL/SQL (for BLOBs), or downloaded via PDFShift
- **PLSQL Code** - PLSQL code which saves the image to database tables or collections
- **Logging** - Whether to log events in the console
### Download Type PDFShift:
- **Portrait / Landscape PDF** - Render PDF in portait or landscape
- **PDFShift Zoom** - Zoom scaling for PDF (0..2]. < 1 is rendered smaller, > 1 is rendered larger.
### Download Type Other than PDFShift:
- **Background color** - Canvas background color, if none is specified in DOM. Set undefined for transparent
- **Width** - Width in pixels (default screen width)
- **Height** - Height in pixels (default screen height)
- **Output-Type** - Output-Type of the resulting screenshot image (e.g. PNG, JPEG, PDF)
- **Letter rendering** - Whether to render each letter separately
- **Allow taint** - Whether to allow cross-origin images to taint the canvas
- **PDF Mutli-Page Handling** - Whether to download PDFs as a single A4 page, multiple A4 pages, or attempt a long continuous page


## Plugin Events (not supported for PDFShift mode)
- **Screen Capture - Saved to DB** - DA event that fires when the image is successfully saved to DB
- **Screen Capture - Error saving to DB** - DA event that fires when saving to DB had an error

## How to use
- Create for example a new Dynamic Action with event "on button click"
- As action choose "APEX Screen Capture".
- Choose best fitting plugin attributes (help included)

#### Convert image to BLOB in PL/SQL / save to DB
For saving the screenshot (base64 png) to DB you can use a PL/SQL function like this:

```language-sql
DECLARE
  --
  l_collection_name VARCHAR2(100);
  l_blob            BLOB;
  l_filename        VARCHAR2(100);
  l_mime_type       VARCHAR2(100);
  l_token           VARCHAR2(32000);
  --
BEGIN
  -- get defaults
  l_mime_type := nvl(apex_application.g_x01,
                     'image/png');
  l_filename  := 'screenshot_' || to_char(SYSDATE,
                                          'YYYYMMDDHH24MISS');
  -- file name based on mime type
  IF l_mime_type = 'image/png' THEN
    l_filename := l_filename || '.png';
  ELSIF l_mime_type = 'image/jpeg' THEN
    l_filename := l_filename || '.jpg';
  ELSIF l_mime_type = 'application/pdf' THEN
    l_filename := l_filename || '.pdf';
  END IF;
  -- build CLOB from f01 30k Array
  dbms_lob.createtemporary(l_blob,
                           FALSE,
                           dbms_lob.session);
  FOR i IN 1 .. apex_application.g_f01.count LOOP
    l_token := wwv_flow.g_f01(i);
    IF length(l_token) > 0 THEN
      dbms_lob.append(l_blob,
                      to_blob(utl_encode.base64_decode(utl_raw.cast_to_raw(l_token))));
    END IF;
  END LOOP;
  --
  -- create own collection (here starts custom part (for example a Insert statement))
  -- collection name
  l_collection_name := 'SCREEN_CAPTURE';
  -- check if exist
  IF NOT apex_collection.collection_exists(p_collection_name => l_collection_name) THEN
    apex_collection.create_collection(l_collection_name);
  END IF;
  -- add collection member (only if BLOB not null)
  IF dbms_lob.getlength(lob_loc => l_blob) IS NOT NULL THEN
    apex_collection.add_member(p_collection_name => l_collection_name,
                               p_c001            => l_filename, -- filename
                               p_c002            => l_mime_type, -- mime_type
                               p_d001            => SYSDATE, -- date created
                               p_blob001         => l_blob); -- BLOB img content
  END IF;
  --
END;
```

#### Excluding page areas from getting rendered
If you would like to exclude some areas from getting rendered to the resulting image, just add

```
data-html2canvas-ignore="true"
```

to a element or a region or something else.
If you would like to exclude a complete region add the "data-html2canvas-ignore" attribute to the "Custom Attributes" field of a region in APEX Page Designer.


## Demo Application
https://apex.oracle.com/pls/apex/f?p=APEXPLUGIN


## Preview
![](https://github.com/Dani3lSun/apex-plugin-apexscreencapture/blob/master/preview.gif)
---
- [html2canvas](https://github.com/niklasvh/html2canvas)
- [ JQuery DOM Outline](https://github.com/andrewchilds/jQuery.DomOutline)
