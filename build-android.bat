@echo off
echo Building Personal Finance Hub for Android...
echo.

echo Step 1: Building web app...
call npm run build
if %errorlevel% neq 0 (
    echo Error: Web build failed!
    pause
    exit /b 1
)

echo.
echo Step 2: Syncing with Android...
call npx cap sync android
if %errorlevel% neq 0 (
    echo Error: Android sync failed!
    pause
    exit /b 1
)

echo.
echo Step 3: Opening Android Studio...
call npx cap open android

echo.
echo Build completed successfully!
echo Next steps:
echo 1. Wait for Android Studio to load
echo 2. Wait for Gradle sync to complete
echo 3. Go to Build ^> Generate Signed Bundle/APK
echo 4. Follow the guide in PLAY_STORE_GUIDE.md
echo.
pause
