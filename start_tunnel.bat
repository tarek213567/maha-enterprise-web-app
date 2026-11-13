@echo off
chcp 65001 >nul
title মাহা এন্টারপ্রাইজ - ক্লাউডফ্লেয়ার টানেল ম্যানেজার

echo ===============================================================================
echo   মাহা এন্টারপ্রাইজ (Maha Enterprise v1.5.0 PRO)
echo   মোবাইল PWA ও ক্লাউডফ্লেয়ার টানেল ম্যানেজার (Port: 3030)
echo   স্থায়ী গেটওয়ে ডোমেন: https://maha.nexobd.pro
echo ===============================================================================
echo.

:: ১. চেক লোকাল সার্ভার পোর্ট ৩০৩০
echo [১/৩] লোকাল মাহা সার্ভার পোর্ট ৩০৩০ চেক করা হচ্ছে...
curl -s --connect-timeout 2 http://localhost:3030/api/health >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [সতর্কবার্তা] পোর্ট ৩০৩০-এ লোকাল সার্ভার পাওয়া যায়নি!
    echo অনুগ্রহ করে নিশ্চিত করুন যে 'মাহা এন্টারপ্রাইজ' ডেস্কটপ সফটওয়্যারটি চালু আছে।
    echo সফটওয়্যার চালু থাকলে টানেল স্বয়ংক্রিয়ভাবে এর সাথে সংযুক্ত হবে।
    echo.
) else (
    echo [✓] লোকাল সার্ভার সক্রিয় এবং রেসপন্স দিচ্ছে (http://0.0.0.0:3030)।
)

echo.
:: ২. চেক cloudflared ইন্সটল আছে কিনা
echo [২/৩] ক্লাউডফ্লেয়ার টানেল ইঞ্জিন চেক করা হচ্ছে...
set "CF_CMD="
if exist "%~dp0bin\cloudflared.exe" (
    set "CF_CMD="%~dp0bin\cloudflared.exe""
) else (
    where cloudflared >nul 2>nul
    if %ERRORLEVEL% EQU 0 (
        set "CF_CMD=cloudflared"
    ) else (
        where npx >nul 2>nul
        if %ERRORLEVEL% EQU 0 (
            set "CF_CMD=npx --yes cloudflared"
        )
    )
)

if "%CF_CMD%"=="" (
    echo [সতর্কবার্তা] আপনার পিসিতে 'cloudflared' বা 'npx' পাওয়া যায়নি!
    echo.
    echo ১. স্বয়ংক্রিয়ভাবে ইনস্টল করতে টার্মিনালে চালান:
    echo    winget install --id Cloudflare.cloudflared -e
    echo.
    echo ২. অথবা সরাসরি ডাউনলোড করুন:
    echo    https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.msi
    echo.
    echo ইনস্টলেশন শেষে এই ফাইলটি পুনরায় চালু করুন।
    echo ===============================================================================
    pause
    exit /b 1
)

echo [✓] ক্লাউডফ্লেয়ার টানেল ইঞ্জিন প্রস্তুত রয়েছে (%CF_CMD%)।
echo.

:: ৩. টানেল টাইপ নির্বাচন
set TOKEN=
if exist "%~dp0tunnel_token.txt" (
    set /p TOKEN=<"%~dp0tunnel_token.txt"
)

if not "%TOKEN%"=="" (
    echo [✓] সংরক্ষিত Zero Trust টানেল টোকেন সনাক্ত হয়েছে!
    echo -------------------------------------------------------------------------------
    echo [১] পার্মানেন্ট Zero Trust টানেল চালান (https://maha.nexobd.pro) [প্রস্তাবিত]
    echo [২] ফ্রি কুইক টানেল চালান (*.trycloudflare.com)
    echo -------------------------------------------------------------------------------
    set /p CHOICE="আপনার পছন্দ লিখুন (ডিফল্ট ১): "
    if "%CHOICE%"=="2" goto QUICK_TUNNEL
    goto NAMED_TUNNEL
)

:QUICK_TUNNEL
echo.
echo [৩/৩] ফ্রি কুইক টানেল চালু হচ্ছে...
echo -------------------------------------------------------------------------------
echo টার্মিনালে আসা https://*.trycloudflare.com লিংকটি লক্ষ্য করুন।
echo সেই লিংকটি Cloudflare Worker-এর UPSTREAM_URL এ সেট করুন।
echo (সংযোগ ড্রপ করলে ৫ সেকেন্ডের মধ্যে স্বয়ংক্রিয়ভাবে পুনরায় সংযুক্ত হবে)
echo (টানেল বন্ধ করতে যেকোনো সময় এই উইন্ডো কেটে দিন বা Ctrl + C চাপুন)
echo -------------------------------------------------------------------------------
echo.

:LOOP_QUICK
%CF_CMD% tunnel --url http://localhost:3030
echo.
echo [!] টানেল সংযোগ বিচ্ছিন্ন হয়েছে। ৫ সেকেন্ডের মধ্যে পুনরায় চেষ্টা করা হচ্ছে...
timeout /t 5 /nobreak >nul
echo [*] পুনরায় সংযুক্ত হচ্ছে...
goto LOOP_QUICK

:NAMED_TUNNEL
echo.
echo [৩/৩] পার্মানেন্ট Zero Trust টানেল চালু হচ্ছে (https://maha.nexobd.pro)...
echo.
:LOOP_NAMED
%CF_CMD% tunnel run --token %TOKEN%
echo.
echo [!] টানেল সংযোগ বিচ্ছিন্ন হয়েছে। ৫ সেকেন্ডের মধ্যে পুনরায় চেষ্টা করা হচ্ছে...
timeout /t 5 /nobreak >nul
echo [*] পুনরায় সংযুক্ত হচ্ছে...
goto LOOP_NAMED
