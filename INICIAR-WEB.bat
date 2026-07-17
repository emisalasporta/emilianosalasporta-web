@echo off
title Servidor de la web - DEJAR ABIERTO
cd /d "D:\profesional\proyectos\website"
echo.
echo  ============================================================
echo    SERVIDOR DE TU WEB
echo.
echo    Espera unos segundos, hasta ver una linea que diga:
echo        Local   http://localhost:4321/
echo.
echo    Cuando la veas, la web ya esta lista.
echo.
echo    - Deja ESTA ventana abierta mientras trabajas.
echo    - Para apagar la web: cerra esta ventana.
echo  ============================================================
echo.
call npm run dev
echo.
echo  (Si ves esto, la web se apago. Podes cerrar la ventana.)
pause
