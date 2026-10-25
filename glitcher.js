/* WRONG MACHINE v1.3 — freeform text glitch editor.
   Open an image as editable text, add/delete arbitrary content,
   decode the resulting bytes back into an image if possible.
   No uploads. No file-structure protection. Broken outputs allowed. */
(function(){
  'use strict';
  if(typeof document==='undefined') return;

  const $ = id => document.getElementById(id);
  const state = {
    file: null,
    originalBytes: null,
    appliedBytes: null,
    originalType: 'application/octet-stream',
    originalName: 'glitched-file',
    viewMode: 'escaped',
    previewGood: false,
    debounce: null
  };

  const MAX_SIZE = 8 * 1024 * 1024; // 8 MB for workable text editing
  const originalCanvas = $('glitchOriginal');
  const previewCanvas = $('glitchPreview');
  const originalCtx = originalCanvas.getContext('2d');
  const previewCtx = previewCanvas.getContext('2d');
  const editor = $('glitchText');
  const status = $('glitchStatus');
  const resultMeta = $('glitchResultMeta');

  function setStatus(msg, kind='info'){
    status.textContent = msg;
    status.dataset.kind = kind;
  }
  function toast(msg){ if(window.wmToast) window.wmToast(msg); }

  function textCanvas(canvas, message, accent='#728296'){
    const ctx = canvas.getContext('2d');
    canvas.width = 720; canvas.height = 450;
    ctx.fillStyle = '#080c15'; ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.strokeStyle = 'rgba(156,255,100,.14)'; ctx.strokeRect(18,18,canvas.width-36,canvas.height-36);
    ctx.fillStyle = accent;
    ctx.font = '15px monospace'; ctx.textAlign = 'center';
    const lines = String(message).split('\n');
    lines.forEach((line,i)=>ctx.fillText(line, canvas.width/2, canvas.height/2 + (i - (lines.length-1)/2) * 20));
  }

  function setButtonState(loaded){
    ['glitchRefresh','glitchReset','glitchRandom','glitchInsert','glitchDelete','glitchDownload','glitchToAudio']
      .forEach(id => $(id).disabled = !loaded);
  }

  function drawScaled(canvas, source){
    const naturalW = source.naturalWidth || source.width;
    const naturalH = source.naturalHeight || source.height;
    const maxW = 720, maxH = 450;
    const scale = Math.min(maxW / naturalW, maxH / naturalH, 1);
    const w = Math.max(1, Math.round(naturalW * scale));
    const h = Math.max(1, Math.round(naturalH * scale));
    const ctx = canvas.getContext('2d');
    canvas.width = maxW; canvas.height = maxH;
    ctx.clearRect(0,0,maxW,maxH);
    ctx.fillStyle = '#060912'; ctx.fillRect(0,0,maxW,maxH);
    const x = Math.round((maxW - w) / 2), y = Math.round((maxH - h) / 2);
    ctx.drawImage(source, x, y, w, h);
  }

  function formatBytes(n){ return `${n.toLocaleString()} BYTES`; }
  function updateStats(editedLength){
    const originalLen = state.originalBytes ? state.originalBytes.length : 0;
    const edited = editedLength ?? 0;
    $('glitchOriginalBytes').textContent = `ORIGINAL: ${formatBytes(originalLen)}`;
    $('glitchEditedBytes').textContent = `EDITED: ${formatBytes(edited)}`;
    const delta = edited - originalLen;
    $('glitchDeltaBytes').textContent = `Δ ${delta >= 0 ? '+' : ''}${delta.toLocaleString()}`;
  }

  function detectMime(name, fallback){
    const n = (name || '').toLowerCase();
    if(/\.png$/.test(n)) return 'image/png';
    if(/\.jpe?g$/.test(n)) return 'image/jpeg';
    if(/\.webp$/.test(n)) return 'image/webp';
    if(/\.gif$/.test(n)) return 'image/gif';
    if(/\.bmp$/.test(n)) return 'image/bmp';
    return fallback || 'application/octet-stream';
  }

  function getExt(name){
    const m = /\.[^.]+$/.exec(name || '');
    return m ? m[0] : '';
  }

  function bytesToEscapedText(bytes){
    let out = '';
    const len = bytes.length;
    for(let i=0;i<len;i++){
      const b = bytes[i];
      if(b === 10) out += '\n';
      else if(b === 13) out += '\r';
      else if(b === 9) out += '\t';
      else if(b === 92) out += '\\\\';
      else if(b >= 32 && b <= 126) out += String.fromCharCode(b);
      else out += `\\x${b.toString(16).padStart(2,'0').toUpperCase()}`;
    }
    return out;
  }

  function escapedTextToBytes(text){
    const out = [];
    for(let i=0;i<text.length;){
      const ch = text[i];
      if(ch !== '\\'){
        out.push(text.charCodeAt(i) & 255);
        i += 1;
        continue;
      }
      const next = text[i+1];
      if(next === 'x' && /^[0-9a-fA-F]{2}$/.test(text.slice(i+2, i+4))){
        out.push(parseInt(text.slice(i+2, i+4), 16));
        i += 4;
      } else if(next === 'n') { out.push(10); i += 2; }
      else if(next === 'r') { out.push(13); i += 2; }
      else if(next === 't') { out.push(9); i += 2; }
      else if(next === '\\') { out.push(92); i += 2; }
      else { out.push(92); i += 1; }
    }
    return Uint8Array.from(out);
  }

  function bytesToHex(bytes){
    return Array.from(bytes, b => b.toString(16).padStart(2,'0').toUpperCase()).join(' ');
  }
  function hexToBytes(text){
    const cleaned = text.replace(/[^0-9a-fA-F]/g, ' ');
    const parts = cleaned.trim() ? cleaned.trim().split(/\s+/) : [];
    if(parts.some(p => p.length !== 2)) throw new Error('HEX VIEW REQUIRES TWO-DIGIT BYTE TOKENS LIKE FF 00 A4');
    return Uint8Array.from(parts.map(p => parseInt(p,16)));
  }

  function currentBytesFromEditor(){
    if(state.viewMode === 'hex') return hexToBytes(editor.value);
    return escapedTextToBytes(editor.value);
  }

  function applyBytesToEditor(bytes, preserveScroll=false){
    const top = editor.scrollTop;
    editor.value = state.viewMode === 'hex' ? bytesToHex(bytes) : bytesToEscapedText(bytes);
    if(preserveScroll) editor.scrollTop = top;
    updateStats(bytes.length);
  }

  async function decodeBytes(bytes){
    const blob = new Blob([bytes], { type: state.originalType });
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.onload = ()=>{ URL.revokeObjectURL(url); resolve(img); };
      img.onerror = ()=>{ URL.revokeObjectURL(url); reject(new Error('Browser could not decode the edited byte stream')); };
      img.src = url;
    });
  }

  async function previewApplied(bytes){
    state.appliedBytes = bytes;
    resultMeta.textContent = `EDITED FILE READY · ${formatBytes(bytes.length)} · TYPE ${state.originalType}`;
    try{
      const img = await decodeBytes(bytes);
      drawScaled(previewCanvas, img);
      setStatus('EDIT APPLIED / FILE STILL DECODES', 'ok');
      state.previewGood = true;
      return true;
    } catch(err){
      textCanvas(previewCanvas, 'DECODER REJECTED\nTHE EDITED FILE', '#ff91ae');
      setStatus('EDIT APPLIED / CURRENT FILE DOES NOT DECODE — YOU CAN STILL EXPORT IT', 'error');
      state.previewGood = false;
      return false;
    }
  }

  async function refreshPreview(){
    if(!state.file) return;
    try{
      const bytes = currentBytesFromEditor();
      updateStats(bytes.length);
      return await previewApplied(bytes);
    } catch(err){
      setStatus(err.message, 'error');
      state.previewGood = false;
      resultMeta.textContent = 'EDITOR CONTENT COULD NOT BE PARSED.';
      return false;
    }
  }

  function queueLivePreview(){
    if(!state.file) return;
    let len = 0;
    try { len = currentBytesFromEditor().length; updateStats(len); setStatus('DATA CHANGED / WAITING TO REFRESH PREVIEW…'); }
    catch(err){ setStatus(err.message, 'error'); return; }
    if(!$('glitchLive').checked) return;
    clearTimeout(state.debounce);
    state.debounce = setTimeout(()=>refreshPreview(), 420);
  }

  async function loadFile(file){
    if(!file) return;
    if(file.size > MAX_SIZE){ setStatus('FILE TOO LARGE FOR THIS FREEFORM EDITOR / TRY UNDER 8 MB', 'error'); return; }
    const type = detectMime(file.name, file.type);
    if(!/^image\//.test(type)){ setStatus('PLEASE LOAD AN IMAGE FILE', 'error'); return; }
    setButtonState(false);
    setStatus('OPENING FILE…');
    try{
      const bytes = new Uint8Array(await file.arrayBuffer());
      const img = await decodeBytes(bytes);
      state.file = file;
      state.originalBytes = bytes;
      state.appliedBytes = bytes.slice();
      state.originalType = type;
      state.originalName = file.name;
      state.viewMode = $('glitchViewMode').value;
      drawScaled(originalCanvas, img);
      drawScaled(previewCanvas, img);
      applyBytesToEditor(bytes);
      $('glitchFileMeta').textContent = `${file.name} · ${(file.size/1024).toFixed(1)} KiB · ${img.naturalWidth || img.width} × ${img.naturalHeight || img.height} · ${type}`;
      resultMeta.textContent = `CURRENT RESULT MATCHES THE ORIGINAL FILE · ${formatBytes(bytes.length)}`;
      setButtonState(true);
      setStatus('FILE OPENED / EDIT THE DATA AND REFRESH THE PREVIEW', 'ok');
      state.previewGood = true;
    } catch(err){
      setStatus('COULD NOT OPEN IMAGE: ' + err.message, 'error');
      setButtonState(false);
    }
  }

  function randomAsciiChunk(){
    const parts = ['ERROR','GLITCH','DATA','NOISE','////','@@@@','%%%%','###','???','0000','1111','WM'];
    let out = parts[Math.floor(Math.random()*parts.length)];
    if(Math.random() < 0.7) out += `\\x${Math.floor(Math.random()*256).toString(16).padStart(2,'0').toUpperCase()}`;
    return out;
  }

  function mutateText(text, operations){
    let s = text;
    for(let i=0;i<operations;i++){
      const action = Math.random();
      if(action < 0.34 || s.length === 0){
        const at = Math.floor(Math.random() * (s.length + 1));
        s = s.slice(0, at) + randomAsciiChunk() + s.slice(at);
      } else if(action < 0.67){
        const start = Math.floor(Math.random() * s.length);
        const del = Math.max(1, Math.floor(Math.random() * 8));
        s = s.slice(0, start) + s.slice(start + del);
      } else {
        const at = Math.floor(Math.random() * s.length);
        const del = Math.max(1, Math.floor(Math.random() * 5));
        s = s.slice(0, at) + randomAsciiChunk() + s.slice(at + del);
      }
    }
    return s;
  }

  function hexRandomBytes(count){
    const arr = [];
    for(let i=0;i<count;i++) arr.push(Math.floor(Math.random()*256).toString(16).padStart(2,'0').toUpperCase());
    return arr.join(' ');
  }

  function mutateHex(text, operations){
    let tokens = text.trim() ? text.trim().split(/\s+/) : [];
    for(let i=0;i<operations;i++){
      const action = Math.random();
      if(action < 0.34 || tokens.length === 0){
        const at = Math.floor(Math.random() * (tokens.length + 1));
        const add = hexRandomBytes(Math.max(1, Math.floor(Math.random()*4)+1)).split(' ');
        tokens.splice(at, 0, ...add);
      } else if(action < 0.67){
        const at = Math.floor(Math.random() * tokens.length);
        const del = Math.max(1, Math.floor(Math.random() * 4));
        tokens.splice(at, del);
      } else {
        const at = Math.floor(Math.random() * tokens.length);
        const del = Math.max(1, Math.floor(Math.random() * 3));
        const add = hexRandomBytes(Math.max(1, Math.floor(Math.random()*3)+1)).split(' ');
        tokens.splice(at, del, ...add);
      }
    }
    return tokens.join(' ');
  }

  function doDownload(file){
    const a = document.createElement('a');
    const url = URL.createObjectURL(file);
    a.href = url; a.download = file.name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(()=>URL.revokeObjectURL(url), 1500);
  }

  async function currentFile(){
    const bytes = state.appliedBytes || currentBytesFromEditor();
    const ext = getExt(state.originalName) || '.bin';
    const base = state.originalName.replace(/\.[^.]+$/, '') || 'glitched';
    return new File([bytes], `${base}-glitched${ext}`, { type: state.originalType });
  }

  $('glitchInput').addEventListener('change', e => loadFile(e.target.files[0]));
  $('glitchUseCurrent').addEventListener('click', ()=>{
    if(!window.wmCurrentImageFile){ setStatus('IMAGE SOUND LAB IS NOT AVAILABLE', 'error'); return; }
    const file = window.wmCurrentImageFile();
    if(!file){ setStatus('LOAD AN IMAGE IN IMAGE → SOUND FIRST', 'error'); return; }
    loadFile(file);
  });

  const drop = $('glitchDrop');
  drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('hover'); });
  drop.addEventListener('dragleave', ()=> drop.classList.remove('hover'));
  drop.addEventListener('drop', e => {
    e.preventDefault(); drop.classList.remove('hover');
    if(e.dataTransfer.files && e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]);
  });

  $('glitchViewMode').addEventListener('change', ()=>{
    state.viewMode = $('glitchViewMode').value;
    $('glitchEditorNote').innerHTML = state.viewMode === 'hex'
      ? 'Hex View treats the file as editable byte tokens. Add, remove, or replace bytes freely. Example: <code>89 50 4E 47 0D 0A</code>.'
      : 'Escaped Text is the main mode. Type ordinary characters directly. Use <code>\\xNN</code> for explicit byte values. Example: <code>HELLO\\x00WORLD</code>.';
    try {
      const bytes = state.appliedBytes || state.originalBytes || new Uint8Array();
      applyBytesToEditor(bytes, true);
      setStatus('EDITOR VIEW CHANGED', 'ok');
    } catch(err){ setStatus(err.message, 'error'); }
  });

  editor.addEventListener('input', queueLivePreview);
  $('glitchRefresh').addEventListener('click', ()=> refreshPreview());
  $('glitchReset').addEventListener('click', ()=>{
    if(!state.originalBytes) return;
    clearTimeout(state.debounce);
    state.appliedBytes = state.originalBytes.slice();
    applyBytesToEditor(state.originalBytes);
    drawScaled(previewCanvas, originalCanvas);
    resultMeta.textContent = `CURRENT RESULT MATCHES THE ORIGINAL FILE · ${formatBytes(state.originalBytes.length)}`;
    state.previewGood = true;
    setStatus('RESET TO THE ORIGINAL FILE DATA', 'ok');
  });

  $('glitchIntensity').addEventListener('input', ()=> $('glitchIntensityVal').textContent = $('glitchIntensity').value);
  $('glitchRandom').addEventListener('click', ()=>{
    if(!state.file) return;
    const ops = +$('glitchIntensity').value;
    editor.value = state.viewMode === 'hex' ? mutateHex(editor.value, ops) : mutateText(editor.value, ops);
    queueLivePreview();
    toast('Random mangling injected into the data stream.');
  });
  $('glitchInsert').addEventListener('click', ()=>{
    if(!state.file) return;
    const chunk = state.viewMode === 'hex' ? (' ' + hexRandomBytes(Math.max(1, Math.floor(Math.random()*6)+1))) : randomAsciiChunk();
    const start = editor.selectionStart ?? editor.value.length;
    const end = editor.selectionEnd ?? start;
    editor.value = editor.value.slice(0,start) + chunk + editor.value.slice(end);
    editor.selectionStart = editor.selectionEnd = start + chunk.length;
    queueLivePreview();
  });
  $('glitchDelete').addEventListener('click', ()=>{
    if(!state.file || !editor.value.length) return;
    let start = editor.selectionStart ?? 0;
    let end = editor.selectionEnd ?? start;
    if(start === end){
      const span = Math.max(1, Math.floor(Math.random()*12));
      start = Math.max(0, start - Math.floor(span/2));
      end = Math.min(editor.value.length, start + span);
    }
    editor.value = editor.value.slice(0,start) + editor.value.slice(end);
    editor.selectionStart = editor.selectionEnd = start;
    queueLivePreview();
  });

  $('glitchDownload').addEventListener('click', async ()=>{
    if(!state.file) return;
    try{
      const bytes = currentBytesFromEditor();
      updateStats(bytes.length);
      const ok = await previewApplied(bytes);
      const ext = getExt(state.originalName) || '.bin';
      const base = state.originalName.replace(/\.[^.]+$/, '') || 'glitched';
      const file = new File([bytes], `${base}-glitched${ext}`, { type: state.originalType });
      doDownload(file);
      setStatus(ok ? 'GLITCHED FILE EXPORTED' : 'BROKEN/UNREADABLE FILE EXPORTED', ok ? 'ok' : 'error');
    } catch(err){ setStatus('EXPORT FAILED: ' + err.message, 'error'); }
  });

  $('glitchToAudio').addEventListener('click', async ()=>{
    if(!state.file) return;
    try{
      const bytes = currentBytesFromEditor();
      updateStats(bytes.length);
      const ok = await previewApplied(bytes);
      if(!ok || !state.previewGood){ setStatus('CURRENT FILE DOES NOT DECODE, SO IT CANNOT BE SENT TO IMAGE → SOUND', 'error'); return; }
      const ext = getExt(state.originalName) || '.bin';
      const base = state.originalName.replace(/\.[^.]+$/, '') || 'glitched';
      const file = new File([bytes], `${base}-glitched${ext}`, { type: state.originalType });
      await window.wmLoadImageIntoSound(file);
      const tab = document.querySelector('[data-tab="image"]');
      if(tab) tab.click();
      setStatus('EDITED FILE SENT TO IMAGE → SOUND', 'ok');
    } catch(err){ setStatus('TRANSFER FAILED: ' + err.message, 'error'); }
  });

  textCanvas(originalCanvas, 'ORIGINAL IMAGE\nAWAITING FILE');
  textCanvas(previewCanvas, 'EDITED RESULT\nAWAITING FILE', '#9fb2c6');
  setButtonState(false);
  updateStats(0);
})();
