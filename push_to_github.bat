@echo off
chcp 65001 > nul
echo ========================================================
echo  UrDPI Davomat Tizimi - GitHub-ga Yuklash (Push)
echo ========================================================
echo.

git add .
git commit -m "Yangilanishlar yuklandi: %date% %time%"
git push -u origin main

echo.
echo ========================================================
echo  Yuklash yakunlandi!
echo ========================================================
pause
