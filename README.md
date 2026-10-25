# WRONG MACHINE — v1.1.0 · SOURCE-FIRST SONIFICATION

Static browser-only digital media laboratory for GitHub Pages. Version 1.1 adds **Raw File Sound** and **True Spectral Painting** while keeping v1.0's editor, audio-to-image tools, sequencer, and local artwork gallery.

## Deploy to GitHub Pages

1. Extract the ZIP and upload **all five files** (`index.html`, `style.css`, `app.js`, `sonification.js`, `README.md`) directly into your repository's **root** (not inside an extra folder).
2. On GitHub, open **Settings → Pages → Deploy from a branch**. Select `main` and `/(root)`.
3. After publication, refresh the live site (hard refresh if the old version is cached).

No build, keys, server, database, API or npm installation is required. Uploaded media is processed locally in your browser. Remote Google Fonts are optional.

## New: TRUE SPECTRAL PAINTING (default)

**What it really does:** Decodes the uploaded image into a pixel array, optionally uses your image-editor adjustments, maps each column to time and vertical image position to frequency, and uses brightness/luminance as the strength of an FFT frequency bin. It reconstructs audio through an inverse FFT and overlap-add.

Controls:
- 128 / 256 / 512 requested bins (actual unique FFT bins shown in the signal report)
- Logarithmic or linear frequency spacing
- Lower and upper frequency limits
- Duration 2–20 seconds
- WAV playback and download
- Original-versus-edited image audio comparison

**No fixed chord, oscillator bank, drum, bass line or hidden synthesizer layer.** The frequencies are actual FFT bins (not a musical scale), and magnitude comes from decoded image pixels.

**Critical scientific distinction:** An image is *not* an audio recording. Pixel data does not contain audio phase. To convert a magnitude spectrum to a waveform, this mode uses a deterministic, disclosed phase convention (seeded per FFT bin and continuously advancing with time). It uses an overlap window, fixed safety gain, brief anti-click fade, and only applies global gain protection if it would otherwise clip. Consequently, the resulting sound is a faithful, reproducible **sonification under documented rules**, not an objectively unique sound hidden in an image.

**Sanity test:** a pure black image yields silence; changing image content should change spectral output. A bright image will produce more spectral energy than a dark image unless peak safety applies.

## New: RAW FILE SOUND (literal source-file bytes)

This method reads the **actual uploaded PNG/JPEG/WebP/etc. file's bytes** (`File.arrayBuffer()`), including format headers, compression data and metadata, and interprets them directly as PCM sample values. It does **not** decode the image to pixels for audio or insert other source material.

Controls:
- PCM interpretation: unsigned 8-bit, signed 8-bit, or little-endian signed 16-bit
- Sample rate: 8,000 / 11,025 / 22,050 / 44,100 Hz
- Bytes skipped from beginning (0 by default, which includes headers)
- Optional peak normalization (off by default)
- Max first 60 seconds (safety cap; explicit truncation notice when used)
- WAV playback and download

The raw sound depends on encoding and playback settings. There is *no universal sample rate* intrinsic to an image file. Because raw mode reads the **original uploaded file**, editing the displayed pixels won't change raw sound. To compare altered file bytes, export the modified image to PNG and upload the new file. PNG export is an encoding operation: compressed image file bytes will change even for visually identical content, depending on how the encoder works.

## Still here from v1.0

- Legacy Brightness Scan, 16-band Harmonic Painting, and decoded-RGBA byte modes (all explicitly labeled as legacy)
- Hue, saturation, brightness, contrast, glitch pixel editing, safe decoded-pixel hex edit, PNG download
- Audio input, bass, treble, distortion and speed, playable audio before/after
- Sound-to-image (spectrogram, sample art, waveform spiral), export and native sharing when supported
- Up-to-eight-image composition sequencer (still uses the legacy modes)
- Local browser artwork archive (does not create a public social network)

## Limits and next steps

- Image canvas is scaled to a maximum 1024 px along its longest dimension for processing; **raw file mode uses the full original uploaded file bytes**.
- True Spectral uses a 2,048-point inverse FFT at 22,050 samples per second and an overlap-add reconstruction; its maximum output frequency is just below Nyquist.
- A browser-based image-to-sound conversion is a mapping, not a measurement of an image's intrinsic audible content.
- Maximum Raw File Sound duration is 60 seconds; longer files are **truncated**, not secretly resampled or looped.
- Optional harmonic/beat-studio layering is **not part of v1.1**. The pure signal comes first; deliberate synth layers can be added later behind explicit controls.
- Some compressed image files may sound like broadband noise in raw mode. That's expected; compression bytes do not directly encode what the picture looks like.
- Public profiles, community posting, likes and comments need a real storage/backend service; the local archive remains private on your browser.
- Audio speed controls change pitch and duration together; independent time-stretch/pitch-shifting is not yet implemented.
- Respect rights and permissions when publishing someone else's images/audio.

## Development checks

The synthesis source is in `sonification.js`, structured so it can also be imported in Node.js for deterministic tests. Automated checks cover exact unsigned-byte conversion, a black image producing silence, pixel-dependent spectral variation and invalid raw-file options. JavaScript syntax and page structure were checked. Full interactive browser testing could not be completed in the authoring environment due to browser navigation/injection restrictions; verify both new modes on the live GitHub Pages build.
