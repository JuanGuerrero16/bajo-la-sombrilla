
// ==========================================
// CONFIGURACIÓN DE LA SESIÓN
// ==========================================

// Nombre de la clave utilizada en localStorage.
const KEY = 'sombrilla_sesion';


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

    // Guardar el nombre o seudónimo del usuario.
    set(nombre) {
        try {
            localStorage.setItem(
                KEY,
                JSON.stringify({ nombre })
            );
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
    }

};


// ==========================================
// REDIRECCIÓN DESPUÉS DE UNA ACCIÓN
// ==========================================

const siguiente = () => {

    // Obtener el parámetro "next" de la URL.
    const parametros = new URLSearchParams(location.search);
    const destino = parametros.get('next');

    // Permitir únicamente destinos con formato nombre.html.
    if (destino && /^[\w-]+\.html$/.test(destino)) {
        return destino;
    }

    // Página predeterminada.
    return 'Bajo_la_sombrilla.html';
};


// ==========================================
// MOSTRAR ERRORES EN LOS FORMULARIOS
// ==========================================

const marcarError = (campo, caja, mensaje) => {

    // Mostrar el mensaje de error.
    caja.textContent = mensaje;

    // Indicar que el campo contiene un error.
    campo.setAttribute('aria-invalid', 'true');

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

    const respuesta = await fetch(url, {
        method: opciones.method || 'GET',
        headers: opciones.body ? { 'Content-Type': 'application/json' } : {},
        body: opciones.body ? JSON.stringify(opciones.body) : undefined,
        credentials: 'same-origin'
    });

    let datos = null;

    try {
        datos = await respuesta.json();
    } catch (e) {
        datos = null;
    }

    if (!respuesta.ok) {
        const error = new Error(
            (datos && datos.error) || 'Ocurrió un error. Intenta de nuevo.'
        );

        error.status = respuesta.status;
        throw error;
    }

    return datos;
};

// Mensaje cuando no se puede hablar con el servidor.
const SIN_CONEXION =
    'No hay conexión con el servidor. Intenta de nuevo en unos minutos.';

// Comprueba con el servidor si la sesión sigue vigente
// y actualiza la copia local. Devuelve la sesión resultante.
Sesion.sincronizar = async () => {

    try {
        const datos = await api('/api/yo');

        if (datos.usuaria) {
            Sesion.set(datos.usuaria.nombre);
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
        await api('/api/logout', { method: 'POST' });
    } catch (e) {
        // Aun así se limpia la copia local.
    }

    Sesion.clear();
};
