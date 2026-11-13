@echo off
chcp 65001 >nul
title মাহা এন্টারপ্রাইজ - ক্লাউডফ্লেয়ার Zero Trust পার্মানেন্ট টানেল

echo ===============================================================================
echo   মাহা এন্টারপ্রাইজ (Maha Enterprise v1.5.0 PRO)
echo   Cloudflare Zero Trust Named Tunnel Runner
echo   স্থায়ী কাস্টম ডোমেন: https://maha.nexobd.pro
echo ===============================================================================
echo.

:: ১. চেক লোকাল সার্ভার পোর্ট ৩০৩০
echo [১/৩] লোকাল মাহা সার্ভার (http://localhost:3030) চেক করা হচ্ছে...
curl -s --connect-timeout 2 http://localhost:3030/api/health >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [সতর্কবার্তা] পোর্ট ৩০৩০-এ লোকাল সার্ভার এখনও চালু হয়নি!
    echo অনুগ্রহ করে নিশ্চিত করুন যে 'মাহা এন্টারপ্রাইজ' সফটওয়্যারটি চালু আছে।
    echo সফটওয়্যার চালু থাকলে টানেল ব্যাকগ্রাউন্ডে এর সাথে স্বয়ংক্রিয়ভাবে সংযুক্ত থাকবে।
    echo.
) else (
    echo [✓] লোকাল মাহা সার্ভার সক্রিয় (http://0.0.0.0:3030)।
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
    echo [ত্রুটি] আপনার পিসিতে 'cloudflared' বা 'npx' ইনস্টল নেই!
    echo ইনস্টল করতে টার্মিনালে চালান: winget install --id Cloudflare.cloudflared -e
    echo অথবা ডাউনলোড করুন: https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.msi
    pause
    exit /b 1
)
echo [✓] ক্লাউডফ্লেয়ার ইঞ্জিন প্রস্তুত (%CF_CMD%)।
echo.

:: ৩. টানেল টোকেন যাচাই বা ইনপুট গ্রহণ
echo [৩/৩] Zero Trust টানেল টোকেন যাচাই করা হচ্ছে...
set TOKEN=
if exist "%~dp0tunnel_token.txt" (
    set /p TOKEN=<"%~dp0tunnel_token.txt"
)

if "%TOKEN%"=="" (
    echo.
    echo ===============================================================================
    echo Cloudflare Zero Trust ড্যাশবোর্ড থেকে পাওয়া টানেল টোকেনটি এখানে পেস্ট করুন।
    echo (টোকেনটি tunnel_token.txt ফাইলে সেভ থাকবে, ফলে পরবর্তীতে আর ইনপুট দিতে হবে না)
    echo ===============================================================================
    set /p TOKEN="টানেল টোকেন দিন (Paste Token): "
    if "%TOKEN%"=="" (
        echo [ত্রুটি] কোনো টোকেন দেওয়া হয়নি! টানেল চালু করা সম্ভব নয়।
        pause
        exit /b 1
    )
    echo %TOKEN%>"%~dp0tunnel_token.txt"
    echo [✓] টোকেন সফলভাবে tunnel_token.txt ফাইলে সংরক্ষিত হয়েছে।
)

echo.
echo ===============================================================================
echo [*] পার্মানেন্ট Zero Trust টানেল চালু হচ্ছে...
echo [*] বিশ্বব্যাপী যে কোনো ব্রাউজার বা আইফোন থেকে ভিজিট করুন:
echo     👉 https://maha.nexobd.pro
echo.
echo (সংযোগ ড্রপ করলে ৫ সেকেন্ডের মধ্যে স্বয়ংক্রিয়ভাবে পুনরায় সংযুক্ত হবে)
echo (টানেল বন্ধ করতে উইন্ডো কেটে দিন বা Ctrl + C চাপুন)
echo ===============================================================================
echo.

:LOOP
%CF_CMD% tunnel run --token %TOKEN%
echo.
echo [!] টানেল সংযোগ বিচ্ছিন্ন হয়েছে। ৫ সেকেন্ডের মধ্যে পুনরায় সংযোগের চেষ্টা চলছে...
timeout /t 5 /nobreak >nul
echo [*] পুনরায় সংযুক্ত হচ্ছে...
goto LOOP
