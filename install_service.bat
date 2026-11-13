@echo off
chcp 65001 >nul
title মাহা এন্টারপ্রাইজ - ক্লাউডফ্লেয়ার সার্ভিস ইনস্টলার

echo ===============================================================================
echo   মাহা এন্টারপ্রাইজ (Maha Enterprise v1.5.0 PRO)
echo   Cloudflare Named Tunnel Windows Service Installer
echo   স্থায়ী কাস্টম ডোমেন: https://maha.nexobd.pro
echo ===============================================================================
echo.

:: ১. এডমিনিস্ট্রেটর প্রিভিলেজ যাচাই
net session >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo [*] এডমিনিস্ট্রেটর পারমিশন প্রয়োজন। UAC প্রম্পট চালু করা হচ্ছে...
    powershell -Command "Start-Process cmd -ArgumentList '/c \"\"%~dp0install_service.bat\"\"' -Verb RunAs"
    exit /b
)

:: ২. টোকেন নির্ধারণ
set TOKEN=
if exist "%~dp0tunnel_token.txt" (
    set /p TOKEN=<"%~dp0tunnel_token.txt"
)
if "%TOKEN%"=="" (
    set TOKEN=eyJhIjoiZGU5NGUxNTQ4ZDdjZTNjZmVkNWRiN2JiZmUwNDg2NjgiLCJ0IjoiODQ2NTJkZDktM2FjZi00NDAyLTk3NzQtMWRhM2MzOGVhNzQ2IiwicyI6Ik5qYzVPRGd3TVRrdE5HRTVPUzAwWlRnd0xXRTFPREV0Tm1Jd05HSXlPRE5qWkdVMyJ9
)

:: ৩. এক্সিকিউটেবল লোকেশন নির্ধারণ
set "CF_EXE=%~dp0bin\cloudflared.exe"
if not exist "%CF_EXE%" (
    where cloudflared >nul 2>&1
    if %ERRORLEVEL% EQU 0 (
        set "CF_EXE=cloudflared"
    ) else (
        echo [ত্রুটি] cloudflared.exe খুঁজে পাওয়া যায়নি!
        pause
        exit /b 1
    )
)

echo [১/৩] বিদ্যমান কোনো পুরোনো সার্ভিস থাকলে তা অপসারণ করা হচ্ছে...
"%CF_EXE%" service uninstall >nul 2>&1

echo.
echo [২/৩] ক্লাউডফ্লেয়ার উইন্ডোজ সার্ভিস ইনস্টল করা হচ্ছে...
"%CF_EXE%" service install %TOKEN%
if %ERRORLEVEL% NEQ 0 (
    echo [ত্রুটি] সার্ভিস ইনস্টল ব্যর্থ হয়েছে!
    pause
    exit /b 1
)

echo.
echo [৩/৩] ক্লাউডফ্লেয়ার সার্ভিস চালু করা হচ্ছে...
net start cloudflared >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    sc.exe start cloudflared >nul 2>&1
)

echo.
echo ===============================================================================
echo [✓] ক্লাউডফ্লেয়ার টানেল সফলভাবে উইন্ডোজ ব্যাকগ্রাউন্ড সার্ভিস হিসেবে রেজিস্টার হয়েছে!
echo [*] সার্ভিসটি উইন্ডোজ বুটের সাথে সাথে স্বয়ংক্রিয়ভাবে ব্যাকগ্রাউন্ডে চালু থাকবে।
echo [*] বিশ্বব্যাপী লাইভ লিঙ্ক: https://maha.nexobd.pro
echo ===============================================================================
echo.
pause
