// =====================================================================
// BELLISSIMA STUDIO — interacción de la página y reservas
// La página NO habla directo con la base de datos: todo pasa por la
// Edge Function, que valida y consulta el Google Calendar de Bellissima.
// =====================================================================

(() => {
  "use strict";

  // -------------------------------------------------------------------
  // CONFIGURACIÓN
  // -------------------------------------------------------------------
  const API = "https://gppdrkgtrwbnyrxwtasu.supabase.co/functions/v1/Google-calendar";
  const WHATSAPP = "18493301799";
  const TIME_ZONE = "America/Santo_Domingo";
  const DIAS_MAXIMOS = 60;               // igual que en la Edge Function
  const DIAS_ABIERTOS = [0, 1, 2, 3, 4, 5, 6]; // 0 = domingo

  const $ = (sel, el = document) => el.querySelector(sel);
  const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];

  // -------------------------------------------------------------------
  // NAVEGACIÓN
  // -------------------------------------------------------------------
  const nav = $("#nav");
  const menuToggle = $("#menuToggle");
  const navMenu = $("#navMenu");

  function setMenu(open) {
    menuToggle.setAttribute("aria-expanded", String(open));
    navMenu.classList.toggle("is-open", open);
    $(".sr-only", menuToggle).textContent = open ? "Cerrar menú" : "Abrir menú";
  }

  menuToggle.addEventListener("click", () => {
    setMenu(menuToggle.getAttribute("aria-expanded") !== "true");
  });
  navMenu.addEventListener("click", (e) => {
    if (e.target.closest("a")) setMenu(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") setMenu(false);
  });

  // Sombra del menú y botón flotante de WhatsApp según el scroll
  const waFloat = $("#waFloat");
  let bookingInView = false;

  function onScroll() {
    const y = window.scrollY;
    nav.classList.toggle("is-scrolled", y > 8);
    waFloat.classList.toggle("is-visible", y > 520 && !bookingInView);
  }
  window.addEventListener("scroll", onScroll, { passive: true });

  // -------------------------------------------------------------------
  // ANIMACIONES AL HACER SCROLL
  // -------------------------------------------------------------------
  if ("IntersectionObserver" in window) {
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          revealObserver.unobserve(entry.target);
        }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });

    $$(".reveal").forEach((el) => revealObserver.observe(el));

    // Oculta el botón flotante mientras se ve el formulario de reserva
    new IntersectionObserver(([entry]) => {
      bookingInView = entry.isIntersecting;
      onScroll();
    }, { threshold: 0.15 }).observe($("#reservar"));
  } else {
    $$(".reveal").forEach((el) => el.classList.add("is-visible"));
  }

  onScroll();

  // -------------------------------------------------------------------
  // LÍNEA DORADA ALREDEDOR DEL ARCO DE LA PORTADA
  // -------------------------------------------------------------------
  function sizeArchLine() {
    const svg = $(".arch-line");
    const box = $(".arch");
    if (!svg || !box) return;

    const gap = 14;
    const w = box.offsetWidth + gap * 2;
    const h = box.offsetHeight + gap;
    const r = w / 2;

    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    $("path", svg).setAttribute("d", `M1 ${h} V${r} A${r - 1} ${r - 1} 0 0 1 ${w - 1} ${r} V${h}`);
  }

  sizeArchLine();
  window.addEventListener("resize", sizeArchLine);

  // Año del pie de página
  $("#year").textContent = new Intl.DateTimeFormat("en", { year: "numeric", timeZone: TIME_ZONE }).format(new Date());

  // -------------------------------------------------------------------
  // FECHAS (siempre en hora de República Dominicana)
  // -------------------------------------------------------------------
  const pad = (n) => String(n).padStart(2, "0");

  function todayKey() {
    return new Intl.DateTimeFormat("en-CA", { timeZone: TIME_ZONE }).format(new Date());
  }

  function keyToUTC(key) {
    const [y, m, d] = key.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d, 12));
  }

  function addDays(key, days) {
    const d = keyToUTC(key);
    d.setUTCDate(d.getUTCDate() + days);
    return d.toISOString().slice(0, 10);
  }

  function longDate(key) {
    const text = new Intl.DateTimeFormat("es-DO", {
      weekday: "long", day: "numeric", month: "long", timeZone: "UTC",
    }).format(keyToUTC(key));
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  function shortDate(key) {
    return new Intl.DateTimeFormat("es-DO", {
      weekday: "short", day: "numeric", month: "short", timeZone: "UTC",
    }).format(keyToUTC(key));
  }

  function to12h(hhmm) {
    const [h, m] = hhmm.split(":").map(Number);
    return `${h % 12 || 12}:${pad(m)} ${h >= 12 ? "pm" : "am"}`;
  }

  function addMinutes(hhmm, minutes) {
    const [h, m] = hhmm.split(":").map(Number);
    const total = h * 60 + m + minutes;
    return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
  }

  const money = (n) => `RD$ ${Number(n).toLocaleString("en-US")}`;

  // -------------------------------------------------------------------
  // ESTADO DE LA RESERVA
  // -------------------------------------------------------------------
  const today = todayKey();
  const maxDate = addDays(today, DIAS_MAXIMOS);

  const state = {
    serviceId: "",
    serviceName: "",
    minutes: 0,
    price: 0,
    date: "",
    time: "",
    viewYear: Number(today.slice(0, 4)),
    viewMonth: Number(today.slice(5, 7)) - 1,
  };

  const el = {
    form: $("#bookingForm"),
    service: $("#bkService"),
    calMonth: $("#calMonth"),
    calDays: $("#calDays"),
    prev: $("#prevMonth"),
    next: $("#nextMonth"),
    slots: $("#slots"),
    slotsHint: $("#slotsHint"),
    name: $("#bkName"),
    phone: $("#bkPhone"),
    website: $("#bkWebsite"),
    submit: $("#bkSubmit"),
    msg: $("#formMsg"),
    success: $("#success"),
    successText: $("#successText"),
    successWhatsApp: $("#successWhatsApp"),
    bookAgain: $("#bookAgain"),
    sum: {
      service: $("#sumService"),
      duration: $("#sumDuration"),
      date: $("#sumDate"),
      time: $("#sumTime"),
      price: $("#sumPrice"),
    },
  };

  // -------------------------------------------------------------------
  // PASO 1: TRATAMIENTO
  // -------------------------------------------------------------------
  function setService(id) {
    const option = $$("option", el.service).find((o) => o.value === id);
    if (!option) return;

    el.service.value = id;
    state.serviceId = id;
    state.serviceName = option.textContent.trim();
    state.minutes = Number(option.dataset.min);
    state.price = Number(option.dataset.price);
    state.time = "";

    updateSummary();
    loadSlots();
  }

  el.service.addEventListener("change", () => setService(el.service.value));

  // Botones "Reservar" del menú de servicios
  $$(".svc-book").forEach((btn) => {
    btn.addEventListener("click", () => {
      setService(btn.dataset.service);
      $("#reservar").scrollIntoView({ behavior: "smooth", block: "start" });
      setTimeout(() => el.service.focus({ preventScroll: true }), 600);
    });
  });

  // -------------------------------------------------------------------
  // PASO 2: CALENDARIO
  // -------------------------------------------------------------------
  function renderCalendar(direction = 0) {
    const { viewYear: y, viewMonth: m } = state;
    const first = new Date(Date.UTC(y, m, 1, 12));

    const monthName = new Intl.DateTimeFormat("es-DO", { month: "long", timeZone: "UTC" }).format(first);
    el.calMonth.textContent = `${monthName.charAt(0).toUpperCase()}${monthName.slice(1)} ${y}`;

    const monthStart = `${y}-${pad(m + 1)}-01`;
    const nextMonthStart = addDays(`${y}-${pad(m + 1)}-01`, new Date(Date.UTC(y, m + 1, 0)).getUTCDate());
    el.prev.disabled = monthStart <= today.slice(0, 8) + "01";
    el.next.disabled = nextMonthStart > maxDate;

    const frag = document.createDocumentFragment();
    const leading = (first.getUTCDay() + 6) % 7; // semana empieza el lunes
    for (let i = 0; i < leading; i++) frag.appendChild(document.createElement("span"));

    const daysInMonth = new Date(Date.UTC(y, m + 1, 0)).getUTCDate();

    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${y}-${pad(m + 1)}-${pad(d)}`;
      const weekday = keyToUTC(key).getUTCDay();
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cal-day";
      btn.textContent = d;
      btn.dataset.date = key;
      btn.setAttribute("aria-label", longDate(key));

      const closed = key < today || key > maxDate || !DIAS_ABIERTOS.includes(weekday);
      btn.disabled = closed;
      if (key === today) btn.classList.add("is-today");
      if (key === state.date) {
        btn.classList.add("is-selected");
        btn.setAttribute("aria-pressed", "true");
      }
      frag.appendChild(btn);
    }

    el.calDays.replaceChildren(frag);

    if (direction) {
      el.calDays.style.setProperty("--dir", `${direction * 14}px`);
      el.calDays.classList.remove("is-changing");
      void el.calDays.offsetWidth; // reinicia la animación
      el.calDays.classList.add("is-changing");
    }
  }

  el.calDays.addEventListener("click", (e) => {
    const btn = e.target.closest(".cal-day");
    if (!btn || btn.disabled) return;
    state.date = btn.dataset.date;
    state.time = "";
    renderCalendar();
    updateSummary();
    loadSlots();
  });

  function changeMonth(step) {
    const d = new Date(Date.UTC(state.viewYear, state.viewMonth + step, 1));
    state.viewYear = d.getUTCFullYear();
    state.viewMonth = d.getUTCMonth();
    renderCalendar(step);
  }

  el.prev.addEventListener("click", () => changeMonth(-1));
  el.next.addEventListener("click", () => changeMonth(1));

  // -------------------------------------------------------------------
  // PASO 3: HORARIOS (vienen del servidor: Google Calendar + reservas)
  // -------------------------------------------------------------------
  let slotsRequest = 0;

  async function api(path, body) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);
    try {
      const res = await fetch(`${API}/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });
      let data = {};
      try { data = await res.json(); } catch { /* respuesta vacía */ }
      return { status: res.status, ok: res.ok && data.ok !== false, data };
    } catch {
      return { status: 0, ok: false, data: {} };
    } finally {
      clearTimeout(timer);
    }
  }

  function whatsappLink(text) {
    return `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(text)}`;
  }

  function slotsMessage(text, withWhatsApp = false, withRetry = false) {
    const box = document.createElement("div");
    box.className = "slots-empty";
    box.append(text);

    if (withRetry) {
      const retry = document.createElement("a");
      retry.href = "#";
      retry.textContent = "Intentar de nuevo";
      retry.addEventListener("click", (e) => { e.preventDefault(); loadSlots(); });
      box.append(" ", retry);
    }
    if (withWhatsApp) {
      const wa = document.createElement("a");
      wa.href = whatsappLink(`Hola, quiero reservar ${state.serviceName || "una cita"}${state.date ? ` para el ${longDate(state.date)}` : ""}.`);
      wa.target = "_blank";
      wa.rel = "noopener";
      wa.textContent = "Escríbenos por WhatsApp";
      box.append(withRetry ? " o " : " ", wa);
      box.append(".");
    }
    el.slots.replaceChildren(box);
  }

  async function loadSlots() {
    if (!state.serviceId || !state.date) {
      el.slotsHint.textContent = !state.serviceId
        ? "Primero elige un tratamiento."
        : "Ahora elige un día en el calendario.";
      el.slots.replaceChildren();
      return;
    }

    const id = ++slotsRequest;
    el.slotsHint.textContent = `Buscando horarios libres para ${longDate(state.date).toLowerCase()}…`;
    el.slots.replaceChildren(...Array.from({ length: 9 }, () => {
      const s = document.createElement("div");
      s.className = "slot-skeleton";
      return s;
    }));

    const { ok, data } = await api("availability", { date: state.date, serviceId: state.serviceId });
    if (id !== slotsRequest) return; // el usuario ya cambió de día o servicio

    if (!ok) {
      el.slotsHint.textContent = "No pudimos cargar la agenda.";
      slotsMessage(data.error ? `${data.error} ` : "Revisa tu conexión. ", true, true);
      return;
    }

    const slots = Array.isArray(data.slots) ? data.slots : [];
    if (!slots.length) {
      el.slotsHint.textContent = longDate(state.date);
      slotsMessage("No quedan horarios libres este día para este tratamiento. Prueba con otro día, o", true);
      return;
    }

    el.slotsHint.textContent = `${longDate(state.date)} · ${slots.length} horario${slots.length === 1 ? "" : "s"} libre${slots.length === 1 ? "" : "s"}`;

    el.slots.replaceChildren(...slots.map((time, i) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "slot";
      btn.style.setProperty("--i", i);
      btn.dataset.time = time;
      btn.textContent = to12h(time);
      btn.setAttribute("aria-pressed", String(time === state.time));
      return btn;
    }));
  }

  el.slots.addEventListener("click", (e) => {
    const btn = e.target.closest(".slot");
    if (!btn) return;
    state.time = btn.dataset.time;
    $$(".slot", el.slots).forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
    updateSummary();
    clearMessage();
  });

  // -------------------------------------------------------------------
  // RESUMEN
  // -------------------------------------------------------------------
  function setSummary(dd, value) {
    if (dd.textContent === value) return;
    dd.textContent = value;
    dd.classList.remove("is-updated");
    void dd.offsetWidth;
    dd.classList.add("is-updated");
  }

  function updateSummary() {
    setSummary(el.sum.service, state.serviceName || "—");
    setSummary(el.sum.duration, state.minutes ? `${state.minutes} min` : "—");
    setSummary(el.sum.date, state.date ? shortDate(state.date) : "—");
    setSummary(el.sum.time, state.time ? `${to12h(state.time)} – ${to12h(addMinutes(state.time, state.minutes))}` : "—");
    setSummary(el.sum.price, state.price ? money(state.price) : "—");

    const steps = $$(".step", el.form);
    steps[0].classList.toggle("is-done", !!state.serviceId);
    steps[1].classList.toggle("is-done", !!state.date);
    steps[2].classList.toggle("is-done", !!state.time);
    steps[3].classList.toggle("is-done", nameValid() && phoneValid());
  }

  // -------------------------------------------------------------------
  // PASO 4: DATOS
  // -------------------------------------------------------------------
  function phoneDigits() {
    let d = el.phone.value.replace(/\D/g, "");
    if (d.length === 11 && d.startsWith("1")) d = d.slice(1);
    return d;
  }
  const phoneValid = () => /^(809|829|849)\d{7}$/.test(phoneDigits());
  const nameValid = () => el.name.value.trim().length >= 2;

  el.phone.addEventListener("input", () => {
    const d = phoneDigits().slice(0, 10);
    const parts = [d.slice(0, 3), d.slice(3, 6), d.slice(6)].filter(Boolean);
    el.phone.value = parts.join("-");
    el.phone.removeAttribute("aria-invalid");
    updateSummary();
  });
  el.name.addEventListener("input", () => {
    el.name.removeAttribute("aria-invalid");
    updateSummary();
  });

  function showMessage(text, type = "error", link) {
    el.msg.className = `form-msg is-${type}`;
    el.msg.replaceChildren(text);
    if (link) {
      const a = document.createElement("a");
      a.href = link.href;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = link.text;
      el.msg.append(" ", a);
    }
  }
  const clearMessage = () => { el.msg.textContent = ""; el.msg.className = "form-msg"; };

  // -------------------------------------------------------------------
  // ENVIAR LA RESERVA
  // -------------------------------------------------------------------
  el.form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearMessage();

    if (!state.serviceId) return showMessage("Elige un tratamiento."), el.service.focus();
    if (!state.date) return showMessage("Elige un día en el calendario.");
    if (!state.time) return showMessage("Elige una hora.");
    if (!nameValid()) {
      el.name.setAttribute("aria-invalid", "true");
      el.name.focus();
      return showMessage("Escribe tu nombre y apellido.");
    }
    if (!phoneValid()) {
      el.phone.setAttribute("aria-invalid", "true");
      el.phone.focus();
      return showMessage("Escribe un WhatsApp dominicano válido, por ejemplo 809-555-1234.");
    }

    el.submit.classList.add("is-loading");
    el.submit.disabled = true;

    const { status, ok, data } = await api("book", {
      serviceId: state.serviceId,
      date: state.date,
      time: state.time,
      name: el.name.value.trim(),
      phone: phoneDigits(),
      website: el.website.value,
    });

    el.submit.classList.remove("is-loading");
    el.submit.disabled = false;

    if (ok && data.booking) return showSuccess(data.booking);

    if (status === 409) {
      state.time = "";
      updateSummary();
      loadSlots();
      return showMessage("Alguien acaba de reservar esa hora. Elige otra de la lista.");
    }

    const fallback = {
      href: whatsappLink(`Hola, quiero reservar ${state.serviceName} el ${longDate(state.date)} a las ${to12h(state.time)}.`),
      text: "Reservar por WhatsApp",
    };
    showMessage(status === 0 ? "No hay conexión con la agenda." : (data.error || "No se pudo completar la reserva."), "error", fallback);
  });

  function showSuccess(booking) {
    const firstName = el.name.value.trim().split(" ")[0];
    const date = longDate(booking.date);
    const time = to12h(booking.time);

    const strong = document.createElement("strong");
    strong.textContent = booking.service;
    el.successText.replaceChildren(
      `${firstName}, te esperamos para `, strong,
      ` el ${date.toLowerCase()} a las ${time}.`,
    );

    el.successWhatsApp.href = whatsappLink(
      `Hola, soy ${el.name.value.trim()}. Acabo de reservar desde la página:\n\n` +
      `✨ ${booking.service}\n📅 ${date}\n⏰ ${time}\n\n` +
      `¿Cómo hago el depósito de RD$ 500?`,
    );

    el.form.hidden = true;
    el.success.hidden = false;
    el.success.focus({ preventScroll: true });
    $("#bookingCard").scrollIntoView({ behavior: "smooth", block: "center" });
  }

  el.bookAgain.addEventListener("click", () => {
    state.date = "";
    state.time = "";
    el.success.hidden = true;
    el.form.hidden = false;
    renderCalendar();
    updateSummary();
    loadSlots();
    el.service.focus();
  });

  // -------------------------------------------------------------------
  // INICIO
  // -------------------------------------------------------------------
  el.service.value = "";
  renderCalendar();
  updateSummary();
  loadSlots();
})();
