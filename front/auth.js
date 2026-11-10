// ==========================================
// CONFIGURACIÓN DE LA SESIÓN
// ==========================================

// Nombre de la clave utilizada en localStorage.
const KEY = "sombrilla_sesion";

// ==========================================
// GESTIÓN DE LA SESIÓN
// ==========================================

const Sesion = {
  // Obtener la sesión guardada.
  get() {
    try {
      return JSON.parse(localStorage.getItem(KEY));
    } catch (e) {
      return null;
    }
  },

  // Guardar los datos básicos de la cuenta (nombre, rol e id).
  // Acepta un texto por compatibilidad con versiones anteriores.
  set(usuario) {
    try {
      const datos =
        typeof usuario === "string"
          ? { nombre: usuario }
          : {
              nombre: usuario && usuario.nombre,
              rol: usuario && usuario.rol,
              id: usuario && usuario.id,
            };

      localStorage.setItem(KEY, JSON.stringify(datos));
    } catch (e) {
      // No hacer nada si el almacenamiento no está disponible.
    }
  },

  // Cerrar la sesión y eliminar los datos guardados.
  clear() {
    try {
      localStorage.removeItem(KEY);
    } catch (e) {
      // No hacer nada si el almacenamiento no está disponible.
    }
  },
};

// En local se usa el puerto 3000. En producción se usa el mismo dominio
// desde el que se sirve el sitio (el servidor también sirve la carpeta front).
// Si el frontend vive en otro dominio, define window.SOMBRILLA_API_URL.
const API_URL =
  window.SOMBRILLA_API_URL ||
  (window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1"
    ? "http://localhost:3000"
    : window.location.origin);

// ==========================================
// REDIRECCIÓN DESPUÉS DE UNA ACCIÓN
// ==========================================

const siguiente = () => {
  // Obtener el parámetro "next" de la URL.
  const parametros = new URLSearchParams(location.search);
  const destino = parametros.get("next");

  // Permitir únicamente destinos con formato nombre.html.
  if (destino && /^[\w-]+\.html$/.test(destino)) {
    return destino;
  }

  // Página predeterminada.
  return "Bajo_la_sombrilla.html";
};

// ==========================================
// MOSTRAR ERRORES EN LOS FORMULARIOS
// ==========================================

const marcarError = (campo, caja, mensaje) => {
  // Mostrar el mensaje de error.
  caja.textContent = mensaje;

  // Indicar que el campo contiene un error.
  campo.setAttribute("aria-invalid", "true");

  // Llevar el cursor al campo que necesita corrección.
  campo.focus();
};

// ==========================================
// VALIDAR CORREOS ELECTRÓNICOS
// ==========================================

const emailValido = (valor) => {
  // Comprobar el formato básico del correo.
  const patron = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  return patron.test(valor);
};

// ==========================================
// COMUNICACIÓN CON EL SERVIDOR
// ==========================================

// Envía una petición a la API y devuelve la respuesta en JSON.
// Si el servidor responde con un error, lanza un Error con su mensaje
// (y el código en error.status).
const api = async (url, opciones = {}) => {
  const respuesta = await fetch(API_URL + url, {
    method: opciones.method || "GET",
    headers: opciones.body ? { "Content-Type": "application/json" } : {},
    body: opciones.body ? JSON.stringify(opciones.body) : undefined,
    credentials: "include",
  });

  let datos = null;

  try {
    datos = await respuesta.json();
  } catch (e) {
    datos = null;
  }

  if (!respuesta.ok) {
    const error = new Error(
      (datos && datos.error) || "Ocurrió un error. Intenta de nuevo.",
    );

    error.status = respuesta.status;
    throw error;
  }

  return datos;
};

// Mensaje cuando no se puede hablar con el servidor.
const SIN_CONEXION =
  "No hay conexión con el servidor. Intenta de nuevo en unos minutos.";

// Comprueba con el servidor si la sesión sigue vigente
// y actualiza la copia local. Devuelve la sesión resultante.
Sesion.sincronizar = async () => {
  try {
    const datos = await api("/api/yo");

    if (datos.usuaria) {
      Sesion.set(datos.usuaria);
    } else {
      Sesion.clear();
    }
  } catch (e) {
    // Sin conexión: se conserva lo que ya había.
  }

  return Sesion.get();
};

// Cierra la sesión en el servidor y en este navegador.
Sesion.cerrar = async () => {
  try {
    await api("/api/logout", { method: "POST" });
  } catch (e) {
    // Aun así se limpia la copia local.
  }

  Sesion.clear();
};
