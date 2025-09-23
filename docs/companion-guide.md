# Companion app (ASIO Bridge)

- Requiere Windows 10/11 con drivers ASIO y compilación de `naudiodon` con soporte ASIO (PortAudio + SDK de Steinberg).
- Variables de entorno: `COMPANION_SIGNAL_URL` apuntando al SFU (`wss://` recomendado en producción).
- `pnpm --filter @flstudio/companion dev` compila TypeScript, copia la UI y abre Electron.
- Audio se captura con `framesPerBuffer = 128` (configurable) y se alimenta a un `RTCAudioSource` que produce un track hacia el SFU.
- La UI muestra RTT estimado (ms) basado en `getStats`. Para medición absoluta usar loopback hardware.

## Prerequisitos y solución de problemas

- Sigue la [guía oficial de node-gyp para Windows](https://github.com/nodejs/node-gyp#on-windows) para instalar Visual Studio Build Tools 2022 (workload "Desktop development with C++") y enlazar correctamente MSVC, Windows SDK y CMake.
- Instala Python 3.10–3.12 y expónlo al PATH. Si `pnpm install` falla con `No module named 'distutils'`, ejecuta `py -m pip install --upgrade pip setuptools` o instala el intérprete desde Microsoft Store con la opción "pip" habilitada. Después, alinea pnpm con `pnpm config set python python311` (ajusta la versión si usas 3.10 o 3.12).
- `naudiodon` utiliza PortAudio; consulta [la documentación oficial](https://portaudio.com/docs/v19-doxydocs/compile_windows.html) si necesitas compilar el backend ASIO manualmente.
- Vuelve a intentar la instalación de dependencias con `pnpm install --filter @flstudio/companion` una vez aplicada la configuración anterior.
