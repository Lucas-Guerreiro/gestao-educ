@echo off
REM Inicia o servidor de desenvolvimento Vite para o projeto EscolaSystem.
cd /d "%~dp0"
echo Iniciando servidor de desenvolvimento Vite em http://localhost:5174
npm run dev -- --port 5174
