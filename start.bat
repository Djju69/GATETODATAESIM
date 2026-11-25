@echo off
title GATETODATA eSIM - launcher
echo Запуск GATETODATA eSIM (сайт + бот)...
start "GATETODATA site" cmd /k "cd /d D:\e-Sim && npm run dev"
timeout /t 3 >nul
start "GATETODATA bot" cmd /k "cd /d D:\e-Sim && npm run bot"
timeout /t 3 >nul
start http://localhost:3010
echo.
echo Сайт:  http://localhost:3010
echo Админ: http://localhost:3010/admin
echo Бот:   @GatetodataEsimBOT
echo (оба окна должны остаться открытыми)
pause
