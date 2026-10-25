# WRONG MACHINE — v1.0

A static, browser-only experimental databending laboratory for GitHub Pages.

## Deploy

1. Create a public GitHub repository (for example `wrong-machine`).
2. Upload `index.html`, `style.css`, and `app.js` to the **root** of the repository.
3. In **Settings → Pages**, select **Deploy from a branch**, branch **main**, folder **/(root)**, then Save.
4. Open the Pages URL once the deployment completes.

No build, API keys, npm, server, or external backend needed. Fonts load from Google Fonts when online; fallback fonts work offline.

## Features

- Image → sound: brightness scan, spectral painting, raw pixel bytes; WAV export and waveform.
- Image editing: hue, saturation, brightness, contrast, horizontal pixel glitch; PNG export.
- Advanced hex editing: safe edits of decoded RGBA pixel bytes (not arbitrary compressed file headers).
- Image before/after: plays the original image's audio mapping, then the current edited image's mapping.
- Audio → image: spectrogram, sample-pixel image, spiral waveform; PNG export.
- Audio bending: bass, treble, distortion, speed/pitch; play original or bent and export WAV.
- Image song sequencer: up to eight images in order, with duration and conversion method controls.
- Local artwork archive and image sharing/export (no public feed in v1.0).

## Important notes

- All processing is local; nothing is uploaded.
- Image decoding is downscaled to max 1024 px to protect performance.
- Audio processing uses the first 90 seconds for speed and memory safety. Some long songs may still be demanding; use shorter clips.
- Image-to-sound is a creative mapping, not a unique sound encoded in the image.
- Sound-to-image methods are not generally reversible. To manipulate an image and decode it back into *the same audio*, a dedicated reversible encoding pipeline is needed in a later version.
- Audio speed changes pitch and duration together; this is not independent pitch shifting.
- Byte editor operates on RGBA pixels after image decoding. Compressed PNG/JPEG bitstream corruption is not implemented in v1.0 because careless edits can invalidate files.
- Browser archive uses localStorage with a maximum of 16 compressed thumbnails and is limited by device storage.
- Sharing is export / native file share where available. A real public feed, profiles, likes, comments and moderation require an authenticated backend and storage.
- Uploaded media must be files you have permission to use or share.

## Roadmap

v1.1: Reversible image/audio data codec and image-edit-to-audio roundtrip; audio trimming; sample-rate controls; optional low-level file-byte sandbox with format warnings.

v1.2: More artistic transformations, saved presets, undo/redo, sequencer fades and transitions, ZIP project export/import.

v2.0: Optional moderated community feed with authentication, cloud storage, content reporting, permissions, and privacy controls.
