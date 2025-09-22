# Guía de despliegue

- **Desarrollo local**: usa `docker-compose` (pendiente) para PostgreSQL, Redis y SFU. Ejecuta `pnpm dev` para levantar todos los procesos.
- **Producción**: empaqueta con Docker y orquesta con Kubernetes. Recomendada topología: pods separados para API, SFU workers y tareas de render.
- **Escalado SFU**: habilita clustering de mediasoup con Redis para coordinación y coloca un balanceador TCP/UDP (HAProxy o Envoy).
- **Almacenamiento**: usa S3 compatible + CDN. Los assets se suben mediante URL firmadas generadas por la API.
- **Observabilidad**: integra Prometheus/Grafana para métricas de latencia, XRuns y uso de CPU. OpenTelemetry para trazas de eventos colaborativos.
