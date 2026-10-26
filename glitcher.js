/* WRONG MACHINE v1.4 — Live Pixel Text + Raw Binary File Glitcher.
   Pixel Text: decoded real RGB values, editable as arbitrary text; always renders to PNG.
   Raw File: exact bytes rendered as escaped text or hex; may stop decoding.
   100% browser local, no uploads. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object' && module.exports)module.exports=api;
  if(root)root.WMTextGlitch=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
  'use strict';
  function bytesToEscapedText(bytes){
    const parts=[];
    for(let i=0;i<bytes.length;i++){
      const b=bytes[i];
      if(b===10)parts.push('\\n');
      else if(b===13)parts.push('\\r');
      else if(b===9)parts.push('\\t');
      else if(b===92)parts.push('\\\\');
      else if(b>=32&&b<=126)parts.push(String.fromCharCode(b));
      else parts.push('\\x'+b.toString(16).padStart(2,'0').toUpperCase());
    }
    return parts.join('');
  }
  function escapedTextToBytes(text){
    const out=[];
    for(let i=0;i<text.length;){
      const ch=text.charCodeAt(i);
      if(ch!==92){
        if(ch<=255){out.push(ch);i++;continue;}
        // Inserted Unicode letters are UTF-8 encoded as their actual bytes.
        const cp=text.codePointAt(i), seq=new TextEncoder().encode(String.fromCodePoint(cp));
        for(const b of seq)out.push(b);i+=cp>65535?2:1;continue;
      }
      const n=text[i+1];
      if(n==='x'&&/^[0-9a-f]{2}$/i.test(text.slice(i+2,i+4))){out.push(parseInt(text.slice(i+2,i+4),16));i+=4;}
      else if(n==='n'){out.push(10);i+=2;}
      else if(n==='r'){out.push(13);i+=2;}
      else if(n==='t'){out.push(9);i+=2;}
      else if(n==='\\'){out.push(92);i+=2;}
      else{out.push(92);i++;}
    }
    return Uint8Array.from(out);
  }
  function bytesToHex(bytes){return Array.from(bytes,b=>b.toString(16).padStart(2,'0').toUpperCase()).join(' ')}
  function hexToBytes(text){
    const tokens=text.trim()?text.trim().split(/\s+/):[];
    if(tokens.some(t=>!/^[0-9a-f]{2}$/i.test(t)))throw Error('HEX MODE: USE SPACE-SEPARATED TWO-DIGIT BYTES, SUCH AS FF 00 A4');
    return Uint8Array.from(tokens.map(t=>parseInt(t,16)));
  }
  function hashColour(token){
    // FNV-1a mapping: arbitrary words are converted into repeatable visible colours.
    let h=2166136261;
    for(let i=0;i<token.length;i++){h=Math.imul(h^token.charCodeAt(i),16777619)>>>0;}
    const r=(h>>>16)&255,g=(h>>>8)&255,b=h&255;
    return [r,g,b];
  }
  function rgbToPixelText(rgba,width,height){
    const lines=[];
    lines.push('// PIXEL TEXT · '+width+' x '+height+' · RGB VALUES');
    lines.push('// EVERY TOKEN IS ONE PIXEL: FF0000 = RED, 00FF00 = GREEN');
    lines.push('// DELETE, REPLACE, PASTE, OR INSERT ANY WORDS. EACH WORD BECOMES A COLOUR.');
    for(let y=0;y<height;y++){
      const row=[];
      for(let x=0;x<width;x++){
        const i=(y*width+x)*4;
        row.push([rgba[i],rgba[i+1],rgba[i+2]].map(v=>v.toString(16).padStart(2,'0').toUpperCase()).join(''));
      }
      lines.push(row.join(' '));
    }
    return lines.join('\n');
  }
  function pixelTokens(text){
    const data=text.split(/\r?\n/).filter(line=>!line.trimStart().startsWith('//')).join(' ').trim();
    return data?data.split(/\s+/):[];
  }
  function pixelTextToRGBA(text,width,height){
    if(!Number.isInteger(width)||!Number.isInteger(height)||width<=0||height<=0||width*height>100000)throw Error('INVALID PIXEL WORKSPACE SIZE');
    const rgba=new Uint8ClampedArray(width*height*4);
    const tokens=pixelTokens(text);
    let words=0;
    const used=Math.min(tokens.length,width*height);
    for(let i=0;i<width*height;i++){
      let r=0,g=0,b=0;
      if(i<used){
        let s=tokens[i];
        if(/^#?[0-9a-f]{6}$/i.test(s)){
          if(s[0]==='#')s=s.slice(1);
          const colour=parseInt(s,16);
          r=(colour>>>16)&255;g=(colour>>>8)&255;b=colour&255;
        }else if(/^0x[0-9a-f]{6}$/i.test(s)){
          const c=parseInt(s.slice(2),16);r=(c>>>16)&255;g=(c>>>8)&255;b=c&255;
        }else{[r,g,b]=hashColour(s);words++;}
      }
      const k=i*4;rgba[k]=r;rgba[k+1]=g;rgba[k+2]=b;rgba[k+3]=255;
    }
    return {rgba,used,words,missing:width*height-used,overflow:Math.max(0,tokens.length-width*height),total:tokens.length};
  }
  return {bytesToEscapedText,escapedTextToBytes,bytesToHex,hexToBytes,hashColour,rgbToPixelText,pixelTokens,pixelTextToRGBA};
});

(function(){
  'use strict';
  if(typeof document==='undefined')return;
  const $=id=>document.getElementById(id), core=window.WMTextGlitch;
  const src=$('glitchOriginal'),out=$('glitchPreview'),area=$('glitchText');
  const state={file:null,bytes:null,image:null,originalName:'',mime:'',mode:'pixel',pixelCanvas:null,pixelSource:null,drafts:{},previewGood:false,pending:null,rev:0};

  function stat(message,kind='info'){$('glitchStatus').textContent=message;$('glitchStatus').dataset.kind=kind;}
  function buttons(on){['glitchRefresh','glitchReset','glitchRandom','glitchInsert','glitchDelete','glitchDownload','glitchToAudio'].forEach(id=>$(id).disabled=!on);}
  function splash(canvas,txt,color='#73879a'){
    canvas.width=720;canvas.height=450;const c=canvas.getContext('2d');c.fillStyle='#080b12';c.fillRect(0,0,720,450);
    c.strokeStyle='#273343';c.strokeRect(15,15,690,420);c.fillStyle=color;c.font='16px monospace';c.textAlign='center';
    txt.split('\n').forEach((line,i)=>c.fillText(line,360,225+i*24));
  }
  function paint(canvas,image,pixelated=false){
    canvas.width=720;canvas.height=450;
    const c=canvas.getContext('2d');c.fillStyle='#05080f';c.fillRect(0,0,720,450);
    const w=image.naturalWidth||image.width,h=image.naturalHeight||image.height;
    const scale=Math.min(720/w,450/h);const dw=Math.max(1,Math.round(w*scale)),dh=Math.max(1,Math.round(h*scale));
    c.imageSmoothingEnabled=!pixelated;
    c.drawImage(image,Math.round((720-dw)/2),Math.round((450-dh)/2),dw,dh);
  }
  function pixelBase(image){
    const max=+$('glitchPixelSize').value;
    const w=image.naturalWidth||image.width,h=image.naturalHeight||image.height;
    const scale=Math.min(1,max/Math.max(w,h));
    const width=Math.max(1,Math.round(w*scale)),height=Math.max(1,Math.round(h*scale));
    const c=document.createElement('canvas');c.width=width;c.height=height;
    const cx=c.getContext('2d',{willReadFrequently:true});cx.fillStyle='#080b12';cx.fillRect(0,0,width,height);cx.drawImage(image,0,0,width,height);
    state.pixelCanvas=c;
    state.pixelSource=core.rgbToPixelText(cx.getImageData(0,0,width,height).data,width,height);
    state.drafts.pixel=state.pixelSource;
  }
  function drawPixelText(){
    const c=state.pixelCanvas;
    const parsed=core.pixelTextToRGBA(area.value,c.width,c.height);
    c.getContext('2d').putImageData(new ImageData(parsed.rgba,c.width,c.height),0,0);
    paint(out,c,true);
    state.previewGood=true;
    const size=c.width*c.height;
    $('glitchOriginalBytes').textContent=`GRID: ${c.width}×${c.height}`;
    $('glitchEditedBytes').textContent=`TOKENS: ${parsed.total.toLocaleString()}`;
    $('glitchDeltaBytes').textContent=`WORDS: ${parsed.words.toLocaleString()}`;
    $('glitchResultMeta').textContent=`PIXEL TEXT · ${parsed.used.toLocaleString()}/${size.toLocaleString()} PIXELS · ${parsed.missing.toLocaleString()} EMPTY → BLACK · ${parsed.overflow.toLocaleString()} EXTRA IGNORED`;
    stat('PIXEL TEXT RENDERED / IMAGE ALWAYS VALID · EXPORTS PNG','ok');
  }
  async function decodeBlob(blob){
    return new Promise((resolve,reject)=>{const url=URL.createObjectURL(blob),img=new Image();
      img.onload=()=>{URL.revokeObjectURL(url);resolve(img)};
      img.onerror=()=>{URL.revokeObjectURL(url);reject(Error('BROWSER CANNOT DECODE THE ALTERED FILE'))};img.src=url;
    });
  }
  async function renderRaw(bytes,id){
    const blob=new Blob([bytes],{type:state.mime});
    try{
      const img=await decodeBlob(blob);if(id!==state.rev)return;
      paint(out,img);state.previewGood=true;stat('RAW FILE RENDERED / BINARY DATA STILL DECODES','ok');
    }catch(e){
      if(id!==state.rev)return;
      splash(out,'DECODER REJECTED THE FILE\nTRY PIXEL TEXT FOR RELIABLE GLITCHES','#ff8aaa');state.previewGood=false;
      stat('RAW BINARY DATA NO LONGER DECODES. PIXEL TEXT MODE IS THE RELIABLE ALTERNATIVE.','error');
    }
    if(id===state.rev){
      $('glitchResultMeta').textContent=`RAW ${state.mode.toUpperCase()} · ${bytes.length.toLocaleString()} BYTES · ${state.previewGood?'DECODED':'BROKEN FILE (STILL EXPORTABLE)'}`;
    }
  }
  function sourceRawDraft(mode){return mode==='escaped'?core.bytesToEscapedText(state.bytes):core.bytesToHex(state.bytes)}
  function fromRawText(){return state.mode==='hex'?core.hexToBytes(area.value):core.escapedTextToBytes(area.value)}
  function updateRawStats(bytes){
    $('glitchOriginalBytes').textContent=`ORIGINAL: ${state.bytes.length.toLocaleString()} BYTES`;
    $('glitchEditedBytes').textContent=`EDITED: ${bytes.length.toLocaleString()} BYTES`;
    const delta=bytes.length-state.bytes.length;$('glitchDeltaBytes').textContent=`Δ ${delta>=0?'+':''}${delta.toLocaleString()}`;
  }
  async function refresh(){
    if(!state.file)return;
    clearTimeout(state.pending);
    state.drafts[state.mode]=area.value;
    const id=++state.rev;
    try{
      if(state.mode==='pixel'){drawPixelText();return}
      const bytes=fromRawText();updateRawStats(bytes);await renderRaw(bytes,id);
    }catch(e){if(id!==state.rev)return;stat(e.message,'error');$('glitchResultMeta').textContent='EDITOR CONTENT COULD NOT BE PARSED';state.previewGood=false;}
  }
  function schedule(){
    if(!state.file)return;
    state.drafts[state.mode]=area.value;
    clearTimeout(state.pending);
    stat('CHANGES DETECTED / PREVIEW PENDING…');
    if($('glitchLive').checked)state.pending=setTimeout(refresh,state.mode==='pixel'?320:600);
  }
  function uiMode(){
    const pixel=state.mode==='pixel';
    $('glitchPixelSettings').hidden=!pixel;
    $('glitchEditorNote').innerHTML=pixel
      ? 'PIXEL TEXT / DECODED RGB DATA. Each <code>RRGGBB</code> token is one pixel. Delete or insert tokens to shift pixels. Arbitrary words become repeatable colours. The preview <b>always works</b> and exports PNG.'
      : state.mode==='escaped'
        ? 'RAW ESCAPED TEXT / EXACT FILE BYTES. Printable bytes appear as characters; other bytes as <code>\\xNN</code>. Edits can break compression, markers or checksums. Decoder failures are expected.'
        : 'RAW HEX FILE / EXACT BYTES. Add, delete or replace two-digit hex tokens (e.g. <code>FF A2 00</code>). Many edits make compressed files undecodable.';
    $('glitchDownload').textContent=pixel?'EXPORT GLITCHED PNG ↧':'EXPORT RAW GLITCHED FILE ↧';
  }
  async function switchMode(){
    clearTimeout(state.pending);
    if(state.file)state.drafts[state.mode]=area.value;
    state.mode=$('glitchViewMode').value;uiMode();
    if(!state.file)return;
    if(!state.drafts[state.mode])state.drafts[state.mode]=state.mode==='pixel'?state.pixelSource:sourceRawDraft(state.mode);
    area.value=state.drafts[state.mode];
    await refresh();
  }
  async function load(file){
    if(!file)return;
    if(file.size>8*1024*1024){stat('8 MB EDITOR LIMIT / TRY A SMALLER FILE','error');return;}
    if(!/^image\//.test(file.type)&&!/\.(png|jpe?g|gif|webp|bmp)$/i.test(file.name)){stat('UPLOAD A SUPPORTED IMAGE','error');return;}
    buttons(false);stat('LOADING IMAGE DATA…');
    try{
      const original=new Uint8Array(await file.arrayBuffer());
      const mime=file.type||({png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',gif:'image/gif',webp:'image/webp',bmp:'image/bmp'}[(file.name.split('.').pop()||'').toLowerCase()]||'image/png');
      const img=await decodeBlob(new Blob([original],{type:mime}));
      state.file=file;state.bytes=original;state.image=img;state.mime=mime;state.originalName=file.name;state.drafts={};
      pixelBase(img);paint(src,img);$('glitchFileMeta').textContent=`${file.name} · ${(file.size/1024).toFixed(1)} KiB · ${img.naturalWidth}×${img.naturalHeight}`;
      state.mode=$('glitchViewMode').value;uiMode();
      state.drafts[state.mode]=state.mode==='pixel'?state.pixelSource:sourceRawDraft(state.mode);
      area.value=state.drafts[state.mode];buttons(true);await refresh();
    }catch(e){stat('CANNOT OPEN IMAGE: '+e.message,'error');buttons(false);}
  }
  function mangleText(input,count,mode){
    if(mode==='pixel'){
      const lines=input.split(/\r?\n/),start=lines.findIndex(l=>!l.trimStart().startsWith('//'));
      const head=start>=0?lines.slice(0,start).join('\n')+'\n':'';
      const tokens=core.pixelTokens(input);
      for(let i=0;i<count;i++){
        const n=Math.floor(Math.random()*(tokens.length+1));
        const action=Math.random();
        if(action<.4)tokens.splice(n,0,['GLITCH','WRONG','MACHINE','NOISE','FF00FF','00FFFF'][Math.floor(Math.random()*6)]);
        else if(action<.7&&tokens.length)tokens.splice(Math.min(n,tokens.length-1),1);
        else if(tokens.length)tokens[Math.min(n,tokens.length-1)]=['GLITCH','ART','F00D00','000000','FFFFFF','C0FFEE'][Math.floor(Math.random()*6)];
      }
      const chunks=[];for(let i=0;i<tokens.length;i+=32)chunks.push(tokens.slice(i,i+32).join(' '));
      return head+chunks.join('\n');
    }
    const tokens=mode==='hex'?input.trim().split(/\s+/):Array.from(input);
    for(let i=0;i<count;i++){
      const n=Math.floor(Math.random()*(tokens.length+1)),r=Math.random();
      const v=mode==='hex'?Math.floor(Math.random()*256).toString(16).padStart(2,'0').toUpperCase():'GLITCH\\x'+Math.floor(Math.random()*256).toString(16).padStart(2,'0').toUpperCase();
      if(r<.4)tokens.splice(n,0,v);else if(r<.7&&tokens.length)tokens.splice(Math.min(n,tokens.length-1),1);
      else if(tokens.length)tokens[Math.min(n,tokens.length-1)]=v;
    }
    return mode==='hex'?tokens.join(' '):tokens.join('');
  }
  function editSelection(replace){
    if(!state.file)return;
    const s=area.selectionStart,e=area.selectionEnd,v=area.value;
    let a=s,b=e;
    if(!replace&&s===e){a=Math.max(0,s-30);b=Math.min(v.length,s+30)}
    const add=replace?(state.mode==='pixel'?` GLITCH FFFFFF NOISE `:state.mode==='hex'?' DE AD BE EF ':'GLITCH\\xFA'):'';
    area.value=v.slice(0,a)+add+v.slice(b);area.selectionStart=area.selectionEnd=a+add.length;
    schedule();area.focus();
  }
  function canvasBlob(canvas){return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(Error('PNG EXPORT FAILED')),'image/png'))}
  async function exportFile(){
    if(state.mode==='pixel'){
      // Ensure canvas reflects the very latest text, regardless of auto-refresh toggle.
      drawPixelText();
      const blob=await canvasBlob(state.pixelCanvas);
      return new File([blob],state.originalName.replace(/\.[^.]+$/,'')+'-pixel-glitched.png',{type:'image/png'});
    }
    const bytes=fromRawText();
    const name=state.originalName.replace(/(\.[^.]+)$/, '-raw-glitched$1');
    return new File([bytes],name,{type:state.mime});
  }
  function download(file){const a=document.createElement('a'),url=URL.createObjectURL(file);a.href=url;a.download=file.name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),2000)}

  $('glitchInput').addEventListener('change',e=>load(e.target.files[0]));
  $('glitchUseCurrent').addEventListener('click',()=>{const f=window.wmCurrentImageFile?.();if(f)load(f);else stat('LOAD AN IMAGE IN IMAGE → SOUND FIRST','error')});
  const drop=$('glitchDrop');drop.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('hover')});
  drop.addEventListener('dragleave',()=>drop.classList.remove('hover'));
  drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('hover');load(e.dataTransfer.files[0])});
  $('glitchViewMode').addEventListener('change',switchMode);
  $('glitchPixelSize').addEventListener('change',async()=>{
    if(!state.image)return;
    pixelBase(state.image);
    if(state.mode==='pixel'){area.value=state.pixelSource;await refresh();stat('PIXEL GRID REBUILT FROM THE ORIGINAL IMAGE / PREVIOUS PIXEL EDITS RESET','ok')}
  });
  area.addEventListener('input',schedule);
  $('glitchRefresh').addEventListener('click',refresh);
  $('glitchReset').addEventListener('click',async()=>{
    if(!state.file)return;
    state.drafts[state.mode]=state.mode==='pixel'?state.pixelSource:sourceRawDraft(state.mode);
    area.value=state.drafts[state.mode];await refresh();stat('RESET CURRENT EDITOR TO ORIGINAL IMAGE DATA','ok');
  });
  $('glitchIntensity').addEventListener('input',()=>$('glitchIntensityVal').textContent=$('glitchIntensity').value);
  $('glitchRandom').addEventListener('click',()=>{if(!state.file)return;area.value=mangleText(area.value,+$('glitchIntensity').value,state.mode);schedule()});
  $('glitchInsert').addEventListener('click',()=>editSelection(true));
  $('glitchDelete').addEventListener('click',()=>editSelection(false));
  $('glitchDownload').addEventListener('click',async()=>{
    try{if(!state.file)return;clearTimeout(state.pending);const file=await exportFile();download(file);stat(state.mode==='pixel'?'VALID GLITCHED PNG EXPORTED':'RAW GLITCHED FILE EXPORTED / MAY NOT DECODE','ok')}
    catch(e){stat(e.message,'error')}
  });
  $('glitchToAudio').addEventListener('click',async()=>{
    if(!state.file)return;
    try{
      clearTimeout(state.pending);await refresh();
      if(!state.previewGood){stat('RAW DATA DOES NOT DECODE. SWITCH TO PIXEL TEXT OR UNDO THE RAW CHANGES.','error');return;}
      const file=await exportFile();await window.wmLoadImageIntoSound(file);
      document.querySelector('[data-tab="image"]').click();stat('GLITCHED IMAGE SENT TO SONIFICATION LAB','ok');
    }catch(e){stat('SOUND LAB TRANSFER FAILED: '+e.message,'error')}
  });
  splash(src,'ORIGINAL IMAGE\nAWAITING FILE');splash(out,'TEXT GLITCH RESULT\nAWAITING FILE');
  buttons(false);uiMode();
})();
