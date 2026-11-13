// Trading-themed motion: a chart that falls in red and recovers in green,
// and small arrows in the hero that drop red, turn, and climb green.
// Both are illustrations. Neither shows real market data.
(() => {
  const RED = "#ef5350", GREEN = "#34c77b";
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const dpr = Math.min(2, devicePixelRatio || 1);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const smooth = (t) => t * t * (3 - 2 * t);
  const rgba = (hex, a) => {
    const n = parseInt(hex.slice(1), 16);
    return "rgba(" + (n >> 16) + "," + ((n >> 8) & 255) + "," + (n & 255) + "," + a + ")";
  };
  function fit(canvas, ctx) {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    canvas.width = w * dpr; canvas.height = h * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return [w, h];
  }
  // Run a frame loop only while the canvas is on screen and the tab is visible.
  function whileVisible(canvas, frame, onEnter) {
    let running = false, raf = 0, onScreen = false;
    const loop = (t) => { frame(t); if (running) raf = requestAnimationFrame(loop); };
    const sync = () => {
      const want = onScreen && !document.hidden;
      if (want && !running) { running = true; if (onEnter) onEnter(); raf = requestAnimationFrame(loop); }
      else if (!want && running) { running = false; cancelAnimationFrame(raf); }
    };
    new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; sync(); }, { threshold: 0.15 }).observe(canvas);
    document.addEventListener("visibilitychange", sync);
  }

  // ---------- The chart: down in red, then up in green ----------
  const chart = document.querySelector(".trend-chart");
  if (chart) {
    const ctx = chart.getContext("2d");
    const N = 56, DRAW = 6200, HOLD = 2400, FADE = 700;
    let w = 0, h = 0, v = [], wick = [], trough = 0, t0 = 0;

    function build() {
      trough = Math.round(N * (0.36 + Math.random() * 0.1));
      v = []; wick = [];
      for (let i = 0; i < N; i++) {
        const base = i <= trough
          ? 0.64 + (0.16 - 0.64) * smooth(i / trough)
          : 0.16 + (0.9 - 0.16) * smooth((i - trough) / (N - 1 - trough));
        const pinned = i === 0 || i === trough || i === N - 1;
        v.push(base + (pinned ? 0 : (Math.random() - 0.5) * 0.075));
        wick.push([0.012 + Math.random() * 0.03, 0.012 + Math.random() * 0.03]);
      }
    }

    function draw(p, fade, now) {
      ctx.clearRect(0, 0, w, h);
      ctx.globalAlpha = fade;
      const padX = Math.max(22, w * 0.045), top = 34, bottom = 34;
      const X = (i) => padX + (i / (N - 1)) * (w - 2 * padX);
      const Y = (val) => top + (1 - val) * (h - top - bottom);
      const step = (w - 2 * padX) / (N - 1);

      // Gridlines
      ctx.lineWidth = 1; ctx.setLineDash([2, 7]); ctx.strokeStyle = "rgba(201,163,92,.16)";
      for (let g = 0; g <= 4; g++) {
        const y = Math.round(top + (g / 4) * (h - top - bottom)) + 0.5;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
      }
      ctx.setLineDash([]);

      const tip = p * (N - 1), k = Math.floor(tip), f = tip - k;
      const tipX = X(tip), tipV = k >= N - 1 ? v[N - 1] : v[k] + (v[k + 1] - v[k]) * f;
      const tipY = Y(tipV);

      // Candles appear as the line passes them
      const cw = clamp(step * 0.5, 3, 14);
      for (let i = 1; i <= Math.min(k + 1, N - 1); i++) {
        const a = clamp(tip - i + 1, 0, 1);
        if (a <= 0) continue;
        const open = v[i - 1], close = v[i], up = close >= open, col = up ? GREEN : RED;
        const hi = Math.max(open, close) + wick[i][0], lo = Math.min(open, close) - wick[i][1];
        const mid = (Y(open) + Y(close)) / 2, half = Math.max(1.5, Math.abs(Y(open) - Y(close)) / 2) * a;
        ctx.strokeStyle = rgba(col, 0.55 * a); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(X(i - 0.5), mid - (mid - Y(hi)) * a); ctx.lineTo(X(i - 0.5), mid + (Y(lo) - mid) * a); ctx.stroke();
        ctx.fillStyle = rgba(col, 0.3 * a);
        ctx.fillRect(X(i - 0.5) - cw / 2, mid - half, cw, half * 2);
        ctx.strokeStyle = rgba(col, 0.75 * a);
        ctx.strokeRect(X(i - 0.5) - cw / 2 + 0.5, mid - half + 0.5, cw - 1, half * 2 - 1);
      }

      // The line, in two colours that meet at the low point
      const seg = (from, to, col) => {
        if (tip <= from) return;
        const end = Math.min(tip, to);
        ctx.beginPath(); ctx.moveTo(X(from), Y(v[from]));
        for (let i = from + 1; i <= Math.floor(end); i++) ctx.lineTo(X(i), Y(v[i]));
        if (end === tip && end < N - 1) ctx.lineTo(tipX, tipY);
        ctx.strokeStyle = col; ctx.lineWidth = 2.6; ctx.lineJoin = "round"; ctx.lineCap = "round";
        ctx.shadowColor = col; ctx.shadowBlur = 18; ctx.stroke(); ctx.shadowBlur = 0;
      };
      seg(0, trough, RED);
      seg(trough, N - 1, GREEN);

      // Arrowhead riding the tip
      const falling = tip < trough, col = falling ? RED : GREEN;
      const j = clamp(k, 0, N - 2);
      const ang = Math.atan2(Y(v[j + 1]) - Y(v[j]), step);
      const turn = clamp(1 - Math.abs(tip - trough) / 1.2, 0, 1); // swing round at the low
      const size = 13 + 5 * turn;
      ctx.save(); ctx.translate(tipX, tipY); ctx.rotate(ang);
      ctx.fillStyle = col; ctx.shadowColor = col; ctx.shadowBlur = 24;
      ctx.beginPath(); ctx.moveTo(size, 0); ctx.lineTo(-size * 0.7, -size * 0.72); ctx.lineTo(-size * 0.3, 0); ctx.lineTo(-size * 0.7, size * 0.72); ctx.closePath(); ctx.fill();
      ctx.restore(); ctx.shadowBlur = 0;

      // Ring at the low once passed, pulse at the finish
      if (tip > trough) {
        const a = clamp((tip - trough) / 3, 0, 1);
        ctx.strokeStyle = rgba(RED, 0.5 * (1 - a * 0.5)); ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(X(trough), Y(v[trough]), 6 + a * 10, 0, Math.PI * 2); ctx.stroke();
      }
      if (p >= 1) {
        const pulse = ((now || 0) % 1400) / 1400;
        ctx.strokeStyle = rgba(GREEN, 0.7 * (1 - pulse)); ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(tipX, tipY, 10 + pulse * 34, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }

    const size = () => { [w, h] = fit(chart, ctx); if (reduced && v.length) draw(1, 1, 0); };
    build(); size();
    addEventListener("resize", size);

    if (reduced) draw(1, 1, 0);
    else whileVisible(chart, (now) => {
      if (!t0) t0 = now;
      let t = now - t0;
      if (t > DRAW + HOLD + FADE) { build(); t0 = now; t = 0; }
      const p = clamp(t / DRAW, 0, 1);
      const fade = t > DRAW + HOLD ? 1 - (t - DRAW - HOLD) / FADE : 1;
      draw(p, clamp(fade, 0, 1), now);
    }, () => { t0 = 0; build(); });
  }

  // ---------- Hero arrows: drop red, turn, climb green ----------
  const flow = document.querySelector(".flow");
  if (flow && !reduced) {
    const ctx = flow.getContext("2d");
    let w = 0, h = 0, arrows = [];
    const spawn = (a = {}) => {
      a.x = Math.random() * w;
      a.y0 = h * (0.08 + Math.random() * 0.45);
      a.fall = h * (0.14 + Math.random() * 0.2);   // distance down, in red
      a.rise = a.fall * (1.5 + Math.random() * 0.9); // distance back up, in green
      a.speed = 0.35 + Math.random() * 0.55;
      a.size = 7 + Math.random() * 8;
      a.d = 0;                                       // distance travelled
      a.wait = Math.random() * 240;                  // frames before starting
      return a;
    };
    const size = () => {
      [w, h] = fit(flow, ctx);
      arrows = Array.from({ length: w < 700 ? 7 : 14 }, () => spawn());
    };
    function arrow(x, y, s, dir, col, alpha) {
      ctx.strokeStyle = rgba(col, alpha); ctx.fillStyle = rgba(col, alpha);
      ctx.lineWidth = 1.4; ctx.shadowColor = col; ctx.shadowBlur = 10;
      ctx.beginPath(); ctx.moveTo(x, y - dir * s * 2.6); ctx.lineTo(x, y); ctx.stroke(); // tail
      ctx.beginPath(); ctx.moveTo(x, y + dir * s * 0.9); ctx.lineTo(x - s * 0.6, y - dir * s * 0.1); ctx.lineTo(x + s * 0.6, y - dir * s * 0.1); ctx.closePath(); ctx.fill();
    }
    size();
    addEventListener("resize", size);
    whileVisible(flow, () => {
      ctx.clearRect(0, 0, w, h);
      for (const a of arrows) {
        if (a.wait > 0) { a.wait--; continue; }
        const total = a.fall + a.rise;
        const falling = a.d < a.fall;
        // slow into the turn, accelerate out of it
        const nearTurn = clamp(Math.abs(a.d - a.fall) / 40, 0.18, 1);
        a.d += a.speed * nearTurn * (falling ? 1 : 1.5);
        if (a.d >= total) { spawn(a); continue; }
        const y = falling ? a.y0 + a.d : a.y0 + a.fall - (a.d - a.fall);
        const edge = Math.min(a.d / 50, (total - a.d) / 70, 1);
        arrow(a.x, y, a.size, falling ? 1 : -1, falling ? RED : GREEN, 0.55 * clamp(edge, 0, 1));
      }
      ctx.shadowBlur = 0;
    });
  }
})();
