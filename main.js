(() => {
  const NS = "http://www.w3.org/2000/svg";
  const TAU = Math.PI * 2;
  const root = document.documentElement;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const lite = matchMedia("(max-width: 900px)").matches || !finePointer; // phones and tablets get a lighter build
  // Phones fire "resize" whenever the address bar slides in or out. Only a real width change should rebuild anything.
  const onWidthChange = (fn) => { let last = innerWidth; addEventListener("resize", () => { if (innerWidth !== last) { last = innerWidth; fn(); } }); };
  const introDelay = root.classList.contains("intro") ? 1.85 : 0.15;
  const el = (name, attrs = {}) => {
    const n = document.createElementNS(NS, name);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  };

  // ---------- Guilloche: the interlaced linework engraved on banknotes ----------
  function ringPath(R, a, n, phase, b = 0, n2 = 0) {
    const steps = Math.max(240, n * 18);
    let d = "";
    for (let i = 0; i <= steps; i++) {
      const t = (i / steps) * TAU;
      const r = R + a * Math.sin(n * t + phase) + b * Math.sin(n2 * t - phase * 2);
      d += (i ? "L" : "M") + (r * Math.cos(t)).toFixed(2) + " " + (r * Math.sin(t)).toFixed(2);
    }
    return d + "Z";
  }
  function bandPaths(svg, band, each) {
    for (let k = 0; k < band.K; k++) {
      const p = el("path", { d: ringPath(band.R, band.a, band.n, (k / band.K) * TAU, band.b, band.n2), pathLength: "1" });
      each(p, k);
      svg.appendChild(p);
    }
  }

  // Hero rosette: each band is its own layer so the rings can counter-rotate.
  document.querySelectorAll("[data-rosette]").forEach((box) => {
    const bands = [
      { R: 252, a: 34, n: 26, K: 10, b: 6, n2: 13, dur: 190 },
      { R: 184, a: 26, n: 18, K: 8, b: 5, n2: 6, dur: 140 },
      { R: 122, a: 24, n: 12, K: 7, b: 4, n2: 4, dur: 100 },
      { R: 58, a: 34, n: 7, K: 5, b: 0, n2: 0, dur: 70 },
    ];
    if (lite) { bands.pop(); bands.forEach((b) => { b.K = Math.ceil(b.K * 0.6); }); }
    bands.forEach((band, bi) => {
      const svg = el("svg", { viewBox: "-300 -300 600 600", "aria-hidden": "true" });
      svg.style.setProperty("--dur", band.dur + "s");
      bandPaths(svg, band, (p, k) => {
        p.classList.add("draw");
        p.style.animationDelay = (introDelay + bi * 0.3 + k * 0.04).toFixed(2) + "s";
      });
      box.appendChild(svg);
    });
  });

  const seals = {
    stocks: [{ R: 34, a: 9, n: 10, K: 6 }, { R: 16, a: 8, n: 5, K: 4 }],
    forex: [{ R: 32, a: 11, n: 6, K: 8 }, { R: 14, a: 7, n: 3, K: 4 }],
    commodities: [{ R: 34, a: 8, n: 14, K: 5 }, { R: 18, a: 10, n: 7, K: 5 }],
    indices: [{ R: 33, a: 10, n: 8, K: 7 }, { R: 15, a: 9, n: 4, K: 6 }],
  };
  document.querySelectorAll("[data-seal]").forEach((svg) => {
    let count = 0;
    (seals[svg.dataset.seal] || seals.stocks).forEach((band) => bandPaths(svg, band, (p) => p.style.setProperty("--k", count++)));
  });

  // Footer strip, drawn twice as wide as it shows so it can loop seamlessly.
  document.querySelectorAll("[data-strip]").forEach((svg) => {
    const W = 2400, K = 7;
    for (let k = 0; k < K; k++) {
      let d = "";
      const phase = (k / K) * TAU;
      for (let x = 0; x <= W; x += 2) {
        const u = (x / 1200) * TAU;
        const y = 23 + 15 * Math.sin(u * 30 + phase) * Math.cos(u * 3);
        d += (x ? "L" : "M") + x + " " + y.toFixed(2);
      }
      svg.appendChild(el("path", { d }));
    }
  });

  // ---------- Headline word splitting + scroll reveals ----------
  document.querySelectorAll("[data-split]").forEach((h) => {
    const words = h.textContent.trim().split(/\s+/);
    h.setAttribute("aria-label", h.textContent.trim());
    h.textContent = "";
    words.forEach((word, i) => {
      const outer = document.createElement("span");
      outer.className = "w";
      outer.setAttribute("aria-hidden", "true");
      const inner = document.createElement("span");
      inner.textContent = word;
      inner.style.setProperty("--wi", i);
      if (h.hasAttribute("data-gold")) inner.className = "gold-text";
      outer.appendChild(inner);
      h.appendChild(outer);
      h.appendChild(document.createTextNode(" "));
    });
  });

  // Stagger siblings that reveal together.
  document.querySelectorAll("[data-stagger]").forEach((group) => {
    [...group.children].forEach((child, i) => child.style.setProperty("--i", i));
  });

  const revealables = document.querySelectorAll("[data-reveal], [data-split], .rule");
  if ("IntersectionObserver" in window && !reduced) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -12% 0px", threshold: 0.08 });
    revealables.forEach((n) => io.observe(n));
  } else {
    revealables.forEach((n) => n.classList.add("in"));
  }

  // ---------- Scroll: header state, progress bar, hero parallax ----------
  const header = document.querySelector(".site-header");
  const progress = document.querySelector(".progress");
  const hero = document.querySelector(".hero, .page-top");
  let ticking = false;
  function onScroll() {
    ticking = false;
    const y = window.scrollY;
    header.classList.toggle("scrolled", y > 24);
    const max = document.documentElement.scrollHeight - innerHeight;
    if (progress) progress.style.setProperty("--p", max > 0 ? (y / max).toFixed(4) : 0);
    if (hero && !reduced && !lite) hero.style.setProperty("--s", Math.min(1, y / (hero.offsetHeight * 0.85)).toFixed(3));
  }
  addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
  onScroll();

  // Stop the rings turning while the hero is off screen.
  if (hero && "IntersectionObserver" in window) {
    new IntersectionObserver(([e]) => hero.classList.toggle("offscreen", !e.isIntersecting)).observe(hero);
  }

  // Rosette leans away from the pointer.
  if (hero && finePointer && !reduced) {
    hero.addEventListener("pointermove", (e) => {
      const r = hero.getBoundingClientRect();
      hero.style.setProperty("--px", (((e.clientX - r.left) / r.width - 0.5) * -46).toFixed(1));
      hero.style.setProperty("--py", (((e.clientY - r.top) / r.height - 0.5) * -34).toFixed(1));
    });
  }

  // ---------- Gold dust drifting through the hero ----------
  const canvas = document.querySelector(".dust");
  if (canvas && !reduced) {
    const ctx = canvas.getContext("2d");
    let w = 0, h = 0, motes = [], running = false, raf = 0;
    const dpr = Math.min(lite ? 1.5 : 2, devicePixelRatio || 1);
    const make = (anywhere) => ({
      x: Math.random() * w,
      y: anywhere ? Math.random() * h : h + 10,
      r: 0.4 + Math.random() * 1.5,
      vy: 0.08 + Math.random() * 0.32,
      vx: (Math.random() - 0.5) * 0.14,
      tw: Math.random() * TAU,
      sp: 0.006 + Math.random() * 0.02,
    });
    function size() {
      w = canvas.clientWidth; h = canvas.clientHeight;
      canvas.width = w * dpr; canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const count = Math.round(Math.min(lite ? 34 : 120, (w * h) / 13000));
      motes = Array.from({ length: count }, () => make(true));
    }
    function frame() {
      ctx.clearRect(0, 0, w, h);
      for (const m of motes) {
        m.y -= m.vy; m.x += m.vx; m.tw += m.sp;
        if (m.y < -10 || m.x < -10 || m.x > w + 10) Object.assign(m, make(false));
        const alpha = 0.18 + 0.5 * (0.5 + 0.5 * Math.sin(m.tw));
        ctx.beginPath();
        ctx.arc(m.x, m.y, m.r, 0, TAU);
        ctx.fillStyle = "rgba(242,223,170," + alpha.toFixed(3) + ")";
        if (!lite) { ctx.shadowColor = "rgba(201,163,92,.9)"; ctx.shadowBlur = m.r * 5; }
        ctx.fill();
      }
      if (running) raf = requestAnimationFrame(frame);
    }
    const start = () => { if (!running) { running = true; raf = requestAnimationFrame(frame); } };
    const stop = () => { running = false; cancelAnimationFrame(raf); };
    size();
    onWidthChange(size);
    new IntersectionObserver(([e]) => (e.isIntersecting && !document.hidden ? start() : stop())).observe(canvas);
    document.addEventListener("visibilitychange", () => (document.hidden ? stop() : start()));
  }

  // ---------- Office clocks: real local time ----------
  const clocks = [...document.querySelectorAll("[data-tz]")].map((office) => {
    const svg = office.querySelector(".clock");
    svg.appendChild(el("circle", { r: 46 }));
    for (let i = 0; i < 12; i++) {
      const t = el("line", { x1: 0, y1: -45, x2: 0, y2: i % 3 ? -41 : -37, class: "tick" + (i % 3 ? "" : " q") });
      t.setAttribute("transform", "rotate(" + i * 30 + ")");
      svg.appendChild(t);
    }
    const hands = {
      h: svg.appendChild(el("line", { x1: 0, y1: 4, x2: 0, y2: -22, class: "hand h" })),
      m: svg.appendChild(el("line", { x1: 0, y1: 5, x2: 0, y2: -33, class: "hand m" })),
      s: svg.appendChild(el("line", { x1: 0, y1: 9, x2: 0, y2: -37, class: "hand sec" })),
    };
    svg.appendChild(el("circle", { r: 2.2, class: "pin" }));
    const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: office.dataset.tz, hour: "2-digit", minute: "2-digit", second: "2-digit", weekday: "long", hour12: false });
    return { hands, fmt, out: office.querySelector("time"), turns: 0, last: -1 };
  });
  function tick() {
    const now = new Date();
    clocks.forEach((c) => {
      const p = Object.fromEntries(c.fmt.formatToParts(now).map((x) => [x.type, x.value]));
      const h = +p.hour % 24, m = +p.minute, s = +p.second;
      if (s < c.last) c.turns++; // keep the second hand moving forward past 60
      c.last = s;
      c.hands.s.style.transform = "rotate(" + (c.turns * 360 + s * 6) + "deg)";
      c.hands.m.style.transform = "rotate(" + (m * 6 + s * 0.1) + "deg)";
      c.hands.h.style.transform = "rotate(" + ((h % 12) * 30 + m * 0.5) + "deg)";
      c.out.textContent = p.weekday + " " + p.hour + ":" + p.minute;
    });
  }
  if (clocks.length) { tick(); setInterval(tick, 1000); }

  // ---------- Pointer effects: spotlight and magnetic buttons ----------
  if (finePointer) {
    document.querySelectorAll(".glow").forEach((n) => {
      n.addEventListener("pointermove", (e) => {
        const r = n.getBoundingClientRect();
        n.style.setProperty("--mx", e.clientX - r.left + "px");
        n.style.setProperty("--my", e.clientY - r.top + "px");
      });
    });
    if (!reduced) {
      document.querySelectorAll(".btn").forEach((b) => {
        b.addEventListener("pointermove", (e) => {
          const r = b.getBoundingClientRect();
          const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2);
          b.style.transform = "translate(" + (dx * 0.16).toFixed(1) + "px," + (dy * 0.28).toFixed(1) + "px)";
        });
        b.addEventListener("pointerleave", () => { b.style.transform = ""; });
      });
    }
  }

  // ---------- FAQ: animate open and close ----------
  document.querySelectorAll(".faq details").forEach((d) => {
    const summary = d.querySelector("summary"), ans = d.querySelector(".ans");
    let anim = null;
    summary.addEventListener("click", (e) => {
      if (reduced || !ans.animate) return;
      e.preventDefault();
      if (anim) anim.cancel();
      const opts = { duration: 520, easing: "cubic-bezier(.16,1,.3,1)" };
      if (d.open) {
        anim = ans.animate({ height: [ans.offsetHeight + "px", "0px"], opacity: [1, 0] }, opts);
        anim.onfinish = () => { d.open = false; anim = null; };
      } else {
        d.open = true;
        anim = ans.animate({ height: ["0px", ans.offsetHeight + "px"], opacity: [0, 1] }, opts);
        anim.onfinish = () => { anim = null; };
      }
    });
  });

  // ---------- Mobile menu ----------
  const toggle = document.querySelector(".nav-toggle");
  const nav = document.querySelector(".nav");
  if (toggle && nav) {
    [...nav.children].forEach((a, i) => a.style.setProperty("--n", i));
    const setOpen = (open) => {
      nav.classList.toggle("open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.textContent = open ? "Close" : "Menu";
      document.body.style.overflow = open ? "hidden" : "";
    };
    toggle.addEventListener("click", () => setOpen(!nav.classList.contains("open")));
    nav.addEventListener("click", (e) => { if (e.target.closest("a")) setOpen(false); });
    addEventListener("keydown", (e) => { if (e.key === "Escape") setOpen(false); });
  }

  // ---------- Forms: validate, then hand off to the visitor's email app ----------
  document.querySelectorAll("form[data-mailto]").forEach((form) => {
    const status = form.querySelector(".form-status");
    const setErr = (input, msg) => {
      const field = input.closest(".field");
      field.classList.toggle("invalid", !!msg);
      field.querySelector(".err").textContent = msg || "";
    };
    form.addEventListener("input", (e) => { if (e.target.closest(".field.invalid")) setErr(e.target, ""); });
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      let first = null;
      form.querySelectorAll("[required]").forEach((input) => {
        let msg = "";
        if (!input.value.trim()) msg = input.dataset.msg || "Enter " + input.dataset.label + ".";
        else if (input.type === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value.trim())) msg = "Enter an email address like name@example.com.";
        setErr(input, msg);
        if (msg && !first) first = input;
      });
      if (first) { first.focus(); status.textContent = ""; return; }

      const data = new FormData(form);
      const lines = [];
      form.querySelectorAll("[name]").forEach((n) => {
        if (n.name === "subject" || !data.get(n.name)) return;
        lines.push(n.dataset.label.replace(/^(your|a|the) /, "").replace(/^./, (c) => c.toUpperCase()) + ": " + data.get(n.name));
      });
      if (form.dataset.note) lines.push("", form.dataset.note);
      const subject = data.get("subject") || form.dataset.subject + (data.get("position") ? " — " + data.get("position") : "");
      window.location.href = "mailto:" + form.dataset.mailto + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(lines.join("\n"));
      status.textContent = form.dataset.done;
    });
  });
})();
