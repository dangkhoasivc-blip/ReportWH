@echo off
echo ===================================================
echo     HE THONG TU DONG CHAY VA DONG BO REPORT
echo ===================================================

echo.
echo [1/3] Dang chay quy trinh bao cao "% Shelf life" goc...
call "D:\OneDrive - SABECO\Cong viec\BC tuan\Canh bao % shelf life\Auto % Shelf life\1. CLICK DE CHAY TU DONG.bat"

echo.
echo [2/3] Dang trich xuat du lieu tu Excel sang JSON cho Website...
cd /d "C:\Users\khoatnd\.gemini\antigravity\scratch\sabeco-dashboard"
python export_to_json.py
python export_hangguic1.py
python export_hangblock.py
python export_hopdong.py

echo.
echo [3/3] Dang day du lieu moi len Github Pages...
git add data.json data_hangblock.json data_hopdong.json data/bc01
git commit -m "Auto update report data at %date% %time%"
git push origin main

echo.
echo ===================================================
echo     HOAN TAT DONG BO! WEBSITE SE CAP NHAT SAU 1-2 PHUT
echo ===================================================
pause
