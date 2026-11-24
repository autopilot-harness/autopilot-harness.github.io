'use strict';
(() => {
const host = document.getElementById('comparison');
const root = host.shadowRoot;
const $ = selector => root.querySelector(selector);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const mmss = seconds => Math.floor(seconds / 60) + ':' + String(Math.floor(seconds % 60)).padStart(2, '0');
const routes = {'905_02':'#sublevel-07', '498_01':'#praxis-fighter-x', '37_02':'#radius-raid', '212_05':'#trichromat'};
const STORY = {
  "498_01": {
    "tab": "Too slow to dodge",
    "death": "ALL SHIPS LOST"
  },
  "37_02": {
    "tab": "Ran out of decisions",
    "death": "HEALTH EMPTY"
  },
  "212_05": {
    "tab": "One move per response"
  },
  "905_02": {
    "tab": "Aiming by hand",
    "death": "VITALS DEPLETED",
    "plabel": "kills / 3",
    "thumb": "assets/sublevel07_thumb.jpg",
    "cnote": "Controller lines are inferred from the logged actions. Each action type comes from one line of the running controller, and the time before an action is shown on its frame-reading line. Every controller step maps to a line.",
    "cut": [
      [
        0,
        38
      ],
      [
        166,
        186
      ],
      [
        197.6,
        203
      ],
      [
        506.8,
        531
      ],
      [
        784,
        810
      ],
      [
        1277,
        1296
      ],
      [
        1323.5,
        1334
      ],
      [
        1373.1,
        1392.4
      ]
    ],
    "lag": 0.65,
    "vidEnd": 1392.1,
    "wonAt": 1392.4
  }
};
const thumbs = {"498_01": 108, "37_02": 74, "212_05": 26};
function tilePos(i) { return `${(i % 12) / 11 * 100}% ${Math.floor(i / 12) / 9 * 100}%`; }

function duel(C) {
  const svg = $("#race"), NS = "http://www.w3.org/2000/svg";
  const L = 34; let Rt = 990, T = 6, B = 60, VH = 100;
  let cur, tmax = 1, t = 0, playing = false, speed = 1, last = 0, auto = false, head;
  // Edited clock: M = kept spans {a, b, o} (run time a..b plays at edited time o..). Without M, edited time == run time.
  let M = null;
  const mkCut = K => { let o = 0; return K.map(([a, b]) => { const g = { a, b, o }; o += b - a; return g; }); };
  const src = e => { if (!M) return e; let g = M[0]; for (const q of M) if (q.o <= e) g = q; return Math.min(g.b, g.a + e - g.o); };
  const ed = x => { if (!M) return x; for (const g of M) if (x >= g.a && x <= g.b) return g.o + x - g.a; return null; };
  const Ea = () => M[M.length - 1].o + M[M.length - 1].b - M[M.length - 1].a;
  const ov = (a, b) => M.some(g => a <= g.b && b >= g.a);
  const edc = x => { if (!M) return x; for (const g of M) { if (x < g.a) return g.o; if (x <= g.b) return g.o + x - g.a; } return tmax; };
  const X = x => L + (Rt - L) * x / tmax, Y = p => B - (B - T) * p;
  const add = (n, a, txt) => { const e = document.createElementNS(NS, n); for (const k in a) e.setAttribute(k, a[k]); if (txt != null) e.textContent = txt; svg.append(e); return e; };
  const at = (arr, x, key = "t") => { let r = null; for (const s of arr) { if (s[key] <= x) r = s; else break; } return r; };
  const count = (arr, x) => { let n = 0; for (const v of arr) { if ((Array.isArray(v) ? v[0] : v) <= x) n++; else break; } return n; };

  const box = $("#cases");
  C.forEach((c, i) => {
    const b = document.createElement("button"), s = STORY[c.id], tile = thumbs[c.id];
    b.className = "case"; b.setAttribute("aria-pressed", i === 0);
    const th = tile !== undefined ? `background-position:${tilePos(tile)}` : `background-image:url(${s.thumb});background-size:cover;background-position:center`;
    b.innerHTML = `<div class="th" style="${th}"></div><div><b>${c.name}</b><span>${s.tab}</span></div>`;
    b.onclick = () => { [...box.children].forEach(x => x.setAttribute("aria-pressed", x === b)); load(c); history.replaceState(null, "", routes[c.id]); };
    box.append(b);
  });

  // Two stacked layers: the current captured frame, and the next one fading in just before it arrives.
  function setSprite(el, sp) {
    if (!el.ly) { el.ly = [0, 1].map(() => { const d = document.createElement("div"); d.className = "ly"; el.prepend(d); return d; }).reverse(); }
    if (!sp) { el.ly.forEach(d => { d.style.backgroundImage = "none"; d.k = -1; }); return; }
    sp.imgs = sp.imgs || sp.sheets.map(src => { const i = new Image(); i.src = src; return i; });
    el.ly.forEach(d => { d.style.backgroundSize = `${sp.cols * 100}% ${sp.rows * 100}%`; d.k = -1; });
  }
  // Re-enacted cases play real footage over the sprite. The clock stays the master: the video follows it.
  function setVideo(el, V) {
    if (!el.vid) { el.vid = document.createElement("video"); el.vid.className = "vid"; el.vid.addEventListener("loadedmetadata", () => { if (!playing) render(); }); el.vid.muted = true; el.vid.playsInline = true; el.vid.preload = "auto"; el.append(el.vid); }
    el.V = V; el.clip = null; el.classList.toggle("hasvid", !!V);
    if (!V) { el.vid.pause(); el.vid.removeAttribute("src"); el.vid.load(); }
  }
  function syncVideo(el, x) {
    const V = el.V, v = el.vid; if (!V) return;
    let p = V.parts[0]; for (const q of V.parts) if (q.start <= x) p = q;
    if (el.clip !== p) { el.clip = p; v.src = `${p.src}#t=${Math.max(0, Math.min(x - p.start, p.dur - .05)).toFixed(2)}`; }
    const want = Math.max(0, Math.min(x - p.start, p.dur - .05)), run = playing && x < (V.playEnd || V.end);
    v.playbackRate = Math.min(speed, 16);
    const can = v.seekable.length && want <= v.seekable.end(v.seekable.length - 1);
    if (v.readyState >= 1 && can && Math.abs(v.currentTime - want) > (run ? Math.max(.4, .08 * speed) : .05)) v.currentTime = want;
    if (run && v.paused) v.play().catch(() => {}); else if (!run && !v.paused) v.pause();
  }
  function paint(d, sp, k) {
    if (d.k === k) return; d.k = k;
    const per = sp.cols * sp.rows, n = k % per, c = n % sp.cols, r = Math.floor(n / sp.cols);
    d.style.backgroundImage = `url(${sp.sheets[Math.floor(k / per)]})`;
    d.style.backgroundPosition = `${c / (sp.cols - 1) * 100}% ${r / (sp.rows - 1) * 100}%`;
  }
  function frame(el, sp, x, pin) {
    if (!sp) return;
    if (pin >= 0) { paint(el.ly[0], sp, pin); el.ly[1].style.opacity = 0; return; }
    let k = 0; for (let i = 0; i < sp.t.length; i++) { if (sp.t[i] <= x) k = i; else break; }
    const nx = Math.min(k + 1, sp.t.length - 1), w = Math.max(.01, Math.min(sp.t[nx] - sp.t[k], .28 * speed));
    paint(el.ly[0], sp, k); paint(el.ly[1], sp, nx);
    el.ly[1].style.opacity = nx === k ? 0 : Math.max(0, Math.min(1, (x - (sp.t[nx] - w)) / w));
  }
  function chart(c) {
    const r = svg.getBoundingClientRect(), W = Math.max(300, Math.round(r.width)); VH = Math.max(80, Math.round(r.height)); Rt = W - 12; T = 7; B = VH - 44;
    svg.setAttribute("viewBox", `0 0 ${W} ${VH}`); svg.style.setProperty("--fs", "11.5px");
    svg.innerHTML = "";
    for (let m = 0; m * 60 <= tmax; m += tmax > 500 ? (tmax > 900 && W < 700 ? 4 : 2) : 1) { add("line", { x1: X(m * 60), x2: X(m * 60), y1: T, y2: VH - 18, stroke: "var(--line)" }); add("text", { x: X(m * 60), y: VH - 5, "text-anchor": "middle" }, m + ":00"); }
    [[0, "0"], [1, "100"]].forEach(([p, l]) => add("text", { x: 28, y: Y(p) + 4, "text-anchor": "end" }, l));
    // Progress steps re-timed to the edited clock: each kept span starts at the level the run had at that moment.
    const runE = S => { if (!M) return S.run; const out = [], lvl = x => { let p = 0; for (const r of S.run) { if (r[0] <= x) p = r[1]; else break; } return p; };
      M.forEach(g => { out.push([g.o, lvl(g.a)]); S.run.forEach(([x, p]) => { if (x > g.a && x <= g.b) out.push([g.o + x - g.a, p]); }); }); return out; };
    const saw = (run, end) => { let d = `${X(0)},${Y(0)}`, b = 0; run.forEach(([x, p]) => { if (x > end) return; d += ` ${X(x)},${Y(b)} ${X(x)},${Y(p)}`; b = p; }); return d + ` ${X(end)},${Y(b)}`; };
    add("polyline", { points: saw(c.v.run, c.v.dur), fill: "none", stroke: "var(--vista)", "stroke-width": 1.8 });
    add("polyline", { points: saw(runE(c.a), edc(c.a.dur)), fill: "none", stroke: "var(--auto)", "stroke-width": 1.8 });
    c.v.inputs.forEach(x => add("line", { x1: X(x), x2: X(x), y1: VH - 38, y2: VH - 30, stroke: "var(--vista)", "stroke-width": 1 }));
    c.a.inputs.forEach(p => { const e = ed(p[0]); if (e != null) add("line", { x1: X(e), x2: X(e), y1: VH - 28, y2: VH - 20, stroke: "var(--auto)", "stroke-width": 1 }); });
    const win = edc(c.a.dur);
    add("circle", { cx: X(win), cy: Y(1), r: 5, fill: "var(--win)" });
    add("text", { x: Math.min(X(win) + 9, Rt - 40), y: Y(1) + 4, fill: "var(--win)", style: "fill:var(--win)" }, "win");
    head = add("line", { x1: X(0), x2: X(0), y1: 3, y2: VH - 18, stroke: "var(--think)", "stroke-width": 2 });
  }
  // Edited cut: counters, death numbers and best progress count only what happens inside the kept clips.
  // AutoPILOT's edited cut: steps and deaths inside the clips; responses whose span reaches into a clip.
  const clipped = c => {
    const k = x => ed(x) != null, A = c.a;
    const L = STORY[c.id].lag || 0, deaths = A.deaths.map(d => ({ ...d, t: d.t + L }));  // state-log events, moved onto the picture
    return { ...c, a: { ...A, dur: A.dur + L, workers: A.workers.map(([a, b]) => [a, b >= A.dur ? A.dur + L : b]), run: A.run.map(([x, p]) => [x + L, p]), inputs: A.inputs.filter(i => k(i[0])), deaths: deaths.filter(d => k(d.t)), msgs: A.msgs.filter((m, i) => ov(A.log[i].s, A.log[i].e)) } };
  };
  function load(c) {
    const s = STORY[c.id];
    M = s.cut ? mkCut(s.cut) : null; if (M) c = clipped(c);
    cur = c; t = 0; tmax = M ? Math.max(c.v.dur, Ea()) : Math.max(c.v.dur, c.a.dur);
    setSprite($("#v-scr"), c.v.sprite); setSprite($("#a-scr"), c.a.sprite);
    setVideo($("#v-scr"), c.video && c.video.v); setVideo($("#a-scr"), c.video && c.video.a);
    $(".inspector").hidden = c.id !== "498_01";
    if (M && c.video && c.video.a) c.video.a.playEnd = s.vidEnd || M[M.length - 1].b;
    $("#v-sub").textContent = c.name; $("#a-sub").textContent = c.name;
    pads(c); lastCtrl = null; $("#codebox").innerHTML = '<div class="none">The code appears here when the model installs a controller.</div>';
    const ms = c.a.ctrl.map(x => x.match), ok = ms.reduce((a, m) => a + m[0], 0), n = ms.reduce((a, m) => a + m[1], 0);
    $("#c-note").textContent = s.cnote || `Controller lines traced on the frames it saw (${ok} of ${n} steps match the run).`;
    root.querySelectorAll(".gauges > div:first-child span").forEach(e => { e.textContent = s.plabel || "progress"; });
    chart(c); render();
  }
  function side(p, S, x, st) {
    const n = S.inputs.length;
    let run = 0; for (const r of S.run) { if (r[0] <= x) run = r[1]; else break; }
    $(`#${p}-run`).textContent = Math.round(run * 100) + "%"; $(`#${p}-bar`).style.width = run * 100 + "%";
    $(`#${p}-in`).textContent = count(S.inputs, x); $(`#${p}-rst`).textContent = count(S.deaths.map(d => d.t), x);
    if (M && p === "a") termCut(p, S.log, x, S.deaths); else term(p, S.log, x, S.deaths);
    const chip = $(`#${p}-chip`); chip.textContent = st[0]; chip.className = "chip " + st[1];
  }
  // Replays each response across its recorded inference span, like a live agent terminal.
  const esc = v => v.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  function term(p, log, x, deaths) {
    let i = -1; for (let k = 0; k < log.length; k++) { if (log[k].s <= x) i = k; else break; }
    const rows = [], k0 = Math.max(0, i - 5), t0 = k0 <= i && k0 > 0 ? log[k0].s : -1;
    // Deaths go in the stream in time order, by the response start times.
    const ds = []; (deaths || []).forEach((d, j) => { if (d.t > t0 && d.t <= x) ds.push([d.t, j]); });
    const dead = ([t, j]) => `<p class="died"><span class="ts">${mmss(t)}</span> ✕ died, death ${j + 1} of ${deaths.length}</p>`;
    for (let k = k0; k <= i; k++) {
      while (ds.length && ds[0][0] < log[k].s) rows.push(dead(ds.shift()));
      rows.push(logRow(log[k], x, mmss(log[k].s)));
    }
    while (ds.length) rows.push(dead(ds.shift()));
    show(p, rows);
  }
  function show(p, rows) {
    const html = rows.join(""), el = $(`#${p}-term`);
    if (el.dataset.h !== html) { el.innerHTML = html; el.dataset.h = html; el.scrollTop = el.scrollHeight; }
  }
  // Edited clock: only rows inside kept spans, stamped with edited time.
  function termCut(p, log, x, deaths) {
    const it = [];
    // A response that began inside a cut is shown from the start of the next clip.
    const key = v => ed(v) != null ? v : (M.find(g => v < g.a) || { a: v }).a;
    log.forEach(e => { if (e.s <= x && ov(e.s, e.e)) it.push([key(e.s), 1, logRow(e, x, mmss(edc(e.s)))]); });
    deaths.forEach((d, j) => { const te = ed(d.t); if (d.t <= x && te != null) it.push([d.t, 1, `<p class="died"><span class="ts">${mmss(te)}</span> ✕ died, death ${j + 1} of ${deaths.length}</p>`]); });
    it.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    show(p, it.slice(-12).map(r => r[2]));
  }
  function logRow(e, x, ts) {
    {
      const live = x < e.e, f = live ? (x - e.s) / Math.max(.01, e.e - e.s) : 1;
      const body = e.x || "", code = e.k || "", n = body.length + code.length;
      const shown = Math.floor(n * Math.max(0, (f - .18) / .82));
      let h = `<span class="ts">${ts}</span> <span class="bul">●</span> `;
      if (live && shown === 0) h += `<span class="wait">thinking</span><span class="cur"></span>`;
      else {
        h += esc(body.slice(0, shown));
        if (code && shown > body.length) h += `<span class="src">${esc(code.slice(0, shown - body.length))}</span>`;
        if (live) h += `<span class="cur"></span>`;
        else h += `\n  <span class="call">→ ${esc(e.c)}</span>`;
      }
      return `<p>${h}</p>`;
    }
  }
  // Keyboard and mouse: every press below is a real recorded input.
  const ROWS = [["Q","W","E","R","T","Y","U","I","O","P"],["A","S","D","F","G","H","J","K","L"],["Z","X","C","V","B","N","M"]];
  const label = { ArrowUp: "↑", ArrowLeft: "←", ArrowDown: "↓", ArrowRight: "→", Space: "space", Enter: "⏎", Shift: "⇧" };
  const norm = k => k === " " ? "Space" : k.length === 1 ? k.toUpperCase() : k;
  function board(id) {
    const U = 34, cap = (k, x, y, w = 1) => `<g data-k="${k}" transform="translate(${x},${y})"><rect width="${w * U - 4}" height="${U - 5}" rx="5"/><text x="${(w * U - 4) / 2}" y="${U / 2 + 2}">${label[k] || k}</text></g>`;
    let h = "";
    ROWS.forEach((r, i) => r.forEach((k, j) => { h += cap(k, 2 + i * 14 + j * U, 2 + i * U); }));
    h += cap("Shift", 2, 2 + 3 * U, 1.6) + cap("Space", 2 + 2 * U, 2 + 3 * U, 5) + cap("Enter", 2 + 9.6 * U, 2 + U, 1.4);
    const ax = 2 + 11.4 * U; h += cap("ArrowUp", ax + U, 2 + 2 * U) + cap("ArrowLeft", ax, 2 + 3 * U) + cap("ArrowDown", ax + U, 2 + 3 * U) + cap("ArrowRight", ax + 2 * U, 2 + 3 * U);
    const mouse = `<svg class="ms" viewBox="0 0 46 66" aria-hidden="true"><path d="M23 3C11 3 5 11 5 22v22c0 11 7 19 18 19s18-8 18-19V22C41 11 35 3 23 3z"/><path class="btn" id="${id}-mb" d="M23 3C11 3 5 11 5 22v6h18z"/><path d="M23 3v25"/></svg>`;
    $(`#${id}-pad`).innerHTML = `<svg class="kb" id="${id}-kb" viewBox="0 0 ${ax + 3 * U + 2} ${4 * U + 2}" role="img" aria-label="Keys held right now">${h}</svg>${mouse}`;
    const old = $(`#${id}-cur`); if (old) old.remove();
    $(`#${id}-scr`).insertAdjacentHTML("beforeend", `<svg class="cursor" id="${id}-cur" viewBox="0 0 18 24" hidden><path d="M1 1 L1 19 L5.5 14.5 L8.6 22 L12 20.5 L8.8 13.4 L15 13.4 Z"/></svg>`);
  }
  function pads(c) { board("v"); board("a"); }
  function input(id, K, x) {
    const held = new Set(); let m = null, click = false;
    for (const i of K) { if (i.s > x) break; if (i.m) m = i.m; if (x < i.s + Math.max(i.d, .16)) { i.k.forEach(k => held.add(norm(k))); if (/click/.test(i.kind || "")) click = true; } }
    $(`#${id}-kb`).querySelectorAll("g").forEach(g => g.classList.toggle("on", held.has(g.dataset.k)));
    $(`#${id}-mb`).classList.toggle("on", click);
    const cu = $(`#${id}-cur`); cu.hidden = !m; if (m) { cu.style.left = m[0] / 12.8 + "%"; cu.style.top = m[1] / 7.2 + "%"; }
  }
  // Controller panel: step through the traced lines between two inputs.
  let lastCtrl = null, lastLine = 0;
  const hl = l => { const e = l.replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
    const cm = e.indexOf("#"), body = cm >= 0 && !/['"].*#/.test(e.slice(0, cm + 1)) ? e.slice(0, cm) : e, tail = body === e ? "" : `<span class="cm">${e.slice(cm)}</span>`;
    return body.replace(/('[^']*'|"[^"]*")/g, '<span class="st">$1</span>').replace(/\b(def|for|in|if|elif|else|while|return|import|from|and|or|not|try|except|break|continue|lambda|None|True|False)\b/g, '<span class="kw">$1</span>').replace(/\bapi\.(\w+)/g, '<span class="ap">api.$1</span>') + tail; };
  function ctrl(c, x) {
    const box = $("#codebox"), st = $("#c-state");
    const C = c.a.ctrl.find(k => x >= k.from_ && x <= k.to + 1) || null;
    if (!C) { st.textContent = "No controller is running; the model sends each step itself."; st.className = ""; box.querySelectorAll(".on").forEach(e => e.classList.remove("on")); return; }
    if (lastCtrl !== C) { lastCtrl = C; lastLine = 0; box.innerHTML = C.code.split("\n").map((l, i) => `<div class="cl" data-n="${i + 1}"><i>${i + 1}</i><span>${hl(l) || " "}</span></div>`).join(""); }
    let k = C.steps.findIndex(s => s.t >= x); if (k < 0) k = C.steps.length - 1;
    const a = k ? C.steps[k - 1].t : C.from_, b = C.steps[k].t, L = C.steps[k].l, f = Math.max(0, Math.min(.999, (x - a) / Math.max(.01, b - a))), n = L[Math.floor(f * L.length)] || L[L.length - 1];
    st.textContent = `running, step ${k + 1} of ${C.steps.length}, line ${n}`; st.className = "live";
    if (n !== lastLine) { lastLine = n; box.querySelectorAll(".on").forEach(e => e.classList.remove("on")); const e = box.querySelector(`[data-n="${n}"]`); if (e) { e.classList.add("on"); const y = e.offsetTop - box.offsetTop, h = box.clientHeight; if (y < box.scrollTop + 24 || y > box.scrollTop + h - 48) box.scrollTop = y - h / 2; } }
  }
  // A death holds its archived frame and banner for the real reset time; fast playback keeps it long enough to read.
  function death(p, c, S, x) {
    let d = null, n = 0; for (const e of S.deaths) { if (e.t <= x) { d = e; n++; } else break; }
    if (d && x - d.t >= Math.max(1.8, .4 * speed)) d = null;
    const box = $(`#${p}-dead`); box.classList.toggle("on", !!d); $(`#${p}-barbox`).classList.toggle("hit", !!d);
    if (d) { box.children[0].textContent = STORY[c.id].death; box.children[1].textContent = `death ${n} of ${S.deaths.length}, this run reached ${Math.round(d.c * 100)}%, back to zero`; }
    return d;
  }
  function render() {
    if (!cur) return;
    const c = cur, te = M ? Math.min(t, Ea()) : t, xa = src(te), tv = Math.min(t, c.v.dur), ta = Math.min(xa, c.a.dur);
    // Once a side's run is over its end stamp shows; a death banner must not sit on top of it.
    const dv = death("v", c, c.v, t >= c.v.dur ? -1 : tv), da = death("a", c, c.a, xa >= c.a.dur ? -1 : ta);
    syncVideo($("#v-scr"), tv); syncVideo($("#a-scr"), M ? xa : ta);
    frame($("#v-scr"), c.v.sprite, tv, dv ? dv.f : -1); frame($("#a-scr"), c.a.sprite, ta, da ? da.f : -1);
    const inSpan = (S, x) => S.some(s => x >= s[0] && x < s[1]);
    const vThink = inSpan(c.v.think, t), aThink = inSpan(c.a.think, xa), aRun = inSpan(c.a.workers, xa);
    side("v", c.v, tv, t >= c.v.dur ? ["budget used", ""] : vThink ? ["thinking, nobody playing", "th"] : ["sending one input", ""]);
    side("a", c.a, ta, xa >= c.a.dur ? ["won", "pl"] : aRun ? [aThink ? "thinking, controller playing" : "controller playing", "pl"] : aThink ? ["thinking, nobody playing", "th"] : ["sending one input", ""]);
    $("#v-resp").textContent = count(c.v.inputs, tv); $("#a-resp").textContent = c.a.msgs.filter(m => m.t <= ta).length;
    const as = $("#a-stamp"), vs = $("#v-stamp");
    as.hidden = xa < (STORY[c.id].wonAt || c.a.dur); as.textContent = M ? "Won" : `Won at ${mmss(c.a.dur)}`;
    vs.hidden = t < c.v.dur; vs.textContent = `100 calls used, best ${Math.round(Math.max(...c.v.run.map(r => r[1])) * 100)}%`;
    input("v", c.v.keys, tv); input("a", c.a.keys, ta); ctrl(c, ta);
    $("#now").textContent = mmss(t);
    if (head) { head.setAttribute("x1", X(t)); head.setAttribute("x2", X(t)); }
  }
  function tickf(now) {
    if (!playing) return;
    t += (now - last) / 1000 * speed; last = now;
    if (t >= tmax) { t = tmax; playing = false; $("#play").textContent = "Replay"; }
    render(); if (playing) requestAnimationFrame(tickf);
  }
  function start() { if (t >= tmax) t = 0; playing = true; $("#play").textContent = "Pause"; last = performance.now(); requestAnimationFrame(tickf); }
  $("#play").onclick = () => { if (playing) { playing = false; $("#play").textContent = "Play"; render(); } else start(); };
  $("#speed").addEventListener("click", e => { const v = +e.target.dataset.v; if (!v) return; speed = v; [...$("#speed").children].forEach(x => x.setAttribute("aria-pressed", x === e.target)); });
  const scrub = e => { const r = svg.getBoundingClientRect(), x = e.clientX - r.left; t = Math.max(0, Math.min(tmax, (x - L) / (Rt - L) * tmax)); render(); };
  let down = false;
  svg.addEventListener("pointerdown", e => { down = true; svg.setPointerCapture(e.pointerId); scrub(e); });
  svg.addEventListener("pointermove", e => { if (down) scrub(e); });
  svg.addEventListener("pointerup", () => { down = false; });
  function route() {
    const index = C.findIndex(c => routes[c.id] === location.hash);
    if (index >= 0) host.scrollIntoView({behavior:"instant", block:"start"});
    if (cur && index < 0) return;
    const selected = Math.max(0, index);
    [...box.children].forEach((b, i) => b.setAttribute("aria-pressed", i === selected));
    load(C[selected]);
  }
  route();
  addEventListener("hashchange", route);
  svg.addEventListener("keydown", e => {
    const positions = {Home:0, End:tmax, ArrowLeft:t-1, ArrowRight:t+1};
    if (!(e.key in positions)) return;
    e.preventDefault(); t = Math.max(0, Math.min(tmax, positions[e.key])); render();
  });
  addEventListener("resize", () => { if (cur) { chart(cur); render(); } });
  if (!reduce && "IntersectionObserver" in window) {
    const io = new IntersectionObserver(es => { if (es[0].isIntersecting && !auto) { auto = true; start(); io.disconnect(); } }, { threshold: .4 });
    io.observe($(".arena"));
  }
}


fetch('assets/duels.json')
  .then(response => { if (!response.ok) throw Error('duel data'); return response.json(); })
  .then(duel)
  .catch(() => { $('#c-note').textContent = 'The gameplay demo could not load. Reload to retry.'; });
})();
