# Companion app (ASIO Bridge)

- Requiere Windows 10/11 con drivers ASIO y compilación de `naudiodon` con soporte ASIO (PortAudio + SDK de Steinberg).
- Variables de entorno: `COMPANION_SIGNAL_URL` apuntando al SFU (`wss://` recomendado en producción).
- `pnpm --filter @flstudio/companion dev` compila TypeScript, copia la UI y abre Electron.
- Audio se captura con `framesPerBuffer = 128` (configurable) y se alimenta a un `RTCAudioSource` que produce un track hacia el SFU.
- La UI muestra RTT estimado (ms) basado en `getStats`. Para medición absoluta usar loopback hardware.
