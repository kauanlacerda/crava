@echo off
rem Abre o Crava num perfil separado e vazio: da pra testar sem mexer nos teus dados.
rem Apagar a pasta %TEMP%\crava-sandbox zera esse perfil de teste.
cd /d "%~dp0"
node_modules\electron\dist\electron.exe . --user-data-dir="%TEMP%\crava-sandbox"
