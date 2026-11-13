@echo off
chcp 65001 >nul
title মাহা এন্টারপ্রাইজ - ক্লাউডফ্লেয়ার সার্ভিস আনইনস্টলার

echo ===============================================================================
echo   মাহা এন্টারপ্রাইজ (Maha Enterprise v1.5.0 PRO)
echo   Cloudflare Windows Service Uninstaller
echo ===============================================================================
echo.

net session >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [*] এডমিনিস্ট্রেটর পারমিশন প্রয়োজন। UAC প্রম্পট চালু করা হচ্ছে...
    powershell -Command "Start-Process cmd -ArgumentList '/c \"\"%~dp0uninstall_service.bat\"\"' -Verb RunAs"
    exit /b
)

set "CF_EXE=%~dp0bin\cloudflared.exe"
if not exist "%CF_EXE%" (
    set "CF_EXE=cloudflared"
)

echo [*] সার্ভিস বন্ধ করা হচ্ছে...
net stop cloudflared >nul 2>&1

echo [*] সার্ভিস আনইনস্টল করা হচ্ছে...
"%CF_EXE%" service uninstall

echo.
echo [✓] ক্লাউডফ্লেয়ার সার্ভিস সফলভাবে আনইনস্টল করা হয়েছে।
echo.
pause
