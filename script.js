// ==========================================
// BELLISSIMA STUDIO - SUPABASE
// ==========================================

import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";


// ==========================================
// CONEXIÓN A SUPABASE
// ==========================================

const SUPABASE_URL =
  "https://gppdrkgtrwbnyrxwtasu.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_Kw6nLOiHqf_8exwxMBz1gQ_yvAWrriC";

const supabase =
  createClient(SUPABASE_URL, SUPABASE_KEY);


// ==========================================
// CONFIGURACIÓN
// ==========================================

const OPEN_HOUR = 10;
const CLOSE_HOUR = 17;
const CLOSE_MINUTE = 30;
const SLOT_MINUTES = 30;

const WHATSAPP_NUMBER = "18493301799";

let calendarDate = new Date();
let selectedDate = "";
let selectedTime = "";

const occupiedSlots = new Set();


// ==========================================
// FECHAS
// ==========================================

function pad(number) {
  return String(number).padStart(2, "0");
}

function dateKey(year, month, day) {
  return `${year}-${pad(month + 1)}-${pad(day)}`;
}

function parseDateKey(key) {
  const [year, month, day] =
    key.split("-").map(Number);

  return new Date(
    year,
    month - 1,
    day
  );
}

function todayKey() {
  const now = new Date();

  return dateKey(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  );
}

function formatDateLong(key) {
  const date = parseDateKey(key);

  return new Intl.DateTimeFormat(
    "es-DO",
    {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    }
  ).format(date);
}

function formatDateShort(key) {
  const date = parseDateKey(key);

  return new Intl.DateTimeFormat(
    "es-DO",
    {
      day: "2-digit",
      month: "2-digit",
      year: "numeric"
    }
  ).format(date);
}

function formatTime(hour, minute) {
  const suffix =
    hour >= 12 ? "PM" : "AM";

  const displayHour =
    hour % 12 || 12;

  return `${displayHour}:${pad(minute)} ${suffix}`;
}


// ==========================================
// HORARIOS
// ==========================================

function createSlotId(date, time) {
  return `${date}_${time}`;
}

function getTimeSlots() {
  const slots = [];

  const start =
    OPEN_HOUR * 60;

  const end =
    CLOSE_HOUR * 60 +
    CLOSE_MINUTE;

  for (
    let minutes = start;
    minutes <= end;
    minutes += SLOT_MINUTES
  ) {
    const hour =
      Math.floor(minutes / 60);

    const minute =
      minutes % 60;

    slots.push(
      formatTime(hour, minute)
    );
  }

  return slots;
}

function isBooked(date, time) {
  return occupiedSlots.has(
    createSlotId(date, time)
  );
}


// ==========================================
// COMPROBAR SI UNA HORA YA PASÓ
// ==========================================

function isTimePastToday(
  dateKeyValue,
  timeText
) {
  if (
    dateKeyValue !== todayKey()
  ) {
    return false;
  }

  const now = new Date();

  const match =
    timeText.match(
      /(\d+):(\d+) (AM|PM)/i
    );

  if (!match) {
    return false;
  }

  let hour =
    Number(match[1]);

  const minute =
    Number(match[2]);

  const suffix =
    match[3].toUpperCase();

  if (
    suffix === "PM" &&
    hour !== 12
  ) {
    hour += 12;
  }

  if (
    suffix === "AM" &&
    hour === 12
  ) {
    hour = 0;
  }

  return (
    hour < now.getHours() ||
    (
      hour === now.getHours() &&
      minute <= now.getMinutes()
    )
  );
}


// ==========================================
// CARGAR HORARIOS DE SUPABASE
// ==========================================

async function loadOccupiedSlots() {
  console.log(
    "Cargando horarios desde Supabase..."
  );

  try {
    const { data, error } =
      await supabase.rpc(
        "horarios_ocupados"
      );

    if (error) {
      throw error;
    }

    occupiedSlots.clear();

    if (Array.isArray(data)) {
      data.forEach(
        (reservation) => {
          if (
            reservation.fecha &&
            reservation.hora
          ) {
            occupiedSlots.add(
              createSlotId(
                reservation.fecha,
                reservation.hora
              )
            );
          }
        }
      );
    }

    console.log(
      "Supabase conectado correctamente."
    );

    console.log(
      "Horarios ocupados:",
      occupiedSlots.size
    );

  } catch (error) {
    console.error(
      "ERROR LEYENDO SUPABASE:",
      error
    );
  }
}


// ==========================================
// CALENDARIO
// ==========================================

function renderCalendar() {
  const monthEl =
    document.getElementById(
      "calendarMonth"
    );

  const daysEl =
    document.getElementById(
      "calendarDays"
    );

  if (!monthEl || !daysEl) {
    return;
  }

  const year =
    calendarDate.getFullYear();

  const month =
    calendarDate.getMonth();

  monthEl.textContent =
    new Intl.DateTimeFormat(
      "es-DO",
      {
        month: "long",
        year: "numeric"
      }
    ).format(calendarDate);

  daysEl.innerHTML = "";

  const firstDay =
    new Date(
      year,
      month,
      1
    ).getDay();

  const mondayIndex =
    (firstDay + 6) % 7;

  const daysInMonth =
    new Date(
      year,
      month + 1,
      0
    ).getDate();


  // Espacios antes del primer día
  for (
    let i = 0;
    i < mondayIndex;
    i++
  ) {
    const empty =
      document.createElement(
        "div"
      );

    empty.className =
      "calendar-day other-month";

    daysEl.appendChild(empty);
  }


  // Días del mes
  for (
    let day = 1;
    day <= daysInMonth;
    day++
  ) {
    const key =
      dateKey(
        year,
        month,
        day
      );

    const date =
      new Date(
        year,
        month,
        day
      );

    const weekday =
      date.getDay();

    const button =
      document.createElement(
        "button"
      );

    button.type = "button";

    button.className =
      "calendar-day";

    button.textContent =
      day;

    const past =
      key < todayKey();

    const sunday =
      weekday === 0;

    const availableSlots =
      getTimeSlots().filter(
        (time) =>
          !isBooked(
            key,
            time
          ) &&
          !isTimePastToday(
            key,
            time
          )
      );

    const full =
      availableSlots.length === 0;

    if (
      key === todayKey()
    ) {
      button.classList.add(
        "today"
      );
    }

    if (
      key === selectedDate
    ) {
      button.classList.add(
        "selected"
      );
    }

    if (
      availableSlots.length > 0 &&
      !past &&
      !sunday
    ) {
      button.classList.add(
        "has-slots"
      );
    }

    if (
      full ||
      past ||
      sunday
    ) {
      button.classList.add(
        "full"
      );
    }

    if (
      past ||
      sunday ||
      full
    ) {
      button.disabled =
        true;
    } else {
      button.addEventListener(
        "click",
        () => selectDate(key)
      );
    }

    daysEl.appendChild(
      button
    );
  }
}


// ==========================================
// SELECCIONAR FECHA
// ==========================================

function selectDate(key) {
  selectedDate = key;
  selectedTime = "";

  const dateInput =
    document.getElementById(
      "bkDate"
    );

  const timeInput =
    document.getElementById(
      "bkTime"
    );

  if (dateInput) {
    dateInput.value =
      key;
  }

  if (timeInput) {
    timeInput.value =
      "";
  }

  renderCalendar();
  renderTimeSlots();

  const selectedText =
    document.getElementById(
      "selectedDateText"
    );

  if (selectedText) {
    selectedText.textContent =
      `Fecha seleccionada: ${formatDateLong(key)}.`;
  }
}


// ==========================================
// MOSTRAR HORARIOS
// ==========================================

function renderTimeSlots() {
  const container =
    document.getElementById(
      "timeSlots"
    );

  if (!container) {
    return;
  }

  container.innerHTML = "";

  if (!selectedDate) {
    container.innerHTML =
      '<div class="time-empty">Primero selecciona una fecha.</div>';

    return;
  }

  const slots =
    getTimeSlots();

  slots.forEach(
    (time) => {
      const button =
        document.createElement(
          "button"
        );

      button.type =
        "button";

      button.className =
        "time-slot";

      button.textContent =
        time;

      const booked =
        isBooked(
          selectedDate,
          time
        );

      const past =
        isTimePastToday(
          selectedDate,
          time
        );

      if (
        booked ||
        past
      ) {
        button.disabled =
          true;

        button.title =
          booked
            ? "Horario ocupado"
            : "Horario pasado";

      } else {
        if (
          time === selectedTime
        ) {
          button.classList.add(
            "selected"
          );
        }

        button.addEventListener(
          "click",
          () => {
            selectedTime =
              time;

            const input =
              document.getElementById(
                "bkTime"
              );

            if (input) {
              input.value =
                time;
            }

            renderTimeSlots();
          }
        );
      }

      container.appendChild(
        button
      );
    }
  );
}


// ==========================================
// CAMBIAR MES
// ==========================================

function changeMonth(amount) {
  const newDate =
    new Date(
      calendarDate.getFullYear(),
      calendarDate.getMonth() + amount,
      1
    );

  const now =
    new Date();

  const currentMonth =
    new Date(
      now.getFullYear(),
      now.getMonth(),
      1
    );

  if (
    newDate < currentMonth
  ) {
    return;
  }

  calendarDate =
    newDate;

  renderCalendar();
}


// ==========================================
// RESERVAR
// ==========================================

async function enviarReserva() {
  const service =
    document.getElementById(
      "bkService"
    )?.value || "";

  const date =
    document.getElementById(
      "bkDate"
    )?.value || "";

  const time =
    document.getElementById(
      "bkTime"
    )?.value || "";

  const name =
    document.getElementById(
      "bkName"
    )?.value.trim() || "";

  const msgEl =
    document.getElementById(
      "bookingMsg"
    );


  // Validar
  if (
    !service ||
    !date ||
    !time ||
    !name
  ) {
    if (msgEl) {
      msgEl.textContent =
        "Completa servicio, fecha, hora y nombre para continuar.";

      msgEl.style.display =
        "block";
    }

    return;
  }


  // Comprobar disponibilidad otra vez
  await loadOccupiedSlots();

  if (
    isBooked(
      date,
      time
    )
  ) {
    if (msgEl) {
      msgEl.textContent =
        "Ese horario acaba de ser ocupado. Selecciona otro horario.";

      msgEl.style.display =
        "block";
    }

    selectedTime = "";

    const timeInput =
      document.getElementById(
        "bkTime"
      );

    if (timeInput) {
      timeInput.value = "";
    }

    renderCalendar();
    renderTimeSlots();

    return;
  }


  // Mostrar estado
  if (msgEl) {
    msgEl.textContent =
      "Registrando reserva...";

    msgEl.style.display =
      "block";
  }


  // ========================================
  // GUARDAR EN SUPABASE
  // ========================================

  console.log(
    "Guardando reserva en Supabase..."
  );

  const { error } =
    await supabase
      .from("reservas")
      .insert([
        {
          nombre: name,
          servicio: service,
          fecha: date,
          hora: time
        }
      ]);


  // ========================================
  // ERROR
  // ========================================

  if (error) {
    console.error(
      "ERROR AL RESERVAR:",
      error
    );

    // Horario duplicado
    if (
      error.code === "23505"
    ) {
      occupiedSlots.add(
        createSlotId(
          date,
          time
        )
      );

      selectedTime = "";

      const timeInput =
        document.getElementById(
          "bkTime"
        );

      if (timeInput) {
        timeInput.value = "";
      }

      renderCalendar();
      renderTimeSlots();

      if (msgEl) {
        msgEl.textContent =
          "Ese horario acaba de ser reservado por otra persona. Selecciona otro.";

        msgEl.style.display =
          "block";
      }

      return;
    }

    if (msgEl) {
      msgEl.textContent =
        "No se pudo registrar la reserva. Inténtalo nuevamente.";

      msgEl.style.display =
        "block";
    }

    return;
  }


  // ========================================
  // RESERVA GUARDADA
  // ========================================

  console.log(
    "RESERVA GUARDADA CORRECTAMENTE."
  );

  occupiedSlots.add(
    createSlotId(
      date,
      time
    )
  );

  renderCalendar();
  renderTimeSlots();


  // ========================================
  // MENSAJE DE WHATSAPP
  // ========================================

  const texto =
    `Hola, soy ${name}. 💅\n\n` +
    `Quiero agendar una cita en Bellissima Studio.\n\n` +
    `✨ Servicio: ${service}\n` +
    `📅 Fecha: ${formatDateShort(date)}\n` +
    `⏰ Hora: ${time}\n\n` +
    `Quedo pendiente de confirmación. ¡Gracias! 🤍`;


  // WhatsApp Web directo al chat
  const whatsappURL =
    `https://web.whatsapp.com/send?phone=${WHATSAPP_NUMBER}&text=${encodeURIComponent(texto)}`;


  if (msgEl) {
    msgEl.textContent =
      "Reserva registrada correctamente. Abriendo el chat de WhatsApp...";

    msgEl.style.display =
      "block";
  }


  // Abrir directamente WhatsApp Web
  window.location.href =
    whatsappURL;
}


// ==========================================
// FAQ
// ==========================================

function toggleFaq(btn) {
  const item =
    btn.closest(
      ".faq-item"
    );

  if (!item) {
    return;
  }

  const answer =
    item.querySelector(
      ".faq-a"
    );

  if (!answer) {
    return;
  }

  const isOpen =
    item.classList.contains(
      "open"
    );

  document
    .querySelectorAll(
      ".faq-item.open"
    )
    .forEach(
      (element) => {
        if (
          element !== item
        ) {
          element.classList.remove(
            "open"
          );

          const otherAnswer =
            element.querySelector(
              ".faq-a"
            );

          if (otherAnswer) {
            otherAnswer.style.maxHeight =
              null;
          }
        }
      }
    );

  if (isOpen) {
    item.classList.remove(
      "open"
    );

    answer.style.maxHeight =
      null;
  } else {
    item.classList.add(
      "open"
    );

    answer.style.maxHeight =
      answer.scrollHeight +
      "px";
  }
}


// ==========================================
// INICIAR
// ==========================================

async function iniciar() {
  renderCalendar();
  renderTimeSlots();

  await loadOccupiedSlots();

  renderCalendar();
  renderTimeSlots();
}


// ==========================================
// EVENTOS
// ==========================================

document.addEventListener(
  "DOMContentLoaded",
  () => {
    const prev =
      document.getElementById(
        "prevMonth"
      );

    const next =
      document.getElementById(
        "nextMonth"
      );

    if (prev) {
      prev.addEventListener(
        "click",
        () => changeMonth(-1)
      );
    }

    if (next) {
      next.addEventListener(
        "click",
        () => changeMonth(1)
      );
    }

    iniciar();
  }
);


// ==========================================
// FUNCIONES PARA EL HTML
// ==========================================

window.enviarReserva =
  enviarReserva;

window.toggleFaq =
  toggleFaq;