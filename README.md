# WRONG MACHINE — v1.2.0 / FILE GLITCHER

Static experimental data-art laboratory for GitHub Pages. Version 1.2 adds an interactive, browser-only **FILE GLITCHER** with a text-editable hexadecimal file/pixel view, before-and-after image previews, random corruption, reset and export, and transfer to the Image → Sound lab. The image/audio conversion features introduced in earlier versions remain available.

## Deploy

Extract the ZIP and upload these six files into the **root** of the GitHub repository:

- `index.html`
- `style.css`
- `app.js`
- `sonification.js`
- `glitcher.js` **(new in v1.2)**
- `README.md`

GitHub **Settings → Pages → Deploy from a branch → main → /(root)**. Hard-refresh the live page once deployed. Everything runs in the browser; there is no server, upload service, or login.

## How the new File Glitcher works

Choose **03 FILE GLITCHER**, upload an image (PNG, JPG, WebP, GIF or BMP; file size limit 20 MiB). Choose one of two representations:

1. **Decoded RGBA pixels**, available for any supported image. The machine decodes the file to a canvas (maximum 1024 pixels on longest edge), then shows editable 2-digit hexadecimal bytes. Each pixel has four successive bytes (R, G, B, A). Changing bytes changes pixels. Output is always a newly encoded, **valid PNG**. This is robust and guaranteed to be an edit of decoded pixel data, but is **not** a direct edit of the compressed original file's binary structure.
2. **Original JPEG compressed scan bytes**, enabled when a JPEG scan is detected. These are *literal original file bytes*. The editor parses JPEG markers, finds the entropy-coded image scan data, and restricts editing to a selected scan. Headers, metadata, image dimensions, existing JPEG markers/stuffing bytes and file length are locked; the editor also refuses to create new FF marker bytes. Edits can cause genuine compressed-image glitch effects **or** make the file undecodable. The app reports decoder failure instead of pretending the operation succeeded. Output is the modified JPEG byte stream with the original layout preserved. Multiple scans may exist in progressive JPEG files; you can select the scan being edited.

The editable box represents bytes as **hex text** (e.g., `FF 00 80 2A`) and the ASCII translation is shown in a separate read-only display. Image files are binary; directly editing them as UTF-8 text would corrupt arbitrary byte sequences. This editor lets you make text-based changes *without silently recoding the entire file*. Do not delete or insert bytes: you must preserve **exactly the same count** in each edit window. All replacements must be two hexadecimal digits between `00` and `FF`.

### Suggested exercises

- Try **RGBA mode** first on a photograph: jump to an offset well into the pixel buffer, change a cluster of hex bytes, click **Apply**, and see how pixels change. Try random corruption for a more visible result.
- Try **JPEG scan mode** on a baseline JPEG. Set random intensity to a small value (e.g. `1`–`5` out of `10000`) to see whether the decoder still yields a recognisable image. Some JPEG edits will break the entire image or make the lower portion distorted: this is normal.
- Compare the **Original** and **Glitched** previews; export the new file. Use **Send to Image → Sound** to hear the altered version with either Raw File Sound or True Spectral Painting.
- **Reset original** always creates a fresh working copy from your source. Your local file is never overwritten.

### Important limitations

- JPEG entropy data does not guarantee editable, self-contained pixels. Tiny changes may cascade through the compressed stream; the decoder may reject it. This is **real file-level corruption**, not a deterministic visual filter. If a file no longer decodes, use Reset or try less corruption. You can still export the broken file to examine in other tools.
- JPEG scan parser provides best effort across ordinary baseline and progressive JPEG files; unusual formats or unsupported markers may not be editable in this mode.
- In Pixel mode, the working canvas is limited to 1024 pixels along its longest side to stay responsive in browsers; exports use this processed resolution. JPEG byte mode edits the **full original file bytes** and retains the original dimensions.
- This version doesn't offer editable plaintext interpretations of compressed PNG `IDAT` streams. PNG generally needs valid DEFLATE encoding and CRC checks. Its RGBA pixel representation is the reliable alternative.
- The editor holds one working image at a time and does not store edits after a page reload. Export to preserve the result.
- Google Fonts load from the internet when available. All processing is local.

## Other tools

- Image → Sound: True Spectral Painting (FFT frequency magnitude derived from decoded pixels), Raw File Sound (uploaded file bytes interpreted as PCM), and legacy artistic modes.
- Sound → Image: spectrogram, sample pixel art, and spiral visualisation; audio pitch/speed and effect controls.
- Image music sequencer, download/export, local artwork gallery.

Note: no image has an objectively unique sound. Raw File Sound preserves literal file bytes but needs a choice of PCM encoding/sample rate. Spectral Painting maps decoded luminance to frequency magnitudes and reconstructs phase, which isn't stored in image data. There are **no undisclosed harmonic backing layers** in the new modes.

## Verification

- JavaScript syntax checks and pure algorithm tests for hexadecimal parsing, JPEG scan bounds, and protected mutations are performed during packaging.
- The browser preview, download, and integration flow should be tested in your deployed GitHub Pages version. Highly corrupted JPEGs may be rendered inconsistently across browsers.
