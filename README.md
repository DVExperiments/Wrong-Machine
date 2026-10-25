# WRONG MACHINE — v1.3.0 / TEXT GLITCH LAB

Static experimental data-art laboratory for GitHub Pages. Version 1.3 replaces the safer hexadecimal file glitcher with a freer **TEXT GLITCH LAB**. Upload an image, open its file data in a real text editor, add or delete whatever you want, and refresh the preview to see whether the browser can still decode the result. This is much closer to the spirit of databending: unstable, hands-on, and willing to break.

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

Choose **03 FILE GLITCHER**, upload an image (PNG, JPG, WebP, GIF or BMP; practical file size limit 8 MiB for browser editing). The editor now works in two freely editable text views:

1. **Escaped Text** — the main mode. Printable ASCII characters are shown directly. Other bytes appear as escape sequences such as `\x89`, while newline, carriage return, tab, and backslash use `\n`, `\r`, `\t`, and `\\`. Users can type text, paste content, delete sections, or insert byte escapes directly.
2. **Hex Stream** — a more exact byte-token view. The entire file becomes editable two-digit hex values separated by spaces, such as `89 50 4E 47 0D 0A`. Unlike the older protected editor, you can now freely add or remove tokens.

Both views allow arbitrary insertion, deletion, and replacement. That means files can partially decode, completely fail, or render differently across software. That uncertainty is intentional.

### Suggested exercises

- Open a PNG or JPEG and scroll through the escaped text. Delete a section, insert a short phrase like `GLITCH`, then press **Refresh Preview**.
- Add explicit byte escapes such as `\x00\xFF\x7F` in the middle of the file and see whether the image survives.
- Use **Random Mangle**, **Insert Noise**, or **Delete Chunk** to attack the file more aggressively.
- Compare the **Original** and **Edited** previews; export the result. Use **Send to Image → Sound** to hear the altered image with either Raw File Sound or True Spectral Painting.

### Important limitations

- This editor is intentionally less protective. Users can add or delete bytes and completely destroy the file structure. That is a feature, not a bug.
- The browser preview only succeeds when the current byte stream still decodes as an image format the browser understands. A failed preview does **not** mean the export failed; it just means the browser rejected the edited file.
- Escaped Text mode is a readable projection of the bytes, not a standard source-code representation used by other tools. It is designed for experimentation.
- Very large files become cumbersome because non-printable bytes expand into visible escapes. Smaller images work best.
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
