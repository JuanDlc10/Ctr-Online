# CTR Online 🏎️💨

¡Juega Crash Team Racing en modo multijugador online P2P directamente desde el navegador! 

Este proyecto utiliza **WebRTC (PeerJS)** para transmitir video, audio y controles en tiempo real con latencia mínima, sin necesidad de servidores intermedios pesados. Un jugador actúa como Host ejecutando el emulador localmente, mientras que los invitados se conectan a su partida.

## ✨ Características Principales

- **Multijugador P2P en Tiempo Real:** Conexión directa entre jugadores usando PeerJS.
- **Soporte Multitap Automático:** Configurado para soportar hasta 4 jugadores simultáneos.
- **Gestión de Cámaras Dinámica:** Los jugadores pueden recortar la pantalla para enfocarse solo en su vista (Pantalla completa, Vista 2P o Vista 4P).
- **Chat y Medidor de Ping:** Sala de espera integrada con chat en vivo y monitoreo de latencia (ping).
- **Soporte de Mandos y Teclado:** Integración con la API de Gamepad para jugar con controles USB/Bluetooth (Plug & Play) o usando el teclado.
- **Enlaces de Invitación Fáciles:** Genera links cortos automáticamente para que tus amigos se unan con un solo clic.

## 🎮 Instrucciones de Uso

### 👑 Para el Host (Jugador 1)
1. Abre la aplicación en tu navegador.
2. Ingresa tu Nickname.
3. Selecciona la ROM del juego (`.zip`, `.chd`, `.bin`, `.iso`, etc.).
4. *(Opcional)* Selecciona la BIOS de PS1 (`scph1001.bin`) para mejor compatibilidad.
5. Haz clic en **"Crear Sala y Generar Link"**.
6. Copia el link de invitación desde la barra superior y compártelo con tus amigos.

### 🕹️ Para los Invitados (Jugadores 2, 3 y 4)
1. Abre el enlace de invitación enviado por el Host (el código de la sala se llenará automáticamente).
2. Ingresa tu Nickname.
3. Haz clic en **"Entrar a la Carrera"**.
4. ¡Listo! Espera a que el Host inicie la partida. 
> **Nota:** Si usas teclado, asegúrate de hacer clic en la ventana del juego para que detecte tus teclas. Si usas mando, presiona cualquier botón para vincularlo automáticamente.

## ⌨️ Controles por Defecto (Teclado)

| Acción | Tecla (RetroArch) |
| :--- | :--- |
| **Direcciones** | Flechas Direccionales |
| **Acelerar (X)** | `Z` |
| **Frenar (Cuadrado)** | `X` |
| **Arma (Círculo)** | `A` |
| **Mirar Atrás (Triángulo)** | `S` |
| **Saltar / Derrapar (L1 / R1)** | `Q` / `W` |
| **Start** | `Enter` |
| **Select** | `Shift Derecho` |

*Los mandos de Xbox/PlayStation conectados por USB o Bluetooth se mapean automáticamente.*

## 🛠️ Tecnologías Utilizadas

- **HTML5 / CSS3 / JavaScript (Vanilla)**
- **[PeerJS](https://peerjs.com/)**: Wrapper de WebRTC para conexiones de datos y media P2P.
- **[EmulatorJS](https://emulatorjs.org/)**: Emulador basado en libretro (núcleo `pcsx_rearmed`) corriendo en WebAssembly.

## 👤 Autor

Desarrollado por **JuanDlc**.