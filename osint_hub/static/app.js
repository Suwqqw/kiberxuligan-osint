/**
 * KIberXuligan — Osint By kiber Core Application
 * Architecture: Modular, event-driven, 60fps canvas engine, Web Audio synth, Vis.js graph.
 * Written with senior engineering standards: strict mode, zero GC thrashing, batched draw calls.
 */

document.addEventListener("DOMContentLoaded", () => {
  "use strict";

  // ==========================================================================
  // 1. OPTIMIZED CONSTELLATION CANVAS ENGINE
  // ==========================================================================

  const canvas = document.getElementById("constellation-canvas");
  if (!canvas) return;
  const ctx = canvas.getContext("2d", { alpha: true });

  let width = 0;
  let height = 0;
  let dpr = Math.min(window.devicePixelRatio || 1, 2);

  // High-performance constellation state (no GC allocations in tick)
  const cState = {
    mouseX: -9999,
    mouseY: -9999,
    mouseActive: false,
    starsCount: 85,
    stars: [],
    time: 0
  };

  const STAR_PALETTE = [
    "255, 255, 255", // Astral white
    "56, 189, 248",  // Ice cyan
    "0, 240, 181",   // Cyber emerald
    "168, 85, 247",  // Electric violet
    "147, 197, 253"  // Deep starlight
  ];

  function resizeCanvas() {
    const prevW = width || window.innerWidth;
    const prevH = height || window.innerHeight;
    width = window.innerWidth;
    height = window.innerHeight;
    dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.floor(width * dpr);
    canvas.height = Math.floor(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    ctx.scale(dpr, dpr);

    if (cState.stars.length === 0) {
      initStars();
    } else {
      const rx = width / prevW;
      const ry = height / prevH;
      for (let i = 0; i < cState.stars.length; i++) {
        cState.stars[i].x *= rx;
        cState.stars[i].y *= ry;
      }
    }
  }

  function initStars() {
    cState.stars = [];
    const count = Math.min(95, Math.max(65, Math.floor((width * height) / 14000)));
    cState.starsCount = count;

    for (let i = 0; i < count; i++) {
      const color = STAR_PALETTE[i % STAR_PALETTE.length];
      cState.stars.push({
        x: Math.random() * width,
        y: Math.random() * height,
        baseVx: (Math.random() - 0.5) * 0.35,
        baseVy: (Math.random() - 0.5) * 0.35,
        vx: (Math.random() - 0.5) * 0.35,
        vy: (Math.random() - 0.5) * 0.35,
        radius: Math.random() * 1.5 + 0.8,
        colorRGB: color,
        baseAlpha: Math.random() * 0.45 + 0.35,
        twinkleSpeed: Math.random() * 0.025 + 0.01,
        phase: Math.random() * Math.PI * 2,
        isMajor: i % 5 === 0
      });
    }
  }

  // Pure 60fps render loop: 2 batched draw calls for lines, zero shockwaves
  function renderConstellations() {
    ctx.clearRect(0, 0, width, height);
    cState.time += 0.016;

    const mx = cState.mouseX;
    const my = cState.mouseY;
    const hasMouse = cState.mouseActive && mx > 0 && my > 0;
    const stars = cState.stars;
    const len = stars.length;

    // 1. Update star positions with soft mouse follower physics
    for (let i = 0; i < len; i++) {
      const s = stars[i];
      s.x += s.vx;
      s.y += s.vy;

      // Screen edge wrapping
      if (s.x < -20) s.x = width + 20;
      else if (s.x > width + 20) s.x = -20;
      if (s.y < -20) s.y = height + 20;
      else if (s.y > height + 20) s.y = -20;

      // Mouse attraction
      if (hasMouse) {
        const dx = mx - s.x;
        const dy = my - s.y;
        const d2 = dx * dx + dy * dy;

        // Attract within 280px radius (d2 < 78400)
        if (d2 < 78400 && d2 > 900) {
          const dist = Math.sqrt(d2);
          const pull = (1.0 - dist / 280) * 0.18;
          s.vx += (dx / dist) * pull;
          s.vy += (dy / dist) * pull;
        } else if (d2 <= 900) {
          // Soft cushion repulsion
          const dist = Math.sqrt(d2) || 1;
          s.vx -= (dx / dist) * 0.25;
          s.vy -= (dy / dist) * 0.25;
        }
      }

      // Smooth damping toward baseline velocity
      s.vx = s.vx * 0.965 + s.baseVx * 0.035;
      s.vy = s.vy * 0.965 + s.baseVy * 0.035;
    }

    // 2. Batched draw call for inter-star constellation lines (dx^2 + dy^2 < 14400 => 120px)
    ctx.beginPath();
    ctx.strokeStyle = "rgba(180, 220, 255, 0.14)";
    ctx.lineWidth = 0.8;
    for (let i = 0; i < len; i++) {
      const s1 = stars[i];
      for (let j = i + 1; j < len; j++) {
        const s2 = stars[j];
        const dx = s1.x - s2.x;
        const dy = s1.y - s2.y;
        if (dx * dx + dy * dy < 14400) {
          ctx.moveTo(s1.x, s1.y);
          ctx.lineTo(s2.x, s2.y);
        }
      }
    }
    ctx.stroke();

    // 3. Batched draw call for lines connecting stars to mouse cursor (dx^2 + dy^2 < 36100 => 190px)
    if (hasMouse) {
      ctx.beginPath();
      ctx.strokeStyle = "rgba(56, 189, 248, 0.32)";
      ctx.lineWidth = 1.0;
      for (let i = 0; i < len; i++) {
        const s = stars[i];
        const dx = mx - s.x;
        const dy = my - s.y;
        if (dx * dx + dy * dy < 36100) {
          ctx.moveTo(s.x, s.y);
          ctx.lineTo(mx, my);
        }
      }
      ctx.stroke();

      // Subtle focal star at cursor
      ctx.fillStyle = "rgba(56, 189, 248, 0.75)";
      ctx.beginPath();
      ctx.arc(mx, my, 2.8, 0, Math.PI * 2);
      ctx.fill();
    }

    // 4. Render Stars
    for (let i = 0; i < len; i++) {
      const s = stars[i];
      const twinkle = 0.75 + 0.25 * Math.sin(cState.time * s.twinkleSpeed * 60 + s.phase);
      const alpha = s.baseAlpha * twinkle;

      ctx.fillStyle = `rgba(${s.colorRGB}, ${alpha})`;
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.radius, 0, Math.PI * 2);
      ctx.fill();
    }

    requestAnimationFrame(renderConstellations);
  }

  // Pointer event tracking (pure tracking, zero click shockwaves)
  window.addEventListener("pointermove", (e) => {
    cState.mouseActive = true;
    cState.mouseX = e.clientX;
    cState.mouseY = e.clientY;
  }, { passive: true });

  document.addEventListener("mouseleave", () => {
    cState.mouseActive = false;
    cState.mouseX = -9999;
    cState.mouseY = -9999;
  });

  window.addEventListener("resize", resizeCanvas, { passive: true });
  resizeCanvas();
  requestAnimationFrame(renderConstellations);


  // ==========================================================================
  // 2. AMBIENT AUDIO SYNTHESIZER: Novulent - Unknown Feelings (Slowed & Reverb)
  // ==========================================================================

  let audioCtx = null;
  let isPlaying = false;
  let isMuted = false;
  let synthTimer = null;
  const activeOscs = [];

  const btnMusicPlay = document.getElementById("btn-music-play");
  const musicPlayIcon = document.getElementById("music-play-icon");
  const musicEqualizer = document.getElementById("music-equalizer");
  const btnSound = document.getElementById("btn-sound-toggle");
  const soundIcon = document.getElementById("sound-icon");

  function initAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === "suspended") {
      audioCtx.resume();
    }
  }

  function trackOsc(osc) {
    activeOscs.push(osc);
    osc.onended = () => {
      const idx = activeOscs.indexOf(osc);
      if (idx !== -1) activeOscs.splice(idx, 1);
    };
  }

  function stopAllActiveOscs() {
    while (activeOscs.length > 0) {
      const osc = activeOscs.pop();
      try {
        osc.stop();
        osc.disconnect();
      } catch (e) {}
    }
  }

  // Harmonic chord progression in F# minor: F#m -> D -> A -> E
  const CHORD_PROGRESSION = [
    { root: 185.00, isMinor: true,  arp: [369.99, 440.00, 554.37] }, // F#m
    { root: 146.83, isMinor: false, arp: [293.66, 369.99, 440.00] }, // D Major
    { root: 220.00, isMinor: false, arp: [277.18, 329.63, 440.00] }, // A Major
    { root: 164.81, isMinor: false, arp: [329.63, 415.30, 493.88] }  // E Major
  ];

  let chordIndex = 0;

  function playSlowedChord() {
    if (!isPlaying || !audioCtx || isMuted) return;

    try {
      const chord = CHORD_PROGRESSION[chordIndex];
      chordIndex = (chordIndex + 1) % CHORD_PROGRESSION.length;
      const now = audioCtx.currentTime;

      // Reverb delay pipeline
      const delay = audioCtx.createDelay(1.2);
      delay.delayTime.setValueAtTime(0.58, now);

      const feedback = audioCtx.createGain();
      feedback.gain.setValueAtTime(0.42, now);

      const filter = audioCtx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(680, now);

      delay.connect(feedback);
      feedback.connect(filter);
      filter.connect(delay);
      delay.connect(audioCtx.destination);

      // Sub-bass root
      const sub = audioCtx.createOscillator();
      const subGain = audioCtx.createGain();
      sub.type = "sine";
      sub.frequency.setValueAtTime(chord.root * 0.5, now);
      subGain.gain.setValueAtTime(0.001, now);
      subGain.gain.linearRampToValueAtTime(0.08, now + 0.8);
      subGain.gain.exponentialRampToValueAtTime(0.001, now + 4.2);
      sub.connect(subGain);
      subGain.connect(audioCtx.destination);
      sub.start(now);
      sub.stop(now + 4.4);
      trackOsc(sub);

      // Chord pad with consonant harmonic third
      const thirdRatio = chord.isMinor ? 1.1892 : 1.2599;
      [1.0, thirdRatio, 1.4983].forEach((ratio) => {
        const osc = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(chord.root * ratio, now);
        g.gain.setValueAtTime(0.001, now);
        g.gain.linearRampToValueAtTime(0.035, now + 0.9);
        g.gain.exponentialRampToValueAtTime(0.001, now + 4.0);
        osc.connect(g);
        g.connect(delay);
        g.connect(audioCtx.destination);
        osc.start(now);
        osc.stop(now + 4.2);
        trackOsc(osc);
      });

      // Atmospheric high arpeggios
      chord.arp.forEach((freq, idx) => {
        const arpOsc = audioCtx.createOscillator();
        const arpGain = audioCtx.createGain();
        const noteTime = now + 0.5 + idx * 0.65;
        arpOsc.type = "sine";
        arpOsc.frequency.setValueAtTime(freq, noteTime);
        arpGain.gain.setValueAtTime(0.001, noteTime);
        arpGain.gain.linearRampToValueAtTime(0.022, noteTime + 0.3);
        arpGain.gain.exponentialRampToValueAtTime(0.001, noteTime + 2.0);
        arpOsc.connect(arpGain);
        arpGain.connect(delay);
        arpGain.connect(audioCtx.destination);
        arpOsc.start(noteTime);
        arpOsc.stop(noteTime + 2.2);
        trackOsc(arpOsc);
      });
    } catch (e) {}

    synthTimer = setTimeout(playSlowedChord, 3800);
  }

  function toggleMusic() {
    initAudioContext();
    isPlaying = !isPlaying;

    if (isPlaying) {
      if (musicPlayIcon) musicPlayIcon.textContent = "⏸";
      if (musicEqualizer) musicEqualizer.classList.add("playing");
      playSlowedChord();
    } else {
      if (musicPlayIcon) musicPlayIcon.textContent = "▶";
      if (musicEqualizer) musicEqualizer.classList.remove("playing");
      if (synthTimer) {
        clearTimeout(synthTimer);
        synthTimer = null;
      }
      stopAllActiveOscs();
    }
  }

  if (btnMusicPlay) {
    btnMusicPlay.addEventListener("click", (e) => {
      e.preventDefault();
      toggleMusic();
    });
  }

  if (btnSound) {
    btnSound.addEventListener("click", (e) => {
      e.preventDefault();
      initAudioContext();
      isMuted = !isMuted;
      if (soundIcon) soundIcon.textContent = isMuted ? "🔇" : "🔊";
      if (isMuted) stopAllActiveOscs();
    });
  }

  // Top Nav Actions
  const btnSkip = document.getElementById("btn-nav-skip");
  const btnCreate = document.getElementById("btn-nav-create");
  const btnLang = document.getElementById("btn-lang-toggle");
  const inputUsername = document.getElementById("target-username");

  if (btnSkip) {
    btnSkip.addEventListener("click", (e) => {
      e.preventDefault();
      const sec = document.getElementById("search-section");
      if (sec) {
        sec.scrollIntoView({ behavior: "smooth" });
        setTimeout(() => inputUsername && inputUsername.focus(), 350);
      }
    });
  }

  if (btnCreate) {
    btnCreate.addEventListener("click", (e) => {
      e.preventDefault();
      const sec = document.getElementById("search-section");
      if (sec) {
        sec.scrollIntoView({ behavior: "smooth" });
        if (inputUsername) {
          inputUsername.value = "";
          setTimeout(() => inputUsername.focus(), 350);
        }
      }
    });
  }

  if (btnLang) {
    btnLang.addEventListener("click", (e) => {
      e.preventDefault();
      addLog(null, "Язык интерфейса: RU (Русский) активен.");
    });
  }


  // ==========================================================================
  // 3. CORE OSINT SCANNER & VIS.JS GRAPH ORCHESTRATION
  // ==========================================================================

  const btnSearch = document.getElementById("btn-search");
  const btnStop = document.getElementById("btn-stop");
  const btnHeroStart = document.getElementById("btn-hero-start");
  const modeFast = document.getElementById("mode-fast");
  const modeDeep = document.getElementById("mode-deep");

  const chkMaigret = document.getElementById("chk-maigret");
  const chkSnoop = document.getElementById("chk-snoop");
  const chkSherlock = document.getElementById("chk-sherlock");
  const chkBlackbird = document.getElementById("chk-blackbird");
  const chkNexfil = document.getElementById("chk-nexfil");

  const terminalLogs = document.getElementById("terminal-logs");
  const tableBody = document.getElementById("table-body");
  const graphNodesCount = document.getElementById("graph-nodes-count");
  const tableRowsCount = document.getElementById("table-rows-count");

  const tabBtns = document.querySelectorAll(".tab-btn");
  const tabContents = document.querySelectorAll(".tab-content");

  let isFastMode = true;
  let activeEventSource = null;
  let network = null;
  const nodesDataSet = new vis.DataSet([]);
  const edgesDataSet = new vis.DataSet([]);
  let physicsEnabled = true;

  let allFoundItems = [];
  let activeCategoryFilter = "all";
  let engineCounts = { maigret: 0, snoop: 0, sherlock: 0, blackbird: 0, nexfil: 0 };
  let latestEmailData = null;
  let latestTgData = null;
  let latestBreachData = null;
  let latestPhoneData = null;

  if (btnHeroStart) {
    btnHeroStart.addEventListener("click", () => {
      const searchSec = document.getElementById("search-section");
      if (searchSec) {
        searchSec.scrollIntoView({ behavior: "smooth" });
        setTimeout(() => inputUsername && inputUsername.focus(), 350);
      }
    });
  }

  if (modeFast && modeDeep) {
    modeFast.addEventListener("click", () => {
      isFastMode = true;
      modeFast.classList.add("active");
      modeDeep.classList.remove("active");
    });

    modeDeep.addEventListener("click", () => {
      isFastMode = false;
      modeDeep.classList.add("active");
      modeFast.classList.remove("active");
    });
  }

  tabBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabBtns.forEach((b) => b.classList.remove("active"));
      tabContents.forEach((c) => c.classList.remove("active"));
      btn.classList.add("active");
      const targetId = btn.getAttribute("data-tab");
      const targetContent = document.getElementById(targetId);
      if (targetContent) targetContent.classList.add("active");
      if (targetId === "tab-graph" && network) {
        setTimeout(() => network.fit(), 120);
      }
      if (targetId === "tab-dossier") {
        updateDossierView();
      }
    });
  });

  // Vis.js Network Initialization styled to match ClearVisual / KIberXuligan
  function initNetwork() {
    const container = document.getElementById("network-canvas");
    if (!container) return;

    const data = { nodes: nodesDataSet, edges: edgesDataSet };
    const options = {
      nodes: {
        shape: "dot",
        scaling: { min: 14, max: 36 },
        font: {
          face: "Plus Jakarta Sans, sans-serif",
          color: "#f8fafc",
          size: 11
        },
        borderWidth: 2
      },
      edges: {
        width: 1.5,
        smooth: {
          type: "continuous",
          roundness: 0.35
        }
      },
      physics: {
        stabilization: { iterations: 100, updateInterval: 25 },
        barnesHut: {
          gravitationalConstant: -4200,
          springConstant: 0.035,
          springLength: 85,
          damping: 0.12
        }
      },
      interaction: {
        hover: true,
        tooltipDelay: 120
      }
    };

    network = new vis.Network(container, data, options);

    // Double-click opens external profile link directly
    network.on("doubleClick", (params) => {
      if (params.nodes && params.nodes.length > 0) {
        const nodeId = params.nodes[0];
        const node = nodesDataSet.get(nodeId);
        if (node && node.url && node.url.startsWith("http")) {
          window.open(node.url, "_blank");
        }
      }
    });
  }

  const btnFit = document.getElementById("btn-fit");
  if (btnFit) {
    btnFit.addEventListener("click", () => {
      if (network) network.fit();
    });
  }

  const btnPhysics = document.getElementById("btn-physics");
  if (btnPhysics) {
    btnPhysics.addEventListener("click", () => {
      physicsEnabled = !physicsEnabled;
      network.setOptions({ physics: { enabled: physicsEnabled } });
      btnPhysics.textContent = physicsEnabled ? "⚡ Физика: ВКЛ" : "💤 Физика: ВЫКЛ";
    });
  }

  function addLog(tool, text, level = "info") {
    if (!terminalLogs) return;
    const time = new Date().toLocaleTimeString();
    const div = document.createElement("div");
    div.className = "log-line";
    const toolClass = tool ? `log-tool ${tool.toLowerCase()}` : "log-tool";
    const toolName = tool ? `[${tool.toUpperCase()}]` : "";
    div.innerHTML = `<span class="log-time">${time}</span><span class="${toolClass}">${toolName}</span><span>${escapeHtml(text)}</span>`;
    terminalLogs.appendChild(div);
    terminalLogs.scrollTop = terminalLogs.scrollHeight;
  }

  function escapeHtml(str) {
    if (!str) return "";
    return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }

  function showToast(message, type = "info") {
    let container = document.getElementById("toast-container");
    if (!container) {
      container = document.createElement("div");
      container.id = "toast-container";
      container.style.cssText = "position: fixed; top: 24px; right: 24px; z-index: 999999; display: flex; flex-direction: column; gap: 10px; pointer-events: none;";
      document.body.appendChild(container);
    }
    const toast = document.createElement("div");
    toast.className = `toast-msg toast-${type}`;
    const icon = type === "error" ? "⚠️" : (type === "success" ? "✅" : "ℹ️");
    const borderCol = type === "error" ? "rgba(239, 68, 68, 0.45)" : (type === "success" ? "rgba(16, 185, 129, 0.45)" : "rgba(56, 189, 248, 0.45)");
    toast.style.cssText = `pointer-events: auto; background: rgba(13, 17, 23, 0.95); border: 1px solid ${borderCol}; color: #f1f5f9; padding: 12px 18px; border-radius: 12px; font-size: 13px; font-weight: 500; box-shadow: 0 10px 30px rgba(0,0,0,0.6); backdrop-filter: blur(12px); display: flex; align-items: center; gap: 10px; max-width: 440px; transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); transform: translateY(-12px); opacity: 0;`;
    toast.innerHTML = `<span style="font-size: 16px;">${icon}</span><span>${escapeHtml(String(message))}</span>`;
    container.appendChild(toast);
    requestAnimationFrame(() => {
      toast.style.transform = "translateY(0)";
      toast.style.opacity = "1";
    });
    setTimeout(() => {
      toast.style.transform = "translateY(-12px)";
      toast.style.opacity = "0";
      setTimeout(() => toast.remove(), 350);
    }, 4500);
  }

  // Deduplicated Table Rendering
  function renderTable() {
    if (!tableBody) return;
    let filtered = allFoundItems;
    if (activeCategoryFilter !== "all") {
      filtered = allFoundItems.filter((item) => item.category === activeCategoryFilter);
    }

    if (tableRowsCount) {
      tableRowsCount.textContent = `${allFoundItems.length} совпадений`;
    }

    if (filtered.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="5" class="table-empty-msg">Нет совпадений для выбранного фильтра</td></tr>`;
      return;
    }

    tableBody.innerHTML = filtered.map((item) => {
      const toolTags = item.tools.map((t) => `<span class="tool-tag ${t}">${t}</span>`).join("");
      const confidenceBadge = item.tools.length > 1
        ? `<span class="conf-high">★ Высокая (${item.tools.length}x)</span>`
        : `<span class="conf-normal">Нормальная</span>`;

      const catTitle = getCategoryTitle(item.category);

      return `
        <tr>
          <td><b>${escapeHtml(item.site)}</b></td>
          <td><span class="category-badge">${catTitle}</span></td>
          <td><a href="${item.url}" target="_blank" class="table-link">${escapeHtml(item.url)} ↗</a></td>
          <td>${toolTags}</td>
          <td>${confidenceBadge}</td>
        </tr>
      `;
    }).join("");
  }

  function getCategoryTitle(cat) {
    const titles = {
      runet: "🇷🇺 Рунет & СНГ",
      messaging: "💬 Мессенджер",
      tech: "💻 IT / Dev",
      social: "🌐 Соцсеть",
      gaming: "🎮 Гейминг",
      media: "🎵 Медиа",
      career: "💼 Карьера",
      other: "📁 Другое"
    };
    return titles[cat] || "📁 Другое";
  }

  const catFilters = document.getElementById("category-filters");
  if (catFilters) {
    catFilters.addEventListener("click", (e) => {
      if (e.target.classList.contains("filter-pill")) {
        document.querySelectorAll(".filter-pill").forEach((p) => p.classList.remove("active"));
        e.target.classList.add("active");
        activeCategoryFilter = e.target.getAttribute("data-category");
        renderTable();
      }
    });
  }

  const btnExport = document.getElementById("btn-export-csv");
  if (btnExport) {
    btnExport.addEventListener("click", () => {
      if (!allFoundItems.length) return showToast("Нет данных для экспорта!", "info");
      let csv = "Site,Category,URL,Tools,Confidence\n";
      allFoundItems.forEach((item) => {
        csv += `"${item.site}","${item.category}","${item.url}","${item.tools.join("; ")}",${item.tools.length}\n`;
      });
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `kiberxuligan_osint_${(inputUsername && inputUsername.value.trim()) || "results"}.csv`;
      a.click();
    });
  }

  function updateTgProfilesLive(item) {
    const tgProfPanel = document.getElementById("tg-profiles-panel");
    const tgProfBody = document.getElementById("tg-profiles-body");
    const tgProfCount = document.getElementById("tg-profiles-count");
    if (!tgProfBody) return;

    if (tgProfPanel) tgProfPanel.style.display = "block";

    const emptyRow = tgProfBody.querySelector(".table-empty-msg");
    if (emptyRow) {
      tgProfBody.innerHTML = "";
    }

    const existing = tgProfBody.querySelector(`a[href="${item.url}"]`);
    if (existing) return;

    const row = document.createElement("tr");
    const tools = (item.tools || [item.tool || "OSINT"]).map(t => `<span class="tool-tag ${t}">${t}</span>`).join("");
    row.innerHTML = `
      <td><b>${escapeHtml(item.site)}</b></td>
      <td><span class="category-badge">${getCategoryTitle(item.category)}</span></td>
      <td><a href="${item.url}" target="_blank" class="table-link">${escapeHtml(item.url)} ↗</a></td>
      <td>${tools}</td>
      <td><span class="badge" style="background: rgba(0, 240, 181, 0.15); color: #00f0b5;">Подтвержден</span></td>
    `;
    tgProfBody.appendChild(row);

    const rowsCount = tgProfBody.querySelectorAll("tr").length;
    if (tgProfCount) tgProfCount.textContent = `${rowsCount} найдено`;
  }

  function updateEmailAccountsLive(item) {
    const emailAccountsPanel = document.getElementById("email-accounts-panel");
    const emailAccountsBody = document.getElementById("email-accounts-body");
    const emailAccountsCount = document.getElementById("email-accounts-count");
    if (!emailAccountsBody) return;

    if (emailAccountsPanel) emailAccountsPanel.style.display = "block";

    const emptyRow = emailAccountsBody.querySelector(".table-empty-msg");
    if (emptyRow) {
      emailAccountsBody.innerHTML = "";
    }

    const existing = emailAccountsBody.querySelector(`a[href="${item.url}"]`);
    if (existing) return;

    const row = document.createElement("tr");
    const toolName = (item.tools && item.tools[0]) || item.tool || "OSINT";
    row.innerHTML = `
      <td><b>${escapeHtml(item.site)}</b></td>
      <td><a href="${item.url}" target="_blank" class="table-link">${escapeHtml(item.url)} ↗</a></td>
      <td><span style="color: #38bdf8; font-family: monospace;">Подтвержденный профиль</span></td>
      <td><span class="tool-tag ${toolName}">Подтверждено</span></td>
    `;
    emailAccountsBody.appendChild(row);

    const rowsCount = emailAccountsBody.querySelectorAll("tr").length;
    if (emailAccountsCount) emailAccountsCount.textContent = `${rowsCount} найдено`;
  }

  let currentSessionId = null;

  // Orchestrated Multi-Engine Scan Execution with Autonomous Auto-Detection
  async function startScan() {
    if (!inputUsername) return;
    const rawTarget = inputUsername.value.trim();
    if (!rawTarget) return showToast("Пожалуйста, введите цель для разведки (никнейм, @telegram, email или телефон)!", "error");

    // Cleanly abort previous session and lingering processes before starting a fresh search
    if (activeEventSource || currentSessionId) {
      if (activeEventSource) {
        activeEventSource.close();
        activeEventSource = null;
      }
      try {
        fetch("/api/scan/stop-all", { method: "POST" });
      } catch (e) {}
    }

    const isEmail = rawTarget.includes("@") && rawTarget.includes(".") && !rawTarget.startsWith("@");
    const isTelegram = rawTarget.startsWith("@") || rawTarget.includes("t.me/");
    const isPhone = /^(\+?\d[\d\s\-\(\)]{8,}\d)$/.test(rawTarget);

    const tools = [];
    if (chkMaigret && chkMaigret.checked) tools.push("maigret");
    if (chkSnoop && chkSnoop.checked) tools.push("snoop");
    if (chkSherlock && chkSherlock.checked) tools.push("sherlock");
    if (chkBlackbird && chkBlackbird.checked) tools.push("blackbird");
    if (chkNexfil && chkNexfil.checked) tools.push("nexfil");

    if (tools.length === 0) return showToast("Выберите хотя бы один поисковый модуль!", "error");

    // Reset state & UI
    nodesDataSet.clear();
    edgesDataSet.clear();
    allFoundItems = [];
    engineCounts = { maigret: 0, snoop: 0, sherlock: 0, blackbird: 0, nexfil: 0 };

    ["maigret", "snoop", "sherlock", "blackbird", "nexfil"].forEach((t) => {
      const badge = document.getElementById(`badge-status-${t}`);
      const count = document.getElementById(`count-${t}`);
      const card = document.getElementById(`card-${t}`);
      const progress = document.getElementById(`progress-${t}`);
      if (badge) { badge.textContent = "Ожидание"; badge.className = "engine-badge"; }
      if (card) { card.className = "engine-card glass-card"; }
      if (progress) { progress.style.width = "0%"; }
      if (count) { count.textContent = "0"; }
    });

    renderTable();
    addLog(null, `Запуск объединенной разведки для "${rawTarget}" [${tools.join(", ")}]...`);

    if (btnSearch) {
      btnSearch.disabled = false;
      btnSearch.innerHTML = `<span class="btn-icon">⚡</span><span>Поиск идет...</span>`;
    }
    if (btnStop) btnStop.style.display = "inline-flex";

    // Autonomous intelligence triggering for specialized query formats
    if (isEmail) {
      if (emailInput) emailInput.value = rawTarget;
      if (breachesInput) breachesInput.value = rawTarget;
      addLog(null, `[АВТОНОМНЫЙ РЕЖИМ] Обнаружен Email "${rawTarget}". Запуск проверки экосистемы Mail.ru, GitHub, Holehe 120+ и утечек...`);
      showToast("Автономный режим: запущен комплексный анализ Email, утечек и 400+ платформ!", "info");
      handleEmailAnalyze(true);
      handleBreachesAnalyze(true);
      handleEmailHoleheScan(true);
    } else if (isTelegram) {
      if (tgInput) tgInput.value = rawTarget;
      if (breachesInput) breachesInput.value = rawTarget;
      if (vkInput) vkInput.value = rawTarget;
      addLog(null, `[АВТОНОМНЫЙ РЕЖИМ] Обнаружен Telegram "${rawTarget}". Запуск анализа профиля, стиллеров, VK и 400+ сайтов...`);
      showToast("Автономный режим: запущен анализ Telegram, стиллеров, VK и 400+ платформ!", "info");
      handleTgAnalyze(true);
      handleBreachesAnalyze(true);
      handleVkAnalyze(true);
    } else if (isPhone) {
      if (phoneInput) phoneInput.value = rawTarget;
      if (breachesInput) breachesInput.value = rawTarget;
      addLog(null, `[АВТОНОМНЫЙ РЕЖИМ] Обнаружен телефон "${rawTarget}". Запуск анализа оператора, мессенджеров и утечек...`);
      showToast("Автономный режим: запущен анализ телефона и утечек!", "info");
      handlePhoneSearch(true);
      handleBreachesAnalyze(true);
    } else {
      if (tgInput) tgInput.value = rawTarget;
      if (breachesInput) breachesInput.value = rawTarget;
      if (vkInput) vkInput.value = rawTarget;
      handleTgAnalyze(true);
      handleBreachesAnalyze(true);
      handleVkAnalyze(true);
    }

    try {
      const resp = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          username: rawTarget,
          tools: tools,
          fast_mode: isFastMode
        })
      });

      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();
      currentSessionId = data.session_id;
      connectStream(data.session_id);
    } catch (err) {
      addLog(null, `Ошибка запуска: ${err.message}`, "error");
      if (btnSearch) btnSearch.disabled = false;
      if (btnStop) btnStop.style.display = "none";
    }
  }

  function connectStream(sessionId) {
    currentSessionId = sessionId;
    if (activeEventSource) {
      activeEventSource.close();
    }

    activeEventSource = new EventSource(`/api/stream/${sessionId}`);

    activeEventSource.addEventListener("log", (e) => {
      const data = JSON.parse(e.data);
      addLog(data.tool, data.text, data.level || "info");
    });

    activeEventSource.addEventListener("status", (e) => {
      const data = JSON.parse(e.data);
      const tool = data.tool;
      const status = data.status;
      const badge = document.getElementById(`badge-status-${tool}`);
      const card = document.getElementById(`card-${tool}`);
      const progress = document.getElementById(`progress-${tool}`);

      if (status === "running") {
        if (badge) { badge.textContent = "Поиск..."; badge.className = "engine-badge scanning"; }
        if (card) card.classList.add("active");
        if (progress) progress.style.width = "45%";
      } else if (status === "done") {
        if (badge) { badge.textContent = "Готово"; badge.className = "engine-badge complete"; }
        if (card) { card.classList.remove("active"); card.classList.add("done"); }
        if (progress) progress.style.width = "100%";
      } else if (status === "error") {
        if (badge) { badge.textContent = "Ошибка"; badge.className = "engine-badge"; }
        if (card) card.classList.remove("active");
      }
    });

    activeEventSource.addEventListener("vector_intel", (e) => {
      try {
        const payload = JSON.parse(e.data);
        if (payload.type === "email_intel" && payload.data) {
          latestEmailData = payload.data;
          renderEmailResults(payload.data);
        } else if (payload.type === "telegram_intel" && payload.data) {
          latestTgData = payload.data;
          renderTgResults(payload.data);
        } else if (payload.type === "phone_intel" && payload.data) {
          latestPhoneData = payload.data;
          renderPhoneResults(payload.data);
        } else if (payload.type === "breach_intel" && payload.data) {
          latestBreachData = payload.data;
          renderBreachesResults(payload.data);
        }
        updateDossierView();
      } catch (err) {
        console.warn("vector_intel parse error:", err);
      }
    });

    activeEventSource.addEventListener("found", (e) => {
      const data = JSON.parse(e.data);
      const item = data.item;
      const tool = data.tool;

      if (tool && engineCounts[tool] !== undefined) {
        engineCounts[tool]++;
        const countEl = document.getElementById(`count-${tool}`);
        if (countEl) countEl.textContent = engineCounts[tool];
      }

      const existingIdx = allFoundItems.findIndex((i) => i.domain === item.domain || i.url === item.url);
      if (existingIdx >= 0) {
        allFoundItems[existingIdx] = item;
      } else {
        allFoundItems.push(item);
      }

      renderTable();
      updateTgProfilesLive(item);
      updateEmailAccountsLive(item);
      updateDossierView();
    });

    activeEventSource.addEventListener("graph", (e) => {
      const graphData = JSON.parse(e.data);
      if (graphData && graphData.nodes) {
        nodesDataSet.clear();
        edgesDataSet.clear();
        nodesDataSet.add(graphData.nodes);
        edgesDataSet.add(graphData.edges);
        if (graphNodesCount) {
          graphNodesCount.textContent = `${graphData.nodes.length} узлов`;
        }
      }
    });

    activeEventSource.addEventListener("complete", (e) => {
      const data = JSON.parse(e.data);
      addLog(null, `Разведка завершена. Всего уникальных профилей: ${data.total_found}.`);
      if (btnSearch) btnSearch.disabled = false;
      if (btnStop) btnStop.style.display = "none";
      if (activeEventSource) {
        activeEventSource.close();
        activeEventSource = null;
      }
      if (network) network.fit();
      updateDossierView();
    });

    activeEventSource.onerror = () => {
      if (btnSearch) btnSearch.disabled = false;
      if (btnStop) btnStop.style.display = "none";
      if (activeEventSource) {
        activeEventSource.close();
        activeEventSource = null;
      }
    };
  }

  if (btnStop) {
    btnStop.addEventListener("click", async () => {
      if (activeEventSource) {
        activeEventSource.close();
        activeEventSource = null;
      }
      try {
        if (currentSessionId) {
          fetch(`/api/scan/${currentSessionId}/stop`, { method: "POST" });
        }
        fetch("/api/scan/stop-all", { method: "POST" });
      } catch (e) {}
      if (btnSearch) btnSearch.disabled = false;
      btnStop.style.display = "none";
      addLog(null, "Сканирование остановлено пользователем.");
      showToast("Разведка принудительно остановлена", "warning");
    });
  }

  if (btnSearch) {
    btnSearch.addEventListener("click", startScan);
  }

  if (inputUsername) {
    inputUsername.addEventListener("input", () => {
      if (btnSearch) {
        btnSearch.disabled = false;
        btnSearch.innerHTML = `<span class="btn-icon">🚀</span><span>Запустить разведку</span>`;
      }
    });
    inputUsername.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        if (btnSearch) btnSearch.disabled = false;
        startScan();
      }
    });
  }

  
  // EXTRA OSINT MODULES (Email, Phone, EXIF, Network, Dossier)
  // =========================================================================

  // 0. Email OSINT
  const emailInput = document.getElementById("email-input");
  const btnAnalyzeEmail = document.getElementById("btn-analyze-email");
  const btnScanEmailHolehe = document.getElementById("btn-scan-email-holehe");
  const emailResults = document.getElementById("email-results");
  const emailAccountsPanel = document.getElementById("email-accounts-panel");
  const emailAccountsBody = document.getElementById("email-accounts-body");
  const emailAccountsCount = document.getElementById("email-accounts-count");

  function renderEmailResults(data) {
    if (!data) return;
    if (emailResults) emailResults.style.display = "block";

    const provEl = document.getElementById("res-email-provider");
    if (provEl) provEl.innerHTML = `<span>${data.provider_icon || ''}</span> ${escapeHtml(data.provider || '—')}`;

    const domEl = document.getElementById("res-email-domain");
    if (domEl) domEl.textContent = data.domain || "—";

    const mxEl = document.getElementById("res-email-mx");
    if (mxEl) mxEl.textContent = (data.mx_records && data.mx_records.join(", ")) || "MX не найден";

    const dispEl = document.getElementById("res-email-disposable");
    if (dispEl) dispEl.textContent = data.is_disposable ? "⚠️ Временная почта (Disposable)" : "✅ Постоянный ящик";

    // Mail.ru existence
    const mailruEl = document.getElementById("res-email-mailru");
    if (mailruEl) {
      if (data.mailru_exists === true) {
        mailruEl.innerHTML = `<span style="color: #00f0b5; font-weight: 700;">✅ Зарегистрирован в экосистеме VK / Mail.ru</span>`;
      } else if (data.mailru_exists === false) {
        mailruEl.innerHTML = `<span style="color: var(--text-dim);">❌ Аккаунт Mail.ru не найден</span>`;
      } else {
        mailruEl.textContent = "—";
      }
    }

    // GitHub public commits
    const githubEl = document.getElementById("res-email-github");
    if (githubEl) {
      if (data.github_commits_count > 0) {
        githubEl.innerHTML = `<span style="color: #f43f5e; font-weight: 700;">⚠️ Обнаружено ${data.github_commits_count} публичных коммитов</span>`;
      } else {
        githubEl.innerHTML = `<span style="color: #00f0b5;">0 публичных коммитов</span>`;
      }
    }

    // Stealer & COMB breach check
    const breachEl = document.getElementById("res-email-breach");
    if (breachEl) {
      const bi = data.breach_intel || {};
      const isComp = Boolean(bi.is_compromised || bi.compromised);
      if (isComp) {
        let bText = "🔴 КОМПРОМЕТАЦИЯ";
        if (bi.stealers_count > 0) bText += ` (${bi.stealers_count} логов стиллера)`;
        if (bi.comb_matches > 0) bText += ` (${bi.comb_matches} записей COMB)`;
        breachEl.innerHTML = `<span style="color: #f43f5e; font-weight: 700;">${bText}</span>`;
      } else {
        breachEl.innerHTML = `<span style="color: #00f0b5;">🟢 Чисто (Стиллеры и COMB не обнаружены)</span>`;
      }
    }

    // Extracted Username Banner
    const extWrap = document.getElementById("email-extracted-wrap");
    const extVal = document.getElementById("email-extracted-val");
    if (data.username && extWrap && extVal) {
      extWrap.style.display = "flex";
      extVal.textContent = data.username;
    }

    // Gravatar
    const gravatarImg = document.getElementById("email-gravatar-img");
    const gravatarLink = document.getElementById("email-gravatar-link");
    if (data.gravatar) {
      if (gravatarImg) {
        gravatarImg.src = data.gravatar.avatar_url;
        gravatarImg.style.display = "inline-block";
      }
      if (gravatarLink) {
        gravatarLink.href = data.gravatar.profile_url;
      }
    }

    // Dorks
    const dorksList = document.getElementById("email-dorks-list");
    if (dorksList && data.dorks) {
      dorksList.innerHTML = data.dorks.map(d => `
        <div class="dork-item">
          <div>
            <div class="dork-title">${escapeHtml(d.title)}</div>
            <div class="dork-query">${escapeHtml(d.query)}</div>
          </div>
          <a href="${d.url}" target="_blank" class="dork-link">Искать в Google ↗</a>
        </div>
      `).join("");
    }

    // Discovered profiles pre-fill
    if (data.found_profiles && data.found_profiles.length > 0) {
      if (emailAccountsPanel) emailAccountsPanel.style.display = "block";
      if (emailAccountsCount) emailAccountsCount.textContent = `${data.found_profiles.length} найдено`;
      if (emailAccountsBody && (emailAccountsBody.innerHTML.includes("Ожидание") || emailAccountsBody.innerHTML.includes("Не найдены"))) {
        emailAccountsBody.innerHTML = data.found_profiles.map(acc => `
          <tr>
            <td><b>${escapeHtml(acc.site)}</b></td>
            <td><a href="${acc.url}" target="_blank" class="table-link">${escapeHtml(acc.url)} ↗</a></td>
            <td><span style="color: #38bdf8; font-family: monospace;">Подтвержденный профиль</span></td>
            <td><span class="tool-tag holehe">Подтверждено</span></td>
          </tr>
        `).join("");
      }
    }
  }

  async function handleEmailAnalyze(isBackground = false) {
    if (!emailInput) return;
    const email = emailInput.value.trim();
    if (!email) {
      if (!isBackground) showToast("Введите адрес электронной почты!", "error");
      return;
    }

    if (!isBackground && btnAnalyzeEmail) {
      btnAnalyzeEmail.disabled = true;
      btnAnalyzeEmail.innerHTML = `<span class="btn-icon">⏳</span><span>Анализ...</span>`;
    }

    try {
      const resp = await fetch("/api/tools/email", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const data = await resp.json();
      if (!data.success) {
        if (!isBackground) showToast(data.error || "Ошибка анализа email", "error");
        return;
      }

      latestEmailData = data;
      renderEmailResults(data);

      if (data.breach_intel) {
        latestBreachData = Object.assign(latestBreachData || {}, data.breach_intel, { query: data.email, extracted_username: data.username });
        renderBreachesResults(latestBreachData);
      }
      updateDossierView();

      if (!isBackground) {
        handleEmailHoleheScan(true);
        if (data.username && inputUsername) {
          inputUsername.value = data.username;
          if (!activeEventSource) {
            startScan();
          }
        }
      }
    } catch (err) {
      if (!isBackground) showToast(`Ошибка: ${err.message}`, "error");
    } finally {
      if (!isBackground && btnAnalyzeEmail) {
        btnAnalyzeEmail.disabled = false;
        btnAnalyzeEmail.innerHTML = `<span class="btn-icon">🔍</span><span>Анализ почты & MX</span>`;
      }
    }
  }

  async function handleEmailHoleheScan(isBackground = false) {
    if (!emailInput) return;
    const email = emailInput.value.trim();
    if (!email) {
      if (!isBackground) showToast("Введите адрес электронной почты!", "error");
      return;
    }

    if (!isBackground && btnScanEmailHolehe) {
      btnScanEmailHolehe.disabled = true;
      btnScanEmailHolehe.innerHTML = `<span class="btn-icon">⏳</span><span>Поиск в 120+ базах...</span>`;
    }

    if (emailAccountsPanel) emailAccountsPanel.style.display = "block";
    if (emailAccountsBody && !isBackground) {
      emailAccountsBody.innerHTML = `<tr><td colspan="4" class="table-empty-msg">⏳ Идет опрос 120+ сервисов через Holehe & базы РФ... Пожалуйста, подождите.</td></tr>`;
    }

    try {
      const resp = await fetch("/api/tools/email/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email })
      });
      const data = await resp.json();
      const accounts = data.accounts || [];

      // Combine Holehe accounts with discovered profiles from username correlation
      const allAccs = [...(latestEmailData?.found_profiles || [])];
      accounts.forEach(acc => {
        if (!allAccs.some(a => a.url === acc.url || a.site === acc.site)) {
          allAccs.push(acc);
        }
      });

      if (emailAccountsCount) emailAccountsCount.textContent = `${allAccs.length} найдено`;

      if (allAccs.length === 0) {
        if (emailAccountsBody) {
          emailAccountsBody.innerHTML = `<tr><td colspan="4" class="table-empty-msg">Аккаунты не найдены или сервисы вернули приватный статус</td></tr>`;
        }
      } else {
        if (emailAccountsBody) {
          emailAccountsBody.innerHTML = allAccs.map(acc => `
            <tr>
              <td><b>${escapeHtml(acc.site)}</b></td>
              <td><a href="${acc.url}" target="_blank" class="table-link">${escapeHtml(acc.url)} ↗</a></td>
              <td>${acc.details ? `<span style="color: #38bdf8; font-family: monospace;">${escapeHtml(acc.details)}</span>` : '<span style="color: #38bdf8; font-family: monospace;">Подтвержденный профиль</span>'}</td>
              <td><span class="tool-tag ${(acc.tools && acc.tools[0]) || acc.tool || 'holehe'}">Подтверждено</span></td>
            </tr>
          `).join("");
        }

        // Add confirmed hits to global items list
        allAccs.forEach(acc => {
          const item = {
            site: acc.site,
            category: acc.category || "runet",
            url: acc.url,
            domain: acc.domain || (acc.site.toLowerCase().replace(/[^a-z0-9]/g, "") + ".com"),
            tools: acc.tools || [acc.tool || "holehe"]
          };
          if (!allFoundItems.some(i => i.url === item.url || i.site === item.site)) {
            allFoundItems.push(item);
          }
        });
        renderTable();
        updateDossierView();
      }
    } catch (err) {
      if (!isBackground) showToast(`Ошибка Holehe: ${err.message}`, "error");
    } finally {
      if (!isBackground && btnScanEmailHolehe) {
        btnScanEmailHolehe.disabled = false;
        btnScanEmailHolehe.innerHTML = `<span class="btn-icon">⚡</span><span>Поиск аккаунтов (Holehe 120+)</span>`;
      }
    }
  }

  // Cross Recon Auto-Trigger button for Email
  const btnEmailAutoRecon = document.getElementById("btn-email-auto-recon");
  if (btnEmailAutoRecon) {
    btnEmailAutoRecon.addEventListener("click", () => {
      const email = (emailInput && emailInput.value.trim()) || "";
      if (!email) return showToast("Сначала введите email адрес!", "info");
      const usernamePart = email.split("@")[0].trim();
      if (!usernamePart) return showToast("Не удалось извлечь никнейм из email адреса!", "error");

      if (inputUsername) {
        inputUsername.value = usernamePart;
      }
      const tableTabBtn = document.querySelector('.tab-btn[data-tab="tab-table"]');
      if (tableTabBtn) tableTabBtn.click();
      const searchSec = document.getElementById("search-section");
      if (searchSec) searchSec.scrollIntoView({ behavior: "smooth" });
      setTimeout(() => {
        if (typeof startScan === "function") startScan();
      }, 200);
    });
  }

  if (btnAnalyzeEmail) btnAnalyzeEmail.addEventListener("click", () => handleEmailAnalyze(false));
  if (btnScanEmailHolehe) btnScanEmailHolehe.addEventListener("click", () => handleEmailHoleheScan(false));
  if (emailInput) {
    emailInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleEmailHoleheScan(false);
    });
  }

  // 1. Phone OSINT
  const phoneInput = document.getElementById("phone-input");
  const btnAnalyzePhone = document.getElementById("btn-analyze-phone");
  const phoneResults = document.getElementById("phone-results");

  function renderPhoneResults(data) {
    if (!data) return;
    if (phoneResults) phoneResults.style.display = "block";
    const setT = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val || "—"; };
    setT("res-phone-e164", data.e164);
    setT("res-phone-nat", data.national);
    setT("res-phone-carrier", data.carrier);
    setT("res-phone-loc", data.location);
    setT("res-phone-type", data.type);
    setT("res-phone-tz", (data.timezones && data.timezones.join(", ")));

    // Phone Breach Card
    const pBreachCard = document.getElementById("phone-breach-card");
    const pBreachBadge = document.getElementById("phone-breach-badge");
    const pBreachText = document.getElementById("phone-breach-text");
    if (pBreachCard && data.breach_intel) {
      pBreachCard.style.display = "block";
      const bi = data.breach_intel;
      if (bi.is_compromised || bi.compromised) {
        if (pBreachBadge) { pBreachBadge.textContent = "КОМПРОМЕТАЦИЯ"; pBreachBadge.className = "badge holehe"; }
        if (pBreachText) pBreachText.innerHTML = `<span style="color: #f43f5e; font-weight: 700;">🚨 Номер обнаружен в скомпрометированных дампах / логах стиллеров (${bi.stealers_count || 0} совпадений)!</span>`;
      } else {
        if (pBreachBadge) { pBreachBadge.textContent = "Чисто"; pBreachBadge.className = "badge"; }
        if (pBreachText) pBreachText.textContent = bi.message || "В открытых базах компрометации номер не обнаружен.";
      }
    }

    // Messengers
    const msgRow = document.getElementById("phone-messengers-row");
    if (msgRow && data.messengers) {
      msgRow.innerHTML = Object.entries(data.messengers).map(([k, v]) => `
        <a href="${v.url}" target="_blank" class="btn-messenger ${k === 'whatsapp' ? 'wa' : k === 'telegram' ? 'tg' : 'vb'}">
          <span>${v.icon}</span>
          <span>${v.title} ↗</span>
        </a>
      `).join("");
    }

    // Directories & Spam databases
    const dirRow = document.getElementById("phone-directories-row");
    if (dirRow && data.directories) {
      dirRow.innerHTML = data.directories.map(d => `
        <a href="${d.url}" target="_blank" class="btn-messenger tg" title="${escapeHtml(d.desc)}">
          <span>🛡️</span>
          <span>${escapeHtml(d.name)} ↗</span>
        </a>
      `).join("");
    }

    // Dorks
    const dorksList = document.getElementById("phone-dorks-list");
    if (dorksList && data.dorks) {
      dorksList.innerHTML = data.dorks.map(d => `
        <div class="dork-item">
          <div>
            <div class="dork-title">${escapeHtml(d.title)}</div>
            <div class="dork-query">${escapeHtml(d.query)}</div>
          </div>
          <a href="${d.url}" target="_blank" class="dork-link">Искать в Google ↗</a>
        </div>
      `).join("");
    }
  }

  async function handlePhoneSearch(isBackground = false) {
    if (!phoneInput) return;
    const phone = phoneInput.value.trim();
    if (!phone) {
      if (!isBackground) showToast("Введите номер телефона для анализа!", "error");
      return;
    }

    if (!isBackground && btnAnalyzePhone) {
      btnAnalyzePhone.disabled = true;
      btnAnalyzePhone.innerHTML = `<span class="btn-icon">⏳</span><span>Проверка...</span>`;
    }

    try {
      const resp = await fetch("/api/tools/phone", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone })
      });
      const data = await resp.json();
      if (!data.success) {
        if (!isBackground) showToast(data.error || "Ошибка анализа номера", "error");
        return;
      }

      latestPhoneData = data;
      renderPhoneResults(data);
      updateDossierView();
    } catch (err) {
      if (!isBackground) showToast(`Ошибка соединения: ${err.message}`, "error");
    } finally {
      if (!isBackground && btnAnalyzePhone) {
        btnAnalyzePhone.disabled = false;
        btnAnalyzePhone.innerHTML = `<span class="btn-icon">🔍</span><span>Проверить номер</span>`;
      }
    }
  }

  if (btnAnalyzePhone) btnAnalyzePhone.addEventListener("click", () => handlePhoneSearch(false));
  if (phoneInput) {
    phoneInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handlePhoneSearch(false);
    });
  }

  // 2. EXIF & Photo Analysis
  const exifDropzone = document.getElementById("exif-dropzone");
  const exifFileInput = document.getElementById("exif-file-input");
  const exifResults = document.getElementById("exif-results");

  if (exifDropzone && exifFileInput) {
    exifDropzone.addEventListener("click", () => exifFileInput.click());
    exifDropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      exifDropzone.classList.add("dragover");
    });
    exifDropzone.addEventListener("dragleave", () => exifDropzone.classList.remove("dragover"));
    exifDropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      exifDropzone.classList.remove("dragover");
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleExifFile(e.dataTransfer.files[0]);
      }
    });

    exifFileInput.addEventListener("change", () => {
      if (exifFileInput.files && exifFileInput.files.length > 0) {
        handleExifFile(exifFileInput.files[0]);
      }
    });
  }

  async function handleExifFile(file) {
    if (!file) return;

    // Show preview
    const reader = new FileReader();
    reader.onload = (e) => {
      const thumb = document.getElementById("exif-thumb");
      if (thumb) thumb.src = e.target.result;
    };
    reader.readAsDataURL(file);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const resp = await fetch("/api/tools/exif", {
        method: "POST",
        body: formData
      });
      const data = await resp.json();
      if (!data.success) {
        showToast(data.error || "Ошибка чтения EXIF", "error");
        return;
      }

      exifResults.style.display = "block";
      const info = data.info || {};
      const summary = info.summary || {};

      document.getElementById("res-exif-device").textContent = summary.device || "Не указано";
      document.getElementById("res-exif-date").textContent = summary.date_time || "Не указана";
      document.getElementById("res-exif-software").textContent = summary.software || "Не указано";
      document.getElementById("res-exif-dims").textContent = info.size_pixels || "—";

      // GPS card
      const gpsCard = document.getElementById("exif-gps-card");
      if (info.gps) {
        gpsCard.style.display = "block";
        document.getElementById("res-exif-coords").textContent = `📍 ${info.gps.coordinates}`;
        document.getElementById("btn-exif-yandex").href = info.gps.yandex_maps;
        document.getElementById("btn-exif-google").href = info.gps.google_maps;
      } else {
        gpsCard.style.display = "none";
      }

      // Tags table
      const tagsBody = document.getElementById("exif-tags-body");
      if (tagsBody) {
        const tags = info.tags || {};
        const entries = Object.entries(tags);
        if (entries.length === 0) {
          tagsBody.innerHTML = `<tr><td colspan="2" class="table-empty-msg">Метаданные очищены или отсутствуют</td></tr>`;
        } else {
          tagsBody.innerHTML = entries.map(([k, v]) => `
            <tr>
              <td><b>${escapeHtml(k)}</b></td>
              <td><code>${escapeHtml(String(v))}</code></td>
            </tr>
          `).join("");
        }
      }
    } catch (err) {
      showToast(`Ошибка отправки файла: ${err.message}`, "error");
    }
  }

  // 3. Network Recon (IP & Domain)
  const networkInput = document.getElementById("network-input");
  const btnAnalyzeNetwork = document.getElementById("btn-analyze-network");
  const networkResults = document.getElementById("network-results");

  async function handleNetworkSearch() {
    if (!networkInput) return;
    const query = networkInput.value.trim();
    if (!query) return showToast("Введите IP-адрес или домен!", "error");

    btnAnalyzeNetwork.disabled = true;
    btnAnalyzeNetwork.innerHTML = `<span class="btn-icon">⏳</span><span>Поиск...</span>`;

    try {
      const resp = await fetch("/api/tools/ip-domain", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query })
      });
      const data = await resp.json();
      if (!data.success) {
        showToast(data.error || "Ошибка исследования хоста", "error");
        return;
      }

      networkResults.style.display = "block";
      document.getElementById("res-net-ip").textContent = data.ip || "—";
      document.getElementById("res-net-host").textContent = data.hostname || "—";
      document.getElementById("res-net-country").textContent = `${data.country || '—'}${data.city ? ', ' + data.city : ''}`;
      document.getElementById("res-net-isp").textContent = data.isp || "—";
      document.getElementById("res-net-asn").textContent = data.asn || "—";
      document.getElementById("res-net-proxy").textContent = data.is_proxy ? "⚠️ Обнаружен Proxy / VPN" : "✅ Обычный IP (Не прокси)";

      const btnNetMap = document.getElementById("btn-net-map");
      if (btnNetMap) {
        if (data.maps_url) {
          btnNetMap.href = data.maps_url;
          btnNetMap.style.display = "inline-flex";
        } else {
          btnNetMap.style.display = "none";
        }
      }
    } catch (err) {
      showToast(`Ошибка сети: ${err.message}`, "error");
    } finally {
      btnAnalyzeNetwork.disabled = false;
      btnAnalyzeNetwork.innerHTML = `<span class="btn-icon">🌐</span><span>Исследовать</span>`;
    }
  }

  if (btnAnalyzeNetwork) btnAnalyzeNetwork.addEventListener("click", handleNetworkSearch);
  if (networkInput) {
    networkInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleNetworkSearch();
    });
  }

  // 4. Dossier Generator (Unified Autonomous Dossier)
  async function updateDossierView() {
    const targetNameEl = document.getElementById("dossier-target-name");
    const totalCountEl = document.getElementById("dossier-total-count");
    const footprintEl = document.getElementById("dossier-footprint-level");
    const dateEl = document.getElementById("dossier-date");
    const caseIdEl = document.getElementById("dossier-case-id");
    const catBreakdown = document.getElementById("dossier-categories-breakdown");
    const tableBodyEl = document.getElementById("dossier-table-body");
    const idListEl = document.getElementById("dossier-identities-list");
    const breachContentEl = document.getElementById("dossier-breach-content");
    const refreshBtn = document.getElementById("btn-refresh-dossier");

    let target = (inputUsername && inputUsername.value.trim()) || "";
    if (!target) {
      target = (latestTgData && latestTgData.username && `@${latestTgData.username}`) ||
               (latestEmailData && latestEmailData.email) ||
               (latestPhoneData && latestPhoneData.e164) ||
               (latestBreachData && latestBreachData.query) ||
               (tgInput && tgInput.value.trim()) ||
               (emailInput && emailInput.value.trim()) ||
               (breachesInput && breachesInput.value.trim()) ||
               (phoneInput && phoneInput.value.trim()) ||
               "Target";
      if (inputUsername && target !== "Target") {
        inputUsername.value = target;
      }
    }

    if (refreshBtn) {
      refreshBtn.disabled = true;
      refreshBtn.innerHTML = `<span>⏳</span><span>Синтез...</span>`;
    }

    // Immediate local baseline preview
    if (targetNameEl) targetNameEl.textContent = target;
    if (totalCountEl) totalCountEl.textContent = allFoundItems.length;
    if (dateEl) dateEl.textContent = new Date().toLocaleString();
    if (caseIdEl) caseIdEl.textContent = `CASE #${Math.abs(hashString(target)).toString(16).toUpperCase()}`;

    try {
      const resp = await fetch("/api/dossier/compile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          target: target,
          found_items: allFoundItems,
          email_data: latestEmailData,
          tg_data: latestTgData,
          telegram_data: latestTgData,
          breach_data: latestBreachData,
          phone_data: latestPhoneData
        })
      });
      const dossier = await resp.json();
      if (dossier.success) {
        if (targetNameEl) targetNameEl.textContent = dossier.target;
        if (totalCountEl) totalCountEl.textContent = dossier.total_found ?? dossier.total_count ?? allFoundItems.length;
        if (dateEl) dateEl.textContent = dossier.generated_at || new Date().toLocaleString();
        if (caseIdEl) caseIdEl.textContent = dossier.case_id || `CASE #${Math.abs(hashString(target)).toString(16).toUpperCase()}`;

        if (footprintEl) {
          footprintEl.textContent = dossier.footprint_level || "МИНИМАЛЬНЫЙ";
          const fStr = dossier.footprint_level || "";
          if (fStr.includes("Высокий") || fStr.includes("ВЫСОКИЙ") || fStr.includes("КРИТИЧЕСКИ")) {
            footprintEl.className = "info-card-value purple";
          } else if (fStr.includes("Средний") || fStr.includes("СРЕДНИЙ")) {
            footprintEl.className = "info-card-value amber";
          } else {
            footprintEl.className = "info-card-value cyan";
          }
        }

        // Identities badges
        if (idListEl && dossier.identities) {
          idListEl.innerHTML = dossier.identities.map(id => `
            <div style="background: rgba(15, 23, 42, 0.85); border: 1px solid rgba(56, 189, 248, 0.3); border-radius: 8px; padding: 6px 14px; font-size: 12px; display: inline-flex; align-items: center; gap: 8px;">
              <span style="color: var(--text-dim);">${escapeHtml(id.type)}:</span>
              <b style="color: #38bdf8; font-family: monospace;">${escapeHtml(id.val || id.value || '')}</b>
            </div>
          `).join("");
        }

        // Breach summary
        if (breachContentEl) {
          const bs = dossier.breach_summary || {};
          if (bs.stealer_infected || (bs.comb_matches && bs.comb_matches > 0)) {
            let bMsg = `
              <div style="color: #f43f5e; font-weight: 700; margin-bottom: 6px;">
                🚨 ВНИМАНИЕ: Зафиксирована компрометация учетных записей цели!
              </div>
              <div style="color: var(--text-secondary); font-size: 13px;">
            `;
            if (bs.stealers_count > 0) {
              bMsg += `Найдено заражений инфостиллерами: <b>${bs.stealers_count}</b>. Скомпрометировано сервисов: <b>${(bs.compromised_user_services || 0) + (bs.compromised_corporate_services || 0)}</b>.<br>`;
            }
            if (bs.comb_matches > 0) {
              bMsg += `Найдено записей в базе COMB 3.2B: <b>${bs.comb_matches}</b>.<br>`;
            }
            bMsg += `Статус угрозы: <b>${escapeHtml(bs.risk_level || 'Высокий')}</b>. Вердикт: <i>${escapeHtml(bs.verdict || '')}</i></div>`;
            breachContentEl.innerHTML = bMsg;
          } else if (bs.checked) {
            breachContentEl.innerHTML = `
              <div style="color: #00f0b5; font-weight: 600;">
                🟢 Проверка проведена: в публичных логах инфостиллеров (RedLine/Vidar) и реестре COMB совпадений не обнаружено.
              </div>
            `;
          } else {
            breachContentEl.innerHTML = `<div style="color: var(--text-dim);">Проверка утечек для цели не выполнялась. Запустите анализ во вкладке «Утечки баз».</div>`;
          }
        }

        // Categories breakdown
        const cats = dossier.categories || dossier.categories_breakdown;
        if (catBreakdown && cats) {
          catBreakdown.innerHTML = Object.entries(cats).map(([cat, c]) => `
            <span class="category-badge">${getCategoryTitle(cat)}: <b>${c}</b></span>
          `).join("") || `<span style="color: var(--text-dim); font-size: 13px;">Нет обнаруженных категорий</span>`;
        }

        // Table
        if (tableBodyEl) {
          const items = dossier.items || allFoundItems;
          if (items.length === 0) {
            tableBodyEl.innerHTML = `<tr><td colspan="4" class="table-empty-msg">Запустите разведку по цели, чтобы сформировать полное досье</td></tr>`;
          } else {
            tableBodyEl.innerHTML = items.map(item => `
              <tr>
                <td><b>${escapeHtml(item.site)}</b></td>
                <td><span class="category-badge">${getCategoryTitle(item.category)}</span></td>
                <td><a href="${item.url}" target="_blank" class="table-link">${escapeHtml(item.url)} ↗</a></td>
                <td>${(item.tools || [item.tool || "OSINT"]).map(t => `<span class="tool-tag ${t}">${t}</span>`).join("")}</td>
              </tr>
            `).join("");
          }
        }
      }
    } catch (err) {
      console.warn("Dossier compilation API fallback to local:", err);
    } finally {
      if (refreshBtn) {
        refreshBtn.disabled = false;
        refreshBtn.innerHTML = `<span>🔄</span><span>Обновить Досье</span>`;
      }
    }
  }

  const btnRefreshDossier = document.getElementById("btn-refresh-dossier");
  if (btnRefreshDossier) {
    btnRefreshDossier.addEventListener("click", updateDossierView);
  }

  function hashString(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash << 5) - hash + str.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }

  const btnPrintDossier = document.getElementById("btn-print-dossier");
  if (btnPrintDossier) {
    btnPrintDossier.addEventListener("click", () => {
      window.print();
    });
  }

  const btnDownloadJson = document.getElementById("btn-download-json");
  if (btnDownloadJson) {
    btnDownloadJson.addEventListener("click", () => {
      const target = (inputUsername && inputUsername.value.trim()) || "target";
      const dossierObj = {
        title: "KIberXuligan Intelligence Dossier",
        target: target,
        generated_at: new Date().toISOString(),
        total_found: allFoundItems.length,
        items: allFoundItems
      };
      const blob = new Blob([JSON.stringify(dossierObj, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `dossier_${target}.json`;
      a.click();
    });
  }

  // 5. Cross-Recon: Send Email username to Username Multi-Engine Recon
  const btnCrossRecon = document.getElementById("btn-cross-recon-username");
  if (btnCrossRecon) {
    btnCrossRecon.addEventListener("click", () => {
      const email = (emailInput && emailInput.value.trim()) || "";
      if (!email) return showToast("Сначала введите email адрес!", "info");
      const usernamePart = email.split("@")[0].trim();
      if (!usernamePart) return showToast("Не удалось извлечь никнейм из email адреса!", "error");

      if (inputUsername) {
        inputUsername.value = usernamePart;
      }

      // Switch tab to Table or Graph
      const tableTabBtn = document.querySelector('.tab-btn[data-tab="tab-table"]');
      if (tableTabBtn) tableTabBtn.click();

      // Scroll up to search section
      const searchSec = document.getElementById("search-section");
      if (searchSec) searchSec.scrollIntoView({ behavior: "smooth" });

      setTimeout(() => {
        if (typeof startScan === "function") startScan();
      }, 200);
    });
  }

  
  // =========================================================================
  // ADVANCED OSINT MODULES (Telegram, Face, Crypto, Auto, Breaches, Pivot)
  // =========================================================================

  // 6. Telegram OSINT
  const tgInput = document.getElementById("tg-input");
  const btnAnalyzeTg = document.getElementById("btn-analyze-tg");
  const tgResults = document.getElementById("tg-results");

  function renderTgResults(data) {
    if (!data) return;
    if (tgResults) tgResults.style.display = "block";

    const resTarget = document.getElementById("res-tg-target");
    if (resTarget) resTarget.textContent = data.username ? `@${data.username}` : `ID: ${data.id || data.target}`;

    const resType = document.getElementById("res-tg-type");
    if (resType) resType.textContent = data.type === "id" ? "Числовой Telegram ID" : "Юзернейм / Канал";

    const resTitle = document.getElementById("res-tg-title");
    if (resTitle) resTitle.textContent = data.title || "—";

    const resApp = document.getElementById("res-tg-app-link");
    if (resApp) {
      const appUrl = data.direct_app_url || (data.username ? `tg://resolve?domain=${data.username}` : "#");
      resApp.innerHTML = `<a href="${appUrl}" class="table-link" style="color: #38bdf8; font-weight: 700;">Открыть в Telegram Desktop ↗</a>`;
    }

    // Services row
    const srvRow = document.getElementById("tg-services-row");
    if (srvRow && data.links) {
      srvRow.innerHTML = data.links.map(l => `
        <a href="${l.url}" target="_blank" class="btn-messenger tg">
          <span>${l.icon}</span>
          <span>${escapeHtml(l.name)} ↗</span>
        </a>
      `).join("");
    }

    // Dorks
    const dorksList = document.getElementById("tg-dorks-list");
    if (dorksList && data.dorks) {
      dorksList.innerHTML = data.dorks.map(d => `
        <div class="dork-item">
          <div>
            <div class="dork-title">${escapeHtml(d.title)}</div>
            <div class="dork-query">${escapeHtml(d.query)}</div>
          </div>
          <a href="${d.url}" target="_blank" class="dork-link">Искать в Google ↗</a>
        </div>
      `).join("");
    }

    // InfoStealers & COMB status card
    const tgBreachCard = document.getElementById("tg-breach-card");
    const tgBreachBadge = document.getElementById("tg-breach-badge");
    const tgBreachText = document.getElementById("tg-breach-text");
    if (tgBreachCard && (data.breach_intel || data.comb_intel)) {
      tgBreachCard.style.display = "block";
      const bi = data.breach_intel || {};
      const ci = data.comb_intel || {};
      const isComp = Boolean(bi.is_compromised || bi.compromised || ci.found);

      if (isComp) {
        if (tgBreachBadge) {
          tgBreachBadge.textContent = "КОМПРОМЕТАЦИЯ";
          tgBreachBadge.className = "badge holehe";
        }
        let txt = "";
        if (bi.is_compromised || bi.compromised) {
          txt += `<div style="color: #f43f5e; font-weight: 700; margin-bottom: 4px;">🚨 Обнаружено совпадение в логах вредоносного ПО (InfoStealers)!</div>`;
          txt += `<div>Зафиксировано заражений: <b>${bi.stealers_count || 0}</b>. Скомпрометировано сервисов: <b>${(bi.total_user_services || bi.compromised_user_services || 0) + (bi.total_corporate_services || bi.compromised_corporate_services || 0)}</b>.</div>`;
        }
        if (ci.found) {
          txt += `<div style="margin-top: 6px; color: #f43f5e; font-weight: 700;">📑 Реестр компрометации COMB (3.2B): найдено ${ci.count} записей!</div>`;
          if (ci.linked_emails && ci.linked_emails.length > 0) {
            txt += `<div style="font-size: 12px; color: var(--text-secondary); margin-top: 2px;">Связанные email из дампов: <b>${ci.linked_emails.map(e => escapeHtml(e)).join(", ")}</b></div>`;
          }
        }
        if (tgBreachText) tgBreachText.innerHTML = txt;
      } else {
        if (tgBreachBadge) {
          tgBreachBadge.textContent = "Чисто";
          tgBreachBadge.className = "badge";
        }
        if (tgBreachText) {
          tgBreachText.textContent = bi.message || "В публичных логах инфостиллеров и реестре COMB компрометация не выявлена.";
        }
      }
    }

    // Linked emails from COMB leaks
    const linkedEmailsWrap = document.getElementById("tg-linked-emails-wrap");
    const linkedEmailsList = document.getElementById("tg-linked-emails-list");
    const linkedEmails = (data.comb_intel && data.comb_intel.linked_emails) || data.linked_emails || [];
    if (linkedEmailsWrap && linkedEmailsList) {
      if (linkedEmails.length > 0) {
        linkedEmailsWrap.style.display = "block";
        linkedEmailsList.innerHTML = linkedEmails.map(em => `
          <div style="background: rgba(15, 23, 42, 0.9); border: 1px solid rgba(244, 63, 94, 0.4); border-radius: 8px; padding: 6px 12px; display: inline-flex; align-items: center; gap: 8px; font-size: 12px;">
            <span style="color: #f43f5e;">✉️</span>
            <b style="color: #38bdf8; font-family: monospace;">${escapeHtml(em)}</b>
            <button class="graph-btn" style="padding: 2px 8px; font-size: 11px; margin-left: 4px;" onclick="if(document.getElementById('email-input')) document.getElementById('email-input').value = '${escapeHtml(em)}'; const eb = document.querySelector('.tab-btn[data-tab=\\'tab-email\\']'); if(eb) eb.click(); const ab = document.getElementById('btn-analyze-email'); if(ab) ab.click();">
              Проверить ↗
            </button>
          </div>
        `).join("");
      } else {
        linkedEmailsWrap.style.display = "none";
      }
    }

    // Discovered Profiles Table in Telegram tab
    const tgProfPanel = document.getElementById("tg-profiles-panel");
    const tgProfUser = document.getElementById("tg-profiles-user");
    const tgProfCount = document.getElementById("tg-profiles-count");
    const tgProfBody = document.getElementById("tg-profiles-body");

    if (tgProfPanel) tgProfPanel.style.display = "block";
    if (tgProfUser) tgProfUser.textContent = data.username ? `@${data.username}` : (data.target || "цель");

    const profiles = data.found_profiles || [];
    if (tgProfCount) tgProfCount.textContent = `${profiles.length} найдено`;

    if (tgProfBody) {
      if (profiles.length === 0) {
        tgProfBody.innerHTML = `<tr><td colspan="5" class="table-empty-msg">Идет автономный поиск профилей цели по 400+ сайтам...</td></tr>`;
      } else {
        tgProfBody.innerHTML = profiles.map(p => `
          <tr>
            <td><b>${escapeHtml(p.site)}</b></td>
            <td><span class="category-badge">${getCategoryTitle(p.category)}</span></td>
            <td><a href="${p.url}" target="_blank" class="table-link">${escapeHtml(p.url)} ↗</a></td>
            <td>${(p.tools || [p.tool || "OSINT"]).map(t => `<span class="tool-tag ${t}">${t}</span>`).join("")}</td>
            <td><span class="badge" style="background: rgba(0, 240, 181, 0.15); color: #00f0b5;">${escapeHtml(p.status || "Подтвержден")}</span></td>
          </tr>
        `).join("");
      }
    }

    // Also enrich global found items and graph
    if (profiles.length > 0) {
      profiles.forEach(p => {
        if (!allFoundItems.some(i => i.domain === p.domain || i.url === p.url)) {
          allFoundItems.push(p);
        }
      });
      renderTable();
    }
  }

  async function handleTgAnalyze(isBackground = false) {
    if (!tgInput) return;
    const target = tgInput.value.trim();
    if (!target) {
      if (!isBackground) showToast("Введите @username или Telegram ID!", "error");
      return;
    }

    if (!isBackground && btnAnalyzeTg) {
      btnAnalyzeTg.disabled = true;
      btnAnalyzeTg.innerHTML = `<span class="btn-icon">⏳</span><span>Разведка...</span>`;
    }

    try {
      const resp = await fetch("/api/tools/telegram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ target })
      });
      const data = await resp.json();
      if (!data.success) {
        if (!isBackground) showToast(data.error || "Ошибка анализа Telegram", "error");
        return;
      }

      latestTgData = data;
      renderTgResults(data);

      if (data.breach_intel) {
        latestBreachData = Object.assign(latestBreachData || {}, data.breach_intel, {
          query: data.username,
          extracted_username: data.username,
          comb_data: data.comb_intel,
          linked_emails: data.linked_emails
        });
        renderBreachesResults(latestBreachData);
      }
      updateDossierView();

      if (!isBackground && data.username) {
        if (inputUsername) inputUsername.value = data.username;
        if (!activeEventSource) {
          startScan();
        }
      }
    } catch (err) {
      if (!isBackground) showToast(`Ошибка: ${err.message}`, "error");
    } finally {
      if (!isBackground && btnAnalyzeTg) {
        btnAnalyzeTg.disabled = false;
        btnAnalyzeTg.innerHTML = `<span class="btn-icon">✈️</span><span>Разведка Telegram</span>`;
      }
    }
  }

  if (btnAnalyzeTg) btnAnalyzeTg.addEventListener("click", () => handleTgAnalyze(false));

  // Telegram Cross Recon Action
  const btnCrossReconTg = document.getElementById("btn-cross-recon-tg");
  if (btnCrossReconTg) {
    btnCrossReconTg.addEventListener("click", () => {
      const tgVal = tgInput ? tgInput.value.trim().replace(/^@/, "") : "";
      if (!tgVal) return showToast("Сначала введите юзернейм Telegram!", "error");
      if (inputUsername) inputUsername.value = tgVal;
      const tableTabBtn = document.querySelector('.tab-btn[data-tab="tab-table"]');
      if (tableTabBtn) tableTabBtn.click();
      const searchSec = document.getElementById("search-section");
      if (searchSec) searchSec.scrollIntoView({ behavior: "smooth" });
      setTimeout(() => {
        if (typeof startScan === "function") startScan();
      }, 200);
    });
  }

  if (tgInput) {
    tgInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleTgAnalyze(false);
    });
  }

  // 7. Face Recon & Reverse Image
  const faceDropzone = document.getElementById("face-dropzone");
  const faceFileInput = document.getElementById("face-file-input");
  const faceResults = document.getElementById("face-results");

  if (faceDropzone && faceFileInput) {
    faceDropzone.addEventListener("click", () => faceFileInput.click());
    faceDropzone.addEventListener("dragover", (e) => {
      e.preventDefault();
      faceDropzone.classList.add("dragover");
    });
    faceDropzone.addEventListener("dragleave", () => faceDropzone.classList.remove("dragover"));
    faceDropzone.addEventListener("drop", (e) => {
      e.preventDefault();
      faceDropzone.classList.remove("dragover");
      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
        handleFaceFile(e.dataTransfer.files[0]);
      }
    });

    faceFileInput.addEventListener("change", () => {
      if (faceFileInput.files && faceFileInput.files.length > 0) {
        handleFaceFile(faceFileInput.files[0]);
      }
    });
  }

  async function handleFaceFile(file) {
    if (!file) return;

    // Preview
    const reader = new FileReader();
    reader.onload = (e) => {
      const prev = document.getElementById("face-preview-img");
      if (prev) prev.src = e.target.result;
    };
    reader.readAsDataURL(file);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const resp = await fetch("/api/tools/face", {
        method: "POST",
        body: formData
      });
      const data = await resp.json();
      if (!data.success) {
        showToast(data.error || "Ошибка анализа изображения", "error");
        return;
      }

      if (faceResults) faceResults.style.display = "block";
      const resRes = document.getElementById("res-face-res");
      if (resRes) resRes.textContent = `${data.width} × ${data.height} px`;
      const resSize = document.getElementById("res-face-size");
      if (resSize) resSize.textContent = `${data.size_kb} KB (${data.format})`;
      const resDhash = document.getElementById("res-face-dhash");
      if (resDhash) resDhash.textContent = data.dhash || "—";
      const resSha = document.getElementById("res-face-sha256");
      if (resSha) resSha.textContent = data.sha256 || "—";

      // AI Forensics Banner
      const aiBanner = document.getElementById("face-ai-banner");
      const aiIcon = document.getElementById("face-ai-icon");
      const aiVerdict = document.getElementById("face-ai-verdict");
      const aiDetails = document.getElementById("face-ai-details");
      if (aiBanner && data.ai_forensics) {
        aiBanner.style.display = "flex";
        if (data.ai_forensics.is_ai) {
          aiBanner.style.background = "rgba(244, 63, 94, 0.15)";
          aiBanner.style.borderColor = "rgba(244, 63, 94, 0.5)";
          aiBanner.style.color = "#f43f5e";
          if (aiIcon) aiIcon.textContent = "🔴";
        } else if (data.ai_forensics.probability > 30) {
          aiBanner.style.background = "rgba(245, 158, 11, 0.15)";
          aiBanner.style.borderColor = "rgba(245, 158, 11, 0.5)";
          aiBanner.style.color = "#fbbf24";
          if (aiIcon) aiIcon.textContent = "⚠️";
        } else {
          aiBanner.style.background = "rgba(0, 240, 181, 0.1)";
          aiBanner.style.borderColor = "rgba(0, 240, 181, 0.3)";
          aiBanner.style.color = "#00f0b5";
          if (aiIcon) aiIcon.textContent = "🟢";
        }
        if (aiVerdict) aiVerdict.textContent = data.ai_forensics.verdict;
        if (aiDetails) aiDetails.textContent = data.ai_forensics.details;
      }

      // Biometrics & Detected Face Crop
      const resStatus = document.getElementById("res-face-status");
      if (resStatus) resStatus.textContent = data.face_status || "Готово";
      const resSharp = document.getElementById("res-face-sharpness");
      if (resSharp) resSharp.textContent = data.sharpness ? `${data.sharpness} (По Лапласиану)` : "—";

      const faceBadge = document.getElementById("face-detected-badge");
      if (faceBadge) {
        if (data.has_face) {
          faceBadge.style.display = "inline-block";
          faceBadge.textContent = `🎯 Найдено лиц: ${data.faces_count}`;
          faceBadge.style.background = "rgba(0, 240, 181, 0.85)";
        } else {
          faceBadge.style.display = "inline-block";
          faceBadge.textContent = "Лицо не обнаружено";
          faceBadge.style.background = "rgba(100, 116, 139, 0.85)";
        }
      }

      const cropWrap = document.getElementById("face-crop-container");
      const cropImg = document.getElementById("face-crop-img");
      const cropRes = document.getElementById("face-crop-res");
      if (cropWrap && cropImg) {
        if (data.face_crop) {
          cropWrap.style.display = "block";
          cropImg.src = data.face_crop;
          if (cropRes) cropRes.textContent = `${data.face_status}`;
        } else {
          cropWrap.style.display = "none";
        }
      }

      // EXIF & Forensic Metadata
      const exifCard = document.getElementById("face-exif-card");
      if (exifCard) {
        if (data.exif && data.exif.has_exif) {
          exifCard.style.display = "block";
          const dDev = document.getElementById("face-exif-device");
          if (dDev) dDev.textContent = data.exif.device || "Не указано";
          const dDate = document.getElementById("face-exif-date");
          if (dDate) dDate.textContent = data.exif.datetime || "Не указана";
          const dSoft = document.getElementById("face-exif-software");
          if (dSoft) dSoft.textContent = data.exif.software || "Не указано";
          const dArt = document.getElementById("face-exif-artist");
          if (dArt) dArt.textContent = data.exif.artist || "Не указан";

          // GPS
          const gpsCard = document.getElementById("face-gps-card");
          const gpsCoords = document.getElementById("face-gps-coords");
          const btnYan = document.getElementById("btn-face-yandex-maps");
          const btnGoo = document.getElementById("btn-face-google-maps");
          if (gpsCard) {
            if (data.exif.gps) {
              gpsCard.style.display = "block";
              if (gpsCoords) gpsCoords.textContent = data.exif.gps.coordinates;
              if (btnYan) btnYan.href = data.exif.gps.yandex_maps;
              if (btnGoo) btnGoo.href = data.exif.gps.google_maps;
            } else {
              gpsCard.style.display = "none";
            }
          }
        } else {
          exifCard.style.display = "none";
        }
      }

      // Author Cross Recon Button
      const authorWrap = document.getElementById("face-author-wrap");
      const authorName = document.getElementById("face-author-name");
      const btnAuthorRecon = document.getElementById("btn-face-cross-recon");
      if (authorWrap && authorName) {
        if (data.extracted_author) {
          authorWrap.style.display = "block";
          authorName.textContent = data.extracted_author;
          if (btnAuthorRecon) {
            btnAuthorRecon.onclick = () => {
              if (inputUsername) inputUsername.value = data.extracted_author;
              const tBtn = document.querySelector('.tab-btn[data-tab="tab-table"]');
              if (tBtn) tBtn.click();
              const sSec = document.getElementById("search-section");
              if (sSec) sSec.scrollIntoView({ behavior: "smooth" });
              setTimeout(() => { if (typeof startScan === "function") startScan(); }, 200);
            };
          }
        } else {
          authorWrap.style.display = "none";
        }
      }

      // Engines Matrix
      const engRow = document.getElementById("face-engines-row");
      if (engRow && data.engines) {
        engRow.innerHTML = data.engines.map(e => `
          <a href="${e.url}" target="_blank" class="btn-messenger wa" title="${escapeHtml(e.desc)}">
            <span>${e.icon}</span>
            <span>${escapeHtml(e.name)} ↗</span>
          </a>
        `).join("");
      }

      // Visual Recognition Tags
      const tagsContainer = document.getElementById("face-tags-container");
      const tagsRow = document.getElementById("face-tags-row");
      const tagsCount = document.getElementById("face-tags-count");
      if (tagsContainer && tagsRow) {
        const vTags = data.visual_tags || [];
        if (vTags.length > 0) {
          tagsContainer.style.display = "block";
          if (tagsCount) tagsCount.textContent = `${vTags.length} тегов`;
          tagsRow.innerHTML = vTags.map(t => `<span class="category-badge" style="font-size: 13px; padding: 6px 12px; background: rgba(6, 182, 212, 0.15); border: 1px solid rgba(6, 182, 212, 0.4); color: #38bdf8;">🏷️ ${escapeHtml(t)}</span>`).join("");
        } else {
          tagsContainer.style.display = "none";
        }
      }

      // Direct Web Matches Table
      const matchesBadge = document.getElementById("face-matches-badge");
      const matchesTableBody = document.getElementById("face-matches-table-body");
      if (matchesTableBody) {
        const matches = data.web_matches || [];
        if (matchesBadge) matchesBadge.textContent = `${matches.length} совпадений`;
        if (matches.length === 0) {
          matchesTableBody.innerHTML = `<tr><td colspan="3" class="table-empty-msg">Прямых открытых веб-страниц с этим файлом не обнаружено в индексе</td></tr>`;
        } else {
          matchesTableBody.innerHTML = matches.map(m => `
            <tr>
              <td><b style="color: var(--accent-cyan); font-family: monospace;">${escapeHtml(m.domain)}</b></td>
              <td>${escapeHtml(m.title)}</td>
              <td>
                <a href="${m.url}" target="_blank" class="action-btn-view" style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; font-size: 12px; text-decoration: none;">
                  <span>Открыть</span> <span>↗</span>
                </a>
              </td>
            </tr>
          `).join("");
          showToast(`Найдено ${matches.length} веб-совпадений для фото!`, "success");
        }
      }
    } catch (err) {
      showToast(`Ошибка распознавания: ${err.message}`, "error");
    }
  }

  // 7.1. ВКонтакте (VK) OSINT
  const vkInput = document.getElementById("vk-input");
  const btnAnalyzeVk = document.getElementById("btn-analyze-vk");
  const vkResults = document.getElementById("vk-results");

  async function handleVkAnalyze(isBackground = false) {
    if (!vkInput) return;
    const rawTarget = vkInput.value.trim();
    if (!rawTarget) {
      if (!isBackground) showToast("Введите VK ID, никнейм или ссылку на профиль!", "error");
      return;
    }

    if (!isBackground && btnAnalyzeVk) {
      btnAnalyzeVk.disabled = true;
      btnAnalyzeVk.innerHTML = `<span class="btn-icon">⏳</span><span>Разведка VK...</span>`;
    }

    try {
      const resp = await fetch("/api/tools/vk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: rawTarget })
      });
      const data = await resp.json();
      if (!data.success) {
        if (!isBackground) showToast(data.error || "Ошибка анализа ВКонтакте", "error");
        return;
      }

      if (vkResults) vkResults.style.display = "block";

      // Profile Info
      const vkAvatar = document.getElementById("vk-avatar");
      if (vkAvatar) {
        if (data.avatar) {
          vkAvatar.src = data.avatar;
          vkAvatar.style.display = "block";
        } else {
          vkAvatar.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Crect width='100' height='100' fill='%231e293b'/%3E%3Ctext x='50%25' y='50%25' dominant-baseline='middle' text-anchor='middle' font-size='32' fill='%2338bdf8'%3EVK%3C/text%3E%3C/svg%3E";
        }
      }

      const vkVerifiedBadge = document.getElementById("vk-verified-badge");
      if (vkVerifiedBadge) {
        vkVerifiedBadge.style.display = data.verified ? "inline-block" : "none";
      }

      const vkName = document.getElementById("vk-name");
      if (vkName) vkName.textContent = data.full_name || data.target;

      const vkStatus = document.getElementById("vk-status");
      if (vkStatus) vkStatus.textContent = data.status_text || "Статус отсутствует";

      const vkCity = document.getElementById("vk-city");
      if (vkCity) vkCity.textContent = data.city || "Не указан";

      const vkPosts = document.getElementById("vk-posts");
      if (vkPosts) vkPosts.textContent = data.posts_count || "0";

      const vkLink = document.getElementById("vk-link");
      if (vkLink) {
        vkLink.href = data.profile_url;
        vkLink.textContent = `vk.com/${data.target} ↗`;
      }

      // Grid
      const resTarget = document.getElementById("res-vk-target");
      if (resTarget) resTarget.textContent = `@${data.target}`;
      const resVer = document.getElementById("res-vk-verified");
      if (resVer) resVer.textContent = data.verified ? "Подтвержден (Галочка)" : "Обычный профиль";
      const resPosts = document.getElementById("res-vk-posts-count");
      if (resPosts) resPosts.textContent = data.posts_count || "0";
      const resLoc = document.getElementById("res-vk-location");
      if (resLoc) resLoc.textContent = data.city || "РФ / СНГ";

      // Leaks card
      const vkBreachBadge = document.getElementById("vk-breach-badge");
      const vkBreachText = document.getElementById("vk-breach-text");
      const comb = data.comb_intel || {};
      const hr = data.breach_intel || {};
      const isComp = Boolean(comb.found || hr.is_compromised || hr.compromised);

      if (vkBreachBadge) {
        if (isComp) {
          vkBreachBadge.textContent = "КОМПРОМЕТАЦИЯ";
          vkBreachBadge.className = "badge holehe";
        } else {
          vkBreachBadge.textContent = "Чисто";
          vkBreachBadge.className = "badge";
        }
      }

      if (vkBreachText) {
        let bHtml = "";
        if (comb.found) {
          bHtml += `<div style="color: #f43f5e; font-weight: 700;">📑 Реестр COMB (3.2B): найдено ${comb.count} записей паролей цели!</div>`;
          if (comb.linked_emails && comb.linked_emails.length > 0) {
            bHtml += `<div style="font-size: 12px; margin-top: 4px;">Связанные email: <b>${comb.linked_emails.join(", ")}</b></div>`;
          }
        }
        if (hr.is_compromised) {
          bHtml += `<div style="color: #f43f5e; font-weight: 700; margin-top: 4px;">🚨 Инфостиллеры: обнаружено заражений: ${hr.stealers_count || 0}</div>`;
        }
        if (!isComp) {
          bHtml = "В публичных логах инфостиллеров и реестре COMB 3.2B компрометация для данного логина не выявлена.";
        }
        vkBreachText.innerHTML = bHtml;
      }

      // Fast Links
      const linksRow = document.getElementById("vk-links-row");
      if (linksRow && data.links) {
        linksRow.innerHTML = data.links.map(l => `
          <a href="${l.url}" target="_blank" class="btn-messenger tg">
            <span>${l.icon}</span>
            <span>${escapeHtml(l.name)} ↗</span>
          </a>
        `).join("");
      }

      // Dorks
      const dorksList = document.getElementById("vk-dorks-list");
      if (dorksList && data.dorks) {
        dorksList.innerHTML = data.dorks.map(d => `
          <div class="dork-item">
            <div>
              <div class="dork-title">${escapeHtml(d.title)}</div>
              <div class="dork-query">${escapeHtml(d.query)}</div>
            </div>
            <a href="${d.url}" target="_blank" class="dork-link">Искать в Google ↗</a>
          </div>
        `).join("");
      }

      showToast(`Профиль VK @${data.target} успешно проанализирован!`, "success");
    } catch (err) {
      if (!isBackground) showToast(`Ошибка анализа VK: ${err.message}`, "error");
    } finally {
      if (!isBackground && btnAnalyzeVk) {
        btnAnalyzeVk.disabled = false;
        btnAnalyzeVk.innerHTML = `<span class="btn-icon">🟦</span><span>Разведка ВКонтакте</span>`;
      }
    }
  }

  if (btnAnalyzeVk) btnAnalyzeVk.addEventListener("click", () => handleVkAnalyze(false));
  if (vkInput) {
    vkInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleVkAnalyze(false);
    });
  }

  // 8. Crypto OSINT
  const cryptoInput = document.getElementById("crypto-input");
  const btnAnalyzeCrypto = document.getElementById("btn-analyze-crypto");
  const cryptoResults = document.getElementById("crypto-results");

  async function handleCryptoAnalyze() {
    if (!cryptoInput) return;
    const address = cryptoInput.value.trim();
    if (!address) return showToast("Введите адрес криптовалютного кошелька!", "error");

    if (btnAnalyzeCrypto) {
      btnAnalyzeCrypto.disabled = true;
      btnAnalyzeCrypto.innerHTML = `<span class="btn-icon">⏳</span><span>Проверка...</span>`;
    }

    try {
      const resp = await fetch("/api/tools/crypto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address })
      });
      const data = await resp.json();
      if (!data.success) {
        showToast(data.error || "Ошибка анализа кошелька", "error");
        return;
      }

      if (cryptoResults) cryptoResults.style.display = "block";
      const resCoin = document.getElementById("res-crypto-coin");
      if (resCoin) resCoin.innerHTML = `<span>${data.icon}</span> ${escapeHtml(data.name)}`;
      const resBal = document.getElementById("res-crypto-balance");
      if (resBal) resBal.textContent = data.balance || "0";
      const resTxs = document.getElementById("res-crypto-txs");
      if (resTxs) resTxs.textContent = `${data.tx_count} транзакций`;
      const resTot = document.getElementById("res-crypto-total");
      if (resTot) resTot.textContent = data.total_received || "—";

      // Explorers
      const expRow = document.getElementById("crypto-explorers-row");
      if (expRow && data.explorers) {
        expRow.innerHTML = data.explorers.map(e => `
          <a href="${e.url}" target="_blank" class="btn-messenger tg">
            <span>${e.icon}</span>
            <span>${escapeHtml(e.name)} ↗</span>
          </a>
        `).join("");
      }

      // AML
      const amlRow = document.getElementById("crypto-aml-row");
      if (amlRow && data.aml_links) {
        amlRow.innerHTML = data.aml_links.map(a => `
          <a href="${a.url}" target="_blank" class="btn-messenger vb">
            <span>${a.icon}</span>
            <span>${escapeHtml(a.name)} ↗</span>
          </a>
        `).join("");
      }
    } catch (err) {
      showToast(`Ошибка проверки кошелька: ${err.message}`, "error");
    } finally {
      if (btnAnalyzeCrypto) {
        btnAnalyzeCrypto.disabled = false;
        btnAnalyzeCrypto.innerHTML = `<span class="btn-icon">🪙</span><span>Проверить кошелек</span>`;
      }
    }
  }

  if (btnAnalyzeCrypto) btnAnalyzeCrypto.addEventListener("click", handleCryptoAnalyze);
  if (cryptoInput) {
    cryptoInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleCryptoAnalyze();
    });
  }

  // 9. Auto OSINT
  const autoInput = document.getElementById("auto-input");
  const btnAnalyzeAuto = document.getElementById("btn-analyze-auto");
  const autoResults = document.getElementById("auto-results");

  async function handleAutoAnalyze() {
    if (!autoInput) return;
    const query = autoInput.value.trim();
    if (!query) return showToast("Введите госномер РФ или VIN номер!", "error");

    if (btnAnalyzeAuto) {
      btnAnalyzeAuto.disabled = true;
      btnAnalyzeAuto.innerHTML = `<span class="btn-icon">⏳</span><span>Проверка...</span>`;
    }

    try {
      const resp = await fetch("/api/tools/auto", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query })
      });
      const data = await resp.json();
      if (!data.success) {
        showToast(data.error || "Ошибка анализа автомобиля", "error");
        return;
      }

      if (autoResults) autoResults.style.display = "block";
      const resQuery = document.getElementById("res-auto-query");
      if (resQuery) resQuery.textContent = data.plate || data.vin;
      const resRegion = document.getElementById("res-auto-region");
      if (resRegion) resRegion.textContent = data.region;
      const resCode = document.getElementById("res-auto-code");
      if (resCode) resCode.textContent = data.region_code ? `Код: ${data.region_code}` : (data.wmi || "—");
      const resCountry = document.getElementById("res-auto-country");
      if (resCountry) resCountry.textContent = data.country;

      // Links
      const linksRow = document.getElementById("auto-links-row");
      if (linksRow && data.links) {
        linksRow.innerHTML = data.links.map(l => `
          <a href="${l.url}" target="_blank" class="btn-messenger wa">
            <span>${l.icon}</span>
            <span>${escapeHtml(l.name)} ↗</span>
          </a>
        `).join("");
      }
    } catch (err) {
      showToast(`Ошибка проверки автомобиля: ${err.message}`, "error");
    } finally {
      if (btnAnalyzeAuto) {
        btnAnalyzeAuto.disabled = false;
        btnAnalyzeAuto.innerHTML = `<span class="btn-icon">🚗</span><span>Проверить автомобиль</span>`;
      }
    }
  }

  if (btnAnalyzeAuto) btnAnalyzeAuto.addEventListener("click", handleAutoAnalyze);
  if (autoInput) {
    autoInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleAutoAnalyze();
    });
  }

  // 10. Breaches Intelligence
  const breachesInput = document.getElementById("breaches-input");
  const btnAnalyzeBreaches = document.getElementById("btn-analyze-breaches");
  const breachesResults = document.getElementById("breaches-results");

  function renderBreachesResults(data) {
    if (!data) return;
    if (breachesResults) breachesResults.style.display = "block";

    // Alert Banner
    const banner = document.getElementById("breaches-alert-banner");
    const bannerIcon = document.getElementById("breaches-alert-icon");
    const bannerText = document.getElementById("breaches-alert-text");
    const stealersCard = document.getElementById("breaches-stealers-card");
    const stealersBody = document.getElementById("breaches-stealers-body");

    const isCompromised = Boolean(data.is_compromised || data.compromised || data.is_infected || (data.comb_data && data.comb_data.found));
    const stealersTotal = data.total_stealers || data.stealers_count || (data.stealers ? data.stealers.length : 0);
    const combTotal = (data.comb_data && data.comb_data.count) || data.comb_matches || 0;

    if (banner && bannerIcon && bannerText) {
      if (isCompromised) {
        banner.style.background = "rgba(244, 63, 94, 0.15)";
        banner.style.borderColor = "rgba(244, 63, 94, 0.5)";
        banner.style.color = "#f43f5e";
        bannerIcon.textContent = "🔴";
        let bMsg = `КРИТИЧЕСКИЙ РИСК: Обнаружена компрометация учетных записей цели!`;
        if (stealersTotal > 0) bMsg += ` Инфостиллеры: ${stealersTotal} заражений.`;
        if (combTotal > 0) bMsg += ` Реестр COMB: ${combTotal} скомпрометированных записей.`;
        bannerText.textContent = bMsg;

        if (stealersCard && stealersBody) {
          stealersCard.style.display = "block";
          let contentHtml = "";

          if (data.stealers && data.stealers.length > 0) {
            contentHtml += (data.stealers || []).map(s => `
              <div style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(244, 63, 94, 0.3); border-radius: 8px; padding: 12px; margin-bottom: 8px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                  <b style="color: #f43f5e;">Вредоносное ПО: ${escapeHtml(s.stealer_name || 'Generic Stealer')}</b>
                  <span style="font-family: monospace; color: var(--text-dim);">${escapeHtml(s.date_compromised || '')}</span>
                </div>
                <div style="font-size: 12px; color: var(--text-secondary);">
                  <div>Компьютер: <code>${escapeHtml(s.computer_name || 'UNKNOWN')}</code> | ОС: <code>${escapeHtml(s.operating_system || 'Windows')}</code></div>
                  <div>Путь к малвари: <code>${escapeHtml(s.malware_path || '—')}</code></div>
                  <div>Учетных записей пользователя: <b>${s.user_services_count || 0}</b> | Корпоративных учетных записей: <b>${s.corporate_services_count || 0}</b></div>
                </div>
              </div>
            `).join("");
          }

          if (data.comb_data && data.comb_data.lines && data.comb_data.lines.length > 0) {
            contentHtml += `
              <div style="background: rgba(15, 23, 42, 0.7); border: 1px solid rgba(244, 63, 94, 0.3); border-radius: 8px; padding: 12px; margin-top: 8px;">
                <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                  <b style="color: #f43f5e;">Реестр компрометации COMB (Compilation of Many Breaches - 3.2B)</b>
                  <span class="badge holehe">${data.comb_data.count} совпадений</span>
                </div>
                <div style="font-size: 12px; color: var(--text-secondary); margin-bottom: 6px;">
                  Скомпрометированные записи паролей/хэшей цели из дампов:
                </div>
                <div style="font-family: monospace; font-size: 11px; background: rgba(0,0,0,0.4); padding: 8px; border-radius: 4px; color: #fca5a5;">
                  ${data.comb_data.lines.map(l => escapeHtml(l)).join("<br>")}
                </div>
              </div>
            `;
          }

          stealersBody.innerHTML = contentHtml || "<div>Зафиксированы факты компрометации паролей и сессионных куки через вредоносное ПО.</div>";
        }
      } else {
        banner.style.background = "rgba(0, 240, 181, 0.1)";
        banner.style.borderColor = "rgba(0, 240, 181, 0.3)";
        banner.style.color = "#00f0b5";
        bannerIcon.textContent = "🟢";
        bannerText.textContent = "Проверка завершена. В публичных логах инфостиллеров (RedLine/Vidar) и реестре COMB компрометация не выявлена.";
        if (stealersCard) stealersCard.style.display = "none";
      }
    }

    // Extracted Username Correlation Wrap
    const corrWrap = document.getElementById("breaches-correlation-wrap");
    const extUser = document.getElementById("breaches-extracted-user");
    if (corrWrap && extUser) {
      if (data.extracted_username) {
        corrWrap.style.display = "block";
        extUser.textContent = data.extracted_username;
      } else {
        corrWrap.style.display = "none";
      }
    }

    // Verified Leaks Table
    const tbBody = document.getElementById("breaches-table-body");
    const bBadge = document.getElementById("breaches-status-badge");
    if (tbBody) {
      const dbList = data.verified_databases || data.known_leaks || [];
      if (bBadge) bBadge.textContent = `${dbList.length} источников проверено`;
      if (dbList.length === 0) {
        tbBody.innerHTML = `<tr><td colspan="4" class="table-empty-msg">Данные не найдены</td></tr>`;
      } else {
        tbBody.innerHTML = dbList.map(item => {
          const name = item.database || item.name;
          const size = item.size || item.records;
          const status = item.status || item.fields;
          const threat = item.threat_level || item.risk || "Информационный";
          const tagClass = threat === "Критический" ? "holehe" : (threat === "Высокий" ? "blackbird" : "sherlock");
          return `
            <tr>
              <td><b>${escapeHtml(name)}</b></td>
              <td><span class="category-badge">${escapeHtml(size)}</span></td>
              <td>${escapeHtml(status)}</td>
              <td><span class="tool-tag ${tagClass}">${escapeHtml(threat)}</span></td>
            </tr>
          `;
        }).join("");
      }
    }

    // Links row
    const linksRow = document.getElementById("breaches-links-row");
    if (linksRow && data.links) {
      linksRow.innerHTML = data.links.map(l => `
        <a href="${l.url}" target="_blank" class="btn-messenger tg">
          <span>${l.icon}</span>
          <span>${escapeHtml(l.name)} ↗</span>
        </a>
      `).join("");
    }

    // Dorks
    const dorksList = document.getElementById("breaches-dorks-list");
    if (dorksList && data.dorks) {
      dorksList.innerHTML = data.dorks.map(d => `
        <div class="dork-item">
          <div>
            <div class="dork-title">${escapeHtml(d.title)}</div>
            <div class="dork-query">${escapeHtml(d.query)}</div>
          </div>
          <a href="${d.url}" target="_blank" class="dork-link">Искать в Google ↗</a>
        </div>
      `).join("");
    }
  }

  async function handleBreachesAnalyze(isBackground = false) {
    if (!breachesInput) return;
    const query = breachesInput.value.trim();
    if (!query) {
      if (!isBackground) showToast("Введите Email, никнейм или телефон!", "error");
      return;
    }

    if (!isBackground && btnAnalyzeBreaches) {
      btnAnalyzeBreaches.disabled = true;
      btnAnalyzeBreaches.innerHTML = `<span class="btn-icon">⏳</span><span>Поиск утечек...</span>`;
    }

    try {
      const resp = await fetch("/api/tools/breaches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query })
      });
      const data = await resp.json();
      if (!data.success) {
        if (!isBackground) showToast(data.error || "Ошибка поиска утечек", "error");
        return;
      }

      latestBreachData = data;
      renderBreachesResults(data);
      updateDossierView();
    } catch (err) {
      if (!isBackground) showToast(`Ошибка проверки утечек: ${err.message}`, "error");
    } finally {
      if (!isBackground && btnAnalyzeBreaches) {
        btnAnalyzeBreaches.disabled = false;
        btnAnalyzeBreaches.innerHTML = `<span class="btn-icon">🔓</span><span>Проверить утечки</span>`;
      }
    }
  }

  // Cross Recon from Breaches
  const btnBreachesCrossRecon = document.getElementById("btn-breaches-cross-recon");
  if (btnBreachesCrossRecon) {
    btnBreachesCrossRecon.addEventListener("click", () => {
      const q = breachesInput ? breachesInput.value.trim() : "";
      const cleanUser = q.includes("@") ? q.split("@")[0].trim() : q.replace(/^@/, "").trim();
      if (!cleanUser) return showToast("Логин не найден!", "error");
      if (inputUsername) inputUsername.value = cleanUser;
      const tableTabBtn = document.querySelector('.tab-btn[data-tab="tab-table"]');
      if (tableTabBtn) tableTabBtn.click();
      const searchSec = document.getElementById("search-section");
      if (searchSec) searchSec.scrollIntoView({ behavior: "smooth" });
      setTimeout(() => {
        if (typeof startScan === "function") startScan();
      }, 200);
    });
  }

  if (btnAnalyzeBreaches) btnAnalyzeBreaches.addEventListener("click", () => handleBreachesAnalyze(false));
  if (breachesInput) {
    breachesInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") handleBreachesAnalyze(false);
    });
  }

  // 11. Cross-Pivot Chain Correlation Engine
  const btnRunPivot = document.getElementById("btn-run-pivot");
  const pivotResultsPanel = document.getElementById("pivot-results-panel");
  const pivotTableBody = document.getElementById("pivot-table-body");
  const pivotAvailableCount = document.getElementById("pivot-available-count");
  const pivotCurrentTarget = document.getElementById("pivot-current-target");

  function updatePivotSummary() {
    const curTarget = (inputUsername && inputUsername.value.trim()) || "Target";
    if (pivotCurrentTarget) pivotCurrentTarget.textContent = curTarget;
    if (pivotAvailableCount) pivotAvailableCount.textContent = allFoundItems.length;
  }

  async function handleRunPivot() {
    const target = (inputUsername && inputUsername.value.trim()) || "Target";
    if (allFoundItems.length === 0) {
      return showToast("Сначала запустите разведку по никнейму цели, чтобы обнаружить профили для построения цепочки!", "info");
    }

    if (btnRunPivot) {
      btnRunPivot.disabled = true;
      btnRunPivot.innerHTML = `<span class="btn-icon">⏳</span><span>Корреляция связей...</span>`;
    }

    try {
      const resp = await fetch("/api/tools/pivot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: target, found_items: allFoundItems })
      });
      const data = await resp.json();
      if (!data.success) {
        showToast(data.error || "Ошибка построения цепочки", "error");
        return;
      }

      if (pivotResultsPanel) pivotResultsPanel.style.display = "block";
      const nodes = data.nodes || [];
      const edges = data.edges || [];

      if (pivotTableBody) {
        if (nodes.length === 0) {
          pivotTableBody.innerHTML = `<tr><td colspan="4" class="table-empty-msg">Связанных сущностей второго порядка не извлечено</td></tr>`;
        } else {
          pivotTableBody.innerHTML = nodes.map(n => `
            <tr>
              <td><span class="category-badge">${escapeHtml(n.type)}</span></td>
              <td><b style="color: #38bdf8;">${escapeHtml(n.label)}</b></td>
              <td>Автоматическая корреляция из обнаруженных профилей</td>
              <td>
                <button class="graph-btn" style="padding: 4px 10px; font-size: 11px;" onclick="document.getElementById('email-input') && (document.getElementById('email-input').value = '${escapeHtml(n.value)}'); document.querySelector('.tab-btn[data-tab=\'tab-email\']') && document.querySelector('.tab-btn[data-tab=\'tab-email\']').click();">
                  Проверить OSINT ↗
                </button>
              </td>
            </tr>
          `).join("");
        }
      }

      // Add nodes and edges to graph network
      nodes.forEach(n => {
        if (!nodesDataSet.get(n.id)) {
          nodesDataSet.add({
            id: n.id,
            label: n.label,
            title: n.title,
            shape: "box",
            color: { background: "#1e1b4b", border: "#818cf8" },
            font: { color: "#ffffff", face: "Plus Jakarta Sans", size: 13 }
          });
        }
      });

      edges.forEach(e => {
        edgesDataSet.add({
          from: e.from,
          to: e.to,
          dashes: true,
          color: { color: "#818cf8" },
          label: e.label,
          font: { color: "#94a3b8", size: 10 }
        });
      });

      const nodesCountEl = document.getElementById("graph-nodes-count");
      if (nodesCountEl) nodesCountEl.textContent = `${nodesDataSet.length} узлов`;

      showToast(`Успешно извлечено ${nodes.length} новых связанных сущностей! Они добавлены на Граф связей.`, "success");

      // Switch to graph tab to show result
      const graphTabBtn = document.querySelector('.tab-btn[data-tab="tab-graph"]');
      if (graphTabBtn) graphTabBtn.click();

    } catch (err) {
      showToast(`Ошибка корреляции: ${err.message}`, "error");
    } finally {
      if (btnRunPivot) {
        btnRunPivot.disabled = false;
        btnRunPivot.innerHTML = `<span class="btn-icon">🧠</span><span>Собрать цепочку и обновить Граф</span>`;
      }
    }
  }

  if (btnRunPivot) btnRunPivot.addEventListener("click", handleRunPivot);

  // Tab switch listener hook to update pivot tab summary
  const pivotTabBtn = document.querySelector('.tab-btn[data-tab="tab-pivot"]');
  if (pivotTabBtn) {
    pivotTabBtn.addEventListener("click", updatePivotSummary);
  }

  // --------------------------------------------------------------------------
  // AUTO-RESTORATION ON PAGE RELOAD (F5) / SERVER RESTART
  // --------------------------------------------------------------------------
  async function restoreLatestScan() {
    try {
      const res = await fetch("/api/scan/latest");
      if (!res.ok) return;
      const data = await res.json();
      if (!data || !data.found || !data.items || data.items.length === 0) return;

      console.log("Restoring previous OSINT findings for:", data.target || data.username);
      if (inputUsername && !inputUsername.value) {
        inputUsername.value = data.target || data.username;
      }

      allFoundItems = data.items;

      // Recompute engine counts from restored records
      engineCounts = { maigret: 0, snoop: 0, sherlock: 0, blackbird: 0, nexfil: 0 };
      allFoundItems.forEach(item => {
        (item.tools || []).forEach(t => {
          const tLower = t.toLowerCase();
          if (engineCounts[tLower] !== undefined) {
            engineCounts[tLower]++;
          }
        });
      });

      // Update engine UI cards and counts
      ["maigret", "snoop", "sherlock", "blackbird", "nexfil"].forEach(t => {
        const countEl = document.getElementById(`count-${t}`);
        const badge = document.getElementById(`badge-status-${t}`);
        const card = document.getElementById(`card-${t}`);
        const progress = document.getElementById(`progress-${t}`);
        if (countEl) countEl.textContent = engineCounts[t] || 0;
        if (badge) {
          if (data.status && data.status[t] === "done") {
            badge.textContent = "Готово";
            badge.className = "engine-badge complete";
            if (card) { card.classList.remove("active"); card.classList.add("done"); }
            if (progress) progress.style.width = "100%";
          } else if (data.status && data.status[t] === "running") {
            badge.textContent = "Поиск...";
            badge.className = "engine-badge scanning";
            if (card) card.classList.add("active");
            if (progress) progress.style.width = "50%";
          }
        }
      });

      renderTable();

      // Restore graph nodes and edges
      if (data.graph && data.graph.nodes) {
        nodesDataSet.clear();
        edgesDataSet.clear();
        nodesDataSet.add(data.graph.nodes);
        edgesDataSet.add(data.graph.edges);
        if (graphNodesCount) {
          graphNodesCount.textContent = `${data.graph.nodes.length} узлов`;
        }
      }

      updateDossierView();
      if (typeof updatePivotSummary === "function") updatePivotSummary();

      if (data.is_active && data.session_id && data.session_id !== "restored") {
        addLog(null, `Восстановлено активное сканирование для "${data.target || data.username}"...`);
        if (btnSearch) {
          btnSearch.disabled = false;
          btnSearch.innerHTML = `<span class="btn-icon">⚡</span><span>Поиск идет...</span>`;
        }
        if (btnStop) btnStop.style.display = "inline-flex";
        connectStream(data.session_id);
      } else {
        if (btnSearch) {
          btnSearch.disabled = false;
          btnSearch.innerHTML = `<span class="btn-icon">🚀</span><span>Запустить разведку</span>`;
        }
        if (btnStop) btnStop.style.display = "none";
        addLog(null, `Восстановлены результаты разведки для "${data.target || data.username}" (${data.total_found} аккаунтов).`);
      }
    } catch (err) {
      console.warn("Could not restore previous scan:", err);
    }
  }

  initNetwork();
  restoreLatestScan();
});