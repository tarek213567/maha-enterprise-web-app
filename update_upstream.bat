@echo off
chcp 65001 >nul
title মাহা এন্টারপ্রাইজ - ক্লাউডফ্লেয়ার ওয়ার্কার আপস্ট্রিম আপডেট

echo ===============================================================================
echo   মাহা এন্টারপ্রাইজ (Maha Enterprise v1.5.0 PRO)
echo   Cloudflare Worker Gateway Upstream URL Updater
echo   স্থায়ী ডোমেন: https://maha.nexobd.pro
echo ===============================================================================
echo.

set /p NEW_URL="টার্মিনালে পাওয়া নতুন trycloudflare লিংকটি পেস্ট করুন (যেমন: https://xxx.trycloudflare.com): "

if "%NEW_URL%"=="" (
    echo [ত্রুটি] কোনো লিংক ইনপুট দেওয়া হয়নি!
    pause
    exit /b 1
)

echo.
echo আপস্ট্রিম URL আপডেট করা হচ্ছে: %NEW_URL%
echo.

cd /d "%~dp0cloudflare-worker"

echo %NEW_URL% | npx wrangler secret put UPSTREAM_URL

if %ERRORLEVEL% EQU 0 (
    echo.
    echo ===============================================================================
    echo [✓] সফলভাবে Cloudflare Worker-এর আপস্ট্রিম URL আপডেট হয়েছে!
    echo এখন আপনি যেকোনো স্থান থেকে https://maha.nexobd.pro ভিজিট করতে পারেন।
    echo ===============================================================================
) else (
    echo.
    echo [!] স্বয়ংক্রিয় আপডেট ব্যর্থ হয়েছে। অনুগ্রহ করে Cloudflare ড্যাশবোর্ডে গিয়ে
    echo Workers > maha-enterprise-gateway > Settings > Variables-এ UPSTREAM_URL পরিবর্তন করুন।
)

echo.
pause
