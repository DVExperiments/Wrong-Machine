/* WRONG MACHINE — v1.1.0  |  transparent sonification engines.
   No preset oscillators, drums, chord beds or external audio samples.
   RAW: literal uploaded file bytes, interpreted as PCM with declared parameters.
   SPECTRAL: decoded pixels specify STFT magnitudes; phase must be chosen because an
   image contains no audio phase. Fixed deterministic phases + continuous advances.
*/
(function (root) {
  'use strict';
  const SR = 22050, FFT_SIZE = 2048, HOP = 512;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

  function rawFile(bytes, opts = {}) {
    if (!(bytes instanceof Uint8Array)) bytes = new Uint8Array(bytes);
    const sampleRate = Number(opts.sampleRate || 11025);
    if (![8000, 11025, 22050, 44100].includes(sampleRate)) throw new Error('Unsupported sample rate');
    const encoding = opts.encoding || 'u8';
    if (!['u8', 's8', 's16le'].includes(encoding)) throw new Error('Unsupported PCM interpretation');
    const headerSkip = Number(opts.headerSkip || 0);
    if (!Number.isSafeInteger(headerSkip) || headerSkip < 0) throw new Error('Invalid skip value');
    const unit = encoding === 's16le' ? 2 : 1;
    const totalSamples = Math.floor(Math.max(0, bytes.length - headerSkip) / unit);
    const maxSeconds = clamp(Number(opts.maxSeconds || 60), 1, 60);
    const count = Math.min(totalSamples, Math.floor(maxSeconds * sampleRate));
    if (count <= 0) throw new Error('No usable bytes after the header skip');
    const samples = new Float32Array(count);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    for (let i = 0; i < count; i++) {
      const pos = headerSkip + i * unit;
      if (encoding === 'u8') samples[i] = (bytes[pos] - 128) / 128;
      else if (encoding === 's8') samples[i] = view.getInt8(pos) / 128;
      else samples[i] = view.getInt16(pos, true) / 32768;
    }
    if (opts.normalize) {
      let peak = 0;
      for (let i = 0; i < count; i++) peak = Math.max(peak, Math.abs(samples[i]));
      if (peak > 0) for (let i = 0; i < count; i++) samples[i] /= peak;
    }
    return {
      samples, sampleRate,
      info: {
        totalFileBytes: bytes.length, bytesUsed: count * unit,
        skippedBytes: Math.min(headerSkip, bytes.length),
        truncated: count < totalSamples, totalSamples,
        encoding, sampleRate, normalize: !!opts.normalize,
        duration: count / sampleRate
      }
    };
  }

  // Iterative radix-2 inverse FFT. Input/output arrays are modified in place.
  function ifft(re, im) {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      while (j & bit) { j ^= bit; bit >>= 1; }
      j ^= bit;
      if (i < j) {
        let z = re[i]; re[i] = re[j]; re[j] = z;
        z = im[i]; im[i] = im[j]; im[j] = z;
      }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const theta = 2 * Math.PI / len;
      const cr = Math.cos(theta), ci = Math.sin(theta);
      for (let off = 0; off < n; off += len) {
        let wr = 1, wi = 0;
        for (let k = 0; k < len / 2; k++) {
          const a = off + k, b = a + len / 2;
          const tr = re[b] * wr - im[b] * wi, ti = re[b] * wi + im[b] * wr;
          re[b] = re[a] - tr; im[b] = im[a] - ti;
          re[a] += tr; im[a] += ti;
          const nextR = wr * cr - wi * ci;
          wi = wr * ci + wi * cr; wr = nextR;
        }
      }
    }
    for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
  }

  function spectralPainting(rgba, width, height, opts = {}) {
    if (!rgba || rgba.length < width * height * 4 || width < 1 || height < 1) throw Error('Missing decoded pixel data');
    const sampleRate = SR;
    const seconds = clamp(Number(opts.duration || 8), 1, 30);
    const length = Math.floor(seconds * sampleRate);
    const fmin = clamp(Number(opts.minHz || 60), 20, 5000);
    const fmax = clamp(Number(opts.maxHz || 10000), 50, sampleRate * .49);
    if (fmax <= fmin) throw Error('Maximum frequency must be above minimum frequency');
    const scale = opts.scale === 'linear' ? 'linear' : 'log';
    const requested = clamp(Number(opts.bands || 256), 16, 512);
    // Bin centres are truly FFT-aligned: never an imposed musical scale or chord.
    const lowBin = Math.max(1, Math.ceil(fmin * FFT_SIZE / sampleRate));
    const highBin = Math.min(FFT_SIZE / 2 - 1, Math.floor(fmax * FFT_SIZE / sampleRate));
    const chosen = new Set();
    for (let j = 0; j < requested; j++) {
      const t = requested === 1 ? 0 : j / (requested - 1);
      const hz = scale === 'linear' ? fmin + (fmax - fmin) * t : fmin * Math.pow(fmax / fmin, t);
      chosen.add(clamp(Math.round(hz * FFT_SIZE / sampleRate), lowBin, highBin));
    }
    const bins = [...chosen].sort((a, b) => a - b);
    const rowForBin = bins.map(k => {
      const hz = k * sampleRate / FFT_SIZE;
      const ratio = scale === 'linear' ? (hz - fmin) / (fmax - fmin) : Math.log(hz / fmin) / Math.log(fmax / fmin);
      return clamp(Math.round((1 - ratio) * (height - 1)), 0, height - 1);
    });
    const window = new Float64Array(FFT_SIZE);
    for (let n = 0; n < FFT_SIZE; n++) window[n] = .5 - .5 * Math.cos(2 * Math.PI * n / (FFT_SIZE - 1));
    const samples = new Float32Array(length), weights = new Float32Array(length);
    const re = new Float64Array(FFT_SIZE), im = new Float64Array(FFT_SIZE);
    const frameCount = Math.ceil(length / HOP);
    // Equal treatment for every chosen FFT bin. Gain is fixed for clipping safety,
    // not an invented audio layer or normalization to an arbitrary loudness.
    const gain = .30 / Math.sqrt(bins.length);
    for (let frame = 0; frame < frameCount; frame++) {
      re.fill(0); im.fill(0);
      const start = frame * HOP - FFT_SIZE / 2;
      const progress = frameCount === 1 ? 0 : frame / (frameCount - 1);
      const x = Math.round(progress * (width - 1));
      for (let j = 0; j < bins.length; j++) {
        const k = bins[j], y = rowForBin[j], p = 4 * (y * width + x);
        const luminance = (.2126 * rgba[p] + .7152 * rgba[p+1] + .0722 * rgba[p+2]) / 255;
        if (luminance <= 0) continue;
        const mag = luminance * FFT_SIZE / 2 * gain;
        // A magnitude image cannot supply phase: deterministic pseudo-random
        // initial phase, advanced exactly at the bin frequency across frames.
        const initial = ((Math.sin(k * 78.233) * 43758.5453) % 1 + 1) % 1 * 2 * Math.PI;
        const phase = initial + 2 * Math.PI * k * frame * HOP / FFT_SIZE;
        const a = mag * Math.cos(phase), b = mag * Math.sin(phase);
        re[k] = a; im[k] = b;
        re[FFT_SIZE - k] = a; im[FFT_SIZE - k] = -b;
      }
      ifft(re, im);
      for (let n = 0; n < FFT_SIZE; n++) {
        const pos = start + n;
        if (pos < 0 || pos >= length) continue;
        const w = window[n];
        samples[pos] += re[n] * w;
        weights[pos] += w;
      }
    }
    for (let i = 0; i < length; i++) if (weights[i] > 1e-9) samples[i] /= weights[i];
    // Short anti-click endpoint fade; zero-energy pixels always yield silence.
    const fade = Math.min(220, Math.floor(length / 8));
    for (let i = 0; i < fade; i++) {
      samples[i] *= i / fade;
      samples[length - 1 - i] *= i / fade;
    }
    let peak = 0;
    for (let i = 0; i < length; i++) peak = Math.max(peak, Math.abs(samples[i]));
    if (peak > 1) for (let i = 0; i < length; i++) samples[i] /= peak; // prevent hard clipping, disclosed
    return { samples, sampleRate, info: {
      bandsRequested: requested, binsUsed: bins.length,
      frequencyMin: fmin, frequencyMax: fmax, scale,
      phase: 'deterministic seed + continuous FFT-bin advancement',
      antiClipAdjusted: peak > 1, peakBeforeSafety: peak,
      duration: length / sampleRate
    }};
  }
  const api = { rawFile, spectralPainting, ifft };
  root.WMSonify = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
