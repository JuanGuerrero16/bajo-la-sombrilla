/* ==========================================================================
   ACCESIBILIDAD COMPARTIDA
   Añade el panel de accesibilidad a todas las páginas y conserva las
   preferencias (tamaño de texto, contraste y movimiento) entre páginas.
   ========================================================================== */

(() => {
  "use strict";

  const CLAVE = "sombrilla_accesibilidad";
  const root = document.documentElement;

  const porDefecto = {
    fontSize: 100,
    contrast: false,
    motion: false,
  };

  const leerPreferencias = () => {
    try {
      const guardadas = JSON.parse(localStorage.getItem(CLAVE) || "{}");
      const fontSize = Number(guardadas.fontSize);

      return {
        fontSize:
          Number.isFinite(fontSize) && fontSize >= 85 && fontSize <= 150
            ? fontSize
            : porDefecto.fontSize,
        contrast: Boolean(guardadas.contrast),
        motion: Boolean(guardadas.motion),
      };
    } catch (e) {
      return { ...porDefecto };
    }
  };

  const prefs = leerPreferencias();

  let boton = document.getElementById("a11yBtn");
  let panel = document.getElementById("a11y");

  const guardar = () => {
    try {
      localStorage.setItem(CLAVE, JSON.stringify(prefs));
    } catch (e) {
      // Si el navegador bloquea el almacenamiento, los ajustes siguen
      // funcionando durante la visita actual.
    }
  };

  const aplicar = () => {
    root.style.fontSize = prefs.fontSize + "%";
    root.dataset.contrast = prefs.contrast ? "1" : "0";
    root.dataset.motion = prefs.motion ? "0" : "1";
  };

  const sincronizarBotones = () => {
    if (!panel) return;

    panel
      .querySelectorAll('[data-a="contrast"], [data-a11y="contrast"]')
      .forEach((el) => el.setAttribute("aria-pressed", String(prefs.contrast)));

    panel
      .querySelectorAll('[data-a="motion"], [data-a11y="motion"]')
      .forEach((el) => el.setAttribute("aria-pressed", String(prefs.motion)));
  };

  const crearPanel = () => {
    if (boton && panel) return;

    const header = document.querySelector("header") || document.body;
    const nav = header.querySelector(".nav");

    if (!boton) {
      boton = document.createElement("button");
      boton.type = "button";
      boton.className = "icon-btn";
      boton.id = "a11yBtn";
      boton.setAttribute("aria-expanded", "false");
      boton.setAttribute("aria-controls", "a11y");
      boton.innerHTML = '♿ <span>Accesibilidad</span>';

      if (nav) {
        const burger = nav.querySelector("#burger");
        nav.insertBefore(boton, burger || null);
      } else {
        header.appendChild(boton);
      }
    }

    if (!panel) {
      panel = document.createElement("div");
      panel.id = "a11y";
      panel.setAttribute("role", "dialog");
      panel.setAttribute("aria-label", "Opciones de accesibilidad");
      panel.innerHTML = `
        <strong>Ajusta la página a tu medida</strong>

        <button class="btn sm" type="button" data-a11y="up">
          A+ Aumentar texto
        </button>

        <button class="btn sm" type="button" data-a11y="down">
          A− Reducir texto
        </button>

        <button class="btn sm" type="button" data-a11y="contrast" aria-pressed="false">
          ◐ Alto contraste
        </button>

        <button class="btn sm" type="button" data-a11y="motion" aria-pressed="false">
          Reducir movimiento
        </button>

        <button class="btn sm" type="button" data-a11y="reset">
          Restablecer
        </button>
      `;

      header.appendChild(panel);
    }
  };

  const alternarPanel = (estado) => {
    if (!boton || !panel) return;

    const abierto =
      typeof estado === "boolean"
        ? estado
        : !panel.classList.contains("open");

    panel.classList.toggle("open", abierto);
    boton.setAttribute("aria-expanded", String(abierto));

    if (abierto) {
      const primero = panel.querySelector("button");
      if (primero) primero.focus();
    }
  };

  const accion = (tipo) => {
    if (tipo === "up") {
      prefs.fontSize = Math.min(150, prefs.fontSize + 10);
    }

    if (tipo === "down") {
      prefs.fontSize = Math.max(85, prefs.fontSize - 10);
    }

    if (tipo === "contrast") {
      prefs.contrast = !prefs.contrast;
    }

    if (tipo === "motion") {
      prefs.motion = !prefs.motion;
    }

    if (tipo === "reset") {
      prefs.fontSize = porDefecto.fontSize;
      prefs.contrast = porDefecto.contrast;
      prefs.motion = porDefecto.motion;
    }

    aplicar();
    guardar();
    sincronizarBotones();
  };

  const iniciar = () => {
    crearPanel();

    if (!boton || !panel) return;

    aplicar();
    sincronizarBotones();

    boton.addEventListener("click", () => alternarPanel());

    panel
      .querySelectorAll('[data-a="up"], [data-a11y="up"]')
      .forEach((el) => el.addEventListener("click", () => accion("up")));

    panel
      .querySelectorAll('[data-a="down"], [data-a11y="down"]')
      .forEach((el) => el.addEventListener("click", () => accion("down")));

    panel
      .querySelectorAll('[data-a="contrast"], [data-a11y="contrast"]')
      .forEach((el) => el.addEventListener("click", () => accion("contrast")));

    panel
      .querySelectorAll('[data-a="motion"], [data-a11y="motion"]')
      .forEach((el) => el.addEventListener("click", () => accion("motion")));

    panel
      .querySelectorAll('[data-a="reset"], [data-a11y="reset"]')
      .forEach((el) => el.addEventListener("click", () => accion("reset")));

    // Enlace del pie de página del inicio.
    const enlacePie = document.getElementById("fa");
    if (enlacePie) {
      enlacePie.addEventListener("click", (evento) => {
        evento.preventDefault();
        alternarPanel(true);
        window.scrollTo({ top: 0 });
      });
    }

    document.addEventListener("keydown", (evento) => {
      if (evento.key === "Escape" && panel.classList.contains("open")) {
        alternarPanel(false);
        boton.focus();
      }
    });

    document.addEventListener("click", (evento) => {
      if (!panel.classList.contains("open")) return;
      if (panel.contains(evento.target) || boton.contains(evento.target)) return;
      if (enlacePie && enlacePie.contains(evento.target)) return;
      alternarPanel(false);
    });
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", iniciar, { once: true });
  } else {
    iniciar();
  }
})();
