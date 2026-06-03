// ==========================================
// QUINIELA TREEBOLITO - Lógica Principal
// ==========================================

console.log("Cargando app.js...");

// Configuración
const CONFIG = {
    PRECIO_QUINIELA: 30,
    MANTENIMIENTO: 2,
    TOTAL_PARTIDOS: 10,
    PARTIDOS_LIGA_MX: 9,
    PARTIDOS_LALIGA: 1,
    HORAS_EXPIRACION: 24,
    CLABE: "722969010056604160",
    WHATSAPP: "4741482078",
    STORAGE_KEY: "quiniela_en_progreso"
};

console.log("CONFIG loaded:", CONFIG.TOTAL_PARTIDOS, "partidos");

// Estado de la aplicación
let quinielaActual = {
    id: null,
    pronosticos: [],
    nombre: "",
    whatsapp: ""
};

let partidos = [];
let partidosData = [];
let acumulado = 0;
let acumuladoMonto = 0;
let countdownInterval = null;
let ultimoMontoAcumulado = 0;
let registrosPausados = false;

console.log("Variables inicializadas");

// ==========================================
// INICIALIZACIÓN
// ==========================================

document.addEventListener("DOMContentLoaded", async() => {
    console.log("DOMContentLoaded fired");

    console.log("DB existe?", typeof db !== 'undefined');

    // Cargar partidos
    await cargarPartidos();
    console.log("Partidos cargados:", partidos.length);

    // Cargar acumulado
    await cargarAcumulado();

    // Cargar resultados
    await cargarResultados();

    // Cargar resultados en vivo
    await cargarResultadosLive();

    // Cargar ganador del ultimo sorteoo cerrado
    await cargarGanador();

    // Cargar ultimo sorteoo ID para detectar cambios
    await cargarSorteoActivoId();

    // Cargar ultimos 5 participantes
    await cargarUltimosParticipantes();

    // Cargar líderes actuales
    await cargarLideresActuales();

    // NO cargar quiniela guardada - cada vez empieza limpia
    // cargarQuinielaGuardada();

    // Setup event listeners
    setupEventListeners();

    // Generar ID inicial
    generarIdQuiniela();

    console.log("Inicialización completa");
});

// ==========================================
// PERSISTENCIA LOCAL
// ==========================================

function guardarQuinielaEnProgreso() {
    if (quinielaActual.pronosticos.some(p => p)) {
        const data = {
            pronosticos: quinielaActual.pronosticos,
            nombre: quinielaActual.nombre,
            whatsapp: quinielaActual.whatsapp,
            timestamp: Date.now()
        };
        localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(data));
    }
}

function cargarQuinielaGuardada() {
    try {
        const saved = localStorage.getItem(CONFIG.STORAGE_KEY);
        if (saved) {
            const data = JSON.parse(saved);
            const horasAntiguo = (Date.now() - data.timestamp) / 3600000;

            if (horasAntiguo < CONFIG.HORAS_EXPIRACION) {
                quinielaActual.pronosticos = data.pronosticos || [];
                quinielaActual.nombre = data.nombre || "";
                quinielaActual.whatsapp = data.whatsapp || "";

                if (quinielaActual.pronosticos.some(p => p)) {
                    renderizarPartidos();
                    actualizarSeleccion();
                    Toast.info("📋 Se restauró tu quiniela anterior");
                }
            } else {
                localStorage.removeItem(CONFIG.STORAGE_KEY);
            }
        }
    } catch (e) {
        console.log("No hay quiniela guardada");
    }
}

function limpiarQuinielaGuardada() {
    localStorage.removeItem(CONFIG.STORAGE_KEY);
}

// ==========================================
// CONTADOR REGRESIVO
// ==========================================

function iniciarCountdown(fechaExpiracion) {
    if (countdownInterval) clearInterval(countdownInterval);

    const actualizar = () => {
        const ahora = Date.now();
        const resta = new Date(fechaExpiracion) - ahora;

        if (resta <= 0) {
            clearInterval(countdownInterval);
            Toast.warning("⏰ Tu quiniela ha expirado");
            return;
        }

        const horas = Math.floor(resta / 3600000);
        const minutos = Math.floor((resta % 3600000) / 60000);
        const segundos = Math.floor((resta % 60000) / 1000);

        const elementos = document.querySelectorAll(".countdown-timer");
        elementos.forEach(el => {
            el.textContent = `${horas}h ${minutos}m ${segundos}s`;
        });
    };

    actualizar();
    countdownInterval = setInterval(actualizar, 1000);
}

// ==========================================
// UTILIDADES DE FECHA
// ==========================================

function formatearFecha(fechaISO, horaStr) {
    try {
        const [year, month, day] = fechaISO.split('-').map(Number);
        
        let hour = 19, minute = 0;
        if (horaStr && horaStr.includes(':')) {
            const parts = horaStr.split(':');
            hour = parseInt(parts[0], 10);
            minute = parseInt(parts[1], 10);
        }
        
        const fechaLocal = new Date(year, month - 1, day, hour, minute);
        
        const opciones = { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
        const formateada = fechaLocal.toLocaleDateString('es-MX', opciones);
        return formateada.charAt(0).toUpperCase() + formateada.slice(1);
    } catch (e) {
        return fechaISO + ' ' + horaStr;
    }
}

// ==========================================
// BARRA DE PROGRESO
// ==========================================

function actualizarProgreso() {
    const seleccionados = quinielaActual.pronosticos.filter(p => p).length;
    const total = CONFIG.TOTAL_PARTIDOS;
    const porcentaje = (seleccionados / total) * 100;

    const progressFill = document.getElementById("progressFill");
    const progressCount = document.getElementById("progressCount");
    const progressContainer = document.getElementById("progressContainer");

    if (progressFill) progressFill.style.width = porcentaje + "%";
    if (progressCount) progressCount.textContent = seleccionados;
    if (progressContainer) progressContainer.style.display = seleccionados > 0 ? "block" : "none";
}

function validarCamposEnTiempoReal() {
    const nombreInput = document.getElementById("clienteNombre");
    const whatsappInput = document.getElementById("clienteWhatsapp");

    if (nombreInput) {
        nombreInput.addEventListener("input", function() {
            this.classList.remove("invalid", "valid");
            if (this.value.trim().length > 0) {
                this.classList.add("valid");
            }
        });
    }

    if (whatsappInput) {
        whatsappInput.addEventListener("input", function() {
            this.classList.remove("invalid", "valid");
            if (/^\d{10}$/.test(this.value)) {
                this.classList.add("valid");
                this.classList.remove("invalid");
            } else if (this.value.length > 0) {
                this.classList.add("invalid");
            }
        });
    }
}

// ==========================================
// EVENT LISTENERS
// ==========================================

let wizardStep = 1;

function setupEventListeners() {
    const navToggle = document.getElementById("navToggle");
    if (navToggle) navToggle.addEventListener("click", () => {
        const navList = document.getElementById("navList");
        if (navList) navList.classList.toggle("show");
    });

    const btnGenerar = document.getElementById("btnGenerar");
    if (btnGenerar) btnGenerar.addEventListener("click", generarQuinielaAleatoria);
    
    const btnConfirmar = document.getElementById("btnConfirmar");
    if (btnConfirmar) btnConfirmar.addEventListener("click", abrirModalCompra);

    const modalClose = document.getElementById("modalClose");
    if (modalClose) modalClose.addEventListener("click", cerrarModal);
    
    const cancelarCompra = document.getElementById("cancelarCompra");
    if (cancelarCompra) cancelarCompra.addEventListener("click", cerrarModal);
    
    const closeSuccess = document.getElementById("closeSuccess");
    if (closeSuccess) closeSuccess.addEventListener("click", cerrarSuccess);

    const copyClabe = document.getElementById("copyClabe");
    if (copyClabe) copyClabe.addEventListener("click", () => {
        copiarTexto(CONFIG.CLABE);
    });
    
    const copyWhatsapp = document.getElementById("copyWhatsapp");
    if (copyWhatsapp) copyWhatsapp.addEventListener("click", () => {
        copiarTexto(CONFIG.WHATSAPP);
    });

    document.addEventListener("click", (e) => {
        if (e.target.classList.contains("opcion")) {
            const partidoIndex = parseInt(e.target.dataset.partido);
            const opcion = e.target.dataset.opcion;
            seleccionarOpcion(partidoIndex, opcion);
        }
    });

    const btnWizardNext = document.getElementById("btnWizardNext");
    if (btnWizardNext) btnWizardNext.addEventListener("click", wizardNextStep);

    document.addEventListener("keydown", (e) => {
        const compraModal = document.getElementById("compraModal");
        if (e.key === "Escape" && compraModal && compraModal.classList.contains("show")) {
            cerrarModal();
        }
        
        // Buscar quiniela con Enter
        if (e.key === "Enter" && e.target.id === "buscarIdInput") {
            buscarQuinielaPorId();
        }
    });
}

// ==========================================
// PARTIDOS
// ==========================================

async function cargarPartidos() {
    try {
        console.log("Intentando cargar partidos de Supabase...");

        // First get the active sorteo
        const sorteoRes = await fetch(
            `${SUPABASE_URL}/rest/v1/sorteos?estado=eq.activa&limit=1`, {
                method: 'GET',
                headers: {
                    'apikey': supabase.headers.apikey,
                    'Authorization': supabase.headers.Authorization
                }
            }
        );

        if (!sorteoRes.ok) {
            console.log("No se pudo obtener sorteo activa");
            return;
        }

        const sorteos = await sorteoRes.json();
        if (!sorteos || sorteos.length === 0) {
            console.log("No hay sorteo activa");
            return;
        }

        const sorteoo = sorteos[0];
        const sortableId = sorteoo.id;
        console.log("Jornada activa ID:", sortableId);

        // Guardar estado de registros pausados
        registrosPausados = sorteoo.registros_abiertos === false;
        console.log("Registros pausados:", registrosPausados);

        // Verificar si registros están bloqueados
        if (registrosPausados) {
            document.getElementById("mensajeRegistroBloqueado").style.display = "block";
            document.getElementById("btnGenerar").disabled = true;
            document.getElementById("btnConfirmar").disabled = true;
            document.getElementById("descargarPdfContainer").style.display = "block";
        } else {
            document.getElementById("mensajeRegistroBloqueado").style.display = "none";
            document.getElementById("btnGenerar").disabled = false;
            document.getElementById("btnConfirmar").disabled = false;
            document.getElementById("descargarPdfContainer").style.display = "none";
        }

        // Now get the partidos for this sorteoo
        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/partidos?sorteoo_id=eq.${sortableId}&order=partido_num`, {
                method: 'GET',
                headers: {
                    'apikey': supabase.headers.apikey,
                    'Authorization': supabase.headers.Authorization
                }
            }
        );

        if (response.ok) {
            const data = await response.json();
            console.log("Datos crudos:", JSON.stringify(data));

            if (data && data.length > 0) {
                // Convertir de formato nuevo a formato antiguo para compatibilidad
                partidos = data.map(p => ({
                    local: p.local,
                    visitante: p.visitante,
                    fecha: p.fecha,
                    hora: p.hora
                }));

                console.log("Partidos asignados:", partidos);
                
                // Cargar resultados del sorteoo activo
                const resResponse = await fetch(
                    `${SUPABASE_URL}/rest/v1/resultados?sorteoo_id=eq.${sortableId}&order=partido_num`, {
                        method: 'GET',
                        headers: {
                            'apikey': supabase.headers.apikey,
                            'Authorization': supabase.headers.Authorization
                        }
                    }
                );
                
                if (resResponse.ok) {
                    const resultadosData = await resResponse.json();
                    console.log("Resultados del sorteoo activo:", resultadosData);
                    
                    // Guardar en liveResultsData para usar en renderizarPartidos
                    liveResultsData = [];
                    resultadosData.forEach((r, i) => {
                        const partido = data[i];
                        if (partido) {
                            liveResultsData.push({
                                local: partido.local,
                                visitante: partido.visitante,
                                resultado: r.resultado,
                                goles_local: r.goles_local,
                                goles_visitante: r.goles_visitante,
                                score: r.goles_local !== null ? `${r.goles_local}-${r.goles_visitante}` : '-:-'
                            });
                        }
                    });
                    console.log("liveResultsData actualizado:", liveResultsData);
                }
                
                renderizarPartidos();
                return;
            }
        }
    } catch (e) {
        console.log("Error cargando partidos:", e);
    }

    // Fallback to local data if Supabase fails
    console.log("Usando datos locales...");
    cargarPartidosDemo();
}

function cargarPartidosDemo() {
    const sorteo13 = [
        { local: "Puebla", visitante: "FC Juárez", liga: "Liga MX", fecha: "2026-04-03", hora: "19:00" },
        { local: "Necaxa", visitante: "Mazatlán", liga: "Liga MX", fecha: "2026-04-04", hora: "17:00" },
        { local: "Tijuana", visitante: "Tigres", liga: "Liga MX", fecha: "2026-04-04", hora: "19:00" },
        { local: "Monterrey", visitante: "Atlético San Luis", liga: "Liga MX", fecha: "2026-04-04", hora: "21:00" },
        { local: "Querétaro", visitante: "Toluca", liga: "Liga MX", fecha: "2026-04-05", hora: "12:00" },
        { local: "León", visitante: "Atlas", liga: "Liga MX", fecha: "2026-04-05", hora: "17:00" },
        { local: "Cruz Azul", visitante: "Pachuca", liga: "Liga MX", fecha: "2026-04-05", hora: "19:00" },
        { local: "Santos", visitante: "América", liga: "Liga MX", fecha: "2026-04-05", hora: "21:05" },
        { local: "Chivas", visitante: "Pumas", liga: "Liga MX", fecha: "2026-04-06", hora: "18:00" },
        { local: "Real Madrid", visitante: "Barcelona", liga: "LaLiga", fecha: "2026-04-05", hora: "20:00" }
    ];
    partidos = sorteo13;
    renderizarPartidos();
}

function renderizarPartidos() {
    const grid = document.getElementById("partidosGrid");
    if (!grid) return;

    grid.innerHTML = "";

    // Usar resultados del active sorteoo si hay resultados guardados
    const resultadosActivos = liveResultsData && liveResultsData.length > 0 ? liveResultsData : resultadosPartidos;

    partidos.forEach((partido, index) => {
        const partidoEl = document.createElement("div");
        const res = resultadosActivos && resultadosActivos[index];
        const tieneResultado = res && res.resultado !== null;

        if (tieneResultado) {
            partidoEl.classList.add("completed");
        }

        partidoEl.className = "partido";

        const fechaHora = partido.fecha && partido.hora ?
            `📅 ${formatearFecha(partido.fecha, partido.hora)}` :
            '';

        // Determinar colores si hay resultado y registros pausados
        let colorLocal = '';
        let colorVisitante = '';
        let marcador = '';
        
        if (tieneResultado && registrosPausados) {
            // Usar score si no hay goles_local/goles_visitante
            let scoreText = '';
            if (res.goles_local !== null && res.goles_visitante !== null) {
                scoreText = `${res.goles_local}-${res.goles_visitante}`;
            } else if (res.score && res.score !== '-:-') {
                scoreText = res.score;
            }
            
            if (scoreText) {
                marcador = `<span style="background:#000;color:#fff;padding:0.2rem 0.5rem;border-radius:5px;font-weight:bold;margin:0 0.25rem">${scoreText}</span>`;
                
                if (res.resultado === 'L') {
                    colorLocal = 'color:#22c55e;font-weight:bold;font-size:1.1rem';
                    colorVisitante = 'color:#ef4444;font-weight:bold;font-size:1.1rem';
                } else if (res.resultado === 'V') {
                    colorLocal = 'color:#ef4444;font-weight:bold;font-size:1.1rem';
                    colorVisitante = 'color:#22c55e;font-weight:bold;font-size:1.1rem';
                } else if (res.resultado === 'E') {
                    colorLocal = 'color:#3b82f6;font-weight:bold;font-size:1.1rem';
                    colorVisitante = 'color:#3b82f6;font-weight:bold;font-size:1.1rem';
                }
            }
        }

        partidoEl.innerHTML = `
      <div class="partido-num">${index + 1}</div>
      <span class="equipo-local ${quinielaActual.pronosticos[index] === 'L' ? 'seleccionado' : ''}" style="${colorLocal}" onclick="seleccionarDesdeEquipo(${index}, 'L')">${partido.local}</span>
      <div class="partido-opciones" style="flex-wrap:nowrap;min-width:100px">
        ${marcador}
        <button class="opcion ${quinielaActual.pronosticos[index] === 'E' ? 'seleccionado' : ''}" data-partido="${index}" data-opcion="E" onclick="seleccionarDesdeEquipo(${index}, 'E')" aria-label="Empate entre ${partido.local} y ${partido.visitante}">E</button>
      </div>
      <span class="equipo-visita ${quinielaActual.pronosticos[index] === 'V' ? 'seleccionado' : ''}" style="${colorVisitante}" onclick="seleccionarDesdeEquipo(${index}, 'V')">${partido.visitante}</span>
      <div class="partido-fecha" style="grid-column:1/-1;text-align:center;margin-top:0.5rem;font-size:0.85rem;color:var(--text-secondary)">
        ${fechaHora}
      </div>
    `;
        grid.appendChild(partidoEl);
    });

    actualizarSeleccion();
    actualizarProgreso();
}

// ==========================================
// SELECCIÓN DE PRONÓSTICOS
// ==========================================

function seleccionarOpcion(partidoIndex, opcion) {
    quinielaActual.pronosticos[partidoIndex] = opcion;

    const buttons = document.querySelectorAll(`.opcion[data-partido="${partidoIndex}"]`);
    buttons.forEach(btn => {
        btn.classList.remove("seleccionado");
        if (btn.dataset.opcion === opcion) {
            btn.classList.add("seleccionado");
        }
    });

    // Highlight para equipos como botones - buscar por clase en el partido
    const partidoEl = document.querySelectorAll('.partido')[partidoIndex];
    if (partidoEl) {
        const localEl = partidoEl.querySelector('.equipo-local');
        const visitaEl = partidoEl.querySelector('.equipo-visita');
        
        if (localEl) {
            localEl.classList.remove('seleccionado');
            if (opcion === 'L') localEl.classList.add('seleccionado');
        }
        if (visitaEl) {
            visitaEl.classList.remove('seleccionado');
            if (opcion === 'V') visitaEl.classList.add('seleccionado');
        }
    }

    // Vibración y feedback
    if (navigator.vibrate) {
        navigator.vibrate(50);
    }

    actualizarSeleccion();
    actualizarProgreso();
}

function seleccionarDesdeEquipo(partidoIndex, opcion) {
    seleccionarOpcion(partidoIndex, opcion);
}

function actualizarSeleccion() {
    const container = document.getElementById("seleccionResultados");
    if (!container) return;

    if (quinielaActual.pronosticos.length === 0 || quinielaActual.pronosticos.every(p => !p)) {
        container.innerHTML = '<span class="resultado-vacio">Selecciona o genera una quiniela</span>';
        return;
    }

    container.innerHTML = quinielaActual.pronosticos.map((p, i) =>
        p ? `<span class="numero-tag">${i + 1}: ${p}</span>` : `<span class="numero-tag" style="opacity:0.5">${i + 1}: -</span>`
    ).join("");
}

function generarQuinielaAleatoria() {
    const opciones = ["L", "E", "V"];
    quinielaActual.pronosticos = [];

    for (let i = 0; i < CONFIG.TOTAL_PARTIDOS; i++) {
        const randomOpcion = opciones[Math.floor(Math.random() * opciones.length)];
        quinielaActual.pronosticos.push(randomOpcion);
    }

    renderizarPartidos();
    Toast.success("🎲 Quiniela generada aleatoriamente");
}

// ==========================================
// MODAL Y COMPRA - WIZARD
// ==========================================

function wizardNextStep() {
    if (wizardStep === 1) {
        wizardStep = 2;
        showWizardStep(2);
    } else if (wizardStep === 2) {
        const nombre = document.getElementById("clienteNombre").value.trim();
        const whatsapp = document.getElementById("clienteWhatsapp").value.trim();

        if (!nombre) {
            Toast.error("Por favor ingresa tu nombre completo");
            return;
        }
        if (!whatsapp || !/^\d{10}$/.test(whatsapp)) {
            Toast.error("Por favor ingresa un WhatsApp válido (10 dígitos)");
            return;
        }

        guardarQuinielaYAceptar();
    } else if (wizardStep === 3) {
        Toast.info("Revisa los datos de pago y envía tu comprobante por WhatsApp");
    }
}

async function guardarQuinielaYAceptar() {
    const nombre = document.getElementById("clienteNombre").value.trim();
    const whatsapp = document.getElementById("clienteWhatsapp").value.trim();
    
    const btn = document.getElementById("btnWizardNext");
    const originalText = btn ? btn.textContent : "Siguiente";
    if (btn) {
        btn.textContent = "Guardando...";
        btn.disabled = true;
    }

    try {
        // Get active sorteoo_id
        const sorteoRes = await fetch(
            `${SUPABASE_URL}/rest/v1/sorteos?estado=eq.activa&limit=1`, {
                method: 'GET',
                headers: {
                    'apikey': supabase.headers.apikey,
                    'Authorization': supabase.headers.Authorization
                }
            }
        );
        
        let sorteooId = null;
        if (sorteoRes.ok) {
            const sorteos = await sorteoRes.json();
            if (sorteos && sorteos.length > 0) {
                sorteooId = sorteos[0].id;
            }
        }

        const exp = new Date(Date.now() + CONFIG.HORAS_EXPIRACION * 3600000).toISOString();

        const quinielaData = {
            id: quinielaActual.id,
            pronosticos: JSON.stringify(quinielaActual.pronosticos),
            nombre: nombre,
            whatsapp: whatsapp,
            precio: CONFIG.PRECIO_QUINIELA,
            fecha: new Date().toISOString(),
            expiracion: exp,
            estado: "pendiente"
        };
        
        if (sorteooId) {
            quinielaData.sorteoo_id = sorteooId;
        }

        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/quinielas`, {
                method: 'POST',
                headers: {
                    'apikey': supabase.headers.apikey,
                    'Authorization': supabase.headers.Authorization,
                    'Content-Type': 'application/json',
                    'Prefer': 'resolution=merge-duplicates'
                },
                body: JSON.stringify(quinielaData)
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || "Error al guardar quiniela");
        }

        // Show success after short delay
        cargarAcumulado();
        
        const quinielaId = quinielaActual.id;
        console.log("quinielaId before timeout:", quinielaId);
        
        // Guardar datos para WhatsApp ANTES del setTimeout
        quinielaActual.nombre = nombre;
        const pronosticosGuardados = [...quinielaActual.pronosticos];
        
        setTimeout(() => {
            console.log("quinielaId in timeout:", quinielaId);
            console.log("pronosticosGuardados:", pronosticosGuardados);
            document.getElementById("compraModal").classList.remove("show");
            document.getElementById("successId").textContent = "" + quinielaId;
            
            // Renderizar pronósticos en el modal de éxito
            const pronosticosContainer = document.getElementById("successPronosticos");
            if (pronosticosContainer) {
                pronosticosContainer.innerHTML = pronosticosGuardados.map((p, i) => 
                    `<span style="background:var(--gray-200);padding:0.25rem 0.5rem;border-radius:5px;font-size:0.85rem">${i + 1}: ${p}</span>`
                ).join("");
            }
            
            const modal = document.getElementById("successModal");
            modal.classList.add("show");
            console.log("Set successId text to:", quinielaId);
            
            // Guardar datos para WhatsApp antes de resetear
            const datosWhatsApp = {
                nombre: nombre,
                id: quinielaId,
                pronosticos: pronosticosGuardados
            };
            window.datosWhatsApp = datosWhatsApp;
            console.log("Datos WhatsApp guardados:", datosWhatsApp);
            
            if (typeof confetti !== 'undefined') {
                confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
            }
            
            Toast.success("✅ Quiniela registrada exitosamente");
            
            iniciarCountdown(exp);
            quinielaActual = { id: null, pronosticos: [], nombre: "", whatsapp: "" };
            renderizarPartidos();
            actualizarSeleccion();
        }, 1500);
    } catch (e) {
        console.error("Error:", e);
        Toast.error("Error al registrar quiniela: " + e.message);
    } finally {
        if (btn) {
            btn.textContent = originalText;
            btn.disabled = false;
        }
    }
}

function showWizardStep(step) {
    // Hide all steps
    document.querySelectorAll(".wizard-step-content").forEach(el => {
        el.classList.remove("active");
    });

    // Show current step
    const stepEl = document.getElementById("step" + step);
    if (stepEl) stepEl.classList.add("active");

    // Update wizard header
    document.querySelectorAll(".wizard-step").forEach((el, i) => {
        const stepNum = i + 1;
        if (stepNum <= step) {
            el.classList.add("active");
        } else {
            el.classList.remove("active");
        }
    });

    // Update button text
    const btnNext = document.getElementById("btnWizardNext");
    if (btnNext) {
        btnNext.style.display = "flex";
        btnNext.textContent = step === 3 ? "Confirmar" : "Siguiente";
    }

    // Scroll to top
    const modalBody = document.querySelector(".modal-body");
    if (modalBody) modalBody.scrollTop = 0;
}

function generarIdQuiniela() {
    const now = new Date();
    const year = now.getFullYear();
    const random = Math.floor(Math.random() * 99999).toString().padStart(5, "0");
    quinielaActual.id = `QB-${year}-${random}`;
}

function estaBloqueadoPorTiempo() {
    if (partidos.length === 0) return false;
    
    const primerPartido = partidos[0];
    if (!primerPartido.fecha || !primerPartido.hora) return false;
    
    const fechaPartido = new Date(`${primerPartido.fecha}T${primerPartido.hora}:00`);
    const ahora = new Date();
    const horasRestantes = (fechaPartido - ahora) / (1000 * 60 * 60);
    
    return horasRestantes < 1;
}

async function verificarRegistrosAbiertos() {
    try {
        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/sorteos?estado=eq.activa&limit=1`, {
                method: 'GET',
                headers: {
                    'apikey': supabase.headers.apikey,
                    'Authorization': supabase.headers.Authorization
                }
            }
        );
        
        if (response.ok) {
            const sorteos = await response.json();
            if (sorteos && sorteos.length > 0) {
                const sorteoo = sorteos[0];
                if (sorteoo.registros_abiertos === false) {
                    Toast.error("⛔ El tiempo para registrarse se ha agotado.");
                    return;
                }
            }
        }
        
        continuarAbrirModal();
    } catch (e) {
        console.error("Error verificando registros:", e);
        continuarAbrirModal();
    }
}

function continuarAbrirModal() {
    const pronosticosValidos = quinielaActual.pronosticos.filter(p => p && p.trim() !== "");
    const faltantes = CONFIG.TOTAL_PARTIDOS - pronosticosValidos.length;

    if (faltantes > 0) {
        const msg = faltantes === 1 ?
            "Falta 1 pronóstico por elegir" :
            `Faltan ${faltantes} pronósticos por elegir`;
        Toast.warning(msg);
        return;
    }

    generarIdQuiniela();

    const container = document.getElementById("quinielaSeleccion");
    container.innerHTML = quinielaActual.pronosticos.map((p, i) =>
        `<span class="numero-tag">${i + 1}: ${p}</span>`
    ).join("");

    wizardStep = 1;
    showWizardStep(1);
    document.getElementById("compraModal").classList.add("show");
}

function abrirModalCompra() {
    if (estaBloqueadoPorTiempo()) {
        Toast.error("⛔ Lo sentimos, el registro de nuevas quinielas se cierra 1 hora antes del primer partido.");
        return;
    }
    
    verificarRegistrosAbiertos();
}

function cerrarModal() {
    document.getElementById("compraModal").classList.remove("show");
    wizardStep = 1;
}

function cerrarSuccess() {
    document.getElementById("successModal").classList.remove("show");
}

function enviarWhatsApp() {
    const datos = window.datosWhatsApp;
    console.log("Datos WhatsApp:", datos);
    if (!datos) {
        Toast.error("No hay datos disponibles");
        return;
    }
    
    let mensaje = `🎯 *Quiniela Treebolito*\n\n`;
    mensaje += `Hola, me llamo: *${datos.nombre}*\n`;
    mensaje += `Mi ID de quiniela es: *${datos.id}*\n\n`;
    mensaje += `📋 *Mis pronósticos:*\n`;
    
    datos.pronosticos.forEach((p, i) => {
        if (p) {
            const opcion = p === 'L' ? 'Local' : p === 'V' ? 'Visitante' : 'Empate';
            mensaje += `${i + 1}: ${opcion} (${p})\n`;
        }
    });
    
    mensaje += `\n💰 *Total pagado:* $30 MXN`;
    
    console.log("Mensaje generado:", mensaje);
    
    const url = `https://wa.me/524741482078?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
    
    // Also show the deposit modal
    document.getElementById("successModal").classList.remove("show");
    document.getElementById("depositoModal").classList.add("show");
}

function enviarCapturaDeposito() {
    const datos = window.datosWhatsApp;
    
    let mensaje = `💳 *Confirmación de Depósito - Quiniela Treebolito*\n\n`;
    mensaje += `Hola, mi nombre es: *${datos ? datos.nombre : 'Cliente'}*\n`;
    mensaje += `Mi ID de quiniela: *${datos ? datos.id : 'N/A'}*\n\n`;
    mensaje += `✅ He realizado mi depósito de $30 MXN\n`;
    mensaje += `📎 Adjunto mi captura de pago`;
    
    const url = `https://wa.me/524741482078?text=${encodeURIComponent(mensaje)}`;
    window.open(url, '_blank');
    
    document.getElementById("depositoModal").classList.remove("show");
}

function cerrarDepositoModal() {
    document.getElementById("depositoModal").classList.remove("show");
}

async function confirmarQuiniela() {
    const nombreInput = document.getElementById("clienteNombre");
    const whatsappInput = document.getElementById("clienteWhatsapp");
    const nombre = nombreInput ? nombreInput.value.trim() : "";
    const whatsapp = whatsappInput ? whatsappInput.value.trim() : "";

    if (!nombre) {
        Toast.error("Por favor ingresa tu nombre completo");
        if (nombreInput) nombreInput.focus();
        return;
    }
    if (!whatsapp || !/^\d{10}$/.test(whatsapp)) {
        Toast.error("Por favor ingresa un número de WhatsApp válido (10 dígitos)");
        if (whatsappInput) whatsappInput.focus();
        return;
    }

    quinielaActual.nombre = nombre;
    quinielaActual.whatsapp = whatsapp;

    const btn = document.getElementById("confirmarApartar");
    const originalText = btn.textContent;
    btn.textContent = "Guardando...";
    btn.disabled = true;

    try {
        const exp = new Date(Date.now() + CONFIG.HORAS_EXPIRACION * 3600000).toISOString();

        // Save quiniela to Supabase
        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/quinielas`, {
                method: 'POST',
                headers: {
                    'apikey': supabase.headers.apikey,
                    'Authorization': supabase.headers.Authorization,
                    'Content-Type': 'application/json',
                    'Prefer': 'resolution=merge-duplicates'
                },
                body: JSON.stringify({
                    id: quinielaActual.id,
                    pronosticos: JSON.stringify(quinielaActual.pronosticos),
                    nombre: nombre,
                    whatsapp: whatsapp,
                    precio: CONFIG.PRECIO_QUINIELA,
                    fecha: new Date().toISOString(),
                    expiracion: exp,
                    estado: "pendiente"
                })
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(errorText || "Error al guardar quiniela");
        }

        document.getElementById("compraModal").classList.remove("show");
        document.getElementById("successId").textContent = quinielaActual.id;
        document.getElementById("successModal").classList.add("show");

        // Confetti celebration
        if (typeof confetti !== 'undefined') {
            confetti({
                particleCount: 100,
                spread: 70,
                origin: { y: 0.6 }
            });
        }

        iniciarCountdown(exp);

        limpiarQuinielaGuardada();
        quinielaActual = { id: null, pronosticos: [], nombre: "", whatsapp: "" };
        renderizarPartidos();
        actualizarSeleccion();

        Toast.success("🎉 Quiniela registrada exitosamente");

        // Refresh participantes count
        cargarAcumulado();

    } catch (e) {
        console.error("Error:", e);
        Toast.error("Error al registrar quiniela: " + e.message);
    } finally {
        btn.textContent = originalText;
        btn.disabled = false;
    }
}

// ==========================================
// ACUMULADO / PARTICIPANTES
// ==========================================

async function cargarAcumulado() {
    console.log('--- Ejecutando cargarAcumulado ---');
    try {
        // Obtener sorteoo activo
        const sorteosRes = await fetch(
            `${SUPABASE_URL}/rest/v1/sorteos?estado=eq.activa&limit=1`, {
                method: 'GET',
                headers: {
                    'apikey': supabase.headers.apikey,
                    'Authorization': supabase.headers.Authorization
                }
            }
        );
        
        let sorteooId = null;
        if (sorteosRes.ok) {
            const sorteos = await sorteosRes.json();
            console.log('Sorteos activos:', sorteos);
            if (sorteos && sorteos.length > 0) {
                sorteooId = sorteos[0].id;
            }
        }
        
        console.log('Sorteoo ID:', sorteooId);
        
        // Filtrar por sorteoo_id si existe
        const filter = sorteooId 
            ? `sorteoo_id=eq.${sorteooId}&estado=eq.confirmado`
            : `estado=eq.confirmado`;
        
        console.log('Filter:', filter);
        
        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/quinielas?${filter}&select=id`, {
                method: 'GET',
                headers: {
                    'apikey': supabase.headers.apikey,
                    'Authorization': supabase.headers.Authorization
                }
            }
        );

        if (response.ok) {
            const data = await response.json();
            console.log('Quinielas encontradas:', data.length, data);
            acumulado = data.length;
            // 90% para acumulado del premio, 10% para admin
            acumuladoMonto = acumulado * CONFIG.PRECIO_QUINIELA * 0.90;
        }
    } catch (e) {
        console.log('Error:', e);
        acumulado = 0;
        acumuladoMonto = 0;
    }

    actualizarMontoAcumulado();
}

function actualizarMontoAcumulado() {
    const montoEl = document.getElementById("participantesMonto");
    const montoAnterior = ultimoMontoAcumulado;

    if (montoEl) {
        montoEl.textContent = acumulado.toString();

        if (montoAnterior > 0 && montoAnterior !== acumulado) {
            montoEl.classList.add("updated");
            setTimeout(() => montoEl.classList.remove("updated"), 600);
        }
    }

    const acumuladoEl = document.getElementById("acumuladoMonto");
    if (acumuladoEl) {
        acumuladoEl.textContent = "$" + acumuladoMonto.toString();
    }

    ultimoMontoAcumulado = acumulado;
}

setInterval(cargarAcumulado, 60000);

// ==========================================
// LÍDERES ACTUALES
// ==========================================

async function cargarLideresActuales() {
    const container = document.getElementById("lideresActuales");
    const nombresEl = document.getElementById("lideresNombres");
    const aciertosEl = document.getElementById("lideresAciertos");
    
    if (!container || !nombresEl || !aciertosEl) return;
    
    try {
        const sorteosRes = await fetch(
            `${SUPABASE_URL}/rest/v1/sorteos?estado=eq.activa&limit=1`, {
                method: 'GET',
                headers: {
                    'apikey': supabase.headers.apikey,
                    'Authorization': supabase.headers.Authorization
                }
            }
        );
        
        if (!sorteosRes.ok) return;
        
        const sorteos = await sorteosRes.json();
        if (!sorteos || sorteos.length === 0) return;
        
        const sorteooId = sorteos[0].id;
        
        const resResponse = await fetch(
            `${SUPABASE_URL}/rest/v1/resultados?sorteoo_id=eq.${sorteooId}&order=partido_num`, {
                method: 'GET',
                headers: {
                    'apikey': supabase.headers.apikey,
                    'Authorization': supabase.headers.Authorization
                }
            }
        );
        
        if (!resResponse.ok) return;
        
        const resultadosData = await resResponse.json();
        
        const resultadosConDatos = resultadosData.filter(r => r.resultado !== null);
        
        if (resultadosConDatos.length === 0) {
            container.style.display = 'none';
            return;
        }
        
        const quinielasRes = await fetch(
            `${SUPABASE_URL}/rest/v1/quinielas?sorteoo_id=eq.${sorteooId}&estado=eq.confirmado`, {
                method: 'GET',
                headers: {
                    'apikey': supabase.headers.apikey,
                    'Authorization': supabase.headers.Authorization
                }
            }
        );
        
        if (!quinielasRes.ok) return;
        
        const quinielas = await quinielasRes.json();
        if (!quinielas || quinielas.length === 0) {
            container.style.display = 'none';
            return;
        }
        
        const aciertosPorQuiniela = [];
        
        quinielas.forEach(q => {
            let pronQ = [];
            try {
                pronQ = typeof q.pronosticos === 'string' ? JSON.parse(q.pronosticos) : q.pronosticos;
            } catch {}
            
            let qAciertos = 0;
            for (let i = 0; i < pronQ.length && i < resultadosData.length; i++) {
                if (resultadosData[i] && resultadosData[i].resultado !== null && pronQ[i] === resultadosData[i].resultado) {
                    qAciertos++;
                }
            }
            
            aciertosPorQuiniela.push({
                nombre: q.nombre,
                aciertos: qAciertos
            });
        });
        
        if (aciertosPorQuiniela.length === 0) {
            container.style.display = 'none';
            return;
        }
        
        aciertosPorQuiniela.sort((a, b) => b.aciertos - a.aciertos);
        
        const maxAciertos = aciertosPorQuiniela[0].aciertos;
        
        if (maxAciertos === 0) {
            container.style.display = 'none';
            return;
        }
        
        const lideres = aciertosPorQuiniela.filter(q => q.aciertos === maxAciertos);
        const nombresLideres = lideres.map(l => {
            const nombre = l.nombre || 'Anónimo';
            const partes = nombre.split(' ');
            return partes.length > 1 ? partes[0] + ' ' + partes[partes.length - 1] : nombre;
        }).join(', ');
        
        nombresEl.textContent = nombresLideres;
        aciertosEl.textContent = `con ${maxAciertos} aciertos`;
        
        container.style.display = 'block';
        
    } catch (e) {
        console.log("Error cargando líderes:", e);
        if (container) container.style.display = 'none';
    }
}

setInterval(cargarLideresActuales, 60000);

// ==========================================
// RESULTADOS EN VIVO
// ==========================================

let resultadosPartidos = [];
let liveResultsData = [];

async function cargarResultados() {
    try {
        // Get closed sorteos and find the one with results
        const sorteosRes = await fetch(
            `${SUPABASE_URL}/rest/v1/sorteos?estado=eq.cerrada&order=numero.desc`, {
                method: 'GET',
                headers: {
                    'apikey': supabase.headers.apikey,
                    'Authorization': supabase.headers.Authorization
                }
            }
        );
        
        if (!sorteosRes.ok) return;
        
        const sorteosCerrados = await sorteosRes.json();
        
        // Find the highest numbered closed sorteoo WITH RESULTS
        let sorteooId = null;
        let sorteooNumero = null;
        
        if (sorteosCerrados && sorteosCerrados.length > 0) {
            for (const s of sorteosCerrados) {
                const resCheck = await fetch(
                    `${SUPABASE_URL}/rest/v1/resultados?sorteoo_id=eq.${s.id}&limit=1`, {
                        method: 'GET',
                        headers: {
                            'apikey': supabase.headers.apikey,
                            'Authorization': supabase.headers.Authorization
                        }
                    }
                );
                if (resCheck.ok) {
                    const data = await resCheck.json();
                    if (data && data.length > 0) {
                        sorteooId = s.id;
                        sorteooNumero = s.numero;
                        break;
                    }
                }
            }
        }
        
        // If no closed sorteoo with results, try active one
        if (!sorteooId) {
            const activoRes = await fetch(
                `${SUPABASE_URL}/rest/v1/sorteos?estado=eq.activa&limit=1`, {
                    method: 'GET',
                    headers: {
                        'apikey': supabase.headers.apikey,
                        'Authorization': supabase.headers.Authorization
                    }
                }
            );
            if (activoRes.ok) {
                const activos = await activoRes.json();
                if (activos && activos.length > 0) {
                    sorteooId = activos[0].id;
                    sorteooNumero = activos[0].numero;
                }
            }
        }
        
        if (!sorteooId) return;
        
        // Get results for this sorteoo
        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/resultados?sorteoo_id=eq.${sorteooId}&order=partido_num`, {
                method: 'GET',
                headers: {
                    'apikey': supabase.headers.apikey,
                    'Authorization': supabase.headers.Authorization
                }
            }
        );

        if (response.ok) {
            const data = await response.json();
            if (data && data.length > 0) {
                // Update title to show which sorteoo
                const tituloEl = document.querySelector('.resultados-titulo');
                if (tituloEl) {
                    tituloEl.textContent = `📊 Resultados anteriores`;
                }
                // Convert to array format and include actual scores
                resultadosPartidos = data.map(r => ({
                    resultado: r.resultado,
                    goles_local: r.goles_local,
                    goles_visitante: r.goles_visitante
                }));
                
                // Also load partidos for team names
                const partidosRes = await fetch(
                    `${SUPABASE_URL}/rest/v1/partidos?sorteoo_id=eq.${sorteooId}&order=partido_num`, {
                        method: 'GET',
                        headers: {
                            'apikey': supabase.headers.apikey,
                            'Authorization': supabase.headers.Authorization
                        }
                    }
                );
                if (partidosRes.ok) {
                    const partidosDataArr = await partidosRes.json();
                    partidosData = partidosDataArr;
                }
                
                renderizarResultados();
            }
        }
    } catch (e) {
        console.log("Cargando resultados...", e);
    }
}

async function cargarResultadosLive() {
    try {
        // Get active sorteo first
        const sorteoRes = await fetch(
            `${SUPABASE_URL}/rest/v1/sorteos?estado=eq.activa&limit=1`, {
                method: 'GET',
                headers: {
                    'apikey': supabase.headers.apikey,
                    'Authorization': supabase.headers.Authorization
                }
            }
        );
        
        if (!sorteoRes.ok) return;
        
        const sorteos = await sorteoRes.json();
        if (!sorteos || sorteos.length === 0) return;
        
        const sorteooId = sorteos[0].id;
        
        const partidoRes = await fetch(
            `${SUPABASE_URL}/rest/v1/partidos?sorteoo_id=eq.${sorteooId}&order=partido_num`, {
                method: 'GET',
                headers: {
                    'apikey': supabase.headers.apikey,
                    'Authorization': supabase.headers.Authorization
                }
            }
        );

        const resultadoRes = await fetch(
            `${SUPABASE_URL}/rest/v1/resultados?sorteoo_id=eq.${sorteooId}&order=partido_num`, {
                method: 'GET',
                headers: {
                    'apikey': supabase.headers.apikey,
                    'Authorization': supabase.headers.Authorization
                }
            }
        );

        if (partidoRes.ok && resultadoRes.ok) {
            const partidoData = await partidoRes.json();
            const resultadoData = await resultadoRes.json();

            if (partidoData && partidoData.length > 0) {
                liveResultsData = [];

                for (let i = 0; i < Math.min(partidoData.length, 10); i++) {
                    const partido = partidoData[i];
                    const resultado = resultadoData.length > i ? resultadoData[i].resultado : null;
                    const golesLocal = resultadoData.length > i ? resultadoData[i].goles_local : null;
                    const golesVisitante = resultadoData.length > i ? resultadoData[i].goles_visitante : null;

                    let status = 'scheduled';
                    let score = '-:-';

                    if (resultado !== null) {
                        status = 'final';
                        if (golesLocal !== null && golesVisitante !== null) {
                            score = `${golesLocal}-${golesVisitante}`;
                        } else if (resultado === 'L') score = '1-0';
                        else if (resultado === 'V') score = '0-1';
                        else score = '0-0';
                    }

                    liveResultsData.push({
                        local: partido.local,
                        visitante: partido.visitante,
                        status: status,
                        score: score,
                        resultado: resultado,
                        goles_local: golesLocal,
                        goles_visitante: golesVisitante
                    });
                }
            }

            renderizarResultadosLive();
            renderizarPartidos();
        }
    } catch (e) {
        console.log("Cargando resultados live...", e);
    }
}

function renderizarResultadosLive() {
    const grid = document.getElementById("liveResultsGrid");
    if (!grid) return;

    if (liveResultsData.length === 0) {
        grid.innerHTML = '<p style="text-align:center;color:var(--text-secondary);padding:1rem">Cargando partidos...</p>';
        return;
    }

    grid.innerHTML = "";

    liveResultsData.forEach((partido, index) => {
        const item = document.createElement("div");
        item.className = "live-result-item";

        const statusClass = partido.status === 'live' ? 'live' :
            partido.status === 'final' ? 'final' : 'scheduled';
        const statusText = partido.status === 'live' ? 'En Vivo' :
            partido.status === 'final' ? 'Final' : 'Por Jugar';

        item.innerHTML = `
      <span class="live-status ${statusClass}">${statusText}</span>
      <span class="live-team">${partido.local}</span>
      <span class="live-score">${partido.score}</span>
      <span class="live-team">${partido.visitante}</span>
    `;
        grid.appendChild(item);
    });
}

function renderizarResultados() {
    const grid = document.getElementById("resultadosGrid");
    if (!grid) return;

    if (resultadosPartidos.length === 0) {
        grid.innerHTML = '<p style="text-align:center;color:var(--text-secondary)">Esperando resultados...</p>';
        return;
    }

    grid.innerHTML = "";

    resultadosPartidos.forEach((res, index) => {
        const item = document.createElement("div");
        item.className = "resultado-item";

        let scoreText = '-';
        if (res && typeof res === 'object' && res.goles_local === null) {
            scoreText = '⏳ Pendiente';
        } else if (res && typeof res === 'object' && res.goles_local !== undefined) {
            scoreText = `${res.goles_local}-${res.goles_visitante}`;
        } else if (res === 'L') scoreText = '1-0';
        else if (res === 'V') scoreText = '0-1';
        else if (res === 'E') scoreText = '0-0';

        const resultado = typeof res === 'object' ? res.resultado : res;
        const indicador = getIndicador(resultado, index);
        
        // Get team names from partidosData if available
        const local = partidosData[index]?.local || `Equipo ${index + 1}`;
        const visitante = partidosData[index]?.visitante || '';

        item.innerHTML = `
      <div style="display:flex;flex-direction:column;gap:2px">
        <span style="font-size:0.75rem;color:var(--text-secondary)">${index + 1}</span>
        <span style="font-weight:600;font-size:0.85rem">${local} vs ${visitante}</span>
        <span style="color:#fbbf24;font-weight:bold">${scoreText} ${indicador}</span>
      </div>
    `;
        grid.appendChild(item);
    });
}

function getIndicador(resultado, index) {
    const pronostico = quinielaActual.pronosticos[index];
    if (!resultado || !pronostico) return '';

    if (resultado === pronostico) {
        return '<span style="color:#22c55e;font-weight:bold">✓</span>';
    }
    return '';
}

setInterval(cargarResultados, 60000);
setInterval(cargarResultadosLive, 300000); // cada 5 minutos
setInterval(cargarGanador, 60000); // cada minuto

async function cargarGanador() {
    console.log('--- Ejecutando cargarGanador ---');
    const container = document.getElementById('ganadoresContainer');
    console.log('Container:', container);
    
    if (!container) {
        console.log('ERROR: Container no encontrado');
        setTimeout(cargarGanador, 500);
        return;
    }
    
    try {
        // Get last closed sorteoo WITH RESULTS
        const sorteosRes = await fetch(
            `${SUPABASE_URL}/rest/v1/sorteos?estado=eq.cerrada&order=numero.desc`, {
                method: 'GET',
                headers: {
                    'apikey': supabase.headers.apikey,
                    'Authorization': supabase.headers.Authorization
                }
            }
        );
        
        if (!sorteosRes.ok) return;
        
        const sorteosCerrados = await sorteosRes.json();
        console.log('Sorteos cerrados:', sorteosCerrados);
        
        if (!sorteosCerrados || sorteosCerrados.length === 0) {
            container.innerHTML = '<div class="ganador-nombre">-</div><div class="ganador-monto">$0</div>';
            return;
        }
        
        // Find the highest numbered sorteoo that has results
        let sorteooId = null;
        for (const s of sorteosCerrados) {
            const resCheck = await fetch(
                `${SUPABASE_URL}/rest/v1/resultados?sorteoo_id=eq.${s.id}&limit=1`, {
                    method: 'GET',
                    headers: {
                        'apikey': supabase.headers.apikey,
                        'Authorization': supabase.headers.Authorization
                    }
                }
            );
            if (resCheck.ok) {
                const data = await resCheck.json();
                if (data && data.length > 0) {
                    sorteooId = s.id;
                    console.log('Found sorteoo with results:', s.numero);
                    break;
                }
            }
        }
        
        if (!sorteooId) {
            container.innerHTML = '<div class="ganador-nombre">Sin resultados</div><div class="ganador-monto">$0</div>';
            return;
        }
        
        console.log('Sorteoo ID:', sorteooId);
        
        // Get results for this sorteoo
        const resResponse = await fetch(
            `${SUPABASE_URL}/rest/v1/resultados?sorteoo_id=eq.${sorteooId}&order=partido_num`, {
                method: 'GET',
                headers: {
                    'apikey': supabase.headers.apikey,
                    'Authorization': supabase.headers.Authorization
                }
            }
        );
        
        if (!resResponse.ok || resResponse.status === 204) {
            container.innerHTML = '<div class="ganador-nombre">Sin resultados</div><div class="ganador-monto">$0</div>';
            return;
        }
        
        const resultados = await resResponse.json();
        console.log('Resultados:', resultados);
        
        if (!resultados || resultados.length === 0) {
            container.innerHTML = '<div class="ganador-nombre">Sin resultados</div><div class="ganador-monto">$0</div>';
            return;
        }
        
        // Get all confirmed quinielas for this sorteoo
        const quinielasRes = await fetch(
            `${SUPABASE_URL}/rest/v1/quinielas?sorteoo_id=eq.${sorteooId}&estado=eq.confirmado`, {
                method: 'GET',
                headers: {
                    'apikey': supabase.headers.apikey,
                    'Authorization': supabase.headers.Authorization
                }
            }
        );
        
        const quinielas = await quinielasRes.json();
        console.log('Quinielas:', quinielas);
        
        if (!quinielas || quinielas.length === 0) {
            container.innerHTML = '<div class="ganador-nombre">Sin participantes</div><div class="ganador-monto">$0</div>';
            return;
        }
        
        // Calculate scores for each quiniela
        const puntuaciones = [];
        quinielas.forEach(q => {
            console.log('Quiniela raw:', q);
            let pronosticos;
            
            // Handle different formats: string, JSON array, or already an array
            if (typeof q.pronosticos === 'string') {
                try {
                    pronosticos = JSON.parse(q.pronosticos);
                } catch {
                    pronosticos = q.pronosticos.split(',');
                }
            } else if (Array.isArray(q.pronosticos)) {
                pronosticos = q.pronosticos;
            } else {
                pronosticos = [];
            }
            
            console.log('Pronosticos:', pronosticos);
            
            let aciertos = 0;
            for (let i = 0; i < Math.min(pronosticos.length, resultados.length); i++) {
                if (pronosticos[i] && resultados[i].resultado !== null && pronosticos[i].toString().trim() === resultados[i].resultado) {
                    aciertos++;
                }
            }
            puntuaciones.push({ id: q.id, nombre: q.nombre || 'Sin nombre', aciertos: aciertos });
            console.log('Quiniela:', q.nombre, 'aciertos:', aciertos);
        });
        
        console.log('Todas las puntuaciones:', puntuaciones);
        
        // Sort by aciertos descending
        puntuaciones.sort((a, b) => b.aciertos - a.aciertos);
        
        const maxAciertos = puntuaciones.length > 0 ? puntuaciones[0].aciertos : 0;
        console.log('Max aciertos:', maxAciertos);
        
        if (maxAciertos === 0) {
            console.log('Sin ganador - max aciertos es 0');
            container.innerHTML = '<div class="ganador-nombre">Sin ganador</div><div class="ganador-monto">$0</div>';
            return;
        }
        
        const listaGanadores = puntuaciones.filter(p => p.aciertos === maxAciertos);
        console.log('Ganadores:', listaGanadores);
        
        // Get acumulado for this sorteoo
        const acumuladoQuinielas = quinielas.length;
        const montoTotal = acumuladoQuinielas * 30 * 0.90; // 90% for prize
        const montoPorGanador = Math.floor(montoTotal / listaGanadores.length);
        
        console.log('Monto por ganador:', montoPorGanador);
        
        // Mostrar todos los ganadores
        let html = '';
        listaGanadores.forEach((g, i) => {
            html += `<div class="ganador-nombre">${g.nombre}</div>`;
            html += `<div class="ganador-aciertos">${g.aciertos}/${resultados.length} aciertos</div>`;
            html += `<div class="ganador-monto">$${montoPorGanador.toLocaleString()}</div>`;
            if (i < listaGanadores.length - 1) {
                html += '<div style="border-bottom:1px solid var(--gray-300);margin:0.5rem 0"></div>';
            }
        });
        container.innerHTML = html;
        console.log('Ganadores mostrados:', listaGanadores.length);
        
    } catch (e) {
        console.log('Error cargando ganador:', e);
        container.innerHTML = '<div class="ganador-nombre">-</div><div class="ganador-monto">$0</div>';
    }
}

// ==========================================
// UTILIDADES
// ==========================================

function copiarTexto(texto) {
    navigator.clipboard.writeText(texto).then(() => {
        Toast.success("📋 Copiado al portapapeles");
    }).catch(() => {
        Toast.error("Error al copiar");
    });
}

const Toast = {
    success: (msg) => showToast(msg, "success"),
    error: (msg) => showToast(msg, "error"),
    warning: (msg) => showToast(msg, "warning"),
    info: (msg) => showToast(msg, "info")
};

function showToast(message, type = "success") {
    const container = document.getElementById("toastContainer");
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.innerHTML = `
    <span class="toast-icon">${type === "success" ? "✅" : type === "error" ? "❌" : type === "warning" ? "⚠️" : "ℹ️"}</span>
    <span class="toast-message">${message}</span>
    <button class="toast-close" onclick="this.parentElement.remove()">✕</button>
  `;
    container.appendChild(toast);

    setTimeout(() => {
        toast.remove();
    }, 5000);
}

// ==========================================
// ULTIMOS PARTICIPANTES Y BUSQUEDA
// ==========================================

let ultimoSorteoId = null;

async function cargarSorteoActivoId() {
    try {
        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/sorteos?estado=eq.activa&limit=1`, {
                method: 'GET',
                headers: {
                    'apikey': supabase.headers.apikey,
                    'Authorization': supabase.headers.Authorization
                }
            }
        );
        if (response.ok) {
            const sorteos = await response.json();
            if (sorteos && sorteos.length > 0) {
                const nuevoSorteoId = sorteos[0].id;
                
                // Si cambió el sorteoo, limpiar búsqueda
                if (ultimoSorteoId && ultimoSorteoId !== nuevoSorteoId) {
                    limpiarBusqueda();
                }
                
                ultimoSorteoId = nuevoSorteoId;
            }
        }
    } catch (e) {
        console.error("Error cargando sorteoo ID:", e);
    }
}

function limpiarBusqueda() {
    const input = document.getElementById('buscarIdInput');
    if (input) input.value = '';
    document.getElementById('buscarQuinielaModal').classList.remove('show');
    document.getElementById('resultadoBusqueda').innerHTML = '';
}

async function cargarUltimosParticipantes() {
    try {
        const response = await fetch(
            `${SUPABASE_URL}/rest/v1/sorteos?estado=eq.activa&limit=1`, {
                method: 'GET',
                headers: {
                    'apikey': supabase.headers.apikey,
                    'Authorization': supabase.headers.Authorization
                }
            }
        );
        
        if (!response.ok) return;
        
        const sorteos = await response.json();
        if (!sorteos || sorteos.length === 0) return;
        
        const sorteooId = sorteos[0].id;
        
        const quinielasRes = await fetch(
            `${SUPABASE_URL}/rest/v1/quinielas?sorteoo_id=eq.${sorteooId}&estado=eq.confirmado&order=fecha.desc&limit=5`, {
                method: 'GET',
                headers: {
                    'apikey': supabase.headers.apikey,
                    'Authorization': supabase.headers.Authorization
                }
            }
        );
        
        if (!quinielasRes.ok) return;
        
        const quinielas = await quinielasRes.json();
        const container = document.getElementById('listaUltimosParticipantes');
        
        if (!container) return;
        
        if (!quinielas || quinielas.length === 0) {
            container.innerHTML = '<p style="color:#888;text-align:center">Aún no hay participantes</p>';
            return;
        }
        
        let html = '';
        quinielas.forEach(q => {
            let pronosticos;
            try {
                pronosticos = typeof q.pronosticos === 'string' ? JSON.parse(q.pronosticos) : q.pronosticos;
            } catch {
                pronosticos = [];
            }
            
            const pronosticosStr = pronosticos.join(', ');
            html += `<div style="background:#1a1a1a;padding:0.75rem;border-radius:8px;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;border:1px solid #f59e0b">
                <span style="font-weight:bold;color:#fbbf24">${q.nombre || 'Sin nombre'}</span>
                <span style="font-size:0.85rem;color:#22c55e">${pronosticosStr}</span>
            </div>`;
        });
        
        container.innerHTML = html;
        
    } catch (e) {
        console.error("Error cargando ultimos participantes:", e);
    }
}

async function buscarQuinielaPorId() {
    const input = document.getElementById('buscarIdInput');
    const busqueda = input ? input.value.trim() : '';
    
    if (!busqueda) {
        Toast.error("Ingresa tu ID o número de teléfono");
        return;
    }
    
    // Detectar tipo de búsqueda
    let esTelefono = false;
    
    // Si tiene formato QB-2026-XXXXX es ID
    if (busqueda.startsWith('QB-') || busqueda.match(/^QB-\d{4}-\d{5}$/)) {
        esTelefono = false;
    }
    // Si son 10 dígitos es teléfono
    else if (busqueda.match(/^\d{10}$/)) {
        esTelefono = true;
    }
    // Si no coincide ninguno, error
    else {
        Toast.error("Ingresa un ID válido (QB-2026-XXXXX) o un teléfono de 10 dígitos");
        return;
    }
    
    try {
        // Get the active sorteoo ID
        const sorteosRes = await fetch(
            `${SUPABASE_URL}/rest/v1/sorteos?estado=eq.activa&limit=1`, {
                method: 'GET',
                headers: {
                    'apikey': supabase.headers.apikey,
                    'Authorization': supabase.headers.Authorization
                }
            }
        );
        
        let sorteooActivoId = null;
        if (sorteosRes.ok) {
            const sorteos = await sorteosRes.json();
            if (sorteos && sorteos.length > 0) {
                sorteooActivoId = sorteos[0].id;
            }
        }
        
        if (!sorteooActivoId) {
            Toast.error("No hay un sorteo activo");
            return;
        }
        
        let response;
        if (esTelefono) {
            // Buscar por teléfono en el sorteoo activo
            response = await fetch(
                `${SUPABASE_URL}/rest/v1/quinielas?whatsapp=eq.${busqueda}&sorteoo_id=eq.${sorteooActivoId}`, {
                    method: 'GET',
                    headers: {
                        'apikey': supabase.headers.apikey,
                        'Authorization': supabase.headers.Authorization
                    }
                }
            );
        } else {
            // Buscar por ID en el sorteoo activo
            response = await fetch(
                `${SUPABASE_URL}/rest/v1/quinielas?id=eq.${encodeURIComponent(busqueda)}&sorteoo_id=eq.${sorteooActivoId}`, {
                    method: 'GET',
                    headers: {
                        'apikey': supabase.headers.apikey,
                        'Authorization': supabase.headers.Authorization
                    }
                }
            );
        }
        
        const resultadoDiv = document.getElementById('resultadoBusqueda');
        
        if (!response.ok) {
            resultadoDiv.innerHTML = '<p style="color:#ef4444">Error al buscar</p>';
            document.getElementById('buscarQuinielaModal').classList.add('show');
            return;
        }
        
        const data = await response.json();
        
        if (!data || data.length === 0) {
            if (esTelefono) {
                resultadoDiv.innerHTML = '<p style="color:#ef4444">No se encontró ninguna quiniela con ese número de teléfono en este sorteo</p>';
            } else {
                resultadoDiv.innerHTML = '<p style="color:#ef4444">No se encontró ninguna quiniela con ese ID en este sorteo</p>';
            }
            document.getElementById('buscarQuinielaModal').classList.add('show');
            return;
        }
        
        const q = data[0];
        const quinielaActualId = q.id;
        
        let pronosticos;
        try {
            pronosticos = typeof q.pronosticos === 'string' ? JSON.parse(q.pronosticos) : q.pronosticos;
        } catch {
            pronosticos = [];
        }
        
        // Cargar resultados para calcular aciertos
        let aciertos = 0;
        let totalConResultado = 0;
        let resultadosData = [];
        
        try {
            const resResponse = await fetch(
                `${SUPABASE_URL}/rest/v1/resultados?sorteoo_id=eq.${sorteooActivoId}&order=partido_num`, {
                    method: 'GET',
                    headers: {
                        'apikey': supabase.headers.apikey,
                        'Authorization': supabase.headers.Authorization
                    }
                }
            );
            
            if (resResponse.ok) {
                resultadosData = await resResponse.json();
                
                // Calcular aciertos
                if (resultadosData && resultadosData.length > 0) {
                    for (let i = 0; i < pronosticos.length && i < resultadosData.length; i++) {
                        // Solo contar si hay resultado definido (no null)
                        if (resultadosData[i] && resultadosData[i].resultado !== null) {
                            totalConResultado++;
                            if (pronosticos[i] === resultadosData[i].resultado) {
                                aciertos++;
                            }
                        }
                    }
                }
            }
        } catch (e) {
            console.log("Error cargando resultados para aciertos:", e);
        }
        
        // Calcular líderes si hay resultados
        let lideresHtml = '';
        if (totalConResultado > 0) {
            try {
                // Cargar todas las quinielas para calcular quiénes van ganando
                const todasQuinielasRes = await fetch(
                    `${SUPABASE_URL}/rest/v1/quinielas?sorteoo_id=eq.${sorteooActivoId}&estado=eq.confirmado`, {
                        method: 'GET',
                        headers: {
                            'apikey': supabase.headers.apikey,
                            'Authorization': supabase.headers.Authorization
                        }
                    }
                );
                
                if (todasQuinielasRes.ok) {
                    const todasQuinielas = await todasQuinielasRes.json();
                    const aciertosPorQuiniela = [];
                    
                    todasQuinielas.forEach(q => {
                        let pronQ = [];
                        try {
                            pronQ = typeof q.pronosticos === 'string' ? JSON.parse(q.pronosticos) : q.pronosticos;
                        } catch {}
                        
                        let qAciertos = 0;
                        for (let i = 0; i < pronQ.length && i < resultadosData.length; i++) {
                            if (resultadosData[i] && resultadosData[i].resultado && pronQ[i] === resultadosData[i].resultado) {
                                qAciertos++;
                            }
                        }
                        
                        aciertosPorQuiniela.push({
                            nombre: q.nombre,
                            aciertos: qAciertos,
                            esTuQuiniela: q.id === quinielaActualId
                        });
                    });
                    
                    // Ordenar por aciertos
                    aciertosPorQuiniela.sort((a, b) => b.aciertos - a.aciertos);
                    
                    // Obtener el máximo
                    const maxAciertos = aciertosPorQuiniela[0].aciertos;
                    const lideres = aciertosPorQuiniela.filter(q => q.aciertos === maxAciertos);
                    
                    // Si el usuario está entre los líderes o tiene el máximo
                    if (maxAciertos > 0) {
                        const nombresLideres = lideres.map(l => l.nombre || 'Anónimo').join(', ');
                        const esLider = lideres.some(l => l.aciertos === aciertos && l.nombre === q.nombre);
                        
                        lideresHtml = `
                            <div style="background:#1a1a2e;color:#fff;padding:0.75rem;border-radius:10px;text-align:center;margin-bottom:1rem">
                                <p style="margin:0;font-size:0.85rem;color:#f59e0b">🏆 LÍDER(ES) ACTUAL(ES)</p>
                                <p style="margin:0;font-size:1rem;font-weight:bold;color:#22c55e">${nombresLideres}</p>
                                <p style="margin:0;font-size:0.85rem;color:#aaa">con ${maxAciertos} aciertos</p>
                            </div>
                        `;
                    }
                }
            } catch (e) {
                console.log("Error calculando líderes:", e);
            }
        }
        
        // Generar HTML de pronósticos con indicadores de color
        let pronosticosHtml = '';
        for (let i = 0; i < pronosticos.length; i++) {
            let bgColor = 'var(--gray-200)';
            let textColor = 'var(--text-primary)';
            let borderStyle = '';
            
            // Verificar si hay resultado para este partido
            if (resultadosData[i] && resultadosData[i].resultado !== null) {
                if (pronosticos[i] === resultadosData[i].resultado) {
                    bgColor = '#22c55e';
                    textColor = '#fff';
                } else {
                    bgColor = '#ef4444';
                    textColor = '#fff';
                }
            }
            
            pronosticosHtml += `<span style="background:${bgColor};color:${textColor};padding:0.25rem 0.5rem;border-radius:5px;font-size:0.85rem">${i + 1}: ${pronosticos[i]}</span>`;
        }
        
        // Mostrar mensaje de aciertos si hay resultados
        let aciertosHtml = '';
        if (totalConResultado > 0) {
            const colorAciertos = aciertos === totalConResultado ? '#22c55e' : (aciertos >= totalConResultado * 0.7 ? '#f59e0b' : '#ef4444');
            aciertosHtml = `
                <div style="background:${colorAciertos};color:#000;padding:0.75rem;border-radius:10px;text-align:center;margin:1rem 0;font-weight:bold">
                    🏆 ATINASTE ${aciertos} DE ${totalConResultado}
                </div>
            `;
        }
        
        resultadoDiv.innerHTML = `
            <div style="background:var(--gray-100);padding:1rem;border-radius:10px;margin:1rem 0;text-align:left">
                <p style="margin-bottom:0.5rem;color:var(--text-secondary)">Nombre:</p>
                <p style="font-size:1.2rem;font-weight:bold;margin-bottom:1rem">${q.nombre || 'Sin nombre'}</p>
                
                <p style="margin-bottom:0.5rem;color:var(--text-secondary)">ID:</p>
                <p style="font-size:1rem;font-weight:bold;color:#f59e0b;margin-bottom:1rem">${q.id}</p>
                
                ${lideresHtml}
                ${aciertosHtml}
                <p style="margin-bottom:0.5rem;color:var(--text-secondary)">Tus pronósticos:</p>
                <div style="display:flex;flex-wrap:wrap;gap:0.5rem">${pronosticosHtml}</div>
                
                <p style="margin-top:1rem;color:var(--text-secondary)">Estado:</p>
                <p style="font-weight:bold;color:${q.estado === 'confirmado' ? '#22c55e' : '#f59e0b'}">${q.estado === 'confirmado' ? '✅ Confirmado' : '⏳ Pendiente de pago'}</p>
            </div>
        `;
        
        document.getElementById('buscarQuinielaModal').classList.add('show');
        
    } catch (e) {
        console.error("Error buscando quiniela:", e);
        Toast.error("Error al buscar quiniela");
    }
}

function cerrarBuscarModal() {
    document.getElementById('buscarQuinielaModal').classList.remove('show');
}

function mostrarDatosPago() {
    document.getElementById('pagoModal').classList.add('show');
}

function cerrarPagoModal() {
    document.getElementById('pagoModal').classList.remove('show');
}

function mostrarInstruccionesApp() {
    document.getElementById('appModal').classList.add('show');
}

function cerrarAppModal() {
    document.getElementById('appModal').classList.remove('show');
}

// Intervalo para verificar cambio de sorteoo
setInterval(cargarSorteoActivoId, 30000);
setInterval(cargarUltimosParticipantes, 30000);

// Función para descargar PDF con todos los pronósticos
async function descargarPronosticosPDF() {
    try {
        Toast.success("Generando PDF...", "info");
        
        // Obtener el sorteo activo
        const sorteosRes = await fetch(
            `${SUPABASE_URL}/rest/v1/sorteos?estado=eq.activa&limit=1`, {
                method: 'GET',
                headers: {
                    'apikey': supabase.headers.apikey,
                    'Authorization': supabase.headers.Authorization
                }
            }
        );
        
        if (!sorteosRes.ok) throw new Error("Error al obtener sorteo");
        
        const sorteos = await sorteosRes.json();
        if (!sorteos || sorteos.length === 0) throw new Error("No hay sorteo activo");
        
        const sorteoo = sorteos[0];
        
        // Obtener todas las quinielas del sorteo activo
        const quinielasRes = await fetch(
            `${SUPABASE_URL}/rest/v1/quinielas?sorteoo_id=eq.${sorteoo.id}&estado=eq.confirmado&order=nombre`, {
                method: 'GET',
                headers: {
                    'apikey': supabase.headers.apikey,
                    'Authorization': supabase.headers.Authorization
                }
            }
        );
        
        if (!quinielasRes.ok) throw new Error("Error al obtener quinielas");
        
        const quinielas = await quinielasRes.json();
        if (!quinielas || quinielas.length === 0) {
            Toast.warning("No hay quinielas confirmadas");
            return;
        }
        
        // Generar PDF
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF();
        
        // Título
        doc.setFontSize(18);
        doc.setTextColor(34, 197, 94);
        doc.text("QUINIELA TREEBOLITO", 105, 20, { align: "center" });
        
        doc.setFontSize(12);
        doc.setTextColor(100);
        doc.text(sorteoo.nombre || "Sorteo Activo", 105, 28, { align: "center" });
        
        const fecha = new Date().toLocaleDateString("es-MX");
        doc.text(`Fecha: ${fecha}`, 105, 35, { align: "center" });
        doc.text(`Total participantes: ${quinielas.length}`, 105, 42, { align: "center" });
        
        // Línea separadora
        doc.setDrawColor(34, 197, 94);
        doc.line(20, 48, 190, 48);
        
        // Headers de columna
        doc.setFontSize(10);
        doc.setTextColor(0);
        doc.setFillColor(240, 240, 240);
        doc.rect(20, 52, 170, 8, "F");
        doc.text("NOMBRE", 22, 58);
        for (let i = 1; i <= 10; i++) {
            doc.text("P" + i, 60 + (i - 1) * 13, 58);
        }
        
        // Datos de participantes
        let y = 64;
        quinielas.forEach((q, index) => {
            if (y > 270) {
                doc.addPage();
                y = 20;
            }
            
            let pronosticos = [];
            try {
                pronosticos = typeof q.pronosticos === "string" ? JSON.parse(q.pronosticos) : q.pronosticos;
            } catch (e) {
                pronosticos = [];
            }
            
            // Alternar colores de fondo
            if (index % 2 === 0) {
                doc.setFillColor(250, 250, 250);
                doc.rect(20, y - 4, 170, 7, "F");
            }
            
            doc.setTextColor(0);
            doc.text((q.nombre || "Sin nombre").substring(0, 20), 22, y);
            
            // Pronósticos
            for (let i = 0; i < 10; i++) {
                const pron = pronosticos[i] || "-";
                doc.text(pron, 62 + i * 13, y);
            }
            
            y += 7;
        });
        
        // Footer
        doc.setFontSize(8);
        doc.setTextColor(150);
        doc.text("Generado por Quiniela Treebolito", 105, 287, { align: "center" });
        
        // Descargar
        doc.save(`quiniela_treebolito_${fecha.replace(/\//g, "-")}.pdf`);
        
        Toast.success("PDF descargado exitosamente!");
        
    } catch (e) {
        console.error("Error generando PDF:", e);
        Toast.error("Error al generar PDF: " + e.message);
    }
}