<#
.SYNOPSIS
Build signed Android APK (direct sideload distribution) and Play Store AAB (bundleRelease).
Prerequisites: Android SDK + JDK 17 + Capacitor dependencies installed in mobile-native/.
#>
$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$uiDir = Join-Path $root 'ui'
$mobileDir = Join-Path $root 'mobile-native'
$outDir = Join-Path $mobileDir 'dist-releases'

Write-Host '1/4 Building production React PWA bundle (ui/dist)...'
Push-Location $uiDir
try {
    npm run build
    if ($LASTEXITCODE -ne 0) { throw 'UI Vite build failed' }
} finally { Pop-Location }

Push-Location $mobileDir
try {
    if (-not (Test-Path 'node_modules')) {
        Write-Host '2/4 Installing Capacitor packages...'
        npm install
        if ($LASTEXITCODE -ne 0) { throw 'Capacitor npm install failed' }
    }
    if (-not (Test-Path 'android')) {
        npx cap add android
        Copy-Item -LiteralPath 'android-template/AndroidManifest.xml' -Destination 'android/app/src/main/AndroidManifest.xml' -Force
        New-Item -ItemType Directory -Force -Path 'android/app/src/main/res/xml' | Out-Null
        Copy-Item -LiteralPath 'android-template/network_security_config.xml' -Destination 'android/app/src/main/res/xml/network_security_config.xml' -Force
    }
    Write-Host '3/4 Syncing web bundle to Android project...'
    npx cap sync android
    if ($LASTEXITCODE -ne 0) { throw 'cap sync failed' }

    Write-Host '4/4 Building direct APK + Google Play AAB...'
    Push-Location 'android'
    try {
        .\gradlew.bat assembleRelease bundleRelease
        if ($LASTEXITCODE -ne 0) { throw 'Gradle APK/AAB build failed' }
    } finally { Pop-Location }

    New-Item -ItemType Directory -Force -Path $outDir | Out-Null
    Copy-Item 'android/app/build/outputs/apk/release/*.apk' $outDir -Force -ErrorAction SilentlyContinue
    Copy-Item 'android/app/build/outputs/bundle/release/*.aab' $outDir -Force -ErrorAction SilentlyContinue
    Write-Host "Artifacts ready in: $outDir"
} finally { Pop-Location }
