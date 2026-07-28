@echo off
title Guardar y subir los cambios
cd /d "D:\profesional\proyectos\website"
echo.
echo  ============================================================
echo    GUARDAR LOS CAMBIOS Y SUBIRLOS A INTERNET
echo.
echo    Esto guarda en el historial lo que se cambio de la web y
echo    lo manda a GitHub. La web se reconstruye sola: en 2 o 3
echo    minutos se ve en emilianosalasporta.cloud
echo.
echo    Ojo: esto NO hace falta para las notas que cargas desde el
echo    panel /admin. Esas se publican solas.
echo  ============================================================
echo.
echo  Limpiando archivos sueltos de git, por las dudas...
if exist ".git\index.lock" del /f /q ".git\index.lock" >nul 2>&1
if exist ".git\HEAD.lock" del /f /q ".git\HEAD.lock" >nul 2>&1
if exist ".git\index.lock.borrar" del /f /q ".git\index.lock.borrar" >nul 2>&1
if exist ".git\_restos-borrar" rmdir /s /q ".git\_restos-borrar" >nul 2>&1
for /r ".git\objects" %%F in (tmp_obj_*) do del /f /q "%%F" >nul 2>&1
echo.
echo  Esto es lo que cambio:
echo.
git add -A
if errorlevel 1 goto salio_mal
git status --short
echo.

if exist "_to_delete\mensaje-commit.txt" goto con_mensaje

echo  Contame en una linea que cambiaste (y apreta Enter):
set "MSG="
set /p "MSG=  > "
if not defined MSG goto sin_mensaje
git commit -m "%MSG%"
if errorlevel 1 goto salio_mal
goto subir

:con_mensaje
echo  Uso el mensaje que quedo preparado en _to_delete\mensaje-commit.txt
echo.
git commit -F "_to_delete\mensaje-commit.txt"
if errorlevel 1 goto salio_mal
del /f /q "_to_delete\mensaje-commit.txt" >nul 2>&1

:subir
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

:sin_mensaje
echo.
echo  No escribiste nada, asi que no guarde nada. Tus cambios siguen
echo  intactos: volve a abrir este archivo cuando quieras.
echo.
pause
exit /b 1

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
