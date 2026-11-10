/* ==========================================================================
   MÓDULO DE ACOMPAÑAMIENTO PSICOSOCIAL
   ========================================================================== */

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const H = (tag, atributos = {}, html = "") =>
  Object.assign(document.createElement(tag), atributos, { innerHTML: html });

const state = {
  sesion: null,
  profesionales: [],
  citas: [],
  conversaciones: [],
  chat: null,
  agenda: null,
  diario: { entradas: [], serie: [] },
  tests: [],
  testActual: null,
  lineas: [],
  tab: "citas",
};

/* ==========================================================================
   UTILIDADES
   ========================================================================== */

const esc = (s) =>
  String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

const fmtFecha = (texto) => {
  const [anio, mes, dia] = String(texto || "").split("-").map(Number);
  if (!anio || !mes || !dia) return String(texto || "");
  return new Date(Date.UTC(anio, mes - 1, dia)).toLocaleDateString("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
};

const fmtFechaHora = (texto) => {
  const [fecha, hora = ""] = String(texto || "").split("T");
  return `${fmtFecha(fecha)} · ${hora.slice(0, 5)}`;
};

const estadoTexto = {
  pendiente: "Pendiente de confirmación",
  confirmada: "Confirmada",
  completada: "Completada",
  cancelada: "Cancelada",
};

const aviso = (mensaje, error = false) => {
  const caja = $("#avisoModulo");
  caja.textContent = mensaje;
  caja.style.color = error ? "#b3361a" : "";
  if (mensaje) {
    caja.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
};

const vacio = (texto) => `<div class="vacio">${esc(texto)}</div>`;

const cargarLineas = async () => {
  try {
    state.lineas = await api("/api/lineas-ayuda");
  } catch (e) {
    state.lineas = [];
  }

  const grid = $("#lineasAyuda");
  const modal = $("#lineasModal");
  if (!grid || !modal) return;

  grid.innerHTML = "";
  modal.innerHTML = "";

  if (!state.lineas.length) {
    grid.innerHTML = vacio("No se pudieron cargar las líneas de atención.");
    return;
  }

  state.lineas.forEach((linea) => {
    const numero = String(linea.numero || "").replace(/\s+/g, "");

    const card = H("article", { className: "card line-card" }, `
      <div class="ico" aria-hidden="true">📞</div>
      <h3></h3>
      <p class="etq"></p>
      <p class="linea-desc"></p>
      <p class="hint"></p>
      <div class="push">
        <a class="tel linea-tel" href="tel:${esc(numero)}"></a>
      </div>
    `);

    card.querySelector("h3").textContent = linea.nombre;
    card.querySelector(".etq").textContent = linea.categoria || "Atención";
    card.querySelector(".linea-desc").textContent = linea.descripcion || "";
    card.querySelector(".hint").textContent = linea.horario || "";
    const enlace = card.querySelector(".linea-tel");
    enlace.textContent = "📞 " + linea.numero;
    enlace.setAttribute("aria-label", `Llamar a ${linea.nombre}`);
    grid.appendChild(card);

    modal.appendChild(
      H("a", {
        className: "emergency-line",
        href: `tel:${numero}`,
        innerHTML: `<strong>${esc(linea.nombre)}</strong><span>${esc(linea.descripcion || "")}</span><b>${esc(linea.numero)}</b>`,
      }),
    );
  });
};

/* ==========================================================================
   SESIÓN Y NAVEGACIÓN
   ========================================================================== */

const mostrarSesion = (sesion) => {
  const nombre = $("#nombreSesion");
  const salir = $("#salir");

  if (!sesion) {
    nombre.hidden = true;
    salir.hidden = true;
    return;
  }

  nombre.hidden = false;
  salir.hidden = false;
  nombre.textContent = "Hola, " + sesion.nombre;
  salir.onclick = async () => {
    await Sesion.cerrar();
    location.href = "Bajo_la_sombrilla.html";
  };
};

const cambiarTab = (tab) => {
  state.tab = tab;

  $$("[data-tab]").forEach((boton) => {
    const activo = boton.dataset.tab === tab;
    boton.setAttribute("aria-pressed", activo);
    boton.classList.toggle("alt", !activo);
    $("#tab-" + boton.dataset.tab).hidden = !activo;
  });

  if (tab === "chat") {
    cargarConversaciones()
      .then(() => {
        if (!state.chat) {
          abrirConversacion(crearConversacionPrueba()).catch(() => {});
        }
      })
      .catch(() => {});
  }
  if (tab === "diario") {
    cargarDiario().catch(() => {});
    setTimeout(dibujarGrafico, 30);
  }
  if (tab === "tests") cargarTests().catch(() => {});
  if (tab === "ayuda") cargarLineas();
};

$$("[data-tab]").forEach((boton) => {
  boton.onclick = () => cambiarTab(boton.dataset.tab);
});

$("#burger").onclick = () => {
  const abierto = $("#mm").classList.toggle("open");
  $("#burger").setAttribute("aria-expanded", abierto);
};

$$("#mm a").forEach((enlace) => {
  enlace.onclick = () => {
    $("#mm").classList.remove("open");
    $("#burger").setAttribute("aria-expanded", "false");
  };
});

/* ==========================================================================
   CITAS
   ========================================================================== */

const cargarProfesionales = async () => {
  const lista = await api("/api/profesionales");
  state.profesionales = lista;

  const grid = $("#profesionales");
  grid.innerHTML = "";

  if (!lista.length) {
    grid.innerHTML = vacio(
      "Aún no hay profesionales disponibles. La administración debe crear las cuentas del equipo psicosocial.",
    );
    return;
  }

  lista.forEach((profesional) => {
    const card = H("article", { className: "card pro-card" }, `
      <div class="ico" aria-hidden="true">🧑‍⚕️</div>
      <h3></h3>
      <p class="etq"></p>
      <p class="pro-desc"></p>
      <div class="push row">
        <button class="btn sm" type="button" data-agendar>AGENDAR CITA</button>
        <button class="btn sm alt" type="button" data-chat>CONVERSAR</button>
      </div>
    `);

    card.querySelector("h3").textContent = profesional.nombre;
    card.querySelector(".etq").textContent = profesional.especialidad;
    card.querySelector(".pro-desc").textContent = profesional.descripcion || "";
    card.querySelector("[data-agendar]").onclick = () => abrirAgenda(profesional);
    card.querySelector("[data-chat]").onclick = () => {
      cambiarTab("chat");
      abrirConversacion({
        profesional_id: profesional.id,
        profesional: profesional.nombre,
        especialidad: profesional.especialidad,
      });
    };

    grid.appendChild(card);
  });
};

const cargarCupos = async () => {
  if (!state.agenda) return;

  const profesional = state.agenda.profesional;
  const fechas = $("#fechas");
  const sinFechas = $("#sinFechas");
  const horas = $("#horas");
  const sinHoras = $("#sinHoras");

  fechas.innerHTML = "";
  horas.innerHTML = "";
  sinFechas.hidden = true;
  sinHoras.hidden = false;
  sinHoras.textContent = "Primero elige un día.";
  $("#btnAgendar").disabled = true;

  state.agenda.fecha = null;
  state.agenda.hora = null;

  try {
    const datos = await api(
      "/api/citas/disponibilidad?profesional_id=" + profesional.id,
    );
    state.agenda.cupos = datos.cupos || [];

    const disponibles = state.agenda.cupos.filter((c) => c.horas.length);

    if (!disponibles.length) {
      sinFechas.hidden = false;
      return;
    }

    disponibles.forEach((cupo) => {
      const [anio, mes, dia] = cupo.fecha.split("-").map(Number);
      const fecha = new Date(Date.UTC(anio, mes - 1, dia));

      const boton = H("button", { className: "date-chip", type: "button" }, `
        <span>${esc(cupo.dia.slice(0, 3))}</span>
        <strong>${dia}</strong>
        <small>${fecha.toLocaleDateString("es-CO", { month: "short", timeZone: "UTC" })}</small>
      `);

      boton.setAttribute("aria-pressed", "false");
      boton.onclick = () => {
        $$(".date-chip", fechas).forEach((b) => b.setAttribute("aria-pressed", "false"));
        boton.setAttribute("aria-pressed", "true");
        state.agenda.fecha = cupo.fecha;
        state.agenda.hora = null;
        pintarHoras(cupo.horas);
      };

      fechas.appendChild(boton);
    });
  } catch (e) {
    sinFechas.hidden = false;
    sinFechas.textContent = e.message || "No se pudo consultar la disponibilidad.";
  }
};

const pintarHoras = (lista) => {
  const horas = $("#horas");
  const sinHoras = $("#sinHoras");
  horas.innerHTML = "";

  if (!lista.length) {
    sinHoras.hidden = false;
    sinHoras.textContent = "No hay horas disponibles para este día.";
    $("#btnAgendar").disabled = true;
    return;
  }

  sinHoras.hidden = true;

  lista.forEach((hora) => {
    const boton = H("button", { className: "time-chip", type: "button" }, hora);
    boton.setAttribute("aria-pressed", "false");
    boton.onclick = () => {
      $$(".time-chip", horas).forEach((b) => b.setAttribute("aria-pressed", "false"));
      boton.setAttribute("aria-pressed", "true");
      state.agenda.hora = hora;
      $("#btnAgendar").disabled = false;
      $("#errCita").textContent = "";
    };
    horas.appendChild(boton);
  });
};

const abrirAgenda = (profesional) => {
  state.agenda = { profesional, cupos: [], fecha: null, hora: null };

  $("#agendaProfesional").textContent = profesional.nombre;
  $("#agendaEspecialidad").textContent =
    profesional.especialidad + (profesional.descripcion ? " · " + profesional.descripcion : "");
  $("#agenda").hidden = false;
  $("#motivo").value = "";
  $("#errCita").textContent = "";
  $("#agenda").scrollIntoView({ behavior: "smooth", block: "start" });
  cargarCupos();
};

$("#cerrarAgenda").onclick = () => {
  state.agenda = null;
  $("#agenda").hidden = true;
};

$("#formCita").onsubmit = async (evento) => {
  evento.preventDefault();

  const error = $("#errCita");
  error.textContent = "";

  if (!state.agenda || !state.agenda.fecha || !state.agenda.hora) {
    error.textContent = "Elige un día y una hora disponibles.";
    return;
  }

  const boton = $("#btnAgendar");
  boton.disabled = true;

  try {
    await api("/api/citas", {
      method: "POST",
      body: {
        profesional_id: state.agenda.profesional.id,
        fecha_hora: state.agenda.fecha + "T" + state.agenda.hora + ":00",
        modalidad: $("#modalidad").value,
        motivo: $("#motivo").value.trim(),
      },
    });

    aviso("Cita solicitada. Queda pendiente de confirmación por la profesional.");
    state.agenda.fecha = null;
    state.agenda.hora = null;
    $("#agenda").hidden = true;
    state.agenda = null;
    await Promise.all([cargarCitas(), cargarProfesionales()]);
  } catch (e) {
    error.textContent = e.message;
    boton.disabled = false;
  }
};

const cargarCitas = async () => {
  const citas = await api("/api/citas");
  state.citas = citas;

  const lista = $("#misCitas");
  lista.innerHTML = "";

  if (!citas.length) {
    lista.innerHTML = vacio("Todavía no tienes citas. Elige una profesional para comenzar.");
    return;
  }

  citas.forEach((cita) => {
    const card = H("article", { className: "card cita-card" }, `
      <div class="cab">
        <h3></h3>
        <span class="etq ${esc(cita.estado)}"></span>
      </div>
      <p class="cita-fecha"></p>
      <p><strong>Profesional:</strong> <span class="cita-pro"></span></p>
      <p><strong>Especialidad:</strong> <span class="cita-esp"></span></p>
      <p><strong>Modalidad:</strong> <span class="cita-mod"></span></p>
      <p class="cita-motivo"></p>
      <div class="acciones"></div>
    `);

    card.querySelector("h3").textContent = fmtFechaHora(cita.fecha_hora);
    const etiqueta = card.querySelector(".etq");
    etiqueta.textContent = estadoTexto[cita.estado] || cita.estado;
    etiqueta.classList.add(cita.estado);
    card.querySelector(".cita-fecha").textContent = "Duración: " + cita.duracion_min + " minutos";
    card.querySelector(".cita-pro").textContent = cita.profesional;
    card.querySelector(".cita-esp").textContent = cita.especialidad || "";
    card.querySelector(".cita-mod").textContent =
      cita.modalidad === "virtual" ? "Virtual" : "Presencial";
    card.querySelector(".cita-motivo").textContent = cita.motivo
      ? "Motivo: " + cita.motivo
      : "";

    const acciones = card.querySelector(".acciones");

    if (cita.estado === "pendiente" || cita.estado === "confirmada") {
      const boton = H("button", { className: "btn sm peligro", type: "button" }, "CANCELAR CITA");
      boton.onclick = async () => {
        if (!confirm("¿Seguro que quieres cancelar esta cita?")) return;
        try {
          await api("/api/citas/" + cita.id, {
            method: "PATCH",
            body: { estado: "cancelada" },
          });
          aviso("La cita fue cancelada.");
          await cargarCitas();
        } catch (e) {
          aviso(e.message, true);
        }
      };
      acciones.appendChild(boton);

      if (cita.modalidad === "virtual") {
        acciones.appendChild(
          H("span", { className: "hint" }, "El enlace de conexión se comparte por mensajería."),
        );
      }
    }

    lista.appendChild(card);
  });
};

/* ==========================================================================
   CHAT
   ========================================================================== */

const CHAT_PRUEBA_ID = "prueba";
const CHAT_PRUEBA_CLAVE = "sombrilla_chat_prueba";
let versionChatPrueba = 0;

const ahoraUTC = () => new Date().toISOString().slice(0, 19);

const guardarChatPrueba = (mensajes) => {
  try {
    localStorage.setItem(CHAT_PRUEBA_CLAVE, JSON.stringify(mensajes));
  } catch (e) {
    // Si el navegador bloquea el almacenamiento, el chat sigue funcionando
    // durante la visita actual.
  }
};

const crearMensajesPrueba = () => {
  const base = Date.now();
  const hace = (minutos) =>
    new Date(base - minutos * 60000).toISOString().slice(0, 19);

  return [
    {
      id: "prueba-1",
      remitente: "profesional",
      texto:
        "Hola, soy la guía de acompañamiento de Bajo la sombrilla. Este es un chat de prueba para que practiques cómo comunicarte.",
      creado_en: hace(95),
    },
    {
      id: "prueba-2",
      remitente: "usuaria",
      texto:
        "Hola, hoy me siento un poco ansiosa y quería hablar con alguien.",
      creado_en: hace(90),
    },
    {
      id: "prueba-3",
      remitente: "profesional",
      texto:
        "Gracias por contarlo. Estoy aquí para escucharte. ¿Quieres contarme qué pasó o prefieres que te comparta un ejercicio de respiración?",
      creado_en: hace(86),
    },
    {
      id: "prueba-4",
      remitente: "usuaria",
      texto: "Quiero entender cómo manejar la ansiedad.",
      creado_en: hace(80),
    },
    {
      id: "prueba-5",
      remitente: "profesional",
      texto:
        "Puedes empezar con una respiración lenta: inhala 4 segundos, sostén 4 y exhala 6. Repítelo cinco veces.",
      creado_en: hace(74),
    },
    {
      id: "prueba-6",
      remitente: "usuaria",
      texto: "Me cuesta concentrarme cuando me pongo así.",
      creado_en: hace(68),
    },
    {
      id: "prueba-7",
      remitente: "profesional",
      texto:
        "Es comprensible. Prueba escribir tres cosas pequeñas que sí puedas controlar hoy; eso puede ayudarte a volver al presente.",
      creado_en: hace(62),
    },
    {
      id: "prueba-8",
      remitente: "usuaria",
      texto: "También quiero agendar una cita con una profesional.",
      creado_en: hace(52),
    },
    {
      id: "prueba-9",
      remitente: "profesional",
      texto:
        "Puedes hacerlo desde la pestaña Citas. Si necesitas orientación, escribe “cita” y te indico los pasos.",
      creado_en: hace(46),
    },
    {
      id: "prueba-10",
      remitente: "profesional",
      texto:
        "Recuerda que este chat es de prueba y no reemplaza la atención profesional. Si estás en peligro inmediato, usa el botón Ayuda o llama al 123.",
      creado_en: hace(40),
    },
  ];
};

const leerChatPrueba = () => {
  try {
    const guardados = JSON.parse(localStorage.getItem(CHAT_PRUEBA_CLAVE) || "null");

    if (Array.isArray(guardados) && guardados.length) return guardados;
  } catch (e) {
    // Se usan los mensajes de prueba por defecto.
  }

  const iniciales = crearMensajesPrueba();
  guardarChatPrueba(iniciales);
  return iniciales;
};

const esChatPrueba = () =>
  Boolean(state.chat && state.chat.profesional_id === CHAT_PRUEBA_ID);

const crearConversacionPrueba = () => {
  const mensajes = leerChatPrueba();
  const ultimo = mensajes[mensajes.length - 1];

  return {
    profesional_id: CHAT_PRUEBA_ID,
    profesional: "Guía de acompañamiento",
    especialidad: "Chat de prueba · respuestas automáticas",
    ultimo: ultimo ? ultimo.texto : "Iniciar chat de prueba",
    sin_leer: 0,
    prueba: true,
  };
};

const respuestaChatPrueba = (texto) => {
  const t = texto.toLowerCase();

  if (
    /(emergencia|peligro|suicid|matar|no quiero vivir|no quiero seguir|hacerme daño|lastimarme|auxilio|123)/.test(
      t,
    )
  ) {
    return "Si estás en peligro inmediato, llama al 123 o usa el botón Ayuda. No estás sola. Si puedes, busca a una persona de confianza y permanece a su lado mientras llega la ayuda.";
  }

  if (/(ansiedad|ansios|nervios|pánico|panico|respir|angustia)/.test(t)) {
    return "Gracias por decírmelo. Puedes probar ahora una respiración lenta: inhala 4 segundos, sostén 4 y exhala 6. Repítelo cinco veces. Si la ansiedad sigue siendo muy intensa, cuéntaselo a una profesional en tu próxima cita.";
  }

  if (/(triste|sola|solo|llorar|deprim|vacío|vacio|desanimada)/.test(t)) {
    return "Siento que estés pasando por eso. No tienes que resolverlo toda sola: puedes escribir en el Diario emocional cómo te sientes y, si quieres, contárselo a una profesional en el chat o en una cita.";
  }

  if (/(cita|agendar|horario|disponibilidad)/.test(t)) {
    return "Puedes agendar desde la pestaña Citas. Elige una profesional, revisa sus horarios disponibles y reserva el que mejor te sirva. La cita queda pendiente hasta que ella la confirme.";
  }

  if (/(gracias|agradezco)/.test(t)) {
    return "Con gusto. Estoy aquí para acompañarte. Si quieres, podemos seguir hablando o puedes escribirle a una profesional.";
  }

  if (/(hola|buenas|buenos días|buenas tardes|buenas noches)/.test(t)) {
    return "Hola, qué bueno que estés aquí. ¿Cómo te sientes hoy y qué te gustaría compartir?";
  }

  return "Te escucho. ¿Quieres contarme un poco más sobre lo que te pasa o prefieres que te comparta una opción de apoyo?";
};

const cargarConversaciones = async () => {
  let lista = [];

  try {
    lista = await api("/api/mensajes");
  } catch (e) {
    // Aunque falle la API, el chat de prueba queda disponible.
    lista = [];
  }

  state.conversaciones = lista;

  const caja = $("#conversaciones");
  caja.innerHTML = "";

  const conversaciones = [crearConversacionPrueba(), ...lista];

  conversaciones.forEach((conversacion) => {
    const esPrueba = conversacion.profesional_id === CHAT_PRUEBA_ID;
    const boton = H(
      "button",
      {
        className: "conv-item" + (esPrueba ? " conv-item-prueba" : ""),
        type: "button",
      },
      `
      <span class="conv-avatar" aria-hidden="true">${esPrueba ? "🌿" : "🧑‍⚕️"}</span>
      <span class="conv-text">
        <strong></strong>
        <small></small>
      </span>
      ${esPrueba ? '<span class="conv-tag">PRUEBA</span>' : '<span class="conv-badge" hidden></span>'}
    `,
    );

    boton.querySelector("strong").textContent = esPrueba
      ? "Guía de apoyo"
      : conversacion.profesional;
    boton.querySelector("small").textContent =
      conversacion.ultimo || conversacion.especialidad || "Iniciar conversación";

    const badge = boton.querySelector(".conv-badge");
    if (badge && Number(conversacion.sin_leer) > 0) {
      badge.hidden = false;
      badge.textContent = conversacion.sin_leer;
    }

    if (state.chat && state.chat.profesional_id === conversacion.profesional_id) {
      boton.classList.add("active");
    }

    boton.onclick = () => abrirConversacion(conversacion);
    caja.appendChild(boton);
  });
};

const abrirConversacion = async (conversacion) => {
  const esPrueba = conversacion.profesional_id === CHAT_PRUEBA_ID;

  state.chat = {
    profesional_id: conversacion.profesional_id,
    profesional: conversacion.profesional,
    especialidad: conversacion.especialidad,
    prueba: esPrueba,
  };

  $("#chatNombre").textContent = conversacion.profesional;
  $("#chatEspecialidad").textContent = conversacion.especialidad || "";
  $("#reiniciarChatPrueba").hidden = !esPrueba;
  $("#textoMensaje").disabled = false;
  $("#textoMensaje").placeholder = esPrueba
    ? "Escribe lo que sientes o necesitas..."
    : "Escribe tu mensaje...";
  $("#btnEnviarMensaje").disabled = false;
  $("#textoMensaje").focus();

  await cargarMensajes(state.chat.profesional_id, false);
  await cargarConversaciones();
};

const pintarMensajes = (mensajes, silencioso) => {
  const caja = $("#mensajes");
  const estabaAbajo =
    caja.scrollTop + caja.clientHeight >= caja.scrollHeight - 40;

  caja.innerHTML = "";

  if (!mensajes.length) {
    caja.innerHTML = vacio("Todavía no hay mensajes. Escribe el primero.");
  } else {
    mensajes.forEach((mensaje) => {
      const burbuja = H("div", {
        className: "bubble " + (mensaje.remitente === "usuaria" ? "mio" : "suyo"),
      });
      burbuja.appendChild(H("p", {}, esc(mensaje.texto)));
      burbuja.appendChild(
        H(
          "small",
          {},
          new Date(mensaje.creado_en + "Z").toLocaleString("es-CO", {
            day: "2-digit",
            month: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
          }),
        ),
      );
      caja.appendChild(burbuja);
    });
  }

  if (!silencioso || estabaAbajo) {
    caja.scrollTop = caja.scrollHeight;
  }
};

const cargarMensajes = async (profesionalId, silencioso) => {
  if (!state.chat || state.chat.profesional_id !== profesionalId) return;

  if (profesionalId === CHAT_PRUEBA_ID) {
    pintarMensajes(leerChatPrueba(), silencioso);
    return;
  }

  const datos = await api("/api/mensajes/" + profesionalId);
  pintarMensajes(datos.mensajes || [], silencioso);
};

$("#formMensaje").onsubmit = async (evento) => {
  evento.preventDefault();

  const error = $("#errMensaje");
  error.textContent = "";

  const texto = $("#textoMensaje").value.trim();

  if (!state.chat || !texto) {
    error.textContent = "Escribe un mensaje.";
    return;
  }

  const boton = $("#btnEnviarMensaje");
  const chatPrueba = esChatPrueba();

  if (!chatPrueba) boton.disabled = true;

  try {
    if (chatPrueba) {
      const mensajes = leerChatPrueba();

      mensajes.push({
        id: "prueba-" + Date.now(),
        remitente: "usuaria",
        texto,
        creado_en: ahoraUTC(),
      });

      guardarChatPrueba(mensajes);
      $("#textoMensaje").value = "";
      pintarMensajes(mensajes, false);
      await cargarConversaciones();

      const version = versionChatPrueba;

      window.setTimeout(() => {
        if (version !== versionChatPrueba) return;

        const actuales = leerChatPrueba();

        actuales.push({
          id: "prueba-" + Date.now(),
          remitente: "profesional",
          texto: respuestaChatPrueba(texto),
          creado_en: ahoraUTC(),
        });

        guardarChatPrueba(actuales);

        if (esChatPrueba()) {
          pintarMensajes(actuales, true);
          cargarConversaciones().catch(() => {});
        }
      }, 800);
    } else {
      await api("/api/mensajes", {
        method: "POST",
        body: {
          profesional_id: state.chat.profesional_id,
          texto,
        },
      });

      $("#textoMensaje").value = "";
      await cargarMensajes(state.chat.profesional_id, false);
      await cargarConversaciones();
    }
  } catch (e) {
    error.textContent = e.message;
  } finally {
    boton.disabled = false;
    $("#textoMensaje").focus();
  }
};

$("#reiniciarChatPrueba").onclick = () => {
  if (!esChatPrueba()) return;

  versionChatPrueba++;

  try {
    localStorage.removeItem(CHAT_PRUEBA_CLAVE);
  } catch (e) {
    // Si no hay almacenamiento, se recrean los mensajes en memoria.
  }

  const mensajes = leerChatPrueba();

  pintarMensajes(mensajes, false);
  cargarConversaciones().catch(() => {});
  $("#textoMensaje").focus();
};

// Actualiza la conversación abierta cada 10 segundos
setInterval(() => {
  if (state.tab === "chat" && state.chat) {
    cargarMensajes(state.chat.profesional_id, true).catch(() => {});
  }
}, 10000);

/* ==========================================================================
   DIARIO EMOCIONAL
   ========================================================================== */

const EMOCIONES = [
  "Alegría",
  "Calma",
  "Tristeza",
  "Ansiedad",
  "Enojo",
  "Miedo",
  "Esperanza",
  "Cansancio",
  "Gratitud",
  "Soledad",
];

const EMOJIS = ["😞", "😔", "😕", "😐", "🙂", "😊", "😄", "😁", "🤩", "🌈"];

const construirSelectorAnimo = () => {
  const contenedor = $("#moodPicker");
  contenedor.innerHTML = "";

  for (let i = 1; i <= 10; i += 1) {
    const boton = H("button", { className: "mood-btn", type: "button" }, `
      <span aria-hidden="true">${EMOJIS[i - 1]}</span>
      <strong>${i}</strong>
    `);
    boton.dataset.animo = i;
    boton.setAttribute("aria-pressed", "false");
    boton.setAttribute("aria-label", `Estado de ánimo ${i} de 10`);
    boton.onclick = () => {
      $$(".mood-btn", contenedor).forEach((b) => b.setAttribute("aria-pressed", "false"));
      boton.setAttribute("aria-pressed", "true");
      state.animo = i;
      const texto =
        i <= 2 ? "Muy bajo" : i <= 4 ? "Bajo" : i === 5 ? "Neutral" : i <= 8 ? "Bien" : "Muy bien";
      $("#moodOutput").textContent = `${EMOJIS[i - 1]} ${i}/10 · ${texto}`;
    };
    contenedor.appendChild(boton);
  }

  const emociones = $("#emociones");
  emociones.innerHTML = "";

  EMOCIONES.forEach((emocion) => {
    const etiqueta = H("label", {}, "");
    const casilla = document.createElement("input");
    casilla.type = "checkbox";
    casilla.value = emocion;
    etiqueta.appendChild(casilla);
    etiqueta.appendChild(document.createTextNode(" " + emocion));
    emociones.appendChild(etiqueta);
  });
};

const cargarDiario = async () => {
  const datos = await api("/api/diario");
  state.diario = datos;

  pintarEntradas(datos.entradas);
  dibujarGrafico();

  const hoy = fechaHoy();
  const entradaHoy = datos.entradas.find((e) => e.fecha === hoy);

  if (entradaHoy) {
    seleccionarAnimo(entradaHoy.animo);
    $("#notaDiario").value = entradaHoy.nota || "";
    const emocionesHoy = String(entradaHoy.emociones || "")
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);

    $$("#emociones input").forEach((casilla) => {
      casilla.checked = emocionesHoy.includes(casilla.value);
    });
  }

  const conDatos = datos.serie.filter((s) => Number(s.promedio) > 0);
  if (conDatos.length) {
    const promedio =
      conDatos.reduce((total, s) => total + Number(s.promedio), 0) / conDatos.length;
    $("#promedioAnimo").textContent = promedio.toFixed(1) + " / 10";
  } else {
    $("#promedioAnimo").textContent = "Sin datos";
  }
};

const fechaHoy = () => {
  const ahora = new Date();
  return new Date(ahora.getTime() - 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
};

const seleccionarAnimo = (animo) => {
  state.animo = Number(animo);
  $$(".mood-btn").forEach((boton) => {
    const activo = Number(boton.dataset.animo) === Number(animo);
    boton.setAttribute("aria-pressed", activo);
  });
  const valor = Number(animo);
  const texto =
    valor <= 2
      ? "Muy bajo"
      : valor <= 4
        ? "Bajo"
        : valor === 5
          ? "Neutral"
          : valor <= 8
            ? "Bien"
            : "Muy bien";
  $("#moodOutput").textContent = `${EMOJIS[valor - 1]} ${valor}/10 · ${texto}`;
};

const pintarEntradas = (entradas) => {
  const lista = $("#entradasDiario");
  lista.innerHTML = "";

  if (!entradas.length) {
    lista.innerHTML = vacio("Aún no hay registros. Guarda cómo te sientes hoy.");
    return;
  }

  entradas.slice(0, 14).forEach((entrada) => {
    const card = H("article", { className: "card diario-item" }, `
      <div class="cab">
        <h3></h3>
        <span class="etq"></span>
      </div>
      <p class="emociones"></p>
      <p class="nota"></p>
    `);

    card.querySelector("h3").textContent = fmtFecha(entrada.fecha);
    card.querySelector(".etq").textContent = `${EMOJIS[Number(entrada.animo) - 1]} ${entrada.animo}/10`;
    card.querySelector(".emociones").textContent = entrada.emociones
      ? "Emociones: " + entrada.emociones
      : "";
    card.querySelector(".nota").textContent = entrada.nota || "";
    lista.appendChild(card);
  });
};

$("#formDiario").onsubmit = async (evento) => {
  evento.preventDefault();

  const error = $("#errDiario");
  error.textContent = "";

  if (!state.animo) {
    error.textContent = "Elige un estado de ánimo del 1 al 10.";
    return;
  }

  const emociones = $$("#emociones input:checked").map((c) => c.value);
  const boton = $("#formDiario button[type='submit']");
  boton.disabled = true;

  try {
    await api("/api/diario", {
      method: "POST",
      body: {
        animo: state.animo,
        emociones,
        nota: $("#notaDiario").value.trim(),
      },
    });

    aviso("Tu registro de hoy fue guardado.");
    await cargarDiario();
  } catch (e) {
    error.textContent = e.message;
  } finally {
    boton.disabled = false;
  }
};

const dibujarGrafico = () => {
  const canvas = $("#graficoAnimo");
  if (!canvas || !canvas.parentElement) return;

  const anchoCss = canvas.parentElement.clientWidth;
  if (!anchoCss) return;

  const altoCss = 300;
  const dpr = window.devicePixelRatio || 1;
  canvas.width = anchoCss * dpr;
  canvas.height = altoCss * dpr;
  canvas.style.width = "100%";
  canvas.style.height = altoCss + "px";

  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const margen = { arriba: 22, derecha: 18, abajo: 46, izquierda: 40 };
  const ancho = anchoCss - margen.izquierda - margen.derecha;
  const alto = altoCss - margen.arriba - margen.abajo;

  ctx.clearRect(0, 0, anchoCss, altoCss);
  ctx.font = "12px Atkinson Hyperlegible, Verdana, sans-serif";
  ctx.fillStyle = "#2b1810";
  ctx.strokeStyle = "#d9c9b8";
  ctx.lineWidth = 1;

  const serie = state.diario.serie || [];

  // Rejilla horizontal
  [1, 5, 10].forEach((valor) => {
    const y = margen.arriba + alto - ((valor - 1) / 9) * alto;
    ctx.beginPath();
    ctx.moveTo(margen.izquierda, y);
    ctx.lineTo(margen.izquierda + ancho, y);
    ctx.stroke();
    ctx.fillText(String(valor), 12, y + 4);
  });

  if (!serie.length) {
    ctx.fillStyle = "#4a2260";
    ctx.font = "600 15px Atkinson Hyperlegible, Verdana, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Aún no hay datos suficientes", anchoCss / 2, altoCss / 2);
    ctx.textAlign = "left";
    return;
  }

  const x = (i) =>
    margen.izquierda + (serie.length === 1 ? ancho / 2 : (i / (serie.length - 1)) * ancho);
  const y = (valor) => margen.arriba + alto - ((Number(valor) - 1) / 9) * alto;

  // Área
  const degradado = ctx.createLinearGradient(0, margen.arriba, 0, margen.arriba + alto);
  degradado.addColorStop(0, "rgba(242, 140, 40, 0.35)");
  degradado.addColorStop(1, "rgba(242, 140, 40, 0.02)");

  ctx.beginPath();
  ctx.moveTo(x(0), y(serie[0].promedio));
  serie.forEach((punto, i) => ctx.lineTo(x(i), y(punto.promedio)));
  ctx.lineTo(x(serie.length - 1), margen.arriba + alto);
  ctx.lineTo(x(0), margen.arriba + alto);
  ctx.closePath();
  ctx.fillStyle = degradado;
  ctx.fill();

  // Línea
  ctx.beginPath();
  serie.forEach((punto, i) => {
    if (i === 0) ctx.moveTo(x(i), y(punto.promedio));
    else ctx.lineTo(x(i), y(punto.promedio));
  });
  ctx.strokeStyle = "#f28c28";
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.stroke();

  // Puntos
  serie.forEach((punto, i) => {
    ctx.beginPath();
    ctx.arc(x(i), y(punto.promedio), 4.5, 0, Math.PI * 2);
    ctx.fillStyle = "#4a2260";
    ctx.fill();
    ctx.strokeStyle = "#fff";
    ctx.lineWidth = 2;
    ctx.stroke();
  });

  // Fechas en el eje horizontal
  ctx.fillStyle = "#2b1810";
  ctx.font = "11px Atkinson Hyperlegible, Verdana, sans-serif";
  const indices = new Set([0, Math.floor((serie.length - 1) / 2), serie.length - 1]);

  indices.forEach((i) => {
    const [anio, mes, dia] = serie[i].fecha.split("-");
    const etiqueta = `${dia}/${mes}`;
    const anchoTexto = ctx.measureText(etiqueta).width;
    let px = x(i) - anchoTexto / 2;
    px = Math.max(margen.izquierda, Math.min(px, anchoCss - margen.derecha - anchoTexto));
    ctx.fillText(etiqueta, px, altoCss - 18);
  });
};

window.addEventListener("resize", () => {
  if (state.tab === "diario") dibujarGrafico();
});

/* ==========================================================================
   TEST DE BIENESTAR
   ========================================================================== */

const cargarTests = async () => {
  const [definiciones, historial] = await Promise.all([
    api("/api/tests/definiciones"),
    api("/api/tests/historial"),
  ]);

  state.tests = definiciones;

  const grid = $("#testsDisponibles");
  grid.innerHTML = "";

  definiciones.forEach((test) => {
    const card = H("article", { className: "card test-card" }, `
      <div class="ico" aria-hidden="true">${test.id === "ansiedad" ? "🧠" : "💚"}</div>
      <h3></h3>
      <p class="test-desc"></p>
      <p class="hint"></p>
      <div class="push">
        <button class="btn sm" type="button">COMENZAR TEST</button>
      </div>
    `);

    card.querySelector("h3").textContent = test.titulo;
    card.querySelector(".test-desc").textContent = test.descripcion;
    card.querySelector(".hint").textContent = `${test.preguntas.length} preguntas · unos 3 minutos`;
    card.querySelector("button").onclick = () => iniciarTest(test);
    grid.appendChild(card);
  });

  pintarHistorial(historial);
};

const iniciarTest = (test) => {
  state.testActual = test;

  $("#testTitulo").textContent = test.titulo;
  $("#testInstruccion").textContent = test.instruccion;
  $("#errTest").textContent = "";
  $("#resultadoTest").hidden = true;
  $("#cuestionario").hidden = false;

  const contenedor = $("#preguntasTest");
  contenedor.innerHTML = "";

  test.preguntas.forEach((pregunta, indice) => {
    const fieldset = H("fieldset", { className: "pregunta-test" });
    const legend = document.createElement("legend");
    legend.textContent = `${indice + 1}. ${pregunta}`;
    fieldset.appendChild(legend);

    const opciones = H("div", { className: "opts test-opts" });

    test.opciones.forEach((opcion) => {
      const etiqueta = document.createElement("label");
      const radio = document.createElement("input");
      radio.type = "radio";
      radio.name = "p" + indice;
      radio.value = opcion.valor;
      etiqueta.appendChild(radio);
      etiqueta.appendChild(document.createTextNode(" " + opcion.texto));
      opciones.appendChild(etiqueta);
    });

    fieldset.appendChild(opciones);
    contenedor.appendChild(fieldset);
  });

  $("#cuestionario").scrollIntoView({ behavior: "smooth", block: "start" });
};

$("#cerrarTest").onclick = () => {
  $("#cuestionario").hidden = true;
  state.testActual = null;
};

$("#formTest").onsubmit = async (evento) => {
  evento.preventDefault();

  const error = $("#errTest");
  error.textContent = "";

  if (!state.testActual) return;

  const respuestas = [];

  for (let i = 0; i < state.testActual.preguntas.length; i += 1) {
    const seleccion = document.querySelector(`input[name="p${i}"]:checked`);
    if (!seleccion) {
      error.textContent = "Responde todas las preguntas para ver tu resultado.";
      return;
    }
    respuestas.push(Number(seleccion.value));
  }

  const boton = $("#formTest button[type='submit']");
  boton.disabled = true;

  try {
    const resultado = await api("/api/tests", {
      method: "POST",
      body: { tipo: state.testActual.id, respuestas },
    });

    $("#cuestionario").hidden = true;
    $("#resultadoTitulo").textContent = resultado.titulo;
    $("#resultadoPuntaje").textContent = `Puntaje: ${resultado.puntaje}`;
    $("#resultadoNivel").textContent = `Nivel: ${resultado.nivel}${resultado.riesgo ? " · Indicador de riesgo" : ""}`;
    $("#resultadoRecomendacion").textContent = resultado.recomendacion;

    const caja = $("#resultadoTest");
    caja.classList.toggle("riesgo", Boolean(resultado.riesgo));
    caja.hidden = false;
    caja.focus();

    aviso(
      resultado.riesgo
        ? "Tu resultado generó una alerta para el equipo profesional."
        : "Resultado guardado. Gracias por hacer el test.",
      false,
    );

    await cargarTests();
  } catch (e) {
    error.textContent = e.message;
  } finally {
    boton.disabled = false;
  }
};

const pintarHistorial = (historial) => {
  const lista = $("#historialTests");
  lista.innerHTML = "";

  if (!historial.length) {
    lista.innerHTML = vacio("Aún no has realizado ningún test.");
    return;
  }

  historial.forEach((test) => {
    const card = H("article", { className: "card test-hist" }, `
      <div class="cab">
        <h3></h3>
        <span class="etq"></span>
        ${test.riesgo ? '<span class="etq riesgo">RIESGO</span>' : ""}
      </div>
      <p></p>
    `);

    card.querySelector("h3").textContent =
      test.tipo === "ansiedad" ? "Escala de ansiedad" : "Escala de autoestima";
    card.querySelector(".etq").textContent = test.nivel;
    card.querySelector("p").textContent =
      `Puntaje ${test.puntaje} · ${new Date(test.creado_en + "Z").toLocaleDateString("es-CO")}`;
    lista.appendChild(card);
  });
};

$("#resultadoCerrar").onclick = () => {
  $("#resultadoTest").hidden = true;
};

$("#resultadoAyuda").onclick = () => abrirModalAyuda();

/* ==========================================================================
   AYUDA Y EMERGENCIA
   ========================================================================== */

const abrirModalAyuda = () => {
  const modal = $("#modalAyuda");
  modal.hidden = false;
  document.body.classList.add("modal-open");
  $("#cerrarAyuda").focus();
};

const cerrarModalAyuda = () => {
  $("#modalAyuda").hidden = true;
  document.body.classList.remove("modal-open");
};

$("#btnEmergencia").onclick = abrirModalAyuda;
$("#abrirAyuda").onclick = abrirModalAyuda;
$("#cerrarAyuda").onclick = cerrarModalAyuda;

$("#modalAyuda").addEventListener("click", (evento) => {
  if (evento.target === $("#modalAyuda")) cerrarModalAyuda();
});

document.addEventListener("keydown", (evento) => {
  if (evento.key === "Escape" && !$("#modalAyuda").hidden) cerrarModalAyuda();
});

/* ==========================================================================
   INICIO
   ========================================================================== */

const iniciarModulo = async () => {
  construirSelectorAnimo();
  cargarLineas();

  const local = Sesion.get();
  mostrarSesion(local);

  const sesion = await Sesion.sincronizar();
  mostrarSesion(sesion);

  if (!sesion) {
    $("#sinSesion").hidden = false;
    $("#modulo").hidden = true;
    return;
  }

  if (sesion.rol === "admin") {
    location.replace("admin.html");
    return;
  }

  if (sesion.rol === "profesional") {
    location.replace("profesional.html");
    return;
  }

  state.sesion = sesion;
  $("#sinSesion").hidden = true;
  $("#modulo").hidden = false;

  const resultados = await Promise.allSettled([
    cargarProfesionales(),
    cargarCitas(),
    cargarConversaciones(),
    cargarDiario(),
    cargarTests(),
  ]);

  const errores = resultados.filter((r) => r.status === "rejected");

  if (errores.length) {
    aviso(
      errores[0].reason && errores[0].reason.message
        ? errores[0].reason.message
        : "Algunas secciones no se pudieron cargar.",
      true,
    );
  }
};

iniciarModulo();
