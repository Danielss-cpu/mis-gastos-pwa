// ============================================
// 1. REGISTRO DEL SERVICE WORKER (PWA Offline)
// ============================================
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then((registration) => {
                console.log('✅ Service Worker registrado con éxito en el alcance:', registration.scope);
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

        // Extraer nombre limpio de categoría (sin emoji) para clase CSS
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
        alert('Por favor, escribe el concepto del gasto.');
        inputConcepto.focus();
        return;
    }

    if (isNaN(cantidad) || cantidad <= 0) {
        alert('Por favor, ingresa una cantidad válida mayor a 0.');
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

    // Limpiar campos y dar foco
    inputConcepto.value = '';
    inputCantidad.value = '';
    inputConcepto.focus();
}

function eliminarGasto(id) {
    gastos = gastos.filter(item => item.id !== id);
    guardarEnLocalStorage();
    renderizarGastos();
}

// Escuchadores de eventos para gastos
btnAgregar.addEventListener('click', agregarGasto);

// Permitir presionar "Enter" en los inputs
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
// 6. NOTIFICACIONES WEB
// ============================================
function enviarNotificacion(titulo, cuerpo) {
    const opciones = {
        body: cuerpo,
        icon: 'icons/icon-192.png',
        badge: 'icons/icon-192.png',
        tag: 'mis-gastos-recordatorio'
    };

    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then((reg) => {
            reg.showNotification(titulo, opciones);
        });
    } else if ('Notification' in window) {
        new Notification(titulo, opciones);
    }
}

async function activarNotificaciones() {
    if (!('Notification' in window)) {
        alert('Este navegador no soporta notificaciones de escritorio.');
        return;
    }

    if (Notification.permission === 'granted') {
        enviarNotificacion(
            'Mis Gastos PWA 💰',
            '¡Recordatorio activo! Recuerda registrar tus compras de hoy para controlar tu presupuesto.'
        );
        btnNotificacion.textContent = '🔔 Notificaciones Activas';
        btnNotificacion.disabled = true;
        return;
    }

    if (Notification.permission !== 'denied') {
        const permiso = await Notification.requestPermission();
        if (permiso === 'granted') {
            enviarNotificacion(
                '¡Bienvenido a Mis Gastos! 💰',
                'Las notificaciones quedaron activadas con éxito. Te recordaremos llevar tu registro.'
            );
            btnNotificacion.textContent = '🔔 Notificaciones Activas';
            btnNotificacion.disabled = true;
        } else {
            alert('Has denegado el permiso para mostrar notificaciones.');
        }
    } else {
        alert('Las notificaciones están bloqueadas en los ajustes de tu navegador.');
    }
}

btnNotificacion.addEventListener('click', activarNotificaciones);

// Verificar permiso previo al iniciar
if ('Notification' in window && Notification.permission === 'granted') {
    btnNotificacion.textContent = '🔔 Notificaciones Activas';
}

// ============================================
// 7. DETECCIÓN DE CONEXIÓN (ONLINE / OFFLINE)
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
// 8. INSTALACIÓN DE LA PWA (Prompt)
// ============================================
let eventoInstalacion = null;

window.addEventListener('beforeinstallprompt', (e) => {
    // Previene el banner automático inmediato del navegador
    e.preventDefault();
    eventoInstalacion = e;
    // Muestra el botón para que el usuario o evaluador pueda instalarla
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
    console.log('¡PWA Mis Gastos instalada con éxito!');
});

// ============================================
// 9. INICIALIZACIÓN
// ============================================
renderizarGastos();
