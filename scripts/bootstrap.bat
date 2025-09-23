@echo off
setlocal ENABLEDELAYEDEXPANSION

if /I not "%OS%"=="Windows_NT" (
  echo.
  echo [ERROR] Este asistente solo esta disponible en Windows.
  exit /b 1
)

echo ================================================
echo  Asistente de preparacion del entorno (Windows)
echo ================================================

echo.
call :require_pnpm || goto :end
call :require_python || goto :end
call :ensure_build_tools || goto :end

echo.
echo Instalando dependencias del monorepo con pnpm...
call pnpm install
if errorlevel 1 (
  echo.
  echo [ERROR] La instalacion de dependencias fallo. Revisa los mensajes anteriores (Python, Build Tools, etc.).
  goto :end
)

echo.
echo Dependencias instaladas correctamente.

echo.
:menu
echo Selecciona el servicio que deseas iniciar:
echo   1 ^) Todos (pnpm dev)
echo   2 ^) API (@flstudio/api)
echo   3 ^) SFU (@flstudio/sfu)
echo   4 ^) Companion (@flstudio/companion)
echo   0 ^) Salir
set /p CHOICE=Opcion [0-4]: 
if "%CHOICE%"=="0" goto :end
if "%CHOICE%"=="1" (
  call pnpm dev
  goto :menu
)
if "%CHOICE%"=="2" (
  call pnpm --filter @flstudio/api dev
  goto :menu
)
if "%CHOICE%"=="3" (
  call pnpm --filter @flstudio/sfu dev
  goto :menu
)
if "%CHOICE%"=="4" (
  call pnpm --filter @flstudio/companion dev
  goto :menu
)
echo.
echo Opcion no valida. Intenta de nuevo.
goto :menu

:require_pnpm
where pnpm >nul 2>nul
if errorlevel 1 (
  echo [ERROR] pnpm no se encuentra en el PATH. Ejecuta "corepack enable pnpm" y vuelve a intentarlo.
  exit /b 1
)
for /f "delims=" %%V in ('pnpm --version 2^>^&1') do set "PNPM_VERSION=%%V"
echo [OK] pnpm detectado (version !PNPM_VERSION!).
exit /b 0

:require_python
set "PYTHON_VERSION="
for /f "delims=" %%V in ('py -3 --version 2^>^&1') do set "PYTHON_VERSION=%%V"
if defined PYTHON_VERSION goto :python_found
for /f "delims=" %%V in ('py --version 2^>^&1') do set "PYTHON_VERSION=%%V"
if defined PYTHON_VERSION goto :python_found
for /f "delims=" %%V in ('python --version 2^>^&1') do set "PYTHON_VERSION=%%V"
if defined PYTHON_VERSION goto :python_found
for /f "delims=" %%V in ('python3 --version 2^>^&1') do set "PYTHON_VERSION=%%V"
if defined PYTHON_VERSION goto :python_found
echo [ERROR] No se encontro Python 3. Instala Python 3.10 o superior y aseguralo en el PATH.
exit /b 1

:python_found
echo [OK] Python detectado (!PYTHON_VERSION!).
exit /b 0

:ensure_build_tools
set "HAS_BUILD_TOOLS="
call :detect_build_tools
if defined HAS_BUILD_TOOLS (
  echo [OK] Herramientas de compilacion de Windows detectadas.
  exit /b 0
)

echo [WARN] No se detectaron Windows Build Tools (vswhere/msbuild).
set /p INSTALL_BT=¿Deseas instalarlas automaticamente con "pnpm dlx windows-build-tools@latest"? [s/N]:
if /I "%INSTALL_BT%"=="S" (
  call pnpm dlx windows-build-tools@latest
  if errorlevel 1 (
    echo [WARN] No se pudieron instalar automaticamente los Windows Build Tools. Instala Visual Studio Build Tools manualmente.
  ) else (
    call :detect_build_tools
    if defined HAS_BUILD_TOOLS (
      echo [OK] Windows Build Tools instalados.
      exit /b 0
    )
  )
) else (
  echo Instala Visual Studio Build Tools 2022 (Desktop development with C++), luego vuelve a ejecutar este asistente.
)
echo [ERROR] Es necesario contar con Visual Studio Build Tools para compilar dependencias nativas.
exit /b 1

:detect_build_tools
where vswhere >nul 2>nul
if %errorlevel%==0 set "HAS_BUILD_TOOLS=1"
if not defined HAS_BUILD_TOOLS (
  where msbuild >nul 2>nul
  if %errorlevel%==0 set "HAS_BUILD_TOOLS=1"
)
exit /b 0

:end
endlocal
exit /b 0
