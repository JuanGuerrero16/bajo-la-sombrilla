
/* ==========================================================================
   1. VARIABLES Y FUNCIONES AUXILIARES
   ========================================================================== */

const $ = (selector) => document.querySelector(selector);

const H = (tag, attributes = {}, innerHTML = '') =>
    Object.assign(document.createElement(tag), attributes, { innerHTML });

const rootElement = document.documentElement;

let fontSizePercentage = 100;


/* ==========================================================================
   2. DATOS DE LA APLICACIÓN
   ========================================================================== */

// Líneas de apoyo
const apoyoData = [
    [
        "📞",
        "155",
        "Línea nacional para orientación a mujeres",
        "Orientación para mujeres víctimas de violencia. Disponible las 24 horas.",
        [["155", "155"]]
    ],
    [
        "🚨",
        "123",
        "Línea única de emergencias",
        "Para situaciones de riesgo inmediato o emergencias médicas, policiales o de protección.",
        [["123", "123"]]
    ],
    [
        "⚖️",
        "Casas de Justicia",
        "",
        "Orientación jurídica y psicosocial gratuita y acceso a servicios de justicia y protección de derechos.",
        [["377 9595", "3779595"], ["195", "195"]]
    ],
    [
        "🏛️",
        "Alcaldía de Bogotá",
        "",
        "Información sobre programas y servicios de orientación, inclusión social, formación y empleabilidad.",
        [["195", "195"]],
        "https://bogota.gov.co/servicios/oportunidades-y-apoyos"
    ],
    [
        "📍",
        "Alcaldías locales",
        "",
        "Orientación sobre programas y servicios sociales, educativos y laborales disponibles en cada localidad.",
        []
    ]
];

// Organizaciones de apoyo
const orgsData = [
    [
        "Casa Libertad",
        "Programa de atención pospenitenciaria en Bogotá que brinda orientación psicosocial, jurídica y laboral.",
        [["377 9595 ext. 4900 / 4901 / 4902 / 4903", "3779595"]]
    ],
    [
        "Acción Interna",
        "Acompañamiento psicosocial, asesoría jurídica, formación, emprendimiento y oportunidades de empleo.",
        [["310 260 0134", "3102600134"]]
    ],
    [
        "Segundas oportunidades",
        "Orientación, formación, asesoría jurídica y oportunidades de empleabilidad.",
        [["310 260 0134", "3102600134"]]
    ],
    [
        "INPEC",
        "Orientación en salud, educación, acompañamiento psicosocial y asesoría jurídica.",
        [["234 7474", "2347474"]]
    ],
    [
        "Corporación Mujeres Libres",
        "Acompañamiento a mujeres privadas y pospenadas y sus familias.",
        [["323 247 1686", "3232471686"]]
    ],
    [
        "Fundación Retorno a la Libertad",
        "Acompañamiento psicosocial, orientación jurídica, formación y apoyo para la reintegración social y familiar.",
        [["312 547 5550", "3125475550"], ["317 550 5158", "3175505158"]],
        "https://fundacionretornoalalibertad.org/"
    ],
    [
        "SENA – Agencia Pública de Empleo",
        "Orientación ocupacional, formación, intermediación laboral y apoyo para emprendimiento.",
        []
    ],
    [
        "Alcaldía de Bogotá",
        "Oportunidades y apoyos disponibles en la ciudad.",
        [],
        "https://bogota.gov.co/servicios/oportunidades-y-apoyos"
    ]
];

// Áreas de ocupación
const ocupacionesData = [
    ["Trabajo y generación de ingresos", "Encontrar o crear una fuente de ingresos y un lugar en el mundo laboral."],
    ["Educación y formación", "Estudiar, aprender un oficio o retomar una meta educativa."],
    ["Emprendimiento", "Convertir un saber, una habilidad o una idea en un proyecto propio."],
    ["Cuidado de sí misma", "Descanso, salud, alimentación y tiempo para una misma."],
    ["Cuidado de otras personas", "Hijos, hijas, madres, familiares: cuidar también es una ocupación."],
    ["Reconstrucción de vínculos familiares", "Volver a encontrarse y construir nuevas formas de relación."],
    ["Nuevas redes sociales", "Amistades, grupos y comunidades donde se comparte y se cuenta con otras."],
    ["Participación comunitaria", "Ser parte de espacios del barrio, la localidad o la ciudad."],
    ["Recreación y tiempo libre", "Disfrutar, jugar, moverse, crear, salir a pasear."],
    ["Espiritualidad", "Prácticas y creencias que dan sentido y calma."],
    ["Organización de rutinas", "Diseñar los días con horarios y hábitos que se ajusten a tu vida."],
    ["Proyectos de vida", "Imaginar lo que quieres construir y decidir por dónde empezar."],
    ["Recuperación o construcción de roles", "Ser madre, hija, trabajadora, vecina, líder… los roles que elijas."],
    ["Nuevas formas de habitar la comunidad", "Moverte, usar servicios y sentirte parte del lugar donde vives."]
];

// Ruta de acompañamiento
const rutaData = [
    [
        "🗂️",
        "Salir y reorganizarse",
        "Documentación, identificación, orientación inicial y reconocimiento de necesidades inmediatas.",
        [
            "Registraduría Nacional",
            "Secretaría Distrital de Integración Social",
            "Defensoría del Pueblo",
            "Personerías",
            "Secretaría Distrital de la Mujer / Casas de Igualdad de Oportunidades"
        ]
    ],
    [
        "💚",
        "Cuidar la salud",
        "Acceso a servicios de salud física y mental, afiliación y orientación.",
        [
            "Secretaría Distrital de Salud",
            "Línea 106"
        ]
    ],
    [
        "🏠",
        "Encontrar estabilidad",
        "Vivienda, alimentación, recursos básicos y condiciones para la vida cotidiana.",
        [
            "Secretaría Distrital de Integración Social",
            "Secretaría Distrital del Hábitat",
            "Banco de Alimentos de Bogotá",
            "ICBF",
            "Manzanas del Cuidado"
        ]
    ],
    [
        "🧵",
        "Formarse y trabajar",
        "Educación, capacitación, empleo, emprendimiento y generación de ingresos.",
        [
            "SENA",
            "Agencia Pública de Empleo",
            "Secretaría Distrital de Desarrollo Económico",
            "Cámara de Comercio de Bogotá",
            "Manzanas del Cuidado",
            "IPES"
        ]
    ]
];

// Preguntas para reflexionar
const preguntasCaminoData = [
    ["¿Qué quieres construir?", "Puede ser algo grande o pequeño. Tú decides el tamaño."],
    ["¿Qué necesitas hoy?", "Hoy, no dentro de un año. Una sola cosa ya es un comienzo."],
    ["¿Qué te gustaría aprender?", "Un oficio, un idioma, una herramienta… lo que despierte tu curiosidad."],
    ["¿Qué actividad quieres recuperar o comenzar?", "Algo que disfrutabas, o algo que nunca has probado."],
    ["¿Con quién cuentas?", "Personas, grupos u organizaciones que ya están en tu camino."],
    ["¿Qué oportunidad estás buscando?", "Nombrarla ayuda a reconocerla cuando aparezca."]
];

// Opciones del formulario de orientación
const opcionesFormulario = [
    "Empleo",
    "Educación",
    "Salud",
    "Orientación jurídica",
    "Vivienda",
    "Emprendimiento",
    "Redes de apoyo",
    "Otro"
];


/* ==========================================================================
   3. RENDERIZADO DINÁMICO DE COMPONENTES
   ========================================================================== */

// Tarjetas de líneas de apoyo
$('#apoyoGrid').append(
    ...apoyoData.map(([icon, title, subtitle, desc, tels, link]) =>
        H('article', { className: 'card' }, `
            <div class="ico" aria-hidden="true">${icon}</div>
            <h3>${title}</h3>
            ${subtitle ? `<p><strong>${subtitle}</strong></p>` : ''}
            <p>${desc}</p>
            <div class="push">
                ${tels.map(([text, num]) =>
                    `<a class="tel" href="tel:${num}" aria-label="Llamar al ${text}">📞 ${text}</a>`
                ).join(' ')}
                ${link ? `
                    <div>
                        <a class="btn sm alt" href="${link}" target="_blank" rel="noopener">
                            Más información
                            <span class="sr" hidden>(abre en otra pestaña)</span>
                        </a>
                    </div>
                ` : ''}
            </div>
        `)
    )
);

// Tarjetas de organizaciones
$('#orgGrid').append(
    ...orgsData.map(([title, desc, tels, link]) =>
        H('article', { className: 'card' }, `
            <div class="mono" aria-hidden="true">${title[0]}</div>
            <h3>${title}</h3>
            <p>${desc}</p>
            <div class="push">
                ${tels.map(([text, num]) =>
                    `<a class="tel" href="tel:${num}" aria-label="Llamar al ${text}">📞 ${text}</a><br>`
                ).join('')}
                ${link ? `
                    <a class="btn sm alt" href="${link}" target="_blank" rel="noopener"
                       aria-label="Visitar sitio de ${title} (abre en otra pestaña)">
                        Visitar sitio
                    </a>
                ` : ''}
            </div>
        `)
    )
);

// Botones de áreas de ocupación
$('#chips').append(
    ...ocupacionesData.map(([title, desc]) => {
        const chipButton = H(
            'button',
            { className: 'chip', type: 'button' },
            title
        );

        chipButton.setAttribute('aria-pressed', 'false');

        chipButton.onclick = () => {
            document.querySelectorAll('.chip').forEach((chip) => {
                chip.setAttribute('aria-pressed', 'false');
            });

            chipButton.setAttribute('aria-pressed', 'true');

            $('#coreT').textContent = title;
            $('#coreP').textContent = desc;
        };

        return chipButton;
    })
);

// Pasos de la ruta de acompañamiento
$('#rutaL').append(
    ...rutaData.map(([icon, title, desc, resources], index) =>
        H('li', { className: 'st' }, `
            <span class="num" aria-hidden="true">${index + 1}</span>

            <div class="card">
                <div aria-hidden="true" style="font-size: 1.6rem">${icon}</div>

                <h3>
                    <span class="sr" style="position: absolute; left: -999px">
                        Estación ${index + 1}:
                    </span>
                    ${title}
                </h3>

                <p>${desc}</p>

                <ul id="r${index}" hidden>
                    ${resources.map((item) => `<li>${item}</li>`).join('')}
                </ul>

                <button
                    class="btn sm alt push"
                    aria-expanded="false"
                    aria-controls="r${index}"
                    data-r="${index}"
                    type="button">
                    Ver recursos
                </button>
            </div>
        `)
    )
);

// Preguntas del camino
$('#cam').append(
    ...preguntasCaminoData.map(([question, note]) => {
        const qButton = H(
            'button',
            { className: 'q', type: 'button' },
            `${question}<small hidden>${note}</small>`
        );

        qButton.setAttribute('aria-pressed', 'false');
        qButton.setAttribute('aria-expanded', 'false');

        qButton.onclick = () => {
            const smallText = qButton.querySelector('small');
            const isHidden = smallText.hidden;

            smallText.hidden = !isHidden;

            qButton.setAttribute('aria-expanded', isHidden);
            qButton.setAttribute('aria-pressed', isHidden);
        };

        return qButton;
    })
);

// Opciones del formulario
$('#opts').append(
    ...opcionesFormulario.map((option) =>
        H(
            'label',
            {},
            `<input type="checkbox" name="b" value="${option}"> ${option}`
        )
    )
);


/* ==========================================================================
   4. MANEJO DE EVENTOS E INTERACTIVIDAD
   ========================================================================== */

// Acordeón de la ruta: mostrar u ocultar recursos
document.querySelectorAll('[data-r]').forEach((btn) => {
    btn.onclick = () => {
        const targetList = $('#r' + btn.dataset.r);
        const isHidden = targetList.hidden;

        targetList.hidden = !isHidden;

        btn.setAttribute('aria-expanded', isHidden);
        btn.textContent = isHidden ? 'Ocultar recursos' : 'Ver recursos';
    };
});

// Envío del formulario de orientación
$('#f').onsubmit = async (e) => {
    e.preventDefault();

    const elegidas = [...document.querySelectorAll('[name="b"]:checked')]
        .map((x) => x.value);

    const messageValue = $('#m').value.trim();

    if (!elegidas.length && !messageValue) {
        $('#e').textContent =
            'Elige al menos una opción o cuéntanos brevemente qué necesitas, para poder orientarte.';

        $('#m').setAttribute('aria-invalid', 'true');
        $('#m').focus();

        return;
    }

    $('#e').textContent = '';
    $('#m').removeAttribute('aria-invalid');

    const boton = $('#f button[type="submit"]');
    boton.disabled = true;

    let mensajeError = '';

    try {
        const respuesta = await fetch('/api/solicitudes', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                nombre: $('#n').value.trim(),
                contacto: $('#c').value.trim(),
                motivos: elegidas,
                mensaje: messageValue
            })
        });

        if (!respuesta.ok) {
            const datos = await respuesta.json().catch(() => ({}));

            mensajeError = datos.error ||
                'No pudimos enviar tu solicitud. Intenta de nuevo.';
        }
    } catch (x) {
        mensajeError =
            'No hay conexión con el servidor. Intenta de nuevo en unos minutos.';
    }

    if (mensajeError) {
        $('#e').textContent = mensajeError;
        boton.disabled = false;

        return;
    }

    $('#f').style.display = 'none';

    const successBox = $('#ok');

    successBox.style.display = 'block';
    successBox.focus();
};

// Menú móvil
const burgerBtn = $('#burger');

burgerBtn.onclick = () => {
    const isOpen = $('#mm').classList.toggle('open');

    burgerBtn.setAttribute('aria-expanded', isOpen);
};

// Cerrar el menú móvil al seleccionar un enlace
document.querySelectorAll('#mm a').forEach((link) => {
    link.onclick = () => {
        $('#mm').classList.remove('open');
        burgerBtn.setAttribute('aria-expanded', 'false');
    };
});


/* ==========================================================================
   5. PANEL DE ACCESIBILIDAD
   ========================================================================== */

const a11yBtn = $('#a11yBtn');
const a11yPanel = $('#a11y');

const toggleA11yPanel = (state) => {
    const isOpen = state ?? !a11yPanel.classList.contains('open');

    a11yPanel.classList.toggle('open', isOpen);
    a11yBtn.setAttribute('aria-expanded', isOpen);
};

// Abrir o cerrar el panel
a11yBtn.onclick = () => toggleA11yPanel();

// Abrir el panel desde el enlace del pie de página
$('#fa').onclick = (e) => {
    e.preventDefault();

    toggleA11yPanel(true);
    a11yPanel.querySelector('button').focus();

    scrollTo({ top: 0 });
};

// Cerrar el panel con Escape
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        toggleA11yPanel(false);
        a11yBtn.focus();
    }
});

// Controles del panel de accesibilidad
a11yPanel.querySelectorAll('[data-a]').forEach((btn) => {
    btn.onclick = () => {
        const action = btn.dataset.a;

        // Aumentar tamaño del texto
        if (action === 'up') {
            fontSizePercentage = Math.min(150, fontSizePercentage + 10);
        }

        // Reducir tamaño del texto
        if (action === 'down') {
            fontSizePercentage = Math.max(85, fontSizePercentage - 10);
        }

        // Activar o desactivar alto contraste
        if (action === 'contrast') {
            const isContrast = rootElement.dataset.contrast !== '1';

            rootElement.dataset.contrast = isContrast ? '1' : '0';
            btn.setAttribute('aria-pressed', isContrast);
        }

        // Activar o desactivar animaciones
        if (action === 'motion') {
            const isMotion = rootElement.dataset.motion !== '0';

            rootElement.dataset.motion = isMotion ? '0' : '1';
            btn.setAttribute('aria-pressed', isMotion);
        }

        // Restaurar configuración predeterminada
        if (action === 'reset') {
            fontSizePercentage = 100;

            rootElement.dataset.contrast = '0';
            rootElement.dataset.motion = '1';

            a11yPanel.querySelectorAll('[aria-pressed]').forEach((element) => {
                element.setAttribute('aria-pressed', 'false');
            });
        }

        rootElement.style.fontSize = fontSizePercentage + '%';
    };
});


/* ==========================================================================
   6. ESTADO DE SESIÓN
   ========================================================================== */

// Cambiar los botones del encabezado si hay una sesión guardada
(() => {
    let ses = null;

    try {
        ses = JSON.parse(localStorage.getItem('sombrilla_sesion'));
    } catch (e) {
        ses = null;
    }

    if (!ses) return;

    // Si la sesión venció en el servidor, se limpia la copia local
    fetch('/api/yo')
        .then((r) => r.json())
        .then((d) => {
            if (!d.usuaria) {
                try {
                    localStorage.removeItem('sombrilla_sesion');
                } catch (x) {
                    // El almacenamiento local podría no estar disponible.
                }

                location.reload();
            }
        })
        .catch(() => {
            // Sin conexión: se deja todo como está.
        });

    // Cerrar la sesión (en el servidor y en este navegador)
    const salir = async (e) => {
        e.preventDefault();

        try {
            await fetch('/api/logout', { method: 'POST' });
        } catch (x) {
            // Aun así se limpia la sesión local.
        }

        try {
            localStorage.removeItem('sombrilla_sesion');
        } catch (x) {
            // El almacenamiento local podría no estar disponible.
        }

        location.reload();
    };

    // Cambiar los enlaces de inicio de sesión por cerrar sesión
    document.querySelectorAll('a[href="login.html"]').forEach((a) => {
        a.textContent = a.classList.contains('btn')
            ? 'CERRAR SESIÓN'
            : 'Cerrar sesión';

        a.href = '#';
        a.onclick = salir;
    });

    // Ocultar los enlaces de registro
    document.querySelectorAll('a[href="registro.html"]').forEach((a) => {
        a.style.display = 'none';
    });

    // Actualizar el enlace para compartir testimonios
    const t = $('#testiCuenta');

    if (t) {
        t.textContent = 'COMPARTIR CON MI CUENTA';
        t.href = 'testimonio.html';
    }
})();


/* ==========================================================================
   7. TESTIMONIOS PUBLICADOS (SECCIÓN "VOCES")
   ========================================================================== */

// Muestra los testimonios que el equipo aprobó
fetch('/api/testimonios')
    .then((r) => r.json())
    .then((lista) => {
        const grid = $('#voces .grid');

        if (!Array.isArray(lista) || !lista.length || !grid) return;

        grid.innerHTML = '';

        grid.append(
            ...lista.map((t) => {
                const card = H('article', { className: 'card' }, `
                    <div class="ico" aria-hidden="true">💬</div>
                    <h3></h3>
                    <p class="texto"></p>
                    <p class="meta"></p>
                `);

                const fecha = new Date(t.fecha);

                const mes = isNaN(fecha)
                    ? ''
                    : fecha.toLocaleDateString('es-CO', { month: 'long', year: 'numeric' });

                // textContent evita que se ejecute código escrito dentro del testimonio
                card.querySelector('h3').textContent = t.nombre;
                card.querySelector('.texto').textContent = t.texto;
                card.querySelector('.meta').textContent =
                    [t.areas, mes].filter(Boolean).join(' · ');

                return card;
            })
        );
    })
    .catch(() => {
        // Sin conexión: se dejan las tarjetas "Próximamente".
    });
