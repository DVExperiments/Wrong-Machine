# WRONG MACHINE — v1.4 / LIVE TEXT GLITCH LAB

A static GitHub Pages experimental audio / image art app. **v1.4 fixes the v1.3 glitcher problem where most raw text edits simply caused “current file does not decode”.** The new default mode is visual-first **Pixel Text**, and raw file corruption remains available as an optional experiment.

## Install on GitHub Pages

Unzip and upload these six files into your repository root, replacing their older versions:

- `index.html`
- `style.css`
- `app.js`
- `sonification.js`
- `glitcher.js`
- `README.md`

Use GitHub **Settings → Pages → Deploy from a branch → main → /(root)**. Hard-reload the browser after deployment. No backend or uploads required; everything runs locally.

## How to use the fixed glitcher

1. Open **03 TEXT GLITCHER** and choose an image (PNG/JPEG/GIF/WebP/BMP, under 8 MB).
2. The default is **PIXEL TEXT / LIVE IMAGE GLITCH**. The editor shows the decoded RGB pixel colours, not compressed PNG/JPEG bytes.
3. Each six-character hexadecimal token is one pixel: `FF0000` is red, `00FF00` is green, `0000FF` is blue. The initial image determines all the starting colours.
4. Replace colours, delete groups of tokens, insert new colour tokens, or type arbitrary words such as `GLITCH`. Words are hashed to deterministic colours. Adding/deleting tokens shifts subsequent pixels, creating graphical glitches.
5. The image preview updates automatically after you stop typing. You can also press **REFRESH PREVIEW** manually.
6. Export the result as a **valid PNG**, or send it to **IMAGE → SOUND** to hear the new pixel data. The exported PNG is limited to the pixel-workspace resolution, selectable as 96, 160, or 256 pixels on the longest side (images smaller than the limit remain at native size).

The left side shows the source image and glitched preview; the right side is the unrestricted text editor. **No valid pixel text edit should produce a file-decoding error**—missing tokens are black, extra tokens are ignored, and arbitrary words become colours. The text editor is a creative representation of decoded pixels, not the original compressed image's textual file content.

## Advanced: actual raw file databending

Select **RAW FILE / ESCAPED BINARY TEXT** to examine original file bytes. Printable bytes are displayed literally, and special/non-printable bytes appear as `\\xNN` escapes. Or choose **RAW FILE / HEX STREAM** to add, remove and change two-digit hexadecimal byte tokens. These two modes modify the *actual uploaded file bytes*. Export retains the original file format and can produce non-decodable files.

**Important:** PNG, JPEG, WebP and other image formats contain headers, structure, compressed data, and sometimes checksums. Arbitrary additions/deletions to actual compressed data usually break decoding entirely. That does not mean the preview mechanism is broken: the original edited file has become invalid. Switch back to Pixel Text to make visible glitches reliably.

Switching between the two approaches does not combine them. The app preserves the unsaved editor text separately per view during the session, and the raw modes begin from the original file bytes rather than from the pixel-edited output. To turn a pixel-edit into literal raw file bytes, export the PNG and re-upload it.

## Tests performed

Automated headless Chromium interaction tests against the actual static files:

- JPG and PNG import succeeds without page script errors.
- Pixel text is populated with real image RGB data.
- Replacing or inserting text changes the preview pixels.
- Deleting everything still creates a valid preview (black image).
- Random mangle, insert and delete controls run and update the preview.
- Exported PNG opens correctly and preserves the selected pixel grid size.
- Send to Image → Sound loads the edited image in the sound lab.
- Raw file mode can render unchanged original file bytes and properly reports decoder failure after deliberate corruption.

## Limits

- Browser-only; edits disappear after reloading unless exported.
- The 8 MB upload size limit and max 256-pixel editing grid keep text editing responsive.
- Pixel Text is intentionally RGB only (source alpha is composited onto the lab's dark background).
- Raw file editing offers no structural protections; broken files remain exportable.
- JPEG images may yield different corruption patterns than PNG in raw mode and are frequently undecodable after arbitrary changes.
