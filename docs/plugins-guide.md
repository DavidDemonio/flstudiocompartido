# Guía de plugins (WASM y nativos)

1. **WASM**: portar DSP a Rust/C++ y compilar con `-O3` + SIMD. Exportar funciones plano/planar y mantener buffers en memoria compartida.
2. **AudioWorklets**: cada procesador en archivo dedicado, sin asignaciones dentro de `process`. Utiliza `SharedArrayBuffer` con COOP/COEP habilitados.
3. **Compatibilidad nativa**: usa el companion (`apps/companion`) para alojar VST3/CLAP/LV2. Se expone cada parámetro como mensaje Yjs + WebRTC DataChannel.
4. **Automatización**: sample-accurate mediante colas de eventos programadas en el audio worklet.
5. **Licencias**: VST3 SDK (Steinberg) y ASIO SDK requieren aceptación manual. CLAP es libre (MIT) y recomendado para plugins de terceros.
