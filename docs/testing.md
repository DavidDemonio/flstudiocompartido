# Plan de pruebas inicial

- **Loopback de latencia**: script (pendiente) que envía un metrónomo desde el navegador y mide el retardo recibido en el companion a través de `RTT` + correlación cruzada.
- **CRDT**: pruebas unitarias con Vitest en `@flstudio/crdt-schema` (pendiente) que validen convergencia tras reconexiones y merges simultáneos.
- **DSP**: tests de respuesta al impulso para el EQ y sintetizador (pendiente) comparando salidas con expectativas conocidas.
- **SFU**: pruebas de señalización (pendiente) para validar reintentos de `transportCreated` y difusión de productores.
