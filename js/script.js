/* =========================================================
   NFC · Presentación — Programación Móvil
   Lógica: navegación + lector NFC real (Web NFC API)
   ========================================================= */
(function () {
  "use strict";

  /* ---------- Referencias ---------- */
  const deck     = document.getElementById("deck");
  const slides   = Array.from(deck.querySelectorAll(".slide"));
  const prevBtn  = document.getElementById("prevBtn");
  const nextBtn  = document.getElementById("nextBtn");
  const dotsWrap = document.getElementById("dots");
  const progress = document.getElementById("progressBar");
  const curEl    = document.getElementById("curSlide");
  const totEl    = document.getElementById("totSlide");
  const controls = document.querySelector(".controls");
  const counter  = document.querySelector(".counter");

  let index = 0;
  const total = slides.length;
  let animating = false;

  /* ---------- Puntos indicadores ---------- */
  slides.forEach((s, i) => {
    const dot = document.createElement("button");
    dot.className = "dot" + (i === 0 ? " active" : "");
    dot.setAttribute("aria-label", "Ir a la diapositiva " + (i + 1));
    dot.addEventListener("click", () => goTo(i));
    dotsWrap.appendChild(dot);
  });
  const dots = Array.from(dotsWrap.children);
  totEl.textContent = total;

  /* ---------- Navegación ---------- */
  function render() {
    slides.forEach((s, i) => s.classList.toggle("active", i === index));
    dots.forEach((d, i) => d.classList.toggle("active", i === index));
    progress.style.width = (index / (total - 1)) * 100 + "%";
    curEl.textContent = index + 1;
    prevBtn.disabled = index === 0;
    nextBtn.disabled = index === total - 1;
    if (slides[index].dataset.title !== "Ejemplo práctico") resetSim();
  }

  function goTo(i) {
    if (animating || i < 0 || i > total - 1 || i === index) return;
    animating = true;
    index = i;
    render();
    setTimeout(() => (animating = false), 520);
  }
  const next = () => goTo(index + 1);
  const prev = () => goTo(index - 1);

  nextBtn.addEventListener("click", next);
  prevBtn.addEventListener("click", prev);

  /* ---------- Teclado físico ---------- */
  document.addEventListener("keydown", (e) => {
    if (["ArrowRight", "ArrowDown", " ", "PageDown"].includes(e.key)) {
      e.preventDefault(); next();
    } else if (["ArrowLeft", "ArrowUp", "PageUp"].includes(e.key)) {
      e.preventDefault(); prev();
    } else if (e.key === "Home") {
      goTo(0);
    } else if (e.key === "End") {
      goTo(total - 1);
    }
  });

  /* ---------- Gestos táctiles (swipe) ---------- */
  let touchX = 0, touchY = 0;
  deck.addEventListener("touchstart", (e) => {
    touchX = e.changedTouches[0].clientX;
    touchY = e.changedTouches[0].clientY;
  }, { passive: true });
  deck.addEventListener("touchend", (e) => {
    const dx = e.changedTouches[0].clientX - touchX;
    const dy = e.changedTouches[0].clientY - touchY;
    if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy)) {
      dx < 0 ? next() : prev();
    }
  }, { passive: true });

  /* ---------- Rueda del ratón (con freno) ---------- */
  let wheelLock = false;
  deck.addEventListener("wheel", (e) => {
    if (wheelLock || Math.abs(e.deltaY) < 28) return;
    wheelLock = true;
    e.deltaY > 0 ? next() : prev();
    setTimeout(() => (wheelLock = false), 750);
  }, { passive: true });

  /* ---------- Barra de navegación oculta ----------
     Se mantiene invisible para no robar espacio de visión.
     Reaparece solo si se acerca el cursor al borde inferior. */
  controls.classList.add("hidden");
  let hideTimer;
  function showControls() {
    clearTimeout(hideTimer);
    controls.classList.remove("hidden");
  }
  function scheduleHide() {
    clearTimeout(hideTimer);
    hideTimer = setTimeout(() => controls.classList.add("hidden"), 700);
  }
  window.addEventListener("mousemove", (e) => {
    if (e.clientY > window.innerHeight - 100) showControls();
    else if (!controls.classList.contains("hidden")) scheduleHide();
  });
  // En pantallas táctiles: un toque en la franja inferior la revela un momento
  window.addEventListener("touchstart", (e) => {
    if (e.touches[0].clientY > window.innerHeight - 100) {
      showControls();
      hideTimer = setTimeout(() => controls.classList.add("hidden"), 3500);
    }
  }, { passive: true });

  /* =======================================================
     PERMISOS FLUTTER — tabs Android / iOS
     ======================================================= */
  const permBtns   = document.querySelectorAll(".perm-btn");
  const permPanels = document.querySelectorAll(".perm-panel");
  permBtns.forEach((btn) => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.perm;
      permBtns.forEach((b) => b.classList.toggle("active", b === btn));
      permPanels.forEach((p) =>
        p.classList.toggle("active", p.dataset.permPanel === target)
      );
    });
  });

  /* =======================================================
     MODOS DE OPERACIÓN — pestañas interactivas
     ======================================================= */
  const modeTabs   = document.querySelectorAll(".mode-tab");
  const modePanels = document.querySelectorAll(".mode-panel");
  modeTabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const m = tab.dataset.mode;
      modeTabs.forEach((t) => t.classList.toggle("active", t === tab));
      modePanels.forEach((p) =>
        p.classList.toggle("active", p.dataset.panel === m)
      );
    });
  });

  /* =======================================================
     EJEMPLO PRÁCTICO — Lector NFC real (Web NFC API)
     ======================================================= */
  const sim         = document.querySelector(".sim");
  const runBtn      = document.getElementById("simRun");
  const resetBtn    = document.getElementById("simReset");
  const log         = document.getElementById("consoleLog");
  const ndefResult  = document.getElementById("ndefResult");
  const phoneScreen = document.getElementById("phoneScreen");
  const simMode     = document.getElementById("simMode");

  const NFC_SUPPORTED = (typeof window !== "undefined" && "NDEFReader" in window);

  let ndefReader = null;
  let abortCtrl  = null;
  let simTimers  = [];

  /* Indicador de modo: NFC real vs. demostración simulada */
  if (simMode) {
    if (NFC_SUPPORTED) {
      simMode.className = "sim-mode real";
      simMode.innerHTML =
        '<span class="dot-led"></span> Web NFC disponible — se leerán etiquetas físicas reales';
    } else {
      simMode.className = "sim-mode sim";
      simMode.innerHTML =
        '<span class="dot-led"></span> Web NFC no disponible aquí — se ejecutará una demostración simulada';
    }
  }
  if (runBtn) {
    runBtn.textContent = NFC_SUPPORTED ? "Escanear etiqueta NFC ⚡" : "Ver demostración ⚡";
  }

  function clearTimers() {
    simTimers.forEach((id) => clearTimeout(id));
    simTimers = [];
  }

  function stopScan() {
    if (abortCtrl) { try { abortCtrl.abort(); } catch (e) {} }
    abortCtrl = null;
    ndefReader = null;
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  }

  function resetSim() {
    if (!sim) return;
    clearTimers();
    stopScan();
    sim.classList.remove("active");
    log.innerHTML = '<p class="log-empty">Pulsa el botón para iniciar la lectura…</p>';
    ndefResult.hidden = true;
    ndefResult.innerHTML = "";
    phoneScreen.className = "phone-screen";
    phoneScreen.innerHTML = '<span class="phone-idle">Listo para escanear</span>';
    runBtn.disabled = false;
    runBtn.textContent = NFC_SUPPORTED ? "Escanear etiqueta NFC ⚡" : "Ver demostración ⚡";
  }

  function addLine(text, kind) {
    const empty = log.querySelector(".log-empty");
    if (empty) empty.remove();
    const line = document.createElement("div");
    line.className = "line" + (kind ? " " + kind : "");
    const icon = kind === "done" ? "✓" : (kind === "err" ? "✕" : ">");
    line.innerHTML = '<span class="arrow">' + icon + "</span>" + text;
    log.appendChild(line);
    log.scrollTop = log.scrollHeight;
    return line;
  }

  function setPhone(state, ico, txt) {
    phoneScreen.className = "phone-screen" + (state ? " " + state : "");
    if (ico) {
      phoneScreen.innerHTML =
        '<div><div class="ok-ico">' + ico + '</div>' +
        '<div class="ok-txt">' + txt + "</div></div>";
    }
  }

  /* ---- Decodificar un registro NDEF (real o de ejemplo) ---- */
  function decodeRecord(record) {
    let dec;
    try { dec = new TextDecoder(record.encoding || "utf-8"); }
    catch (e) { dec = new TextDecoder("utf-8"); }
    const bytes = record.data ? record.data.byteLength : 0;

    switch (record.recordType) {
      case "text":
        return { tnf: "0x01 · Well-Known", type: '"T" (Texto)',
                 payload: dec.decode(record.data),
                 note: "Idioma: " + (record.lang || "—"), bytes: bytes };
      case "url":
      case "absolute-url":
        return { tnf: "0x01 · Well-Known", type: '"U" (URI)',
                 payload: dec.decode(record.data), bytes: bytes };
      case "mime":
        return { tnf: "0x02 · MIME", type: record.mediaType || "mime",
                 payload: "[contenido binario · " + bytes + " bytes]", bytes: bytes };
      case "smart-poster":
        return { tnf: "0x01 · Well-Known", type: '"Sp" (Smart Poster)',
                 payload: "[poster con varios sub-registros]", bytes: bytes };
      case "empty":
        return { tnf: "0x00 · Empty", type: "—",
                 payload: "(registro vacío)", bytes: 0 };
      default: {
        let v;
        try { v = dec.decode(record.data); }
        catch (e) { v = "[" + bytes + " bytes]"; }
        return { tnf: "Externo / Otro", type: record.recordType,
                 payload: v, bytes: bytes };
      }
    }
  }

  function showRecords(message, serial) {
    ndefResult.innerHTML = "";
    const addRow = (k, v, payload) => {
      const r = document.createElement("div");
      r.className = "rec-row" + (payload ? " payload" : "");
      r.innerHTML = "<span>" + k + "</span><b>" + escapeHtml(v) + "</b>";
      ndefResult.appendChild(r);
    };
    if (serial) addRow("UID etiqueta", serial);
    message.records.forEach((rec, i) => {
      const d = decodeRecord(rec);
      addRow("Registro #" + (i + 1), d.type);
      addRow("TNF", d.tnf);
      addRow("Payload", d.payload, true);
      if (d.note) addRow("Detalle", d.note);
    });
    ndefResult.hidden = false;
  }

  /* ---- Lectura NFC REAL ---- */
  async function startRealScan() {
    resetSim();
    runBtn.disabled = true;
    runBtn.textContent = "Escaneando…";
    sim.classList.add("active");
    log.innerHTML = "";
    addLine("Web NFC detectado — inicializando lector…");

    try {
      ndefReader = new NDEFReader();
      abortCtrl = new AbortController();
      await ndefReader.scan({ signal: abortCtrl.signal });

      addLine("Permiso concedido — campo de RF activo a 13.56 MHz", "done");
      addLine("Acerca una etiqueta NFC a la parte trasera del teléfono…");
      setPhone("connected", "📡", "Buscando…");

      ndefReader.onreading = (event) => {
        const message = event.message;
        const serial  = event.serialNumber || "—";
        sim.classList.remove("active");
        addLine("¡Etiqueta detectada!  UID: " + serial, "done");
        addLine("Mensaje NDEF leído · " +
                message.records.length + " registro(s)", "done");
        showRecords(message, serial);
        setPhone("connected", "✓", "Etiqueta leída");
        runBtn.disabled = false;
        runBtn.textContent = "Escanear de nuevo ↻";
        stopScan(); // detener el lector hasta el próximo escaneo
      };

      ndefReader.onreadingerror = () => {
        addLine("No se pudo leer la etiqueta — vuelve a intentarlo", "err");
      };
    } catch (err) {
      sim.classList.remove("active");
      let msg;
      const name = err && err.name ? err.name : "Error";
      if (name === "NotAllowedError")
        msg = "Permiso denegado. Activa el NFC del teléfono y permite el acceso al recargar la página.";
      else if (name === "NotSupportedError")
        msg = "El dispositivo no tiene hardware NFC o está desactivado.";
      else if (name === "SecurityError")
        msg = "Web NFC requiere una conexión segura (HTTPS) o localhost.";
      else
        msg = "No se pudo iniciar el lector NFC (" + name + ").";
      addLine(msg, "err");
      addLine("Mostrando una demostración simulada como alternativa…");
      simTimers.push(setTimeout(runSimulation, 1000));
    }
  }

  /* ---- Demostración SIMULADA (escritorio / sin NFC) ---- */
  const sequence = [
    { t: 300,  text: "Generando campo de RF a 13.56 MHz…" },
    { t: 1000, text: "Etiqueta pasiva detectada — energizando por inducción" },
    { t: 1750, text: "Estableciendo enlace ISO/IEC 14443-A" },
    { t: 2450, text: "Solicitando mensaje NDEF a la etiqueta…" },
    { t: 3200, text: "NDEF recibido · 1 registro · 27 bytes", kind: "done" }
  ];

  function runSimulation() {
    clearTimers();
    sim.classList.add("active");
    log.innerHTML = "";
    addLine("[ modo demostración — datos de ejemplo ]");
    setPhone("connected", "📡", "Enlace activo");

    sequence.forEach((step) => {
      simTimers.push(setTimeout(
        () => addLine(step.text, step.kind), step.t));
    });

    simTimers.push(setTimeout(() => {
      addLine("Lectura completada — datos disponibles", "done");
      const ejemplo = {
        records: [{
          recordType: "url",
          data: new TextEncoder().encode("https://www.unicesar.edu.co")
        }]
      };
      showRecords(ejemplo, "04:A2:E1:7B:9C:55:80");
      setPhone("connected", "✓", "Etiqueta leída");
      runBtn.disabled = false;
      runBtn.textContent = NFC_SUPPORTED
        ? "Escanear de nuevo ↻" : "Repetir demostración ↻";
    }, 3900));
  }

  /* ---- Botón principal ---- */
  function onRun() {
    if (NFC_SUPPORTED) {
      startRealScan();
    } else {
      resetSim();
      runBtn.disabled = true;
      runBtn.textContent = "Procesando…";
      runSimulation();
    }
  }

  if (runBtn)   runBtn.addEventListener("click", onRun);
  if (resetBtn) resetBtn.addEventListener("click", resetSim);

  /* =======================================================
     NFC LAB — Prueba NFC Real (Slide 15)
     ======================================================= */

  /* ---- Verificación de requisitos ---- */
  (function checkReqs() {
    const ua = navigator.userAgent || "";
    const checks = {
      "req-https":   location.protocol === "https:" || location.hostname === "localhost" || location.hostname === "127.0.0.1",
      "req-android": /Android/i.test(ua),
      "req-chrome":  /Chrome\//.test(ua) && !/Edg\/|OPR\//.test(ua),
      "req-nfc":     "NDEFReader" in window
    };
    let allOk = true;
    for (const [id, ok] of Object.entries(checks)) {
      const pill = document.getElementById(id);
      if (!pill) continue;
      pill.classList.add(ok ? "ok" : "fail");
      if (!ok) allOk = false;
    }
    const statusEl = document.getElementById("reqStatus");
    if (statusEl) {
      statusEl.textContent = allOk
        ? "✓ Listo para lectura/escritura real"
        : "Web NFC requiere Android + Chrome + HTTPS";
      statusEl.className = "req-status " + (allOk ? "ready" : "blocked");
    }
  })();

  /* ---- Referencias al DOM del Lab ---- */
  const labVisual  = document.querySelector(".lab-visual");
  const labScreen  = document.getElementById("labScreen");
  const labWaves   = document.getElementById("labWaves");
  const labLog     = document.getElementById("labLog");
  const labResult  = document.getElementById("labResult");
  const labTs      = document.getElementById("labTs");
  const ltrUid     = document.getElementById("ltrUid");
  const ltrSize    = document.getElementById("ltrSize");
  const ltrRecords = document.getElementById("ltrRecords");
  const labReadBtn = document.getElementById("labReadBtn");
  const labStopBtn = document.getElementById("labStopBtn");
  const labClearBtn= document.getElementById("labClearBtn");
  const writeLog   = document.getElementById("writeLog");
  const writeResult= document.getElementById("writeResult");
  const writeResultTxt = document.getElementById("writeResultTxt");
  const writeBtn   = document.getElementById("writeBtn");
  const writeClearBtn  = document.getElementById("writeClearBtn");
  const writeContent   = document.getElementById("writeContent");
  const writeByteCount = document.getElementById("writeByteCount");
  const writeTagCap    = document.getElementById("writeTagCap");

  let labReader = null;
  let labAbort  = null;
  let labActive = false;

  /* ---- Tabs del Lab ---- */
  document.querySelectorAll(".lab-tab").forEach((tab) => {
    tab.addEventListener("click", () => {
      document.querySelectorAll(".lab-tab").forEach((t) => t.classList.toggle("active", t === tab));
      document.querySelectorAll(".lab-panel").forEach((p) => {
        p.classList.toggle("active", p.id === "lab" + tab.dataset.lab.charAt(0).toUpperCase() + tab.dataset.lab.slice(1));
      });
    });
  });

  /* ---- Tipo de escritura (URL / Texto) ---- */
  document.querySelectorAll(".wtype-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".wtype-btn").forEach((b) => b.classList.toggle("active", b === btn));
      if (writeContent) {
        writeContent.type  = btn.dataset.wtype === "url" ? "url" : "text";
        writeContent.placeholder = btn.dataset.wtype === "url"
          ? "https://unicesar.edu.co" : "Texto a almacenar en la etiqueta";
        updateByteCount();
      }
    });
  });

  /* ---- Contador de bytes en tiempo real ---- */
  function updateByteCount() {
    if (!writeContent || !writeByteCount) return;
    const val = writeContent.value || "";
    const bytes = new TextEncoder().encode(val).length;
    writeByteCount.textContent = bytes + " bytes";
    writeByteCount.style.color = bytes > 137 ? "#f06060" : "var(--faint)";
  }
  if (writeContent) {
    writeContent.addEventListener("input", updateByteCount);
    updateByteCount();
  }

  /* ---- Utilidades ---- */
  function labAddLine(container, text, kind) {
    const empty = container ? container.querySelector(".log-empty") : null;
    if (empty) empty.remove();
    if (!container) return;
    const div = document.createElement("div");
    div.className = "line" + (kind ? " " + kind : "");
    const icon = kind === "ok" ? "✓" : (kind === "err" ? "✕" : ">");
    div.innerHTML = '<span class="arrow">' + icon + "</span>" + text;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function toHex(byte) {
    return byte.toString(16).padStart(2, "0").toUpperCase();
  }

  function dataViewToHexBytes(dv, limit) {
    const bytes = [];
    if (!dv) return bytes;
    const n = Math.min(dv.byteLength, limit || dv.byteLength);
    for (let i = 0; i < n; i++) bytes.push(toHex(dv.getUint8(i)));
    return bytes;
  }

  function decodePayloadText(record) {
    try {
      const dv = record.data;
      if (!dv) return null;
      if (record.recordType === "text") {
        const enc = record.encoding || "utf-8";
        return new TextDecoder(enc).decode(dv);
      }
      if (record.recordType === "url" || record.recordType === "absolute-url") {
        return new TextDecoder("utf-8").decode(dv);
      }
      if (record.recordType === "mime") {
        if ((record.mediaType || "").startsWith("text/")) {
          return new TextDecoder("utf-8").decode(dv);
        }
        return "[binario: " + dv.byteLength + " bytes]";
      }
      // Intentar decodificar como UTF-8
      const decoded = new TextDecoder("utf-8").decode(dv);
      // Si parece legible, devolverlo; si no, hex
      return /[\x00-\x08\x0e-\x1f\x7f-\x9f]/.test(decoded)
        ? "[" + dv.byteLength + " bytes]"
        : decoded;
    } catch (e) {
      return record.data ? "[" + record.data.byteLength + " bytes]" : null;
    }
  }

  function tnfLabel(recordType) {
    const map = {
      "text":         "TNF:01 Well-Known · T",
      "url":          "TNF:01 Well-Known · U",
      "absolute-url": "TNF:03 Absolute-URI",
      "mime":         "TNF:02 MIME",
      "smart-poster": "TNF:01 Well-Known · Sp",
      "empty":        "TNF:00 Empty",
      "unknown":      "TNF:05 Unknown"
    };
    return map[recordType] || ("TNF:04 External · " + recordType);
  }

  /* ---- Render resultado técnico ---- */
  function renderLabResult(message, serial) {
    if (!labResult || !ltrUid || !ltrSize || !ltrRecords) return;

    ltrUid.textContent = serial ? "UID: " + serial : "UID: —";
    const totalBytes = message.records.reduce((s, r) => s + (r.data ? r.data.byteLength : 0), 0);
    ltrSize.textContent = message.records.length + " registro(s) · " + totalBytes + " B payload";
    ltrRecords.innerHTML = "";

    message.records.forEach((rec, idx) => {
      const div = document.createElement("div");
      div.className = "ltr-record";

      const payloadText = decodePayloadText(rec) || "";
      const hexBytes    = dataViewToHexBytes(rec.data, 20);
      const moreThan20  = rec.data && rec.data.byteLength > 20;

      div.innerHTML = `
        <div class="ltr-record-head">
          <span class="ltr-rtype">${rec.recordType || "unknown"}</span>
          <span class="ltr-rtnf">${tnfLabel(rec.recordType)}</span>
          <span class="ltr-rtnf" style="margin-left:auto">${rec.data ? rec.data.byteLength : 0} B</span>
        </div>
        <div class="ltr-payload">${payloadText || "—"}</div>
        <div class="ltr-hex">
          ${hexBytes.map((h, i) => `<span class="ltr-hex-b${i < 3 ? " hdr-byte" : ""}" title="offset ${i}">${h}</span>`).join("")}
          ${moreThan20 ? '<span class="ltr-hex-b" style="width:auto;padding:0 .3rem;color:var(--faint)">+' + (rec.data.byteLength - 20) + '</span>' : ""}
        </div>`;
      ltrRecords.appendChild(div);
    });

    labResult.hidden = false;
  }

  /* ---- Limpiar lab ---- */
  function resetLab() {
    if (labAbort) { try { labAbort.abort(); } catch(e) {} }
    labAbort = null; labReader = null; labActive = false;
    if (labVisual)  labVisual.classList.remove("scanning");
    if (labScreen)  { labScreen.className = "lab-screen"; labScreen.innerHTML = '<span class="lab-idle">Listo</span>'; }
    if (labLog)     labLog.innerHTML = '<p class="log-empty">Pulsa "Leer" y acerca una etiqueta NFC…</p>';
    if (labResult)  { labResult.hidden = true; if(ltrRecords) ltrRecords.innerHTML = ""; }
    if (labTs)      labTs.textContent = "—";
    if (labReadBtn) { labReadBtn.disabled = false; labReadBtn.textContent = "Iniciar lectura ⚡"; }
    if (labStopBtn) labStopBtn.disabled = true;
  }

  function resetWriteLog() {
    if (writeLog)    writeLog.innerHTML = '<p class="log-empty">Configura el contenido y pulsa Escribir…</p>';
    if (writeResult) writeResult.hidden = true;
    if (writeBtn)    { writeBtn.disabled = false; writeBtn.textContent = "Escribir en etiqueta ✎"; }
  }

  if (labClearBtn)   labClearBtn.addEventListener("click", resetLab);
  if (writeClearBtn) writeClearBtn.addEventListener("click", resetWriteLog);

  /* ---- Lectura NFC real ---- */
  async function startLabRead() {
    if (labActive) return;
    resetLab();
    labActive = true;
    if (labReadBtn) { labReadBtn.disabled = true; labReadBtn.textContent = "Escaneando…"; }
    if (labStopBtn) labStopBtn.disabled = false;
    if (labVisual)  labVisual.classList.add("scanning");

    const t0 = performance.now();
    labAddLine(labLog, "Inicializando NDEFReader…");

    try {
      labReader = new NDEFReader();
      labAbort  = new AbortController();
      await labReader.scan({ signal: labAbort.signal });

      labAddLine(labLog, "Campo RF activo a 13.56 MHz — aguardando tag…", "ok");
      if (labScreen) labScreen.innerHTML = '<div><div class="s-ok">📡</div><div class="s-txt">RF activo</div></div>';

      labReader.onreading = (event) => {
        const elapsed = ((performance.now() - t0) / 1000).toFixed(2) + "s";
        if (labTs) labTs.textContent = elapsed;
        if (labVisual) labVisual.classList.remove("scanning");

        const serial  = event.serialNumber || "—";
        const message = event.message;

        labAddLine(labLog, "Tag detectado — UID: <strong style='color:var(--accent)'>" + serial + "</strong>", "ok");
        labAddLine(labLog, "Protocolo: ISO 14443-A/B · " + message.records.length + " registro(s) NDEF leído(s)", "ok");
        labAddLine(labLog, "Tiempo de respuesta: " + elapsed);

        if (labScreen) {
          labScreen.className = "lab-screen ok";
          labScreen.innerHTML = '<div><div class="s-ok">✓</div><div class="s-txt">Tag leído</div></div>';
        }
        renderLabResult(message, serial);

        if (labReadBtn) { labReadBtn.disabled = false; labReadBtn.textContent = "Leer de nuevo ↻"; }
        if (labStopBtn) labStopBtn.disabled = true;
        labActive = false;
        try { labAbort.abort(); } catch(e) {}
      };

      labReader.onreadingerror = () => {
        labAddLine(labLog, "Error al leer la etiqueta — vuelve a intentarlo", "err");
      };

    } catch (err) {
      if (labVisual) labVisual.classList.remove("scanning");
      labActive = false;
      const name = (err && err.name) || "Error";
      const msgs = {
        NotAllowedError:  "Permiso denegado. Activa el NFC del dispositivo y recarga la página.",
        NotSupportedError:"NFC no disponible o desactivado en este dispositivo.",
        SecurityError:    "Requiere contexto seguro (HTTPS o localhost).",
        AbortError:       "Lectura cancelada por el usuario."
      };
      labAddLine(labLog, msgs[name] || "Error al iniciar NDEFReader (" + name + ")", "err");
      if (labReadBtn) { labReadBtn.disabled = false; labReadBtn.textContent = "Reintentar"; }
      if (labStopBtn) labStopBtn.disabled = true;
    }
  }

  function stopLabRead() {
    if (labAbort) { try { labAbort.abort(); } catch(e) {} }
    labAbort = null; labActive = false;
    if (labVisual) labVisual.classList.remove("scanning");
    if (labReadBtn) { labReadBtn.disabled = false; labReadBtn.textContent = "Iniciar lectura ⚡"; }
    if (labStopBtn) labStopBtn.disabled = true;
    labAddLine(labLog, "Lectura detenida por el usuario.");
  }

  if (labReadBtn) labReadBtn.addEventListener("click", startLabRead);
  if (labStopBtn) labStopBtn.addEventListener("click", stopLabRead);

  /* ---- Escritura NFC real ---- */
  async function writeToTag() {
    if (!writeContent || !writeBtn) return;
    const content = writeContent.value.trim();
    if (!content) {
      labAddLine(writeLog, "Introduce el contenido a escribir primero.", "err");
      return;
    }
    const activeType = document.querySelector(".wtype-btn.active");
    const wtype = activeType ? activeType.dataset.wtype : "url";

    // Limpiar estado anterior SIEMPRE antes de nuevo intento
    resetWriteLog();
    writeBtn.disabled = true;
    writeBtn.textContent = "Acerca el tag…";

    const bytes = new TextEncoder().encode(content).length;
    labAddLine(writeLog, "NDEFReader write inicializado…");
    labAddLine(writeLog, "Tipo: " + wtype.toUpperCase() + " · " + bytes + " bytes · mantén el tag fijo hasta confirmar");

    const writeAbort = new AbortController();
    // Timeout 20s — abortar si usuario no acerca tag
    const timeout = setTimeout(() => writeAbort.abort(), 20000);

    let written = false;
    try {
      const writer = new NDEFReader();
      const record = wtype === "url"
        ? { recordType: "url",  data: content }
        : { recordType: "text", data: content, lang: "es" };

      await writer.write({ records: [record] }, { signal: writeAbort.signal });
      written = true;

    } catch (err) {
      const name = (err && err.name) || "Error";

      // AbortError: puede ser timeout propio O éxito real con sesión cerrada por Android
      if (name === "AbortError") {
        if (written) {
          // Nada — éxito manejado abajo
        } else {
          // Timeout o tag retirado antes de escribir
          labAddLine(writeLog, "Tag retirado demasiado pronto o sin tag detectado — mantén el tag fijo hasta ver confirmación.", "err");
          writeBtn.disabled = false;
          writeBtn.textContent = "Reintentar ✎";
          clearTimeout(timeout);
          return;
        }
      } else {
        const msgs = {
          NotAllowedError:   "Permiso denegado — activa NFC y recarga.",
          NotSupportedError: "NFC no disponible o desactivado.",
          SecurityError:     "Requiere HTTPS o localhost.",
          NotReadableError:  "Tag de solo lectura o formato incompatible (usa NTAG213/215/216).",
        };
        labAddLine(writeLog, msgs[name] || "Error al escribir (" + name + ")", "err");
        writeBtn.disabled = false;
        writeBtn.textContent = "Reintentar ✎";
        clearTimeout(timeout);
        return;
      }
    }

    clearTimeout(timeout);

    // Confirmar éxito
    labAddLine(writeLog, "¡Escrito en tag NFC!", "ok");
    labAddLine(writeLog, bytes + " bytes · TNF 0x01 Well-Known · SR=1 · tipo " + wtype.toUpperCase(), "ok");
    if (writeTagCap) writeTagCap.textContent = bytes + " bytes escritos";
    if (writeResult) {
      writeResult.hidden = false;
      if (writeResultTxt)
        writeResultTxt.textContent = "✓ " + content.substring(0, 48) + (content.length > 48 ? "…" : "");
    }
    writeBtn.disabled = false;
    writeBtn.textContent = "Escribir de nuevo ↻";
  }

  if (writeBtn) writeBtn.addEventListener("click", writeToTag);

  /* ---------- Arranque ---------- */
  render();
})();
