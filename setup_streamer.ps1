$ErrorActionPreference = "Stop"

$ToolsDir = "D:\ANITECH GCS\tools\streamer"
if (!(Test-Path $ToolsDir)) {
    New-Item -ItemType Directory -Force -Path $ToolsDir | Out-Null
}

Write-Host "Downloading MediaMTX (RTSP Server)..."
$MediaMtxUrl = "https://github.com/bluenviron/mediamtx/releases/download/v1.9.0/mediamtx_v1.9.0_windows_amd64.zip"
$MediaMtxZip = "$ToolsDir\mediamtx.zip"
Invoke-WebRequest -Uri $MediaMtxUrl -OutFile $MediaMtxZip
Expand-Archive -Path $MediaMtxZip -DestinationPath "$ToolsDir\mediamtx" -Force
Remove-Item $MediaMtxZip

Write-Host "Downloading FFmpeg..."
$FfmpegUrl = "https://github.com/BtbN/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip"
$FfmpegZip = "$ToolsDir\ffmpeg.zip"
Invoke-WebRequest -Uri $FfmpegUrl -OutFile $FfmpegZip
Expand-Archive -Path $FfmpegZip -DestinationPath "$ToolsDir\ffmpeg_temp" -Force
$FfmpegExe = (Get-ChildItem -Path "$ToolsDir\ffmpeg_temp" -Filter "ffmpeg.exe" -Recurse).FullName
Copy-Item $FfmpegExe -Destination "$ToolsDir\ffmpeg.exe"
Remove-Item -Recurse -Force "$ToolsDir\ffmpeg_temp"
Remove-Item $FfmpegZip

Write-Host "Detecting Webcam..."
$Devices = & "$ToolsDir\ffmpeg.exe" -list_devices true -f dshow -i dummy 2>&1
$VideoDevice = ""
foreach ($line in $Devices) {
    if ($line -match '\[dshow @ .*\]  "(.*?)" \(video\)') {
        $VideoDevice = $matches[1]
        break
    }
}

if ($VideoDevice -eq "") {
    Write-Host "COULD NOT FIND WEBCAM! Defaulting to 'Integrated Camera'"
    $VideoDevice = "Integrated Camera"
} else {
    Write-Host "Found Webcam: $VideoDevice"
}

# Create a batch file to start both
$BatContent = @"
@echo off
title ANITECH GCS - CAMERA STREAM SERVER
echo Starting MediaMTX RTSP Server...
start "" /B "%~dp0mediamtx\mediamtx.exe"

echo Waiting 2 seconds for server to start...
timeout /t 2 /nobreak > nul

echo Starting FFmpeg to capture webcam "%VideoDevice%"...
"%~dp0ffmpeg.exe" -f dshow -i video="%VideoDevice%" -c:v libx264 -preset ultrafast -tune zerolatency -b:v 1M -f rtsp rtsp://localhost:8554/drone

pause
"@

Set-Content -Path "$ToolsDir\start_stream.bat" -Value $BatContent

Write-Host ""
Write-Host "============================================="
Write-Host "INSTALLATION COMPLETE!"
Write-Host "============================================="
Write-Host "To start streaming, run this file:"
Write-Host "$ToolsDir\start_stream.bat"
Write-Host "============================================="
