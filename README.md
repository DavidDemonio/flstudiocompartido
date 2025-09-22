# FL Studio Compartido – DAW colaborativa web (MVP)

> **Nota rápida:** Esta es la primera entrega del MVP. Incluye la arquitectura propuesta, la estructura del monorepo y código ejecutable mínimo para las aplicaciones `web`, `api`, `sfu` y `companion`.

## 1. Arquitectura de alto nivel

```
                              ┌─────────────────────────────────────────────────────┐
                              │                    Navegador                        │
                              │                                                     │
                              │  React + Tailwind UI (Timeline, Piano Roll, Mixer)  │
                              │  Zustand/Yjs estado local + CRDT                    │
                              │  WebAudio Graph ←→ AudioWorklets ←→ DSP en WASM     │
                              │  WebRTC (media/data) ←→ SFU                         │
                              │  REST/gRPC → API (proyectos, assets)                │
                              └──────────────┬────────────────────┬─────────────────┘
                                             │                    │
                                             │CRDT Sync (WebSocket) │Uploads (S3)
                                             │                    │
 ┌───────────────────────────┐     ┌─────────▼─────────┐   ┌───────▼────────┐
 │ Companion App (Windows)   │     │     API (Node)     │   │   SFU (mediasoup) │
 │ Electron + Node-API +     │     │ Fastify + PostgreSQL│  │  Workers (RTC)   │
 │  ASIO/naudiodon bridge    │     │  Redis (Pub/Sub)    │  │  RTP relaying    │
 │  WebRTC media/data        │     │  Storage metadata   │  │  Tempo tick fanout│
 └──────────┬────────────────┘     └─────────┬─────────┘   └───────┬────────┘
            │                                  │                    │
            │ WebRTC audio (baja latencia)     │REST/WebSocket      │DTLS/SRTP
            │ Param sync (DataChannel)         │Auth OIDC           │Simulcast
            │                                  │                    │
     ┌──────▼────────┐                ┌────────▼────────┐     ┌─────▼─────────┐
     │  ASIO Device  │                │PostgreSQL + S3   │     │ Redis / Clock │
     │ (64-128 buf)  │                │(Assets, proyectos│     │  Sync / SFU   │
     └───────────────┘                └──────────────────┘     └──────────────┘
```

### Decisiones clave

- **Frontend**: React + Vite para iteración rápida, Tailwind para coherencia visual y accesibilidad. Estado musical y edición sincronizada con **Yjs** + Zustand.
- **Audio en navegador**: DSP crítico aislado en AudioWorklets con módulos WebAssembly optimizados (SIMD cuando sea posible). El reloj maestro se ancla a `AudioContext.currentTime` y se distribuye por DataChannel.
- **Colaboración**: CRDT (Yjs) con persistencia en PostgreSQL. Redis pub/sub para presencia y fanout de actualizaciones server-side.
- **Medios**: **mediasoup** como SFU (puede migrar a LiveKit/Jitsi). Permite escalabilidad >100 usuarios con forwarding y mezcla opcional.
- **Companion**: App Windows basada en Electron + Node-API y `naudiodon` (PortAudio) para acceder a ASIO y alojar plugins nativos. Expone WebRTC (data + audio) hacia el navegador.
- **Seguridad**: Autenticación OIDC (placeholder), SRTP/DTLS en RTC, control de permisos por pista.
- **Latencia**: Objetivo <50 ms E2E (10 ms procesamiento local + 20-40 ms red). Se documentan compensaciones en `docs/latency-guide.md`.

## 2. Estructura del monorepo

```
.
├── apps
│   ├── web          # React + Vite + AudioWorklets + WASM demo
│   ├── api          # Fastify API, PostgreSQL, migraciones SQL
│   ├── sfu          # Servidor mediasoup + signaling WebSocket
│   └── companion    # Electron + WebRTC + puente ASIO (Node-API)
├── packages
│   ├── dsp-wasm     # Utilidades y binarios base64 para DSP WASM
│   ├── crdt-schema  # Definiciones Yjs y helpers de colaboración
│   └── ui           # Componentes compartidos (Tailwind/Headless)
├── docs             # Guías (latencia, plugins, despliegue)
├── README.md        # Este documento
├── package.json     # Scripts pnpm/turbo
├── pnpm-workspace.yaml
└── turbo.json
```

## 3. Guía rápida

1. **Instalar pnpm** `npm install -g pnpm@8` y Node 20+.
2. **Instalar dependencias**: `pnpm install` (requiere toolchain para compilar dependencias nativas como mediasoup y naudiodon).
3. **Servir todo en paralelo**: `pnpm dev`.
   - `apps/web`: Vite en `http://localhost:5173`.
   - `apps/api`: Fastify API en `http://localhost:4000`.
   - `apps/sfu`: Signaling + SFU en `ws://localhost:4443` (DTLS en puertos dinámicos UDP/TCP).
   - `apps/companion`: Ejecuta `pnpm --filter @flstudio/companion dev` (abre ventana Electron).
4. **Migraciones**: configura `DATABASE_URL` y ejecuta `pnpm migrate` (aplica `apps/api/migrations`).
5. **Limitaciones conocidas**:
   - El SDK de ASIO y los binarios de VST3/CLAP **no se distribuyen**. Debes aceptar sus licencias, descargar e indicar la ruta antes de compilar el companion.
   - El objetivo es <50 ms E2E; `0 ms` es físicamente imposible (documentado en `docs/latency-guide.md`).
   - La demo incluye un sintetizador WASM sustractivo simple y un EQ digital básico; son ejemplos iniciales.
   - Para WebRTC en localhost se usa certificados auto-firmados generados en `apps/sfu/certs` (genera con el script provisto).

Consulta también:

- `docs/latency-guide.md`: metas de latencia y técnicas de compensación.
- `docs/plugins-guide.md`: flujo para portar y alojar plugins.
- `docs/companion-guide.md`: requisitos del bridge ASIO.
- `docs/testing.md`: pruebas planificadas.
- `docs/roadmap.md`: evolución funcional (time-stretching, comping, freeze, etc.).

## Próximos pasos

Tras esta base se continuará con guías detalladas (latencia, plugins, despliegue), pruebas automáticas (loopback, CRDT, DSP) y roadmap avanzado (time-stretching, comping, freeze, etc.).
