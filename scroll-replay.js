'use strict';

// Key requests in the two controller excerpts, in replay seconds. Each holds X and a direction for 0.18 s.
const controllerInputs = [[43.711, 1], [45.14, 1], [45.524, 1], [45.909, -1], [46.311, 1], [46.693, -1], [47.075, 1], [47.456, -1], [47.844, 1], [48.258, -1], [48.676, 1], [49.093, -1], [49.494, 1], [49.876, -1], [50.26, 1], [50.646, -1], [51.026, 1], [51.41, -1], [51.794, 1], [78.823, -1], [79.21, -1], [79.593, 1], [79.974, -1], [80.36, 1], [80.757, -1], [81.159, 1], [81.549, -1], [81.942, 1], [82.323, -1], [82.71, 1], [83.106, -1], [83.49, -1], [83.855, 1], [84.242, 1], [84.626, 1], [85.026, -1], [85.405, -1], [85.788, -1]];

// Hull position and mean nearby projectile x reconstructed from replay pixels at 8 Hz.
const pixelTrack = [[320,313,313],[319,309,323],[322,311,300],[320,314,298],[311,313,313],[315,312,316],[305,314,324],[54,296,87],[320,312,325],[323,312,308],[324,312,325],[323,312,340],[528,310,551],[324,314,345],[323,314,340],[323,314,340],[528,310,550],[528,310,550],[528,310,549],[310,296,318],[319,292,322],[319,292,322],[35,321,93],[35,321,90],[35,321,91],[35,322,81],[317,326,316],[317,315,310],[317,315,311],[35,322,91],[317,315,310],[317,315,317],[35,321,94],[314,292,314],[399,303,392],[404,316,401],[35,321,94],[35,319,90],[327,309,315],[342,305,321],[400,308,401],[414,310,473],[405,301,409],[346,310,314],[334,308,316],[344,304,310],[402,311,444],[412,306,449],[407,311,431],[360,316,338],[339,303,308],[334,305,315],[400,313,408],[421,304,464],[429,315,480],[399,302,430],[351,311,323],[349,310,321],[372,308,345],[422,312,460],[433,311,468],[432,304,460],[373,305,341],[359,306,323],[355,306,334],[393,313,371],[432,302,430],[429,316,470],[391,302,369],[353,306,326],[348,314,314],[389,312,404],[429,303,415],[434,309,431],[396,312,398],[349,303,319],[345,309,325],[382,307,362],[430,306,429],[430,306,430],[482,311,476],[475,310,509],[428,309,461],[407,304,427],[405,313,398],[348,304,326],[335,303,313],[330,302,314],[400,298,359],[414,303,471],[411,304,427],[364,304,324],[340,303,320],[341,302,312],[390,304,406],[424,301,438],[424,304,436],[378,304,396],[350,309,344],[348,303,328],[389,300,358],[424,303,448],[434,313,445],[405,304,431],[362,303,319],[356,303,330],[366,310,328],[437,312,479],[440,310,479],[437,309,468],[370,302,327],[366,309,327],[362,302,335],[406,307,369],[451,308,443],[453,314,463],[453,314,473],[453,314,474],[454,314,473],[38,309,72],[602,311,548],[56,313,72],[500,305,467],[456,300,427],[490,298,526],[506,322,514],[533,312,521],[533,312,523],[577,307,540],[574,310,552],[578,309,542],[36,311,78],[37,311,86],[504,300,538],[462,304,509],[402,299,374],[414,309,448],[393,310,383],[337,300,320],[334,302,317]];

// Best observed task progress from the published replay series and success timestamp.
const taskProgress = {"VISTA":[[38.0,0.0384],[40.35,0.1392]],"AutoPILOT":[[4.56,0.016],[12.66,0.032],[13.69,0.048],[26.81,0.0496],[29.42,0.1168],[52.12,0.1216],[54.06,0.1376],[54.44,0.1888],[56.02,0.2272],[56.81,0.2432],[58.37,0.2816],[59.52,0.2992],[59.9,0.3232],[60.29,0.3456],[60.67,0.3744],[61.06,0.4992],[61.46,0.5536],[61.84,0.6144],[63.39,0.6576],[63.77,0.7072],[82.64,0.7216],[83.04,0.808],[83.79,0.8608],[85.72,0.8768],[85.77,1]]};

// Buffer media on basic local servers so native seeking works without HTTP Range.
async function seekableMediaURL(url, signal) {
  if (/^https?:$/.test(url.protocol)) {
    try {
      const headers = await fetch(url, {method:'HEAD', signal});
      if (headers.ok && headers.headers.get('accept-ranges') !== 'bytes') {
        const response = await fetch(url, {signal});
        if (response.ok) return URL.createObjectURL(await response.blob());
      }
    } catch (error) {
      if (signal?.aborted) throw error;
    }
  }
  return url.href;
}

(() => {
  const byId = id => document.getElementById(id);
  const flight = byId('flight');
  const inspector = new URLSearchParams(location.search).get('scene') === 'controller';
  document.body.classList.toggle('paired-home', !inspector);
  const stage = flight.querySelector('.flight-stage');
  const cover = flight.querySelector('.cover-card');
  const screen = byId('moving-screen');
  const still = byId('pulled-frame');
  const video = byId('flight-video');
  const code = byId('code-view');
  const guide = screen.querySelector('.guides');
  const hull = guide.querySelector('.hull-guide');
  const threat = guide.querySelector('.threat-guide');
  const clock = byId('episode-time');
  const status = byId('runtime-state');
  const seek = byId('replay-seek');
  const toggle = byId('play-replay');
  const guideButton = byId('guides-toggle');
  const sceneLinks = [...flight.querySelectorAll('[data-scene-link]')];
  // Full ANSI keyboard. Names are display labels; active keys come only from the trace.
  const svgNS = 'http://www.w3.org/2000/svg';
  const keyboard = byId('keyboard-layout');
  function keyRow(x, y, cells) {
    for (const item of cells) {
      const [name, units = 1, height = 1] = Array.isArray(item) ? item : [item];
      const w = units * 20;
      if (name) {
        const cap = document.createElementNS(svgNS,'g');
        const face = document.createElementNS(svgNS,'rect');
        const legend = document.createElementNS(svgNS,'text');
        cap.setAttribute('transform','translate('+x+' '+y+')');
        cap.dataset.key = name;
        face.setAttribute('width',w-2);
        face.setAttribute('height',20*height-2);
        face.setAttribute('rx',2);
        legend.setAttribute('x',(w-2)/2);
        legend.setAttribute('y',(20*height-2)/2);
        legend.textContent = name;
        cap.append(face,legend);
        keyboard.append(cap);
      }
      x += w;
    }
  }
  keyRow(1,3,['Esc',['',1],'F1','F2','F3','F4',['',.5],'F5','F6','F7','F8',['',.5],'F9','F10','F11','F12']);
  keyRow(309,3,['Prt','Scr','Brk']);
  keyRow(1,29,['`','1','2','3','4','5','6','7','8','9','0','-','=','Backspace'].map(k=>k==='Backspace'?[k,2]:k));
  keyRow(1,49,[['Tab',1.5],...'QWERTYUIOP','[',']',['\\',1.5]]);
  keyRow(1,69,[['Caps',1.75],...'ASDFGHJKL',';',"'",
    ['Enter',2.25]]);
  keyRow(1,89,[['Shift',2.25],...'ZXCVBNM',',','.','/',['Shift',2.75]]);
  keyRow(1,109,[['Ctrl',1.25],['Win',1.25],['Alt',1.25],['Space',6.25],['Alt',1.25],['Win',1.25],['Menu',1.25],['Ctrl',1.25]]);
  keyRow(309,29,['Ins','Home','PgUp']);
  keyRow(309,49,['Del','End','PgDn']);
  keyRow(329,89,['↑']);
  keyRow(309,109,['←','↓','→']);
  keyRow(381,29,['Num','/','*','−']);
  keyRow(381,49,['7','8','9',['+',1,2]]);
  keyRow(381,69,['4','5','6']);
  keyRow(381,89,['1','2','3',['Ent',1,2]]);
  keyRow(381,109,[['0',2],'.']);
  const keys = ['←','→','X'].map(name => keyboard.querySelector('[data-key="'+name+'"]'));

  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const stops = [0, .48, .88];
  const clamp = t => Math.max(0, Math.min(1, t));
  const mix = (a, b, t) => a + (b - a) * t;
  function ease(t, start, end) {
    const n = clamp((t - start) / (end - start));
    return n * n * (3 - 2 * n);
  }

  let scene = -1;
  let progress = 0;
  let explicitPause = reduced.matches;
  let reachedEnd = false;
  let visible = false;
  let pendingSeek = null;
  let geometry;
  let scrollFrame = 0;
  let videoFrame = 0;

  function moveTo(t) {
    if (video.readyState < 1) { pendingSeek = t; return; }
    video.currentTime = t;
    drawReplay();
  }

  function syncButton() {
    const label = reachedEnd ? 'Replay this scene' : video.paused ? 'Play replay' : 'Pause replay';
    toggle.setAttribute('aria-label', label);
    toggle.title = label;
    toggle.textContent = reachedEnd ? '↺' : video.paused ? '▶' : 'Ⅱ';
  }

  function syncPlayback() {
    if (!visible || document.hidden || explicitPause || reachedEnd || byId('source-dialog').open) video.pause();
    else if (video.getAttribute('src')) video.play().catch(error => {
      if (error.name !== 'AbortError') { explicitPause = true; syncButton(); }
    });
    syncButton();
  }

  function setScene(next) {
    if (scene === next) return;
    scene = next;
    flight.dataset.scene = String(next);
    cover.inert = next !== 0;
    code.inert = next !== 2;
    byId('open-source').hidden = next !== 2;
    document.querySelector('.replay-instruments').inert = next === 0;
    sceneLinks.forEach((b, i) => b.setAttribute('aria-pressed',String(i === next)));
    const controller = next === 2;
    byId('harness-name').textContent = controller ? 'AutoPILOT' : 'VISTA';
    byId('scene-title').textContent = controller ? 'Closed-loop controller' : 'Single-step harness';
    byId('scene-description').textContent = controller
      ? 'The controller reads fresh frames and acts without another model call.'
      : 'At most one action per model call. The game keeps running.';
    byId('left-label').textContent = controller ? 'Controller code' : 'Model input';
    delete steering.dataset.state;
    byId('left-detail').textContent = controller ? 'direction = —' : '0:38.04';
    byId('left-caption').textContent = controller
      ? 'Fire and steer for 0.18 s per action.' : 'Next action at 0:42.16 (4.12 s later).';
    seek.min = controller ? 6 : 0;
    seek.max = controller ? 23.5 : 5.99;
    reachedEnd = false;
    moveTo(controller ? 8.08 : next === 1 ? .54 : 0);
    syncPlayback();
  }

  function measure() {
    const root = stage.getBoundingClientRect();
    const relative = id => {
      const r = byId(id).getBoundingClientRect();
      return {x:r.left-root.left, y:r.top-root.top, w:r.width, h:r.height};
    };
    geometry = {
      full:{x:0,y:0,w:root.width,h:root.height},
      left:relative('frame-dock'), right:relative('video-dock'),
      travel:flight.offsetHeight - stage.offsetHeight,
      top:flight.getBoundingClientRect().top + window.scrollY,
      nav:document.querySelector('header.top').offsetHeight
    };
  }

  function place(el, from, to, f, radius) {
    el.style.transform = 'translate3d(' + mix(from.x,to.x,f) + 'px,' + mix(from.y,to.y,f) + 'px,0)';
    el.style.width = mix(from.w,to.w,f) + 'px';
    el.style.height = mix(from.h,to.h,f) + 'px';
    el.style.borderRadius = radius + 'px';
  }

  function layout() {
    scrollFrame = 0;
    if (!geometry) measure();
    if (inspector && !reduced.matches) progress = clamp((window.scrollY - geometry.top + geometry.nav) / Math.max(1,geometry.travel));
    const split = ease(progress,.09,.42);
    const loop = ease(progress,.56,.77);
    const current = progress < .105 ? 0 : progress < .665 ? 1 : 2;
    if (scene !== current) {
      setScene(current);
      measure();
    }
    const g = geometry;
    const css = flight.style;
    css.setProperty('--cover-opacity', 1-ease(progress,0,.14));
    css.setProperty('--cover-rise', (ease(progress,0,.15)*40)+'px');
    css.setProperty('--panel-opacity', ease(progress,.19,.40));
    css.setProperty('--shade-opacity', 1-ease(progress,.02,.28));
    css.setProperty('--still-opacity', ease(progress,.095,.16)*(1-loop));
    css.setProperty('--code-opacity',loop);
    // The moving replay retains its identity as it docks. A still copy peels
    // from the same rectangle, then collapses into the controller's first line.
    place(screen,g.full,g.right,split,split*9);
    if (loop === 0) place(still,g.full,g.left,ease(progress,.105,.42),split*9);
    else place(still,g.left,{x:g.left.x+20,y:g.left.y+g.left.h*.27,w:g.left.w*.12,h:g.left.h*.12},loop,6);
  }

  function requestLayout() {
    if (!scrollFrame) scrollFrame = requestAnimationFrame(layout);
  }

  function chooseScene(i) {
    if (!reduced.matches) {
      window.scrollTo({top:geometry.top - geometry.nav + geometry.travel*stops[i],behavior:'smooth'});
    } else { progress = stops[i]; layout(); }
  }

  function formatTime(time) {
    const ms = Math.round(time*100);
    return Math.floor(ms/6000)+':'+((ms%6000)/100).toFixed(2).padStart(5,'0');
  }

  const curve = byId('score-curve');
  const pen = curve.getContext('2d');
  const scoreMeter = byId('task-meter');
  const scorePanel = byId('score-panel');

  function drawScore(controller, episodeTime) {
    const samples = controller ? taskProgress.AutoPILOT : taskProgress.VISTA;
    const start = controller ? 41.5 : 37.5;
    const end = controller ? 86.25 : 43.5;
    const time = Math.max(start, Math.min(end, episodeTime));
    const value = samples.findLast(([at]) => at <= time)?.[1] ?? 0;
    if (scoreMeter.value !== value) {
      scoreMeter.value = value;
      byId('task-value').value = (value*100).toFixed(1).replace(/\.0$/,'')+'%';
      scorePanel.classList.toggle('is-complete',value === 1);
    }
    const series = controller ? 'controller' : 'vista';
    if (scorePanel.dataset.series !== series) {
      scorePanel.dataset.series = series;
      byId('score-start').textContent = formatTime(start);
      byId('score-end').textContent = formatTime(end);
    }
    const w = curve.clientWidth, h = curve.clientHeight;
    if (!pen || !w || !h) return;
    const scale = Math.min(devicePixelRatio || 1, 2);
    const width = Math.round(w * scale), height = Math.round(h * scale);
    if (curve.width !== width || curve.height !== height) {
      curve.width = width; curve.height = height;
    }
    pen.setTransform(width/w,0,0,height/h,0,0);
    pen.clearRect(0,0,w,h);
    const x = t => 4 + (w-8)*(t-start)/(end-start);
    const y = v => h-4 - (h-8)*v;
    const now = x(time);
    pen.lineWidth = 1;
    pen.strokeStyle = '#c6dace';
    pen.setLineDash([2,3]);
    pen.beginPath();
    for (const level of [0,.5,1]) {
      pen.moveTo(x(start),y(level)); pen.lineTo(x(end),y(level));
    }
    pen.stroke(); pen.setLineDash([]);

    // A step changes only when the replay records a new best.
    const line = new Path2D();
    let best = samples.findLast(([at]) => at <= start)?.[1] ?? 0;
    line.moveTo(x(start),y(best));
    for (const [at,next] of samples) {
      if (at <= start || at > end) continue;
      line.lineTo(x(at),y(best)); line.lineTo(x(at),y(next)); best = next;
    }
    line.lineTo(x(end),y(best));
    pen.strokeStyle = '#adcbc0'; pen.lineWidth = 1.3; pen.stroke(line);
    pen.save(); pen.beginPath(); pen.rect(0,0,now,h); pen.clip();
    const area = new Path2D(line);
    area.lineTo(x(end),y(0)); area.lineTo(x(start),y(0)); area.closePath();
    const gradient = pen.createLinearGradient(0,0,0,h);
    gradient.addColorStop(0,'#48b78e65'); gradient.addColorStop(1,'#48b78e0b');
    pen.fillStyle = gradient; pen.fill(area);
    pen.strokeStyle = '#16856d'; pen.lineWidth = 2; pen.stroke(line); pen.restore();
    pen.strokeStyle = '#78a89a'; pen.lineWidth = 1;
    pen.beginPath(); pen.moveTo(now,y(1)); pen.lineTo(now,y(0)); pen.stroke();
    pen.beginPath(); pen.arc(now,y(value),3,0,2*Math.PI);
    pen.fillStyle = '#16856d'; pen.fill(); pen.strokeStyle = '#fff'; pen.stroke();
  }

  const steering = byId('steering-readout');
  const steeringArrow = steering.querySelector('.steering-arrow');
  const steeringState = steering.querySelector('small');
  const steeringKey = steering.querySelector('strong');
  // Map only requests in the two visible excerpts onto the edited video clock.
  const visibleInputs = controllerInputs.flatMap(([start, sign]) => {
    if (start >= 41.5 && start < 51.5) return [{at:6 + start - 41.5, sign}];
    if (start >= 78.75 && start < 86.25) return [{at:16 + start - 78.75, sign}];
    return [];
  });
  const turns = visibleInputs.filter((input, i) => i > 0 &&
    input.sign !== visibleInputs[i-1].sign && ((input.at < 16) === (visibleInputs[i-1].at < 16)));

  function showSteering(input, held) {
    const key = input ? (input.sign < 0 ? 'ArrowLeft' : 'ArrowRight') : '';
    const state = input ? (held ? 'held' : 'released') : 'waiting';
    if (steering.dataset.key === key && steering.dataset.state === state) return;
    steering.dataset.key = key;
    steering.dataset.state = state;
    steeringArrow.textContent = key ? (input.sign < 0 ? '←' : '→') : '·';
    steeringState.textContent = held ? 'Key held' : input ? 'Last key · released' : 'Direction';
    steeringKey.textContent = key || 'Awaiting input';
    byId('left-detail').textContent = key ? "direction = '" + key + "'" : 'direction = —';
  }

  function drawReplay() {
    const t = video.currentTime;
    const controller = scene === 2;
    const time = controller ? (t >= 16 ? 78.75+t-16 : 41.5+t-6) : 37.5+t;
    let direction = 0;
    let firing = false;
    let label;
    if (controller) {
      const input = visibleInputs.findLast(({at}) => at <= t && (t < 16 || at >= 16));
      if (input && t < input.at + .18) { direction = input.sign; firing = true; }
      showSteering(input, firing);
      label = time >= 85.77 ? 'Goal reached · 5,024 points' : time < 43.58 ? 'Installing controller' : 'Controller running';
    } else {
      label = time < 38.04 ? 'Observing' : time < 40.35 ? 'Model thinking' : time < 42.16 ? 'Ship lost during call' : 'Action arrives after reset';
      if (time >= 42.162 && time < 43.162) direction = 1;
      firing = direction !== 0 || (time >= 35.873 && time < 37.873);
    }
    const track = controller && time >= 43.58 && time < 85.77 ? pixelTrack[Math.floor((t-6)*8)] : null;
    hull.hidden = !track;
    threat.hidden = !track || track[2] === null;
    if (track) {
      hull.style.left = track[0]/640*100+'%'; hull.style.top = track[1]/360*100+'%';
      if (track[2] !== null) threat.style.left = track[2]/640*100+'%';
    }
    code.dataset.op = controller && time >= 43.58 && time < 85.77 ? (firing ? 'act' : '') : '';
    [direction<0,direction>0,firing].forEach((down,i)=>keys[i].classList.toggle('down',down));
    const requested = [firing ? 'X' : '',direction < 0 ? '←' : direction > 0 ? '→' : ''].filter(Boolean).join(' + ') || '—';
    for (const id of ['pressed-keys','expanded-keys']) {
      if (byId(id).value !== requested) byId(id).value = requested;
    }
    drawScore(controller, time);
    const duration = controller ? 17.5 : 6;
    const clipTime = Math.max(0,Math.min(duration,t-(controller ? 6 : 0)));
    byId('clip-time').value = clipTime.toFixed(1)+' / '+duration+' s';
    seek.style.setProperty('--played',100*clipTime/duration+'%');
    if (status.textContent !== label) status.textContent = label;
    clock.value = formatTime(time);
    seek.value = String(t);
    seek.setAttribute('aria-valuetext',label+' at '+clock.value);
  }

  function paint() {
    drawReplay();
    if (scene < 2 && video.currentTime >= 5.94 && !video.seeking) {
      if (scene === 0) moveTo(0);
      else {
        reachedEnd = true;
        video.pause();
        moveTo(5.94);
        syncButton();
      }
    }
    if (!video.paused && !video.ended) videoFrame = requestAnimationFrame(paint);
  }

  byId('expanded-code').textContent = byId('recorded-code').textContent;
  byId('open-source').addEventListener('click',() => {
    byId('source-dialog').showModal();
    syncPlayback();
  });
  byId('source-dialog').addEventListener('close',syncPlayback);
  byId('open-keyboard').addEventListener('click',() => byId('keyboard-dialog').showModal());
  sceneLinks.forEach((b,i)=>b.addEventListener('click',()=>chooseScene(i)));
  guideButton.addEventListener('click',()=>{
    guide.hidden = !guide.hidden;
    guideButton.setAttribute('aria-pressed',String(!guide.hidden));
  });
  byId('next-turn').addEventListener('click', () => {
    const target = turns.find(({at}) => at > video.currentTime + .001) || turns[0];
    explicitPause = true;
    reachedEnd = false;
    syncPlayback();
    moveTo(target.at + .02);
  });
  byId('jump-goal').addEventListener('click',()=>{reachedEnd=false;moveTo(16);syncPlayback();});
  toggle.addEventListener('click',()=>{
    if (reachedEnd) {
      reachedEnd = false; explicitPause = false;
      moveTo(scene === 2 ? 6 : 0);
    } else explicitPause = !video.paused;
    syncPlayback();
  });
  seek.addEventListener('input',()=>{
    reachedEnd=false;
    moveTo(Number(seek.value));
    syncPlayback();
  });
  video.addEventListener('loadedmetadata',()=>{
    if (pendingSeek !== null) {moveTo(pendingSeek);pendingSeek=null;}
    drawReplay();
  });
  video.addEventListener('play',()=>{syncButton();cancelAnimationFrame(videoFrame);paint();});
  video.addEventListener('pause',()=>{cancelAnimationFrame(videoFrame);syncButton();drawReplay();});
  video.addEventListener('seeked',drawReplay);
  video.addEventListener('ended',()=>{reachedEnd=true;syncButton();drawReplay();});
  video.addEventListener('error',()=>{
    status.textContent='Replay unavailable. See the paper figure below.';
    toggle.disabled=seek.disabled=true;
  });
  document.addEventListener('visibilitychange',syncPlayback);
  window.addEventListener('scroll',requestLayout,{passive:true});
  const observer = new ResizeObserver(()=>{measure();requestLayout();});
  [stage,byId('video-dock'),byId('frame-dock')].forEach(el=>observer.observe(el));
  reduced.addEventListener('change',()=>{
    explicitPause=reduced.matches;progress=stops[Math.max(0,scene)];measure();layout();syncPlayback();
  });
  let replayRequested = false;
  new IntersectionObserver(([entry]) => {
    visible = entry.isIntersecting;
    if (visible && !replayRequested) {
      replayRequested = true;
      loadReplay();
    }
    syncPlayback();
  }).observe(stage);
  async function loadReplay() {
    const source = [...video.querySelectorAll('source')].find(item => video.canPlayType(item.type));
    if (!source) {
      video.dispatchEvent(new Event('error'));
      return;
    }
    const url = new URL(source.dataset.src, document.baseURI);
    video.src = await seekableMediaURL(url);
    syncPlayback();
  }

  new ResizeObserver(() => drawReplay()).observe(curve);
  measure();
  if (new URLSearchParams(location.search).get('scene') === 'controller') {
    progress = stops[2];
    if (!reduced.matches) window.scrollTo(0,geometry.top-geometry.nav+geometry.travel*progress);
  }
  layout();
})();
