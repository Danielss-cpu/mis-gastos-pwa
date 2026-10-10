// ============================================
// 1. REGISTRO DEL SERVICE WORKER (PWA Offline)
// ============================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // Eliminar caché obsoleta si existiera
        if ('caches' in window) {
            caches.delete('mis-gastos-v1');
        }

        navigator.serviceWorker.register('./sw.js')
            .then((registration) => {
                console.log('✅ Service Worker registrado con éxito en:', registration.scope);
                // Forzar comprobación de actualización
                registration.update();
            })
            .catch((error) => {
                console.error('❌ Error al registrar el Service Worker:', error);
            });
    });
}

// ============================================
// 2. ELEMENTOS DEL DOM
// ============================================
const inputConcepto = document.getElementById('concepto');
const inputCantidad = document.getElementById('cantidad');
const selectCategoria = document.getElementById('categoria');
const btnAgregar = document.getElementById('agregar');
const labelTotal = document.getElementById('total');
const listaGastos = document.getElementById('lista-gastos');
const btnNotificacion = document.getElementById('notificacion');
const btnInstalar = document.getElementById('btn-instalar');
const badgeRed = document.getElementById('estado-red');
const textoRed = document.getElementById('texto-red');

// ============================================
// 3. ESTADO Y ALMACENAMIENTO (localStorage)
// ============================================
const STORAGE_KEY = 'mis_gastos_pwa_datos';
let gastos = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];

// Guardar en localStorage
function guardarEnLocalStorage() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(gastos));
}

// Formatear montos a moneda ($0.00)
function formatearMoneda(monto) {
    return '$' + Number(monto).toLocaleString('es-MX', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

// ============================================
// 4. RENDERIZADO Y CÁLCULOS
// ============================================
function actualizarTotal() {
    const total = gastos.reduce((acumulado, item) => acumulado + item.cantidad, 0);
    labelTotal.textContent = formatearMoneda(total);
}

function renderizarGastos() {
    listaGastos.innerHTML = '';

    if (gastos.length === 0) {
        listaGastos.innerHTML = `
            <div class="empty-state">
                <p>No tienes gastos registrados todavía.</p>
                <p>¡Agrega tu primer gasto arriba! 👆</p>
            </div>
        `;
        actualizarTotal();
        return;
    }

    gastos.forEach((gasto) => {
        const li = document.createElement('li');
        const catKey = gasto.categoria.split(' ').pop();

        li.innerHTML = `
            <div class="gasto-info">
                <span class="gasto-concepto">${escapeHTML(gasto.concepto)}</span>
                <div class="gasto-meta">
                    <span class="categoria-tag categoria-${catKey}">${escapeHTML(gasto.categoria)}</span>
                    <span>${gasto.fecha}</span>
                </div>
            </div>
            <div class="gasto-monto-area">
                <span class="gasto-monto">${formatearMoneda(gasto.cantidad)}</span>
                <button class="btn-eliminar" data-id="${gasto.id}" title="Eliminar gasto">✕</button>
            </div>
        `;

        listaGastos.appendChild(li);
    });

    actualizarTotal();
}

// Sanitizar entradas para prevenir inyecciones de texto
function escapeHTML(texto) {
    const div = document.createElement('div');
    div.textContent = texto;
    return div.innerHTML;
}

// ============================================
// 5. REGISTRAR Y ELIMINAR GASTOS
// ============================================
function agregarGasto() {
    const concepto = inputConcepto.value.trim();
    const cantidad = parseFloat(inputCantidad.value);
    const categoria = selectCategoria.value;

    if (!concepto) {
        mostrarToast('Campo obligatorio', 'Por favor, escribe el concepto del gasto.', 'alerta');
        inputConcepto.focus();
        return;
    }

    if (isNaN(cantidad) || cantidad <= 0) {
        mostrarToast('Cantidad inválida', 'Ingresa una cantidad en pesos mayor a 0.', 'alerta');
        inputCantidad.focus();
        return;
    }

    const nuevoGasto = {
        id: Date.now(),
        concepto: concepto,
        cantidad: cantidad,
        categoria: categoria,
        fecha: new Date().toLocaleDateString('es-MX', {
            day: '2-digit',
            month: 'short'
        })
    };

    gastos.unshift(nuevoGasto);
    guardarEnLocalStorage();
    renderizarGastos();

    // 1. Notificación visual en pantalla (Toast)
    mostrarToast(
        '¡Gasto registrado con éxito! 🎉',
        `${nuevoGasto.concepto} por ${formatearMoneda(nuevoGasto.cantidad)} (${nuevoGasto.categoria})`,
        'exito'
    );

    // 2. Efecto de sonido suave de caja registradora / éxito
    reproducirSonidoExito();

    // 3. Notificación nativa del sistema (Windows / Celular / Mac)
    notificarGastoRegistrado(nuevoGasto);

    // Limpiar campos y dar foco
    inputConcepto.value = '';
    inputCantidad.value = '';
    inputConcepto.focus();
}

function eliminarGasto(id) {
    const gastoEliminado = gastos.find(item => item.id === id);
    gastos = gastos.filter(item => item.id !== id);
    guardarEnLocalStorage();
    renderizarGastos();

    mostrarToast(
        'Gasto eliminado 🗑️',
        gastoEliminado ? `"${gastoEliminado.concepto}" fue eliminado.` : 'El gasto fue eliminado del historial.',
        'eliminado'
    );
}

// Escuchador de agregar
btnAgregar.addEventListener('click', agregarGasto);

// Permitir presionar "Enter" en los inputs para registrar
[inputConcepto, inputCantidad].forEach(input => {
    input.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            agregarGasto();
        }
    });
});

// Delegación de eventos para eliminar gastos
listaGastos.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-eliminar')) {
        const id = Number(e.target.getAttribute('data-id'));
        eliminarGasto(id);
    }
});

// ============================================
// 6. EFECTO DE SONIDO (Web Audio API)
// ============================================
function reproducirSonidoExito() {
    try {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) return;
        const ctx = new AudioContext();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, ctx.currentTime); // Nota Re5
        osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08); // Nota La5

        gain.gain.setValueAtTime(0.12, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start();
        osc.stop(ctx.currentTime + 0.22);
    } catch (e) {
        // En navegadores con políticas estrictas de audio se omite sin error
    }
}

// ============================================
// 7. NOTIFICACIONES (PANTALLA Y SISTEMA)
// ============================================

// A. Mostrar notificación flotante (Toast)
function mostrarToast(titulo, mensaje, tipo = 'exito') {
    let contenedor = document.getElementById('toast-container');
    if (!contenedor) {
        contenedor = document.createElement('div');
        contenedor.id = 'toast-container';
        contenedor.className = 'toast-container';
        document.body.appendChild(contenedor);
    }

    const toast = document.createElement('div');
    toast.className = `toast toast-${tipo}`;

    let icono = '✅';
    if (tipo === 'eliminado') icono = '🗑️';
    if (tipo === 'alerta') icono = '⚠️';

    toast.innerHTML = `
        <span class="toast-icono">${icono}</span>
        <div class="toast-texto">
            <span class="toast-titulo">${escapeHTML(titulo)}</span>
            <span class="toast-mensaje">${escapeHTML(mensaje)}</span>
        </div>
    `;

    contenedor.appendChild(toast);

    // Remover automáticamente tras 3.5 segundos
    setTimeout(() => {
        toast.style.animation = 'toastOut 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards';
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

// B. Enviar notificación del sistema (Barra de notificaciones del SO / móvil)
function enviarNotificacion(titulo, cuerpo) {
    if (!('Notification' in window)) {
        console.warn('Este navegador no soporta la API de notificaciones.');
        return;
    }

    if (Notification.permission !== 'granted') {
        console.warn('Permiso de notificación no otorgado aún:', Notification.permission);
        return;
    }

    const opciones = {
        body: cuerpo,
        icon: 'icons/icon-192.png',
        badge: 'icons/icon-192.png',
        tag: 'gasto-' + Date.now(),
        renotify: true,
        vibrate: [150, 80, 150]
    };

    // Intentar con Service Worker para soporte óptimo en PWA
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then((reg) => {
            reg.showNotification(titulo, opciones).catch(() => {
                new Notification(titulo, opciones);
            });
        }).catch(() => {
            new Notification(titulo, opciones);
        });
    } else {
        try {
            new Notification(titulo, opciones);
        } catch (e) {
            console.warn('Fallo al invocar Notification():', e);
        }
    }
}

// C. Lanzar notificación automática al registrar gasto
function notificarGastoRegistrado(gasto) {
    if (!('Notification' in window)) return;

    const titulo = '¡Gasto Registrado! 💳';
    const cuerpo = `Registraste "${gasto.concepto}" por ${formatearMoneda(gasto.cantidad)} (${gasto.categoria}).`;

    if (Notification.permission === 'granted') {
        enviarNotificacion(titulo, cuerpo);
    } else if (Notification.permission === 'default') {
        // Solicita el permiso amigablemente con el clic del usuario
        Notification.requestPermission().then((permiso) => {
            if (permiso === 'granted') {
                enviarNotificacion(titulo, cuerpo);
                if (btnNotificacion) {
                    btnNotificacion.textContent = '🔔 Notificaciones Activas';
                    btnNotificacion.disabled = true;
                }
            }
        });
    } else if (Notification.permission === 'denied') {
        console.log('Las notificaciones del sistema están denegadas en el navegador.');
    }
}

// D. Botón explícito para activar notificaciones
async function activarNotificaciones() {
    if (!('Notification' in window)) {
        alert('Este navegador no soporta notificaciones de escritorio.');
        return;
    }

    if (Notification.permission === 'granted') {
        enviarNotificacion(
            'Mis Gastos PWA 💰',
            '¡Notificaciones activas! Cada vez que agregues un gasto recibirás una alerta como esta.'
        );
        mostrarToast('Notificaciones activas ✅', 'Ya tienes habilitadas las alertas del sistema.', 'exito');
        btnNotificacion.textContent = '🔔 Notificaciones Activas';
        btnNotificacion.disabled = true;
        return;
    }

    if (Notification.permission === 'denied') {
        mostrarToast(
            'Notificaciones bloqueadas 🔒',
            'Haz clic en el candado junto a la URL para permitir notificaciones.',
            'alerta'
        );
        alert('Las notificaciones están bloqueadas en tu navegador.\n\nPara permitirlas:\n1. Haz clic en el icono del candado 🔒 o de ajustes al lado de la barra de dirección.\n2. En "Notificaciones", selecciona "Permitir".\n3. Recarga la página.');
        return;
    }

    const permiso = await Notification.requestPermission();
    if (permiso === 'granted') {
        enviarNotificacion(
            '¡Bienvenido a Mis Gastos! 💰',
            'Notificaciones activadas con éxito. Recibirás un aviso en cada gasto que registres.'
        );
        mostrarToast('¡Notificaciones activadas! ✅', 'Permisos concedidos correctamente.', 'exito');
        btnNotificacion.textContent = '🔔 Notificaciones Activas';
        btnNotificacion.disabled = true;
    } else {
        mostrarToast('Permiso no concedido', 'Puedes activarlas más tarde en el navegador.', 'alerta');
    }
}

btnNotificacion.addEventListener('click', activarNotificaciones);

// Comprobar estado previo de notificaciones
if ('Notification' in window && Notification.permission === 'granted') {
    btnNotificacion.textContent = '🔔 Notificaciones Activas';
}

// ============================================
// 8. DETECCIÓN DE CONEXIÓN (ONLINE / OFFLINE)
// ============================================
function actualizarEstadoRed() {
    if (navigator.onLine) {
        badgeRed.classList.remove('offline');
        textoRed.textContent = 'En línea';
    } else {
        badgeRed.classList.add('offline');
        textoRed.textContent = 'Modo sin conexión (Offline)';
    }
}

window.addEventListener('online', actualizarEstadoRed);
window.addEventListener('offline', actualizarEstadoRed);
actualizarEstadoRed();

// ============================================
// 9. INSTALACIÓN DE LA PWA (Prompt)
// ============================================
let eventoInstalacion = null;

window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    eventoInstalacion = e;
    btnInstalar.style.display = 'block';
});

btnInstalar.addEventListener('click', async () => {
    if (!eventoInstalacion) return;
    eventoInstalacion.prompt();
    const eleccion = await eventoInstalacion.userChoice;
    if (eleccion.outcome === 'accepted') {
        console.log('El usuario instaló la PWA');
    }
    eventoInstalacion = null;
    btnInstalar.style.display = 'none';
});

window.addEventListener('appinstalled', () => {
    btnInstalar.style.display = 'none';
    mostrarToast('¡App Instalada! 📲', 'Mis Gastos ahora está disponible en tus aplicaciones.', 'exito');
});

// ============================================
// 10. INICIALIZACIÓN
// ============================================
renderizarGastos();
