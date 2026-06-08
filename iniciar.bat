@echo off
title Gestao Educacional - Servidor Local
echo ===================================================
echo   Iniciando o Servidor de Desenvolvimento
echo ===================================================
echo.
echo Abrindo o navegador em http://localhost:5173...
start http://localhost:5173
echo.
echo Iniciando o Vite...
npm run dev
