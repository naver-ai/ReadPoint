// ReadPoint teaser animation: the same VLM writing a point token by token, then read as a decision model.
// Every probability drawn here is the real read of our Qwen3.5-2B decision model on one DroneCATS frame
// (assets/anim/readout.json: p(x) and p(y) over the 1,000 values of each axis, and P(yes) of the self-check).
// The prefix tree is shown one level at a time for clarity; the model reads all 222 prefixes in one forward pass.
(function () {
  const root = document.getElementById("readout-anim");
  if (!root) return;
  const cv = root.querySelector("canvas"), ctx = cv.getContext("2d");
  const chips = [...root.querySelectorAll("[data-stage]")], playBtn = root.querySelector(".anim-play");
  const capEl = root.querySelector(".anim-cap");
  const T = { input: 0, write: 1200, read: 6400, map: 10600, check: 13000, end: 17500 };
  const STAGES = [["write", T.write], ["read", T.read], ["map", T.map], ["check", T.check]];
  const TOKENS = ['{"x":', " 4", "0", "5", ",", ' "y":', " 5", "3", "1", "}"];
  let D = null, img = new Image(), t0 = performance.now(), paused = false, pauseAt = 0, L = null;
  const reduce = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  function css(n) { return getComputedStyle(document.documentElement).getPropertyValue(n).trim(); }
  const clamp = (v, a = 0, b = 1) => Math.max(a, Math.min(b, v));
  const ease = u => 1 - Math.pow(1 - clamp(u), 3);
  const prog = (t, a, d) => ease((t - a) / d);

  function tree(p) {   // next-digit probabilities of all 111 prefixes of one axis, from the 1,000-value distribution
    const p1 = [], p2 = [], p3 = [];
    for (let a = 0; a < 10; a++) {
      let s1 = 0; for (let i = a * 100; i < a * 100 + 100; i++) s1 += p[i]; p1.push(s1);
      const r2 = [], r3 = [];
      for (let b = 0; b < 10; b++) {
        let s2 = 0; const o = a * 100 + b * 10; for (let i = o; i < o + 10; i++) s2 += p[i];
        r2.push(s1 > 0 ? s2 / s1 : 0);
        const r = []; for (let c = 0; c < 10; c++) r.push(s2 > 0 ? p[o + c] / s2 : 0); r3.push(r);
      }
      p2.push(r2); p3.push(r3);
    }
    return { p1, p2, p3 };
  }
  function bins(p, n) { const k = p.length / n, o = []; for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j < k; j++) s += p[i * k + j]; o.push(s); } return o; }

  function layout() {
    const w = root.clientWidth, wide = w >= 720;
    const LW = wide ? 980 : 520, LH = wide ? 480 : 900;
    const s = w / LW, dpr = window.devicePixelRatio || 1;
    cv.style.height = (LH * s) + "px"; cv.width = Math.round(w * dpr); cv.height = Math.round(LH * s * dpr);
    ctx.setTransform(s * dpr, 0, 0, s * dpr, 0, 0);
    const iw = wide ? 420 : 440, ih = iw * 360 / 640;
    const im = wide ? { x: 46, y: 46, w: iw, h: ih } : { x: 60, y: 40, w: iw, h: ih };
    const panel = wide ? { x: 530, y: 24, w: 420, h: 440 } : { x: 40, y: im.y + ih + 130, w: 440, h: 460 };
    L = { wide, LW, LH, im, panel };
  }

  function txt(s, x, y, o = {}) {
    ctx.font = `${o.w || 400} ${o.size || 13}px ${o.mono ? '"JetBrains Mono", ui-monospace, monospace' : 'Inter, "Helvetica Neue", Arial, sans-serif'}`;
    ctx.fillStyle = o.color || css("--ink"); ctx.textAlign = o.align || "left"; ctx.textBaseline = o.base || "alphabetic";
    ctx.globalAlpha = o.alpha == null ? 1 : o.alpha; ctx.fillText(s, x, y); ctx.globalAlpha = 1;
  }
  function rrect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function hexA(hex, a) { const h = hex.replace("#", ""); const n = parseInt(h.length === 3 ? h.split("").map(c => c + c).join("") : h, 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; }

  function drawImage(t) {
    const { im } = L, ours = "#4A6FA5", writes = "#8F8070";
    ctx.save(); rrect(im.x, im.y, im.w, im.h, 6); ctx.clip();
    if (img.complete && img.naturalWidth) ctx.drawImage(img, im.x, im.y, im.w, im.h); else { ctx.fillStyle = css("--paper-2"); ctx.fillRect(im.x, im.y, im.w, im.h); }
    // probability map (product of p(x) and p(y), 100 x 100 cells)
    const a = prog(t, T.map + 1300, 1100);
    if (a > 0) {
      const bx = bins(D.px, 100), by = bins(D.py, 100); let mx = 0;
      for (const u of bx) for (const v of by) mx = Math.max(mx, u * v);
      const cw = im.w / 100, ch = im.h / 100;
      ctx.fillStyle = `rgba(10,14,22,${0.28 * a})`; ctx.fillRect(im.x, im.y, im.w, im.h);
      for (let i = 0; i < 100; i++) for (let j = 0; j < 100; j++) {
        const v = Math.pow(bx[i] * by[j] / mx, 0.32); if (v < 0.04) continue;
        ctx.fillStyle = `rgba(120,165,230,${0.85 * v * a})`; ctx.fillRect(im.x + i * cw, im.y + j * ch, cw + 0.4, ch + 0.4);
      }
    }
    ctx.restore();
    ctx.strokeStyle = css("--rule-2"); ctx.lineWidth = 1; rrect(im.x, im.y, im.w, im.h, 6); ctx.stroke();
    // written point (grey cross) once the last digit is written
    if (t >= T.write + 400 * 9) {
      const x = im.x + (+D.written.x + 0.5) / 1000 * im.w, y = im.y + (+D.written.y + 0.5) / 1000 * im.h;
      const fa = t >= T.read ? 0.55 : 1; ctx.globalAlpha = fa;
      ctx.strokeStyle = "#fff"; ctx.lineWidth = 4; cross(x, y, 6); ctx.strokeStyle = writes; ctx.lineWidth = 2.2; cross(x, y, 6); ctx.globalAlpha = 1;
    }
    // read peak (blue dot)
    const pk = prog(t, T.check, 500);
    if (pk > 0) {
      const x = im.x + (D.argmax.x + 0.5) / 1000 * im.w, y = im.y + (D.argmax.y + 0.5) / 1000 * im.h;
      ctx.beginPath(); ctx.arc(x, y, 6.5 * pk, 0, 7); ctx.fillStyle = ours; ctx.fill(); ctx.lineWidth = 2; ctx.strokeStyle = "#fff"; ctx.stroke();
      ctx.beginPath(); ctx.arc(x, y, 6.5 + 14 * ((t - T.check) % 1600) / 1600, 0, 7); ctx.strokeStyle = hexA(ours, 0.5 * (1 - ((t - T.check) % 1600) / 1600)); ctx.lineWidth = 2; ctx.stroke();
    }
    // instruction
    txt("“" + D.instruction + "”", im.x + im.w / 2, im.y + im.h + 24, { align: "center", size: 14, w: 500, color: css("--ink-2") });
    // p(x) under the image, p(y) left of it
    const sx = prog(t, T.map, 900), sy = prog(t, T.map + 500, 900);
    if (sx > 0) strip(D.px, im.x, im.y + im.h + 40, im.w, 46, sx, true);
    if (sy > 0) strip(D.py, im.x - 40, im.y, 34, im.h, sy, false);
    if (sx > 0) txt("p(x)", im.x + im.w, im.y + im.h + 100, { align: "right", size: 12, color: css("--muted"), alpha: sx });
    if (sy > 0) txt("p(y)", im.x - 23, im.y - 8, { align: "center", size: 12, color: css("--muted"), alpha: sy });
  }
  function cross(x, y, r) { ctx.beginPath(); ctx.moveTo(x - r, y - r); ctx.lineTo(x + r, y + r); ctx.moveTo(x + r, y - r); ctx.lineTo(x - r, y + r); ctx.stroke(); }
  function strip(p, x, y, w, h, a, horiz) {
    const n = p.length, mx = Math.max(...p), ours = "#4A6FA5";
    ctx.save(); ctx.beginPath(); ctx.rect(x - 2, y - 2, horiz ? w * a + 2 : w + 4, horiz ? h + 4 : h * a + 2); ctx.clip();
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const v = Math.pow(p[i] / mx, 0.6);
      if (horiz) { const X = x + (i + 0.5) / n * w, Y = y + h - v * h; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
      else { const Y = y + (i + 0.5) / n * h, X = x + w - v * w; i ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); }
    }
    if (horiz) { ctx.lineTo(x + w, y + h); ctx.lineTo(x, y + h); } else { ctx.lineTo(x + w, y + h); ctx.lineTo(x + w, y); }
    ctx.closePath(); ctx.fillStyle = hexA(ours, 0.22); ctx.fill(); ctx.strokeStyle = ours; ctx.lineWidth = 1.4; ctx.stroke(); ctx.restore();
    ctx.strokeStyle = css("--rule-2"); ctx.lineWidth = 1; ctx.beginPath();
    if (horiz) { ctx.moveTo(x, y + h + 0.5); ctx.lineTo(x + w, y + h + 0.5); } else { ctx.moveTo(x + w + 0.5, y); ctx.lineTo(x + w + 0.5, y + h); } ctx.stroke();
  }

  function bars(vals, x, y, w, h, a, color, op = 1) {
    const n = vals.length, bw = w / n, mx = Math.max(...vals) || 1;   // each chart scaled to its own largest bar; its opacity shows how likely the prefix is
    for (let i = 0; i < n; i++) {
      const v = vals[i] / mx * a; if (v <= 0) continue;
      ctx.fillStyle = hexA(color, op); ctx.fillRect(x + i * bw + bw * 0.12, y + h - v * h, Math.max(bw * 0.76, 0.35), v * h);
    }
    ctx.fillStyle = hexA(css("--rule-2").startsWith("#") ? css("--rule-2") : "#CFCBC2", 1); ctx.fillRect(x, y + h, w, 0.8);
  }

  function drawPanel(t) {
    const P = L.panel, ours = "#4A6FA5", writes = "#8F8070", ink = css("--ink"), muted = css("--muted");
    if (t < T.read) {   // ---- writing lane
      const a = prog(t, T.write - 300, 600);
      txt("Writing the point", P.x, P.y + 18, { size: 16, w: 600, alpha: a });
      // (no subtitle: the sentence under the canvas explains the step)
      const k = clamp(Math.floor((t - T.write) / 400) + 1, 0, TOKENS.length);
      const bx = P.x, by = P.y + 80, gw = (P.w) / 5, gh = 44;
      for (let i = 0; i < TOKENS.length; i++) {
        const r = Math.floor(i / 5), c = i % 5, x = bx + c * gw, y = by + r * (gh + 36);
        const on = i < k, cur = i === k - 1 && t < T.write + 400 * TOKENS.length;
        ctx.strokeStyle = on ? (cur ? writes : css("--rule-2")) : css("--rule"); ctx.lineWidth = cur ? 2 : 1;
        rrect(x + 4, y, gw - 14, gh, 6); ctx.stroke();
        if (on) txt(TOKENS[i].trim(), x + 4 + (gw - 14) / 2, y + gh / 2 + 5, { align: "center", mono: true, size: 15, w: 500 });
        txt("pass " + (i + 1), x + 4 + (gw - 14) / 2, y + gh + 15, { align: "center", size: 11, color: muted, alpha: on ? 1 : 0.35 });
        if (c < 4) { ctx.fillStyle = on ? writes : css("--rule"); ctx.beginPath(); const ax = x + gw - 8, ay = y + gh / 2; ctx.moveTo(ax - 2, ay - 4); ctx.lineTo(ax + 4, ay); ctx.lineTo(ax - 2, ay + 4); ctx.fill(); }
      }
      if (t > T.write + 400 * TOKENS.length) {
        const b = prog(t, T.write + 400 * TOKENS.length, 500);
        txt("(" + D.written.x + ", " + D.written.y + ") after 10 passes", P.x, P.y + 270, { size: 15, w: 600, color: writes, alpha: b });
        txt("83.3 ms", P.x, P.y + 292, { size: 13, color: muted, alpha: b });
      }
      return;
    }
    // ---- reading: the prefix tree of x
    const a0 = prog(t, T.read - 200, 500);
    txt("Reading the digits", P.x, P.y + 18, { size: 16, w: 600, color: css("--ours-d"), alpha: a0 });
    // (no subtitle: the sentence under the canvas explains the step)
    const tr = D.tx, y1 = P.y + 78, h1 = 46, y2 = P.y + 168, h2 = 34, y3 = P.y + 250, h3 = 34;
    const g1 = prog(t, T.read + 200, 700), g2 = prog(t, T.read + 1100, 700), g3 = prog(t, T.read + 2000, 700);
    const w1 = 150, x1 = P.x + (P.w - w1) / 2;
    txt('x: ?', x1 - 10, y1 + h1 - 4, { align: "right", mono: true, size: 13, alpha: g1 });
    bars(tr.p1, x1, y1, w1, h1, g1, ours);
    for (let d = 0; d < 10; d++) txt(String(d), x1 + (d + 0.5) * w1 / 10, y1 + h1 + 13, { align: "center", mono: true, size: 10, color: muted, alpha: g1 });
    txt("1 prefix", P.x + P.w, y1 + 10, { align: "right", size: 12, color: muted, alpha: g1 });
    // level 2
    const gap = 4, w2 = (P.w - 9 * gap) / 10;
    for (let d = 0; d < 10; d++) {
      const x = P.x + d * (w2 + gap), op = 0.25 + 0.75 * Math.sqrt(tr.p1[d]);
      if (g2 > 0) { ctx.strokeStyle = hexA(ours, 0.18 * g2); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x1 + (d + 0.5) * w1 / 10, y1 + h1 + 16); ctx.lineTo(x + w2 / 2, y2 - 4); ctx.stroke(); }
      bars(tr.p2[d], x, y2, w2, h2, g2, ours, op);
      txt(d + "?", x + w2 / 2, y2 + h2 + 12, { align: "center", mono: true, size: 10, color: muted, alpha: g2 });
    }
    txt("10 prefixes", P.x + P.w, y2 - 10, { align: "right", size: 12, color: muted, alpha: g2 });
    // level 3: the 100 prefixes x: 00? ... x: 99?; the ten under the most probable first digit are drawn
    const dm = tr.p1.indexOf(Math.max(...tr.p1)), xd = P.x + dm * (w2 + gap);
    for (let e = 0; e < 10; e++) {
      const x = P.x + e * (w2 + gap), op = 0.25 + 0.75 * Math.sqrt(tr.p2[dm][e]);
      if (g3 > 0) { ctx.strokeStyle = hexA(ours, 0.18 * g3); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(xd + w2 / 2, y2 + h2 + 16); ctx.lineTo(x + w2 / 2, y3 - 4); ctx.stroke(); }
      bars(tr.p3[dm][e], x, y3, w2, h3, g3, ours, op);
      txt(String(dm) + e + "?", x + w2 / 2, y3 + h3 + 12, { align: "center", mono: true, size: 10, color: muted, alpha: g3 });
    }
    txt("100 prefixes (10 shown)", P.x + P.w, y3 - 10, { align: "right", size: 12, color: muted, alpha: g3 });
    const g4 = prog(t, T.read + 2900, 600);
    rrect(P.x, P.y + 316, P.w, 52, 8); ctx.fillStyle = hexA(ours, 0.09 * g4); ctx.fill(); ctx.strokeStyle = hexA(ours, 0.5 * g4); ctx.lineWidth = 1; ctx.stroke();
    txt("222 prefixes, one forward pass", P.x + 14, P.y + 338, { size: 13.5, w: 600, color: css("--ours-d"), alpha: g4 });
    txt("40.3 ms", P.x + 14, P.y + 357, { size: 12.5, color: muted, alpha: g4 });
    // map and self-check
    const g5 = prog(t, T.map, 600);
    // (the product of p(x) and p(y) is drawn on the image; the sentence under the canvas says so)
    const g6 = prog(t, T.check + 200, 600);
    if (g6 > 0) {
      txt("Self-check: can you point to it precisely?", P.x, P.y + 422, { size: 12.5, color: ink, alpha: g6 });
      txt("P(yes) = " + D.p_yes.toFixed(2), P.x, P.y + 442, { size: 13.5, w: 600, color: css("--ours-d"), alpha: g6 });
    }
  }

  function caption(t) {
    let s;
    if (t < T.write) s = "Our Qwen3.5-2B decision model gets one drone camera frame and an instruction.";
    else if (t < T.read) s = "Written as text, the point takes ten forward passes, one per token, each waiting for the one before.";
    else if (t < T.map) s = "Read instead, every digit prefix of x and y is known in advance, so all 222 get their next-digit probabilities in one forward pass. The tree is drawn level by level here; the model reads it at once.";
    else if (t < T.check) s = "Multiplying the probabilities along the tree gives p(x) and p(y) over 1,000 values each, and their product gives the probability of every point.";
    else s = "The most probable point is the decision. The self-check, read in the same pass, says whether to act on it.";
    if (capEl.textContent !== s) capEl.textContent = s;
    chips.forEach(c => { const st = STAGES.find(z => z[0] === c.dataset.stage); const nx = STAGES[STAGES.indexOf(st) + 1]; c.classList.toggle("on", t >= st[1] && t < (nx ? nx[1] : T.end)); });
  }

  function frame(now) {
    if (!D) return;
    let t = paused ? pauseAt : (now - t0) % T.end;
    ctx.clearRect(0, 0, L.LW, L.LH);
    drawImage(t); drawPanel(t); caption(t);
    if (!paused) requestAnimationFrame(frame);
  }
  function jump(ms) { t0 = performance.now() - ms; if (paused) { pauseAt = ms; requestAnimationFrame(frame); } }
  chips.forEach(c => c.addEventListener("click", () => { const st = STAGES.find(z => z[0] === c.dataset.stage); jump(st[1] + (paused ? { write: 4600, read: 3800, map: 2300, check: 2600 }[st[0]] : 0)); }));
  playBtn.addEventListener("click", () => {
    if (paused) { paused = false; t0 = performance.now() - pauseAt; playBtn.textContent = "Pause"; requestAnimationFrame(frame); }
    else { paused = true; pauseAt = (performance.now() - t0) % T.end; playBtn.textContent = "Play"; }
  });
  window.addEventListener("resize", () => { layout(); requestAnimationFrame(frame); });
  root.seek = ms => { paused = true; pauseAt = ms; playBtn.textContent = "Play"; frame(performance.now()); };   // used to render the README GIF

  img.src = "assets/anim/frame.jpg";
  fetch("assets/anim/readout.json").then(r => r.json()).then(j => {
    D = j; D.tx = tree(D.px); layout();
    if (reduce) { paused = true; pauseAt = T.check + 3000; playBtn.textContent = "Play"; }
    img.onload = () => requestAnimationFrame(frame);
    requestAnimationFrame(frame);
  }).catch(() => { capEl.textContent = "The animation could not load its data."; });
})();
