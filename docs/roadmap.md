# Roadmap de funcionalidades avanzadas

1. **Time-stretching y warping**: análisis FFT en WASM, markers elásticos, grid con cuantización adaptativa.
2. **Comping**: pila de takes por pista, selección por rango y fusión con crossfades automáticos.
3. **Elastic audio**: detección de transitorios + estiramiento por grano (phase vocoder) con previsualización en tiempo real.
4. **Bounce-in-place / Freeze**: render parcial en servidor o navegador usando WebAssembly threads + almacenamiento incremental.
5. **Control surfaces (MIDI)**: mapeo dinámico de CC/NRPN, feedback LED/Display vía WebMIDI y companion app.
