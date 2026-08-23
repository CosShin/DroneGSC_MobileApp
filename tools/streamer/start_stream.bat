@echo off
title ANITECH GCS - HLS STREAM SERVER

cd "%~dp0hls"
echo Cleaning old stream files...
del /q *.m3u8 *.ts >nul 2>&1

echo Starting Python HTTP Server on port 8888...
start "" /B python -m http.server 8888

echo Starting FFmpeg to capture webcam "HP Wide Vision HD Camera" and output HLS...
"%~dp0ffmpeg.exe" -f dshow -i video="HP Wide Vision HD Camera" -c:v libx264 -preset ultrafast -tune zerolatency -pix_fmt yuv420p -b:v 1M -g 30 -sc_threshold 0 -f hls -hls_time 2 -hls_list_size 30 -hls_flags delete_segments stream.m3u8

pause
