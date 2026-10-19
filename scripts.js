window._audioStreamDestino = null;
window._hostSpeakerGain = null;
window._audioContextCapturado = null;
let audioLocalMuteado = false;

(function instalarInterceptorDeAudio() {
    const connectOriginal = AudioNode.prototype.connect;

    AudioNode.prototype.connect = function(destino, ...args) {
        if (destino && (destino instanceof AudioDestinationNode || destino === this.context.destination)) {
            const ctx = this.context;
            window._audioContextCapturado = ctx;
            if (!window._audioStreamDestino) {
                window._audioStreamDestino = ctx.createMediaStreamDestination();
            }
            if (!window._hostSpeakerGain) {
                window._hostSpeakerGain = ctx.createGain();
                window._hostSpeakerGain.gain.value = audioLocalMuteado ? 0 : 1;
                connectOriginal.call(window._hostSpeakerGain, ctx.destination);
            }
            try {
                connectOriginal.call(this, window._audioStreamDestino);
            } catch (e) {}
            return connectOriginal.call(this, window._hostSpeakerGain, ...args);
        }

        return connectOriginal.call(this, destino, ...args);
    };
})();

const paramsUrl = new URLSearchParams(window.location.search);
const salaEnUrl = paramsUrl.get('sala');
const codigoCortoGenerado = 'CTR-' + Math.random().toString(36).substring(2, 6).toUpperCase();
const idInicialPeer = salaEnUrl ? undefined : codigoCortoGenerado;

const peer = new Peer(idInicialPeer, {
    config: {
        iceServers: [
            { urls: 'stun:stun.l.google.com:19302' },
            { urls: 'stun:stun1.l.google.com:19302' },
            { urls: 'stun:stun2.l.google.com:19302' }
        ]
    }
});

const spanId = document.getElementById('mi-id');
const estadoRed = document.getElementById('estado-red');
const badgeRol = document.getElementById('badge-rol');
const selectorCamara = document.getElementById('selector-camara');
const btnAudioLocal = document.getElementById('btn-audio-local');
const btnFullscreen = document.getElementById('btn-fullscreen');
const btnToggleMando = document.getElementById('btn-toggle-mando');
const btnForzarMultitap = document.getElementById('btn-forzar-multitap');
const btnCopiarLink = document.getElementById('btn-copiar-link');

let miNumeroJugador = 1;
let miNickname = 'Piloto';
let esHost = false;
let usarMandoEnInvitado = true;
let conexionConHost = null;

const estadoPilotos = {
    1: { nombre: 'Esperando...', ocupado: false, ping: 0 },
    2: { nombre: 'Libre (P2)', ocupado: false, ping: null, peerId: null },
    3: { nombre: 'Libre (P3)', ocupado: false, ping: null, peerId: null },
    4: { nombre: 'Libre (P4)', ocupado: false, ping: null, peerId: null }
};
const conexionesActivas = [];

if (salaEnUrl) {
    document.getElementById('input-id-host').value = salaEnUrl;
    document.getElementById('panel-crear-host').style.display = 'none';
    estadoRed.textContent = `🔗 Sala detectada: ${salaEnUrl}`;
}

peer.on('open', (id) => {
    spanId.textContent = salaEnUrl ? salaEnUrl : id;
});

btnCopiarLink.addEventListener('click', () => {
    const urlInvitacion = `${window.location.origin}${window.location.pathname}?sala=${spanId.textContent}`;
    navigator.clipboard.writeText(urlInvitacion);
    btnCopiarLink.textContent = '✅ ¡Link Copiado!';
    setTimeout(() => btnCopiarLink.textContent = '🔗 Copiar Link', 2000);
});

btnAudioLocal.addEventListener('click', () => {
    audioLocalMuteado = !audioLocalMuteado;

    if (esHost) {
        if (window._hostSpeakerGain) {
            window._hostSpeakerGain.gain.value = audioLocalMuteado ? 0 : 1;
        }
        if (window._audioContextCapturado && window._audioContextCapturado.state === 'suspended') {
            window._audioContextCapturado.resume();
        }
    } else {
        const videoRemoto = document.getElementById('video-remoto');
        if (videoRemoto) {
            videoRemoto.muted = audioLocalMuteado;
            videoRemoto.volume = audioLocalMuteado ? 0 : 1;
        }
    }

    btnAudioLocal.textContent = audioLocalMuteado ? '🔇 Mi Audio: MUTE' : '🔊 Mi Audio: ON';
    btnAudioLocal.classList.toggle('muteado', audioLocalMuteado);
});

btnFullscreen.addEventListener('click', () => {
    const viewport = document.getElementById('viewport-juego');
    if (!document.fullscreenElement) {
        if (viewport.requestFullscreen) {
            viewport.requestFullscreen();
        } else if (viewport.webkitRequestFullscreen) {
            viewport.webkitRequestFullscreen();
        }
    } else {
        document.exitFullscreen();
    }
});

window.addEventListener('keydown', (e) => {
    if (!esHost && e.code === 'KeyF' && document.activeElement.id !== 'input-chat' && document.activeElement.tagName !== 'INPUT') {
        btnFullscreen.click();
    }
});

function renderizarListaPilotos() {
    const contenedor = document.getElementById('lista-pilotos');
    contenedor.innerHTML = '';
    for (let i = 1; i <= 4; i++) {
        const p = estadoPilotos[i];
        const div = document.createElement('div');
        div.className = 'slot-jugador' + (!p.ocupado ? ' vacio' : '');
        const icono = i === 1 ? '👑' : '🏎️';
        const textoPing = p.ocupado ? `<span class="ping-tag">${p.ping !== null ? p.ping + ' ms' : 'Host'}</span>` : '';
        div.innerHTML = `<span>${icono} <b>P${i}:</b> ${p.nombre}</span> ${textoPing}`;
        contenedor.appendChild(div);
    }
}

function agregarMensajeChat(autor, texto) {
    const caja = document.getElementById('mensajes-chat');
    const div = document.createElement('div');
    div.className = 'msg-item';
    div.innerHTML = `<span class="msg-autor">${autor}:</span> ${texto}`;
    caja.appendChild(div);
    caja.scrollTop = caja.scrollHeight;
}

function enviarMensajeChat() {
    const input = document.getElementById('input-chat');
    const texto = input.value.trim();
    if (!texto) return;
    input.value = '';

    const autor = `P${miNumeroJugador} (${miNickname})`;
    if (esHost) {
        agregarMensajeChat(autor, texto);
        retransmitirATodos({ tipo: 'chat', autor, texto });
    } else if (conexionConHost && conexionConHost.open) {
        conexionConHost.send({ tipo: 'chat', autor, texto });
    }
}

document.getElementById('btn-enviar-chat').addEventListener('click', enviarMensajeChat);
document.getElementById('input-chat').addEventListener('keydown', (e) => {
    e.stopPropagation();
    if (e.key === 'Enter') enviarMensajeChat();
});

function retransmitirATodos(objetoDatos) {
    conexionesActivas.forEach(c => {
        if (c.open) c.send(objetoDatos);
    });
}

btnToggleMando.addEventListener('click', () => {
    usarMandoEnInvitado = !usarMandoEnInvitado;
    btnToggleMando.textContent = usarMandoEnInvitado ? '🎮 Mando: ON (Ventana activa)' : '🚫 Mando: OFF';
    btnToggleMando.classList.toggle('apagado', !usarMandoEnInvitado);
});

function aplicarRecorteCamara(modo) {
    const contenedor = esHost ? document.getElementById('contenedor-emulador') : document.getElementById('contenedor-invitado');
    contenedor.className = '';
    if (modo === '2p') {
        const num = miNumeroJugador === 1 ? 1 : 2;
        contenedor.classList.add(`cam-2p-j${num}`);
    } else if (modo === '4p') {
        contenedor.classList.add(`cam-4p-j${miNumeroJugador}`);
    }
}

selectorCamara.addEventListener('change', (e) => {
    aplicarRecorteCamara(e.target.value);
    if (esHost) retransmitirATodos({ tipo: 'cambio_camara', modo: e.target.value });
});

const controlesPorDefecto = {
    0: {
        0: { 'value': 'z', 'value2': 'BUTTON_1' }, 1: { 'value': 'x', 'value2': 'BUTTON_3' },
        2: { 'value': 'right shift', 'value2': 'SELECT' }, 3: { 'value': 'enter', 'value2': 'START' },
        4: { 'value': 'up arrow', 'value2': 'DPAD_UP' }, 5: { 'value': 'down arrow', 'value2': 'DPAD_DOWN' },
        6: { 'value': 'left arrow', 'value2': 'DPAD_LEFT' }, 7: { 'value': 'right arrow', 'value2': 'DPAD_RIGHT' },
        8: { 'value': 'a', 'value2': 'BUTTON_2' }, 9: { 'value': 's', 'value2': 'BUTTON_4' },
        10: { 'value': 'q', 'value2': 'LEFT_TOP_SHOULDER' }, 11: { 'value': 'w', 'value2': 'RIGHT_TOP_SHOULDER' },
        12: { 'value': 'e', 'value2': 'LEFT_BOTTOM_SHOULDER' }, 13: { 'value': 'r', 'value2': 'RIGHT_BOTTOM_SHOULDER' },
        16: { 'value': '', 'value2': 'LEFT_STICK_X:+1' }, 17: { 'value': '', 'value2': 'LEFT_STICK_X:-1' },
        18: { 'value': '', 'value2': 'LEFT_STICK_Y:+1' }, 19: { 'value': '', 'value2': 'LEFT_STICK_Y:-1' }
    },
    1: { 0: { 'value': 'u', 'value2': '' }, 1: { 'value': 'o', 'value2': '' }, 2: { 'value': '7', 'value2': '' }, 3: { 'value': '8', 'value2': '' }, 4: { 'value': 'i', 'value2': '' }, 5: { 'value': 'k', 'value2': '' }, 6: { 'value': 'j', 'value2': '' }, 7: { 'value': 'l', 'value2': '' }, 8: { 'value': 'p', 'value2': '' }, 9: { 'value': '9', 'value2': '' }, 10: { 'value': '0', 'value2': '' }, 11: { 'value': '-', 'value2': '' } },
    2: { 0: { 'value': 'numpad 1', 'value2': '' }, 1: { 'value': 'numpad 2', 'value2': '' }, 2: { 'value': 'numpad 7', 'value2': '' }, 3: { 'value': 'numpad 9', 'value2': '' }, 4: { 'value': 'numpad 8', 'value2': '' }, 5: { 'value': 'numpad 5', 'value2': '' }, 6: { 'value': 'numpad 4', 'value2': '' }, 7: { 'value': 'numpad 6', 'value2': '' }, 8: { 'value': 'numpad 3', 'value2': '' }, 9: { 'value': 'numpad 0', 'value2': '' }, 10: { 'value': 'numpad add', 'value2': '' }, 11: { 'value': 'numpad subtract', 'value2': '' } },
    3: { 0: { 'value': 'f', 'value2': '' }, 1: { 'value': 'g', 'value2': '' }, 2: { 'value': 'c', 'value2': '' }, 3: { 'value': 'v', 'value2': '' }, 4: { 'value': 't', 'value2': '' }, 5: { 'value': 'b', 'value2': '' }, 6: { 'value': 'd', 'value2': '' }, 7: { 'value': 'h', 'value2': '' }, 8: { 'value': 'y', 'value2': '' }, 9: { 'value': 'n', 'value2': '' }, 10: { 'value': 'm', 'value2': '' }, 11: { 'value': 'comma', 'value2': '' } }
};

const mapaTeclaABotonRetroArch = {
    'ArrowUp': 4, 'KeyI': 4, 'ArrowDown': 5, 'KeyK': 5, 'ArrowLeft': 6, 'KeyJ': 6, 'ArrowRight': 7, 'KeyL': 7,
    'KeyZ': 0, 'KeyX': 1, 'KeyA': 8, 'KeyS': 9, 'KeyQ': 10, 'KeyW': 11, 'Enter': 3, 'ShiftRight': 2
};

function inyectarBotonEnEmulador(slotIndex, idBotonRetroArch, presionado) {
    const valor = presionado ? 1 : 0;
    const ejs = window.EJS_emulator;
    if (!ejs) return;

    if (ejs.Module?._retro_set_controller_port_device) {
        ejs.Module._retro_set_controller_port_device(slotIndex, 1);
    }

    if (ejs.gameManager?.functions?.simulateInput) {
        ejs.gameManager.functions.simulateInput(slotIndex, idBotonRetroArch, valor);
    } else if (ejs.gameManager?.simulateInput) {
        ejs.gameManager.simulateInput(slotIndex, idBotonRetroArch, valor);
    } else if (ejs.Module?._simulate_input) {
        ejs.Module._simulate_input(slotIndex, idBotonRetroArch, valor);
    }
}

function activarMultitapEnNúcleo(reiniciarConsola = false) {
    const ejs = window.EJS_emulator;
    if (!ejs) return;

    if (ejs.Module?._retro_set_controller_port_device) {
        for (let p = 0; p < 4; p++) {
            ejs.Module._retro_set_controller_port_device(p, 1);
        }
    }

    const fs = ejs.Module?.FS || ejs.gameManager?.FS;
    if (fs) {
        const opcionesCore = [
            'pcsx_rearmed_multitap = "port 1"',
            'pcsx_rearmed_multitap1 = "enabled"',
            'pcsx_rearmed_pad1type = "standard"',
            'pcsx_rearmed_pad2type = "standard"',
            'pcsx_rearmed_pad3type = "standard"',
            'pcsx_rearmed_pad4type = "standard"',
            'pcsx_rearmed_pad5type = "standard"',
            'input_max_users = "4"',
            'input_libretro_device_p1 = "1"',
            'input_libretro_device_p2 = "1"',
            'input_libretro_device_p3 = "1"',
            'input_libretro_device_p4 = "1"'
        ].join('\n') + '\n';

        [
            '/home/web_user/retroarch/userdata/retroarch-core-options.cfg',
            '/home/web_user/retroarch/userdata/config/PCSX-ReARMed/PCSX-ReARMed.opt',
            '/retroarch-core-options.cfg'
        ].forEach(r => {
            try { fs.writeFile(r, opcionesCore); } catch (e) {}
        });
    }

    if (typeof ejs.changeSettingOption === 'function') {
        ejs.changeSettingOption('pcsx_rearmed_multitap', 'port 1');
        ejs.changeSettingOption('pcsx rearmed multitap', 'port 1');
        ejs.changeSettingOption('pcsx_rearmed_pad3type', 'standard');
        ejs.changeSettingOption('pcsx_rearmed_pad4type', 'standard');
    }

    if (ejs.gameManager?.setVariable) {
        ejs.gameManager.setVariable('pcsx_rearmed_multitap', 'port 1');
        ejs.gameManager.setVariable('pcsx_rearmed_pad3type', 'standard');
        ejs.gameManager.setVariable('pcsx_rearmed_pad4type', 'standard');
    }

    if (reiniciarConsola && ejs.gameManager?.functions?.restart) {
        ejs.gameManager.functions.restart();
    }
}

btnForzarMultitap.addEventListener('click', () => activarMultitapEnNúcleo(true));

function obtenerStreamCompletoDelEmulador() {
    const canvas = document.querySelector('#juego canvas');
    if (!canvas) return null;

    const videoStream = canvas.captureStream(60);
    const pistas = [...videoStream.getVideoTracks()];

    if (window._audioStreamDestino) {
        const audioTracks = window._audioStreamDestino.stream.getAudioTracks();
        if (audioTracks.length > 0) {
            pistas.push(audioTracks[0]);
        }
    }

    return new MediaStream(pistas);
}
document.getElementById('btn-host').addEventListener('click', () => {
    const archivoRom = document.getElementById('input-rom').files[0];
    const archivoBios = document.getElementById('input-bios').files[0];
    if (!archivoRom) return alert('Selecciona la ROM primero.');

    esHost = true;
    miNumeroJugador = 1;
    miNickname = document.getElementById('nick-host').value.trim() || 'Host P1';

    estadoPilotos[1] = { nombre: miNickname, ocupado: true, ping: null };
    renderizarListaPilotos();

    document.getElementById('menus-inicio').style.display = 'none';
    document.getElementById('layout-partida').style.display = 'flex';
    document.getElementById('contenedor-emulador').style.display = 'block';
    badgeRol.style.display = 'inline-block';
    badgeRol.textContent = `👑 P1: ${miNickname}`;
    selectorCamara.style.display = 'inline-block';
    btnAudioLocal.style.display = 'inline-block';
    btnFullscreen.style.display = 'inline-block';
    btnForzarMultitap.style.display = 'inline-block';
    btnCopiarLink.style.display = 'inline-block';
    estadoRed.textContent = '🟢 Sala activa. Copia el link para invitar.';

    Object.keys(localStorage).forEach(k => localStorage.removeItem(k));
    try { indexedDB.deleteDatabase('EmulatorJS-states'); } catch(e) {}

    window.EJS_player = '#juego';
    window.EJS_core = 'pcsx_rearmed';
    window.EJS_gameName = 'Crash Team Racing';
    window.EJS_gameUrl = URL.createObjectURL(archivoRom);
    if (archivoBios) window.EJS_biosUrl = URL.createObjectURL(archivoBios);
    window.EJS_pathtodata = 'https://cdn.emulatorjs.org/stable/data/';
    window.EJS_startOnLoaded = true;
    window.EJS_defaultControls = controlesPorDefecto;
    window.EJS_volume = 1; 
    window.EJS_defaultOptions = {
        'pcsx_rearmed_multitap': 'port 1',
        'pcsx_rearmed_pad1type': 'standard',
        'pcsx_rearmed_pad2type': 'standard',
        'pcsx_rearmed_pad3type': 'standard',
        'pcsx_rearmed_pad4type': 'standard'
    };

    window.EJS_onGameStart = function() {
        const ejs = window.EJS_emulator;
        if (ejs && ejs.controls) {
            ejs.controls = JSON.parse(JSON.stringify(controlesPorDefecto));
            if (typeof ejs.saveSettings === 'function') ejs.saveSettings();
            if (typeof ejs.setupKeys === 'function') ejs.setupKeys();
        }
        activarMultitapEnNúcleo(false);
        setTimeout(() => activarMultitapEnNúcleo(true), 300);
    };

    const script = document.createElement('script');
    script.src = 'https://cdn.emulatorjs.org/stable/data/loader.js';
    document.body.appendChild(script);
});

peer.on('connection', (conn) => {
    let numJugadorAsignado = null;
    for (let p = 2; p <= 4; p++) {
        if (!estadoPilotos[p].ocupado) {
            numJugadorAsignado = p;
            estadoPilotos[p].ocupado = true;
            estadoPilotos[p].peerId = conn.peer;
            break;
        }
    }

    if (numJugadorAsignado === null) {
        conn.on('open', () => conn.send({ tipo: 'sala_llena' }));
        return;
    }

    const slotRetroArch = numJugadorAsignado - 1;
    conexionesActivas.push(conn);

    conn.on('open', () => {
        if (window.EJS_emulator?.Module?._retro_set_controller_port_device) {
            window.EJS_emulator.Module._retro_set_controller_port_device(slotRetroArch, 1);
        }

        conn.send({
            tipo: 'asignacion_jugador',
            numeroJugador: numJugadorAsignado,
            modoCamaraActual: selectorCamara.value,
            estadoPilotos
        });
    });

    const esperarStream = setInterval(() => {
        const stream = obtenerStreamCompletoDelEmulador();
        if (stream && stream.getVideoTracks().length > 0) {
            clearInterval(esperarStream);
            peer.call(conn.peer, stream);
        }
    }, 500);

    conn.on('data', (datos) => {
        if (datos.tipo === 'input_mando') {
            inyectarBotonEnEmulador(slotRetroArch, datos.boton, datos.presionado);
        } else if (datos.tipo === 'registro_nick') {
            estadoPilotos[numJugadorAsignado].nombre = datos.nick;
            estadoPilotos[numJugadorAsignado].ping = 18;
            renderizarListaPilotos();
            retransmitirATodos({ tipo: 'actualizacion_lobby', estadoPilotos });
            agregarMensajeChat('Sistema', `¡${datos.nick} entró como Jugador ${numJugadorAsignado}!`);
            retransmitirATodos({ tipo: 'chat', autor: 'Sistema', texto: `¡${datos.nick} entró como Jugador ${numJugadorAsignado}!` });
        } else if (datos.tipo === 'chat') {
            agregarMensajeChat(datos.autor, datos.texto);
            retransmitirATodos(datos);
        } else if (datos.tipo === 'ping_req') {
            conn.send({ tipo: 'ping_res', t: datos.t });
        } else if (datos.tipo === 'reporte_ping') {
            estadoPilotos[numJugadorAsignado].ping = datos.ms;
            renderizarListaPilotos();
            retransmitirATodos({ tipo: 'actualizacion_lobby', estadoPilotos });
        }
    });

    conn.on('close', () => {
        const nombreSaliente = estadoPilotos[numJugadorAsignado].nombre;
        estadoPilotos[numJugadorAsignado] = { nombre: `Libre (P${numJugadorAsignado})`, ocupado: false, ping: null, peerId: null };
        renderizarListaPilotos();
        retransmitirATodos({ tipo: 'actualizacion_lobby', estadoPilotos });
        agregarMensajeChat('Sistema', `${nombreSaliente} salió de la sala.`);
    });
});

document.getElementById('btn-unirse').addEventListener('click', () => {
    const idHost = document.getElementById('input-id-host').value.trim();
    if (!idHost) return alert('Ingresa el código de la sala.');

    miNickname = document.getElementById('nick-invitado').value.trim() || 'Invitado';

    document.getElementById('menus-inicio').style.display = 'none';
    document.getElementById('layout-partida').style.display = 'flex';
    document.getElementById('contenedor-invitado').style.display = 'block';
    selectorCamara.style.display = 'inline-block';
    btnAudioLocal.style.display = 'inline-block';
    btnFullscreen.style.display = 'inline-block';
    btnToggleMando.style.display = 'inline-block';
    estadoRed.textContent = '🟡 Conectando a la sala...';

    const conn = peer.connect(idHost);
    conexionConHost = conn;

    conn.on('open', () => {
        conn.send({ tipo: 'registro_nick', nick: miNickname });
        iniciarCapturaControlesInvitado(conn);
        setInterval(() => {
            if (conn.open) conn.send({ tipo: 'ping_req', t: performance.now() });
        }, 3000);
    });

    conn.on('data', (datos) => {
        if (datos.tipo === 'sala_llena') {
            alert('La sala ya tiene los 4 jugadores llenos.');
            location.reload();
        } else if (datos.tipo === 'asignacion_jugador') {
            miNumeroJugador = datos.numeroJugador;
            badgeRol.style.display = 'inline-block';
            badgeRol.textContent = `🎮 P${miNumeroJugador}: ${miNickname}`;
            estadoRed.textContent = `🟢 En línea`;
            Object.assign(estadoPilotos, datos.estadoPilotos);
            renderizarListaPilotos();
            selectorCamara.value = datos.modoCamaraActual;
            aplicarRecorteCamara(datos.modoCamaraActual);
        } else if (datos.tipo === 'actualizacion_lobby') {
            Object.assign(estadoPilotos, datos.estadoPilotos);
            renderizarListaPilotos();
        } else if (datos.tipo === 'cambio_camara') {
            selectorCamara.value = datos.modo;
            aplicarRecorteCamara(datos.modo);
        } else if (datos.tipo === 'chat') {
            agregarMensajeChat(datos.autor, datos.texto);
        } else if (datos.tipo === 'ping_res') {
            const ms = Math.round(performance.now() - datos.t);
            conn.send({ tipo: 'reporte_ping', ms });
        }
    });

    peer.on('call', (llamada) => {
        llamada.answer();
        llamada.on('stream', (streamRemoto) => {
            const video = document.getElementById('video-remoto');
            video.srcObject = streamRemoto;
            video.muted = audioLocalMuteado;
            video.volume = 1;
            video.play().catch(() => {
                const desbloquearAudio = () => {
                    video.muted = audioLocalMuteado;
                    video.play();
                    window.removeEventListener('keydown', desbloquearAudio);
                    window.removeEventListener('click', desbloquearAudio);
                };
                window.addEventListener('keydown', desbloquearAudio);
                window.addEventListener('click', desbloquearAudio);
            });
        });
    });
});

function iniciarCapturaControlesInvitado(conn) {
    const teclasActivas = new Set();

    window.addEventListener('keydown', (e) => {
        if (!document.hasFocus() || document.activeElement.id === 'input-chat') return;
        const idBoton = mapaTeclaABotonRetroArch[e.code];
        if (idBoton !== undefined && !teclasActivas.has(e.code)) {
            e.preventDefault();
            teclasActivas.add(e.code);
            conn.send({ tipo: 'input_mando', boton: idBoton, presionado: true });
        }
    });

    window.addEventListener('keyup', (e) => {
        const idBoton = mapaTeclaABotonRetroArch[e.code];
        if (idBoton !== undefined && teclasActivas.has(e.code)) {
            e.preventDefault();
            teclasActivas.delete(e.code);
            conn.send({ tipo: 'input_mando', boton: idBoton, presionado: false });
        }
    });

    const estadoMando = {};
    const mapaGamepadARetroArch = {
        0: 0, 2: 1, 1: 8, 3: 9, 4: 10, 5: 11, 8: 2, 9: 3,
        12: 4, 13: 5, 14: 6, 15: 7
    };

    function loopMando() {
        if (!document.hasFocus() || !usarMandoEnInvitado) {
            requestAnimationFrame(loopMando);
            return;
        }

        const gamepads = navigator.getGamepads ? navigator.getGamepads() : [];
        const gp = Array.from(gamepads).find(g => g && g.connected);

        if (gp) {
            for (const [btnFisico, btnRetro] of Object.entries(mapaGamepadARetroArch)) {
                const presionado = gp.buttons[btnFisico]?.pressed || false;
                if (presionado !== !!estadoMando[btnFisico]) {
                    estadoMando[btnFisico] = presionado;
                    conn.send({ tipo: 'input_mando', boton: btnRetro, presionado: presionado });
                }
            }

            const ejeX = gp.axes[0] || 0;
            const ejeY = gp.axes[1] || 0;
            const dirs = { izq: [ejeX < -0.4, 6], der: [ejeX > 0.4, 7], arr: [ejeY < -0.4, 4], aba: [ejeY > 0.4, 5] };
            for (const [k, [activo, btnId]] of Object.entries(dirs)) {
                if (activo !== !!estadoMando[k]) {
                    estadoMando[k] = activo;
                    conn.send({ tipo: 'input_mando', boton: btnId, presionado: activo });
                }
            }
        }
        requestAnimationFrame(loopMando);
    }
    requestAnimationFrame(loopMando);
}