@echo off
title Subir la web a internet
cd /d "D:\profesional\proyectos\website"
echo.
echo  ============================================================
echo    SUBIR LOS CAMBIOS A INTERNET
echo.
echo    Esto manda a GitHub lo que ya quedo preparado, y la web se
echo    reconstruye sola. En 2 o 3 minutos se ve el cambio en
echo    emilianosalasporta.cloud
echo.
echo    Ojo: esto NO hace falta para las notas que cargas desde el
echo    panel /admin. Esas se publican solas. Esto es para cuando
echo    tocamos el codigo de la web.
echo  ============================================================
echo.
echo  Limpiando archivos sueltos de git, por las dudas...
if exist ".git\index.lock" del /f /q ".git\index.lock" >nul 2>&1
if exist ".git\HEAD.lock" del /f /q ".git\HEAD.lock" >nul 2>&1
if exist ".git\_restos-borrar" rmdir /s /q ".git\_restos-borrar" >nul 2>&1
echo.
echo  Esto es lo que se va a subir:
echo.
git log --oneline origin/main..main
echo.
echo  Subiendo...
echo.
git push
if errorlevel 1 goto salio_mal

echo.
echo  ------------------------------------------------------------
echo    LISTO, ya se subio.
echo    En 2 o 3 minutos miralo en: https://emilianosalasporta.cloud
echo    (si no aparece, avisame y lo revisamos)
echo  ------------------------------------------------------------
echo.
pause
exit /b 0

:salio_mal
echo.
echo  ------------------------------------------------------------
echo    ALGO FALLO Y NO SE SUBIO NADA.
echo    Sacale una foto o copiame el texto de arriba y lo vemos.
echo    Tu trabajo NO se perdio: sigue guardado en tu compu.
echo  ------------------------------------------------------------
echo.
pause
exit /b 1
