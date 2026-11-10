/* ==========================================================================
   PANEL PROFESIONAL
   ========================================================================== */

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const H = (tag, atributos = {}, html = "") =>
  Object.assign(document.createElement(tag), atributos, { innerHTML: html });

const state = {
  sesion: null,
  citas: [],
  conversaciones: [],
  chat: null,
  tab: "citas",
  disponibilidad: [],
};

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

// Las alertas guardan su fecha en UTC y el servidor la entrega sin la "Z".
const fmtMarcaUTC = (texto) => {
  const txt = String(texto || "").replace(" ", "T");
  if (!txt) return "";
  const d = new Date(/Z$/i.test(txt) ? txt : txt + "Z");
  return isNaN(d)
    ? String(texto || "")
    : d.toLocaleString("es-CO", {
        day: "numeric",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
};

const estadoTexto = {
  pendiente: "Pendiente",
  confirmada: "Confirmada",
  completada: "Completada",
  cancelada: "Cancelada",
};

const aviso = (mensaje, error = false) => {
  const caja = $("#avisoProfesional");
  caja.textContent = mensaje;
  caja.style.color = error ? "#b3361a" : "";
};

const vacio = (texto) => `<div class="vacio">${esc(texto)}</div>`;

/* ==========================================================================
   SESIÓN Y NAVEGACIÓN
   ========================================================================== */

const mostrarSesion = (sesion) => {
  if (!sesion) {
    $("#nombreSesion").hidden = true;
    $("#salir").hidden = true;
    return;
  }

  $("#nombreSesion").hidden = false;
  $("#salir").hidden = false;
  $("#nombreSesion").textContent = sesion.nombre;

  $("#salir").onclick = async () => {
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

  if (tab === "chat") cargarConversaciones().catch(() => {});
  if (tab === "alertas") cargarAlertas().catch(() => {});
  if (tab === "dispo") cargarDisponibilidad().catch(() => {});
};

$$("[data-tab]").forEach((boton) => {
  boton.onclick = () => cambiarTab(boton.dataset.tab);
});

/* ==========================================================================
   CITAS
   ========================================================================== */

const cargarCitas = async () => {
  state.citas = await api("/api/profesional/citas");
  pintarCitas();
};

const pintarCitas = () => {
  const filtro = $("#filtroCitas").value;
  const citas = state.citas.filter((c) => filtro === "todas" || c.estado === filtro);

  const lista = $("#listaCitas");
  lista.innerHTML = "";

  if (!citas.length) {
    lista.innerHTML = vacio("No hay citas en esta categoría.");
    return;
  }

  citas.forEach((cita) => {
    const card = H("article", { className: "card cita-card" }, `
      <div class="cab">
        <h3></h3>
        <span class="etq ${esc(cita.estado)}"></span>
      </div>
      <p><strong>Usuaria:</strong> <span class="cita-usuaria"></span></p>
      <p><strong>Modalidad:</strong> <span class="cita-modalidad"></span></p>
      <p class="cita-motivo"></p>
      <p class="cita-notas"></p>
      <div class="acciones"></div>
    `);

    card.querySelector("h3").textContent = fmtFechaHora(cita.fecha_hora);
    const etiqueta = card.querySelector(".etq");
    etiqueta.textContent = estadoTexto[cita.estado] || cita.estado;
    etiqueta.classList.add(cita.estado);

    card.querySelector(".cita-usuaria").textContent = cita.usuaria;
    card.querySelector(".cita-modalidad").textContent =
      cita.modalidad === "virtual" ? "Virtual" : "Presencial";
    card.querySelector(".cita-motivo").textContent = cita.motivo
      ? "Motivo: " + cita.motivo
      : "";
    card.querySelector(".cita-notas").textContent = cita.notas
      ? "Notas: " + cita.notas
      : "";

    const acciones = card.querySelector(".acciones");

    const agregarAccion = (texto, estado, clase) => {
      const boton = H("button", { className: "btn sm " + (clase || ""), type: "button" }, texto);
      boton.onclick = async () => {
        try {
          await api("/api/profesional/citas/" + cita.id, {
            method: "PATCH",
            body: { estado },
          });
          aviso("La cita fue actualizada.");
          await cargarCitas();
        } catch (e) {
          aviso(e.message, true);
        }
      };
      acciones.appendChild(boton);
    };

    if (cita.estado === "pendiente") {
      agregarAccion("CONFIRMAR", "confirmada");
      agregarAccion("CANCELAR", "cancelada", "peligro");
    } else if (cita.estado === "confirmada") {
      agregarAccion("MARCAR COMPLETADA", "completada");
      agregarAccion("CANCELAR", "cancelada", "peligro");
    }

    lista.appendChild(card);
  });
};

$("#filtroCitas").onchange = pintarCitas;

/* ==========================================================================
   MENSAJES
   ========================================================================== */

const cargarConversaciones = async () => {
  state.conversaciones = await api("/api/profesional/conversaciones");
  pintarConversaciones();
};

const pintarConversaciones = () => {
  const caja = $("#conversacionesProf");
  caja.innerHTML = "";

  if (!state.conversaciones.length) {
    caja.innerHTML = vacio("Aún no tienes conversaciones o citas con usuarias.");
    return;
  }

  state.conversaciones.forEach((conversacion) => {
    const boton = H("button", { className: "conv-item", type: "button" }, `
      <span class="conv-avatar" aria-hidden="true">👩</span>
      <span class="conv-text">
        <strong></strong>
        <small></small>
      </span>
      <span class="conv-badge" hidden></span>
    `);

    boton.querySelector("strong").textContent = conversacion.usuaria;
    boton.querySelector("small").textContent =
      conversacion.ultimo || "Sin mensajes todavía";

    const badge = boton.querySelector(".conv-badge");
    if (Number(conversacion.sin_leer) > 0) {
      badge.hidden = false;
      badge.textContent = conversacion.sin_leer;
    }

    if (state.chat && state.chat.id === conversacion.usuaria_id) {
      boton.classList.add("active");
    }

    boton.onclick = () => abrirConversacion(conversacion);
    caja.appendChild(boton);
  });
};

const abrirConversacion = async (conversacion) => {
  state.chat = { id: conversacion.usuaria_id, nombre: conversacion.usuaria };

  $("#chatUsuaria").textContent = conversacion.usuaria;
  $("#chatUsuariaInfo").textContent = "Conversación privada del acompañamiento";
  $("#textoProf").disabled = false;
  $("#btnEnviarProf").disabled = false;
  $("#textoProf").focus();

  await cargarMensajes(state.chat.id, false);
  await cargarConversaciones();
};

const cargarMensajes = async (usuariaId, silencioso) => {
  if (!state.chat || state.chat.id !== usuariaId) return;

  const datos = await api("/api/profesional/mensajes/" + usuariaId);
  const caja = $("#mensajesProf");
  const estabaAbajo = caja.scrollTop + caja.clientHeight >= caja.scrollHeight - 40;

  caja.innerHTML = "";

  if (!datos.mensajes.length) {
    caja.innerHTML = vacio("Todavía no hay mensajes con esta usuaria.");
  } else {
    datos.mensajes.forEach((mensaje) => {
      const burbuja = H("div", {
        className: "bubble " + (mensaje.remitente === "profesional" ? "mio" : "suyo"),
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

  if (!silencioso || estabaAbajo) caja.scrollTop = caja.scrollHeight;
};

$("#formMensajeProf").onsubmit = async (evento) => {
  evento.preventDefault();

  const error = $("#errMensajeProf");
  error.textContent = "";

  const texto = $("#textoProf").value.trim();
  if (!state.chat || !texto) {
    error.textContent = "Escribe un mensaje.";
    return;
  }

  const boton = $("#btnEnviarProf");
  boton.disabled = true;

  try {
    await api("/api/profesional/mensajes", {
      method: "POST",
      body: { usuaria_id: state.chat.id, texto },
    });
    $("#textoProf").value = "";
    await cargarMensajes(state.chat.id, false);
    await cargarConversaciones();
  } catch (e) {
    error.textContent = e.message;
  } finally {
    boton.disabled = false;
    $("#textoProf").focus();
  }
};

setInterval(() => {
  if (state.tab === "chat" && state.chat) {
    cargarMensajes(state.chat.id, true).catch(() => {});
  }
}, 10000);

/* ==========================================================================
   ALERTAS
   ========================================================================== */

const cargarAlertas = async () => {
  const alertas = await api("/api/profesional/alertas");
  const lista = $("#listaAlertas");
  lista.innerHTML = "";

  if (!alertas.length) {
    lista.innerHTML = vacio("No hay alertas de riesgo por ahora.");
    return;
  }

  alertas.forEach((alerta) => {
    const card = H("article", { className: "card alerta-card" }, `
      <div class="cab">
        <h3></h3>
        <span class="etq ${alerta.nivel === "alto" ? "riesgo" : "pendiente"}"></span>
        ${alerta.atendida ? '<span class="etq">ATENDIDA</span>' : ""}
      </div>
      <p class="alerta-desc"></p>
      <p class="hint"></p>
      <div class="acciones"></div>
    `);

    card.querySelector("h3").textContent = alerta.usuaria;
    card.querySelector(".etq").textContent = "Nivel " + alerta.nivel;
    card.querySelector(".alerta-desc").textContent = alerta.descripcion;
    card.querySelector(".hint").textContent =
      fmtMarcaUTC(alerta.creado_en) +
      (alerta.profesional ? " · Asignada a " + alerta.profesional : " · Sin asignar");

    if (!alerta.atendida) {
      const boton = H("button", { className: "btn sm", type: "button" }, "MARCAR ATENDIDA");
      boton.onclick = async () => {
        try {
          await api("/api/profesional/alertas/" + alerta.id, {
            method: "PATCH",
            body: { atendida: true },
          });
          aviso("Alerta marcada como atendida.");
          await cargarAlertas();
        } catch (e) {
          aviso(e.message, true);
        }
      };
      card.querySelector(".acciones").appendChild(boton);
    }

    lista.appendChild(card);
  });
};

/* ==========================================================================
   DISPONIBILIDAD
   ========================================================================== */

const DIAS = [
  [1, "Lunes"],
  [2, "Martes"],
  [3, "Miércoles"],
  [4, "Jueves"],
  [5, "Viernes"],
  [6, "Sábado"],
  [0, "Domingo"],
];

const construirDias = () => {
  const caja = $("#diasDispo");
  caja.innerHTML = "";

  DIAS.forEach(([valor, nombre]) => {
    const etiqueta = document.createElement("label");
    const casilla = document.createElement("input");
    casilla.type = "checkbox";
    casilla.value = valor;
    etiqueta.appendChild(casilla);
    etiqueta.appendChild(document.createTextNode(" " + nombre));
    caja.appendChild(etiqueta);
  });
};

const cargarDisponibilidad = async () => {
  state.disponibilidad = await api("/api/profesional/disponibilidad");
  pintarDisponibilidad();
};

const pintarDisponibilidad = () => {
  const caja = $("#rangosDispo");
  caja.innerHTML = "";

  if (!state.disponibilidad.length) {
    caja.innerHTML = vacio("Todavía no has definido horarios de atención.");
  } else {
    state.disponibilidad.forEach((rango) => {
      const nombreDia = DIAS.find(([valor]) => Number(valor) === Number(rango.dia_semana));
      caja.appendChild(
        H(
          "p",
          { className: "rango" },
          `<strong>${esc(nombreDia ? nombreDia[1] : rango.dia_semana)}</strong> · ${esc(rango.hora_inicio)} a ${esc(rango.hora_fin)}`,
        ),
      );
    });
  }

  const dias = [...new Set(state.disponibilidad.map((r) => Number(r.dia_semana)))];
  $$("#diasDispo input").forEach((casilla) => {
    casilla.checked = dias.includes(Number(casilla.value));
  });

  if (state.disponibilidad.length) {
    $("#horaInicio").value = state.disponibilidad[0].hora_inicio;
    $("#horaFin").value = state.disponibilidad[0].hora_fin;
  }
};

$("#formDispo").onsubmit = async (evento) => {
  evento.preventDefault();

  const error = $("#errDispo");
  error.textContent = "";

  const dias = $$("#diasDispo input:checked").map((c) => Number(c.value));
  const inicio = $("#horaInicio").value;
  const fin = $("#horaFin").value;

  if (!dias.length) {
    error.textContent = "Selecciona al menos un día de atención.";
    return;
  }
  if (!inicio || !fin || fin <= inicio) {
    error.textContent = "La hora final debe ser mayor que la inicial.";
    return;
  }

  const boton = $("#formDispo button[type='submit']");
  boton.disabled = true;

  try {
    await api("/api/profesional/disponibilidad", {
      method: "PUT",
      body: {
        rangos: dias.map((dia) => ({
          dia_semana: dia,
          hora_inicio: inicio,
          hora_fin: fin,
        })),
      },
    });

    aviso("Disponibilidad actualizada.");
    await cargarDisponibilidad();
  } catch (e) {
    error.textContent = e.message;
  } finally {
    boton.disabled = false;
  }
};

/* ==========================================================================
   INICIO
   ========================================================================== */

const iniciarPanel = async () => {
  construirDias();

  const local = Sesion.get();
  mostrarSesion(local);

  const sesion = await Sesion.sincronizar();
  mostrarSesion(sesion);

  if (!sesion) {
    $("#sinSesion").hidden = false;
    $("#panelProfesional").hidden = true;
    return;
  }

  if (sesion.rol === "usuaria") {
    location.replace("acompanamiento.html");
    return;
  }

  if (sesion.rol === "admin") {
    location.replace("admin.html");
    return;
  }

  if (sesion.rol !== "profesional") {
    $("#sinSesion").hidden = false;
    $("#panelProfesional").hidden = true;
    return;
  }

  state.sesion = sesion;
  $("#sinSesion").hidden = true;
  $("#panelProfesional").hidden = false;

  const resultados = await Promise.allSettled([
    cargarCitas(),
    cargarConversaciones(),
    cargarAlertas(),
    cargarDisponibilidad(),
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

iniciarPanel();
