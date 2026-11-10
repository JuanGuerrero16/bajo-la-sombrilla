/* ==========================================================================
   MAPA DE SERVICIOS · LEAFLET + OPENSTREETMAP
   ========================================================================== */

const $ = (selector) => document.querySelector(selector);

const COLORES = {
  Fundaciones: "#4a2260",
  Albergues: "#f28c28",
  Salud: "#2e7d32",
  Empleo: "#1565c0",
  "Comisarías de familia": "#b3361a",
  Educación: "#7b1fa2",
  "Atención psicosocial": "#00838f",
  Otro: "#5f6368",
};

const esc = (s) =>
  String(s == null ? "" : s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );

let servicios = [];
let mapa = null;
let capa = null;
let marcadores = new Map();
let ubicacionUsuario = null;

$("#burger").onclick = () => {
  const abierto = $("#mm").classList.toggle("open");
  $("#burger").setAttribute("aria-expanded", abierto);
};

document.querySelectorAll("#mm a").forEach((enlace) => {
  enlace.onclick = () => {
    $("#mm").classList.remove("open");
    $("#burger").setAttribute("aria-expanded", "false");
  };
});

const colorCategoria = (categoria) => COLORES[categoria] || COLORES.Otro;

const crearMapa = () => {
  mapa = L.map("mapa", {
    center: [4.65, -74.07],
    zoom: 11,
    scrollWheelZoom: true,
    zoomControl: true,
  });

  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>',
  }).addTo(mapa);

  capa = L.layerGroup().addTo(mapa);
};

const popupServicio = (servicio) => {
  const telefono = String(servicio.telefono || "").replace(/\s+/g, "");

  return `
    <div class="popup-servicio">
      <strong>${esc(servicio.nombre)}</strong>
      <span class="popup-categoria" style="background:${colorCategoria(servicio.categoria)}">
        ${esc(servicio.categoria)}
      </span>
      <p>${esc(servicio.direccion || "")}${servicio.ciudad ? " · " + esc(servicio.ciudad) : ""}</p>
      ${servicio.horario ? `<p><b>Horario:</b> ${esc(servicio.horario)}</p>` : ""}
      ${servicio.descripcion ? `<p>${esc(servicio.descripcion)}</p>` : ""}
      ${
        telefono
          ? `<a class="popup-tel" href="tel:${esc(telefono)}">📞 ${esc(servicio.telefono)}</a>`
          : ""
      }
      ${
        servicio.web
          ? `<a class="popup-web" href="${esc(servicio.web)}" target="_blank" rel="noopener">Más información</a>`
          : ""
      }
    </div>
  `;
};

const pintarResultados = (lista) => {
  const caja = $("#resultados");
  caja.innerHTML = "";

  if (!lista.length) {
    caja.innerHTML = '<div class="vacio">No hay servicios con esos filtros.</div>';
    return;
  }

  lista.forEach((servicio) => {
    const card = document.createElement("article");
    card.className = "map-result";

    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "map-result-btn";

    const titulo = document.createElement("strong");
    titulo.textContent = servicio.nombre;

    const detalle = document.createElement("span");
    detalle.textContent = `${servicio.categoria} · ${servicio.ciudad}`;

    const direccion = document.createElement("small");
    direccion.textContent = servicio.direccion || "";

    boton.appendChild(titulo);
    boton.appendChild(detalle);
    boton.appendChild(direccion);

    boton.onclick = () => {
      const marcador = marcadores.get(servicio.id);
      if (!marcador) return;
      mapa.setView([Number(servicio.lat), Number(servicio.lng)], 16, { animate: true });
      marcador.openPopup();
      $("#mapa").scrollIntoView({ behavior: "smooth", block: "center" });
    };

    card.appendChild(boton);
    caja.appendChild(card);
  });
};

const pintarLeyenda = (lista) => {
  const caja = $("#leyenda");
  caja.innerHTML = "";

  const categorias = [...new Set(lista.map((s) => s.categoria))].sort();

  categorias.forEach((categoria) => {
    const item = document.createElement("span");
    item.className = "leyenda-item";
    item.innerHTML = `<span class="leyenda-dot" style="background:${colorCategoria(categoria)}"></span>${esc(categoria)}`;
    caja.appendChild(item);
  });
};

const aplicarFiltros = () => {
  const categoria = $("#filtroCategoria").value;
  const ciudad = $("#filtroCiudad").value;

  const filtrados = servicios.filter(
    (s) =>
      (!categoria || s.categoria === categoria) &&
      (!ciudad || s.ciudad === ciudad),
  );

  capa.clearLayers();
  marcadores = new Map();

  filtrados.forEach((servicio) => {
    const marcador = L.circleMarker([Number(servicio.lat), Number(servicio.lng)], {
      radius: 9,
      fillColor: colorCategoria(servicio.categoria),
      color: "#ffffff",
      weight: 2,
      opacity: 1,
      fillOpacity: 0.92,
    });

    marcador.bindPopup(popupServicio(servicio), { maxWidth: 320 });
    marcador.addTo(capa);
    marcadores.set(servicio.id, marcador);
  });

  const contador = $("#contador");
  contador.textContent =
    filtrados.length === 1
      ? "1 servicio encontrado"
      : `${filtrados.length} servicios encontrados`;

  pintarResultados(filtrados);
  pintarLeyenda(filtrados);

  if (filtrados.length) {
    const limites = L.latLngBounds(
      filtrados.map((s) => [Number(s.lat), Number(s.lng)]),
    );
    mapa.fitBounds(limites.pad(0.12), { maxZoom: 15 });
  }
};

const cargarFiltros = (filtros) => {
  const categorias = $("#filtroCategoria");
  const ciudades = $("#filtroCiudad");

  filtros.categorias.forEach((categoria) => {
    const opcion = document.createElement("option");
    opcion.value = categoria;
    opcion.textContent = categoria;
    categorias.appendChild(opcion);
  });

  filtros.ciudades.forEach((ciudad) => {
    const opcion = document.createElement("option");
    opcion.value = ciudad;
    opcion.textContent = ciudad;
    ciudades.appendChild(opcion);
  });

  categorias.onchange = aplicarFiltros;
  ciudades.onchange = aplicarFiltros;
};

$("#verTodos").onclick = () => {
  $("#filtroCategoria").value = "";
  $("#filtroCiudad").value = "";
  aplicarFiltros();
};

$("#miUbicacion").onclick = () => {
  if (!navigator.geolocation) {
    $("#contador").textContent = "Tu navegador no permite obtener la ubicación.";
    return;
  }

  $("#contador").textContent = "Buscando tu ubicación...";

  navigator.geolocation.getCurrentPosition(
    (posicion) => {
      const { latitude, longitude } = posicion.coords;

      if (ubicacionUsuario) mapa.removeLayer(ubicacionUsuario);

      ubicacionUsuario = L.circleMarker([latitude, longitude], {
        radius: 10,
        fillColor: "#1565c0",
        color: "#fff",
        weight: 3,
        fillOpacity: 0.95,
      })
        .addTo(mapa)
        .bindPopup("<strong>Tu ubicación aproximada</strong>")
        .openPopup();

      mapa.setView([latitude, longitude], 15);
      $("#contador").textContent = "Ubicación encontrada. Los servicios se mantienen en el mapa.";
    },
    () => {
      $("#contador").textContent =
        "No pudimos obtener tu ubicación. Puedes buscar por ciudad o categoría.";
    },
    { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
  );
};

const iniciarMapa = async () => {
  crearMapa();

  try {
    const [lista, filtros] = await Promise.all([
      api("/api/servicios-mapa"),
      api("/api/servicios-mapa/filtros"),
    ]);

    servicios = lista;
    cargarFiltros(filtros);
    aplicarFiltros();
  } catch (e) {
    $("#contador").textContent =
      "No se pudieron cargar los servicios. Intenta de nuevo en unos minutos.";
    $("#resultados").innerHTML =
      '<div class="vacio">Sin conexión con el servidor.</div>';
  }
};

iniciarMapa();
