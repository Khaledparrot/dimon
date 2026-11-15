/* =====================================================================
   cracker.js — the hasher. Runs in a Web Worker so it keeps working
   while you use the rest of the game. No passwords are ever typed:
   the seal is a system-made hash and the phone does the work.
   ===================================================================== */
(function (global) {
  'use strict';

  var WORKER_SRC = [
    'function sha256hex(str){',
    'function rr(n,x){return (x>>>n)|(x<<(32-n));}',
    'var K=[0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,',
    '0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,',
    '0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,',
    '0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,',
    '0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,',
    '0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,',
    '0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,',
    '0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2];',
    'var H0=[0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19];',
    'var bytes=[],i,c;',
    'for(i=0;i<str.length;i++){c=str.charCodeAt(i);if(c<128)bytes.push(c);else if(c<2048){bytes.push(192|(c>>6),128|(c&63));}else{bytes.push(224|(c>>12),128|((c>>6)&63),128|(c&63));}}',
    'var bitLen=bytes.length*8;bytes.push(0x80);while(bytes.length%64!==56)bytes.push(0);',
    'bytes.push(0,0,0,0,(bitLen>>>24)&255,(bitLen>>>16)&255,(bitLen>>>8)&255,bitLen&255);',
    'var H=H0.slice(),w=new Array(64);',
    'for(var off=0;off<bytes.length;off+=64){',
    'for(i=0;i<16;i++){w[i]=(bytes[off+i*4]<<24)|(bytes[off+i*4+1]<<16)|(bytes[off+i*4+2]<<8)|bytes[off+i*4+3];}',
    'for(i=16;i<64;i++){var s0=rr(7,w[i-15])^rr(18,w[i-15])^(w[i-15]>>>3);var s1=rr(17,w[i-2])^rr(19,w[i-2])^(w[i-2]>>>10);w[i]=(w[i-16]+s0+w[i-7]+s1)|0;}',
    'var a=H[0],b=H[1],cc=H[2],d=H[3],e=H[4],f=H[5],g=H[6],h=H[7];',
    'for(i=0;i<64;i++){var S1=rr(6,e)^rr(11,e)^rr(25,e);var ch=(e&f)^(~e&g);var t1=(h+S1+ch+K[i]+w[i])|0;',
    'var S0=rr(2,a)^rr(13,a)^rr(22,a);var mj=(a&b)^(a&cc)^(b&cc);var t2=(S0+mj)|0;',
    'h=g;g=f;f=e;e=(d+t1)|0;d=cc;cc=b;b=a;a=(t1+t2)|0;}',
    'H[0]=(H[0]+a)|0;H[1]=(H[1]+b)|0;H[2]=(H[2]+cc)|0;H[3]=(H[3]+d)|0;H[4]=(H[4]+e)|0;H[5]=(H[5]+f)|0;H[6]=(H[6]+g)|0;H[7]=(H[7]+h)|0;}',
    'var out="";for(i=0;i<8;i++){out+=("00000000"+(H[i]>>>0).toString(16)).slice(-8);}return out;}',
    'var job=null;',
    'self.onmessage=function(ev){',
    ' var m=ev.data;',
    ' if(m.type==="stop"){job=null;return;}',
    ' if(m.type==="run"){job=m;run();}',
    '};',
    'function run(){',
    ' if(!job)return;',
    ' var nonce=job.nonce||0,t0=performance.now(),hashes=0,prefix="0".repeat(job.zeros),found=null;',
    ' while(job){',
    '  var batch=4000;',
    '  for(var i=0;i<batch;i++){',
    '   var h=sha256hex(job.salt+":"+nonce);hashes++;',
    '   if(h.slice(0,job.zeros)===prefix){found={nonce:nonce,hash:h};break;}',
    '   nonce++;',
    '  }',
    '  var dt=performance.now()-t0;',
    '  if(found){self.postMessage({type:"found",nonce:found.nonce,hash:found.hash,hashes:hashes});job=null;return;}',
    '  if(dt>700){self.postMessage({type:"progress",nonce:nonce,rate:Math.round(hashes/(dt/1000))});hashes=0;t0=performance.now();}',
    '  if(job.paused){self.postMessage({type:"paused",nonce:nonce});job=null;return;}',
    '  break;',
    ' }',
    ' setTimeout(run,0);',
    '}'
  ].join('\n');

  var worker = null, active = null;

  function makeWorker() {
    try {
      var blob = new Blob([WORKER_SRC], { type: 'text/javascript' });
      return new Worker(URL.createObjectURL(blob));
    } catch (e) { return null; }
  }

  /* job = {id, salt, zeros, nonce, onProgress, onFound} */
  function start(job) {
    stop();
    active = job;
    worker = makeWorker();
    if (!worker) { if (job.onFail) job.onFail(); return null; }
    worker.onmessage = function (e) {
      var m = e.data;
      if (!active || active.id !== job.id) return;
      if (m.type === 'progress') {
        active.nonce = m.nonce;
        if (job.onProgress) job.onProgress(m.nonce, m.rate);
      } else if (m.type === 'found') {
        if (job.onFound) job.onFound(m.nonce, m.hash, m.hashes);
        active = null;
      } else if (m.type === 'paused') {
        active.nonce = m.nonce;
      }
    };
    worker.postMessage({ type: 'run', salt: job.salt, zeros: job.zeros, nonce: job.nonce || 0 });
    return worker;
  }

  function stop() {
    if (worker) { try { worker.postMessage({ type: 'stop' }); worker.terminate(); } catch (e) {} }
    worker = null;
  }
  function current() { return active; }

  global.Cracker = { start: start, stop: stop, current: current };
})(window);
