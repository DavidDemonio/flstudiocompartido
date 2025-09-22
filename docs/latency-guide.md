# Guía de latencia y sincronización

- **Objetivo local**: búfer de 128 frames @ 48 kHz (< 3 ms de retardo de hardware + 3 ms de salida).
- **Objetivo colaborativo**: mantener < 50 ms E2E (10 ms procesamiento + 20-40 ms red). Zero delay no es posible por límites físicos.
- **Buffering**: activar compensación de jitter mediante búfer adaptativo (40-80 ms) para sesiones remotas de alta variabilidad.
- **Reloj**: sincronizar sobre `AudioContext.currentTime` y recalibrar cada 5 s usando mensajes de latencia por DataChannel.
- **XRuns**: monitorizar contadores de underruns via AudioWorkletMessage y reducir carga DSP cuando se acerque al límite.
