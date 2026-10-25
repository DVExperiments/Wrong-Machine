/* WRONG MACHINE v1.2 — source-first hexadecimal image glitcher.
   Pixel mode: decoded RGBA bytes; re-encodes as valid PNG.
   JPEG scan mode: exact original compressed bytes; never modifies headers/markers.
   No external dependencies and no uploads. */
(function(root, factory){
  const api=factory();
  if(typeof module==='object' && module.exports)module.exports=api;
  if(root)root.WMGlitch=api;
})(typeof globalThis!=='undefined'?globalThis:null,function(){
  'use strict';
  const HEX=/^[0-9a-fA-F]{2}$/;
  function hexText(bytes){
    const lines=[];
    for(let i=0;i<bytes.length;i+=16)lines.push(Array.from(bytes.subarray(i,i+16),b=>b.toString(16).padStart(2,'0').toUpperCase()).join(' '));
    return lines.join('\n');
  }
  function parseHex(text,expected){
    const chunks=text.trim().split(/\s+/).filter(Boolean);
    if(chunks.length!==expected)throw Error(`KEEP THE BYTE COUNT UNCHANGED: EXPECTED ${expected}, FOUND ${chunks.length}`);
    if(chunks.some(s=>!HEX.test(s)))throw Error('USE TWO HEX DIGITS PER BYTE (00–FF), SEPARATED BY SPACES');
    return Uint8Array.from(chunks.map(s=>parseInt(s,16)));
  }
  function asciiText(bytes){
    return Array.from(bytes,b=>(b>=32&&b<=126)?String.fromCharCode(b):'·').join('').replace(/(.{16})/g,'$1\n').trimEnd();
  }
  function parseJPEGScans(bytes){
    if(!bytes||bytes.length<4||bytes[0]!==255||bytes[1]!==216)throw Error('NOT A JPEG FILE');
    let p=2;const scans=[];
    while(p<bytes.length-1){
      if(bytes[p]!==255){p++;continue}
      const markerPos=p;
      while(bytes[p]===255)p++;
      if(p>=bytes.length)break;
      const mark=bytes[p++];
      if(mark===217)break;
      if(mark===216||mark===1||(mark>=208&&mark<=215))continue;
      if(p+2>bytes.length)break;
      const len=(bytes[p]<<8)|bytes[p+1];
      if(len<2||p+len>bytes.length)throw Error('INVALID JPEG MARKER LENGTH');
      if(mark!==218){p+=len;continue}
      const start=p+len;
      p=start;
      while(p<bytes.length-1){
        if(bytes[p]!==255){p++;continue}
        const b=bytes[p+1];
        if(b===0||(b>=208&&b<=215)){p+=2;continue}
        break;
      }
      if(p>start)scans.push({start,end:p,length:p-start,marker:markerPos});
    }
    if(!scans.length)throw Error('NO EDITABLE JPEG ENTROPY SCAN WAS FOUND');
    return scans;
  }
  function safeWindow(mode,bytes,scan,offset,count){
    const lo=mode==='jpeg'?scan.start:0,hi=mode==='jpeg'?scan.end:bytes.length;
    if(!Number.isSafeInteger(offset)||offset<lo||offset>=hi)throw Error('OFFSET OUTSIDE EDITABLE REGION');
    if(!Number.isSafeInteger(count)||count<1||offset+count>hi)throw Error('EDIT WINDOW OUTSIDE EDITABLE REGION');
    return {start:offset,end:offset+count,lo,hi};
  }
  function validateJPEGEdit(original,working,offset,replacement){
    for(let n=0;n<replacement.length;n++){
      const i=offset+n;
      if(replacement[n]===working[i])continue;
      if(original[i]===255||(i>0&&original[i-1]===255))throw Error('JPEG MARKER/STUFFING BYTE LOCKED AT OFFSET '+i);
      if(replacement[n]===255)throw Error('NEW FF MARKERS ARE DISALLOWED IN JPEG SCAN DATA (OFFSET '+i+')');
    }
    return true;
  }
  function mutate(bytes,start,end,count,mode){
    const result=new Uint8Array(bytes), span=end-start;
    const n=Math.min(Math.max(1,Math.floor(count)),span);
    for(let k=0;k<n;k++){
      const i=start+Math.floor(Math.random()*span);
      if(mode==='jpeg'&&(result[i]===255||(i>0&&result[i-1]===255)))continue;
      const original=result[i];
      let next;
      if(mode==='jpeg')next=Math.floor(Math.random()*255); // Avoid new FF marker bytes.
      else next=Math.floor(Math.random()*256);
      if(next===original)next=(next+1)% (mode==='jpeg'?255:256);
      result[i]=next;
    }
    return result;
  }
  return {hexText,parseHex,asciiText,parseJPEGScans,safeWindow,validateJPEGEdit,mutate};
});

(function(){
  'use strict';
  if(typeof document==='undefined')return;
  const $=id=>document.getElementById(id);
  const core=window.WMGlitch;
  const state={file:null,original:null,working:null,pixelCanvas:null,mode:'pixels',scans:[],scanIndex:0,offset:0,window:256,previewGood:false};
  const preview=$('glitchPreview'),original=$('glitchOriginal'),ctx=preview.getContext('2d');
  const picker=$('glitchInput'),mode=$('glitchMode'),scan=$('glitchScan'),hex=$('glitchHex');
  const status=$('glitchStatus'),ascii=$('glitchAscii'),addresses=$('glitchAddresses');
  $('glitchIntensity').addEventListener('input',()=>{$('glitchIntensityVal').textContent=$('glitchIntensity').value});
  function setStatus(message,kind='info') {status.textContent=message;status.dataset.kind=kind}
  function setButtons(enabled){for(const id of ['glitchApply','glitchRandom','glitchUndo','glitchDownload','glitchToAudio','glitchPrev','glitchNext'])$(id).disabled=!enabled}
  function textCanvas(canvas,msg){const c=canvas.getContext('2d');canvas.width=720;canvas.height=450;c.fillStyle='#080c15';c.fillRect(0,0,720,450);c.fillStyle='#728296';c.font='15px monospace';c.textAlign='center';c.fillText(msg,360,225)}
  textCanvas(preview,'GLITCH PREVIEW / AWAITING FILE');textCanvas(original,'ORIGINAL / AWAITING FILE');setButtons(false);
  function selectedScan(){return state.scans[state.scanIndex]}
  function bounds(){if(state.mode==='jpeg'){const s=selectedScan();return {lo:s.start,hi:s.end}}return {lo:0,hi:state.working.length}}
  function showMode(){
    const isJpeg=state.file&&/\.jpe?g$/i.test(state.file.name)&&state.scans.length;
    const opt=mode.querySelector('option[value="jpeg"]');opt.disabled=!isJpeg;
    if(!isJpeg&&mode.value==='jpeg')mode.value='pixels';
    $('jpegScanRow').hidden=state.mode!=='jpeg';
    $('glitchFormatNote').textContent=state.mode==='jpeg'
       ?'REAL COMPRESSED JPEG BYTES. Editing inside entropy scans can create genuine compression artifacts or destroy decoding. JPEG headers, markers, and file length stay untouched.'
       :'DECODED RGBA PIXEL BYTES. Edits are visible and exported as a fresh valid PNG. This is not modification of the original compressed PNG/JPEG file stream.';
    $('glitchDownload').textContent=state.mode==='jpeg'?'EXPORT GLITCHED JPEG ↧':'EXPORT GLITCHED PNG ↧';
  }
  function refreshEditor(){
    if(!state.working)return;
    const {lo,hi}=bounds();state.offset=Math.min(Math.max(lo,state.offset),hi-1);
    const count=Math.min(state.window,hi-state.offset);
    const segment=state.working.subarray(state.offset,state.offset+count);
    hex.value=core.hexText(segment);
    ascii.textContent=core.asciiText(segment);
    let list=[];for(let i=0;i<count;i+=16)list.push((state.offset+i).toString(16).toUpperCase().padStart(8,'0'));
    addresses.textContent=list.join('\n');
    $('glitchOffset').value=state.offset;
    $('glitchByteCount').textContent=`${count} BYTES / ${state.offset.toLocaleString()} – ${(state.offset+count-1).toLocaleString()} / ${(hi-lo).toLocaleString()} EDITABLE`;
    $('glitchByteTotal').textContent=`${state.working.length.toLocaleString()} BYTES`;
    $('glitchPrev').disabled=state.offset<=lo;$('glitchNext').disabled=state.offset+state.window>=hi;
    setStatus(state.mode==='jpeg'?'JPEG ENTROPY SCAN / HEADER LOCKED':'DECODED PIXELS / SAFE TO EDIT');
  }
  function drawScaled(canvas,img){const naturalW=img.naturalWidth||img.width,naturalH=img.naturalHeight||img.height;
    const scale=Math.min(1,1024/Math.max(naturalW,naturalH));const w=Math.max(1,Math.round(naturalW*scale)),h=Math.max(1,Math.round(naturalH*scale));
    canvas.width=w;canvas.height=h;const x=canvas.getContext('2d',{willReadFrequently:true});x.clearRect(0,0,w,h);x.drawImage(img,0,0,w,h)
  }
  function decodeFile(blob){return new Promise((resolve,reject)=>{const url=URL.createObjectURL(blob),im=new Image();im.onload=()=>{URL.revokeObjectURL(url);resolve(im)};im.onerror=()=>{URL.revokeObjectURL(url);reject(Error('BROWSER COULD NOT DECODE THE MODIFIED FILE'))};im.src=url})}
  async function decodeBytes(bytes){return decodeFile(new Blob([bytes],{type:'image/jpeg'}))}
  function paintFailure(reason){textCanvas(preview,'DECODER REJECTED THESE BYTES');setStatus(reason+' — TRY UNDO OR FEWER CHANGES','error');state.previewGood=false;}
  async function showPreview(){
    if(state.mode==='pixels'){
      const c=state.pixelCanvas;
      const im=new ImageData(new Uint8ClampedArray(state.working),c.width,c.height);
      const cctx=c.getContext('2d',{willReadFrequently:true});cctx.putImageData(im,0,0);
      preview.width=c.width;preview.height=c.height;ctx.drawImage(c,0,0);state.previewGood=true;return true;
    }
    try{const im=await decodeBytes(state.working);drawScaled(preview,im);state.previewGood=true;return true}
    catch(e){paintFailure(e.message);return false}
  }
  async function load(file){
    if(!file)return;
    if(!/^image\//.test(file.type)&&!/\.(png|jpe?g|webp|gif|bmp)$/i.test(file.name)){setStatus('PLEASE CHOOSE A BROWSER-SUPPORTED IMAGE','error');return}
    if(file.size>20*1024*1024){setStatus('20 MB FILE LIMIT / TRY A SMALLER IMAGE','error');return}
    setButtons(false);setStatus('DECODING IMAGE…');
    try{
      const img=await decodeFile(file),raw=new Uint8Array(await file.arrayBuffer());
      const pixels=document.createElement('canvas');drawScaled(pixels,img);
      const jpg=/\.jpe?g$/i.test(file.name)||file.type==='image/jpeg';
      let scans=[];if(jpg){try{scans=core.parseJPEGScans(raw)}catch(e){scans=[]}}
      state.file=file;state.original=raw;state.pixelCanvas=pixels;state.scans=scans;state.scanIndex=0;
      state.mode=jpg&&scans.length?'jpeg':'pixels';mode.value=state.mode;
      drawScaled(original,img);
      scan.innerHTML='';scans.forEach((s,i)=>{const op=document.createElement('option');op.value=i;op.textContent=`SCAN ${i+1} / ${s.length.toLocaleString()} BYTES`;scan.append(op)});
      resetWorking();
      $('glitchFileMeta').textContent=`${file.name} · ${(file.size/1024).toFixed(1)} KiB · ${pixels.width} × ${pixels.height} pixel workspace${jpg?' · '+scans.length+' JPEG scan(s)':''}`;
      setButtons(true);showMode();refreshEditor();await showPreview();
      setStatus(state.mode==='jpeg'?'JPEG LOADED / COMPRESSED FILE BYTES READY':'IMAGE LOADED / RGBA BYTES READY','ok');
    }catch(e){setStatus('CANNOT READ IMAGE: '+e.message,'error');setButtons(false)}
  }
  function resetWorking(){
    if(state.mode==='jpeg')state.working=new Uint8Array(state.original);
    else state.working=new Uint8Array(state.pixelCanvas.getContext('2d',{willReadFrequently:true}).getImageData(0,0,state.pixelCanvas.width,state.pixelCanvas.height).data);
    state.offset=bounds().lo;
  }
  async function switchMode(){if(!state.file)return;state.mode=mode.value;state.scanIndex=0;scan.value='0';resetWorking();showMode();refreshEditor();await showPreview()}
  mode.addEventListener('change',switchMode);
  scan.addEventListener('change',()=>{state.scanIndex=+scan.value;state.offset=selectedScan().start;refreshEditor()});
  picker.addEventListener('change',e=>load(e.target.files[0]));
  $('glitchUseCurrent').addEventListener('click',()=>{
    if(!window.wmCurrentImageFile){setStatus('UPLOAD AN IMAGE IN THE IMAGE → SOUND TAB FIRST','error');return}
    load(window.wmCurrentImageFile());
  });
  $('glitchWindow').addEventListener('change',()=>{state.window=+$('glitchWindow').value;if(state.working)refreshEditor()});
  $('glitchJump').addEventListener('click',()=>{if(!state.working)return;const {lo,hi}=bounds(),n=Number($('glitchOffset').value);if(!Number.isSafeInteger(n)||n<lo||n>=hi){setStatus(`OFFSET MUST BE ${lo}–${hi-1}`,'error');return}state.offset=n;refreshEditor()});
  $('glitchPrev').addEventListener('click',()=>{state.offset-=state.window;refreshEditor()});
  $('glitchNext').addEventListener('click',()=>{state.offset+=state.window;refreshEditor()});
  hex.addEventListener('input',()=>{
    if(!state.working)return;
    const count=Math.min(state.window,bounds().hi-state.offset);
    try{const bytes=core.parseHex(hex.value,count);ascii.textContent=core.asciiText(bytes);$('glitchApply').disabled=false;setStatus('VALID HEX EDIT / PRESS APPLY','ok')}
    catch(e){$('glitchApply').disabled=true;setStatus(e.message,'error')}
  });
  let operation=0;
  $('glitchApply').addEventListener('click',async()=>{
    if(!state.working)return;
    const {hi}=bounds(),count=Math.min(state.window,hi-state.offset);
    try{
      const bytes=core.parseHex(hex.value,count),newData=new Uint8Array(state.working);
      if(state.mode==='jpeg')core.validateJPEGEdit(state.original,state.working,state.offset,bytes);
      newData.set(bytes,state.offset);
      state.working=newData;const id=++operation;
      const ok=await showPreview();if(id!==operation)return;
      refreshEditor();setStatus(ok?'EDIT APPLIED / '+count+' BYTES IN WINDOW':'EDIT APPLIED / IMAGE CANNOT DECODE',ok?'ok':'error');
    }catch(e){setStatus(e.message,'error')}
  });
  $('glitchRandom').addEventListener('click',async()=>{
    if(!state.working)return;
    const {lo,hi}=bounds(),pct=+$('glitchIntensity').value;
    // Spread randomized changes across entire editable region (not only 256-byte viewport).
    const n=Math.max(1,Math.round((hi-lo)*pct/10000));
    state.working=core.mutate(state.working,lo,hi,n,state.mode);
    const id=++operation;const ok=await showPreview();if(id!==operation)return;
    refreshEditor();setStatus(ok?`CORRUPTED ~${n.toLocaleString()} BYTES (${pct}/10000 OF REGION)`:'FILE DECODING FAILED / LOWER INTENSITY OR RESET',ok?'ok':'error');
  });
  $('glitchUndo').addEventListener('click',async()=>{if(!state.working)return;++operation;resetWorking();refreshEditor();await showPreview();setStatus('ORIGINAL IMAGE RESTORED / EDITS DISCARDED','ok')});
  async function resultFile(){
    if(state.mode==='jpeg')return new File([state.working],state.file.name.replace(/\.[^.]+$/,'')+'-glitched.jpg',{type:'image/jpeg'});
    const blob=await new Promise((resolve,reject)=>state.pixelCanvas.toBlob(b=>b?resolve(b):reject(Error('PNG ENCODING FAILED')),'image/png'));
    return new File([blob],state.file.name.replace(/\.[^.]+$/,'')+'-glitched.png',{type:'image/png'});
  }
  $('glitchDownload').addEventListener('click',async()=>{
    if(!state.working)return;
    try{const file=await resultFile();downloadBlob(file,file.name);setStatus('GLITCHED FILE EXPORTED / ORIGINAL IS UNCHANGED','ok')}
    catch(e){setStatus(e.message,'error')}
  });
  $('glitchToAudio').addEventListener('click',async()=>{
    if(!state.working)return;
    if(!state.previewGood){setStatus('CANNOT SEND A FILE THAT THE BROWSER CANNOT DECODE','error');return}
    try{
      const file=await resultFile();await window.wmLoadImageIntoSound(file);
      document.querySelector('[data-tab="image"]').click();
      setStatus('GLITCHED FILE SENT TO THE SONIFICATION LAB','ok');
    }catch(e){setStatus('TRANSFER FAILED: '+e.message,'error')}
  });
  const drop=$('glitchDrop');drop.addEventListener('dragover',e=>{e.preventDefault();drop.classList.add('hover')});drop.addEventListener('dragleave',()=>drop.classList.remove('hover'));
  drop.addEventListener('drop',e=>{e.preventDefault();drop.classList.remove('hover');load(e.dataTransfer.files[0])});
})();
