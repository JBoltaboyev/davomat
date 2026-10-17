@echo off
chcp 65001 > nul
echo ================================================================
echo  davomat.urdpi.uz domenini kompyuterga ulash (Administrator)
echo ================================================================
echo.
echo Iltimos, chiqadigan oynada "HA" (Yes) tugmasini bosing...

powershell -Command "Start-Process powershell -ArgumentList '-NoProfile -Command $hosts = ''C:\Windows\System32\drivers\etc\hosts''; $line = ''127.0.0.1 davomat.urdpi.uz''; if ((Get-Content $hosts) -notcontains $line) { Add-Content -Path $hosts -Value \"`n$line\" }' -Verb RunAs"

echo.
echo ================================================================
echo  Muvaffaqiyatli ulandi! Endi brauzerda:
echo  http://davomat.urdpi.uz deb kirsangiz bo'ladi!
echo ================================================================
pause
