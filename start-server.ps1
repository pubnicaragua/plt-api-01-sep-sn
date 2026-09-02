$ErrorActionPreference = 'Continue'
$base = 'C:\Users\Probook 450 G7\Desktop\INCOEX APPS\api-incoex'
Set-Location -LiteralPath $base
Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.Id -ne $PID } | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Milliseconds 1200
& node (Join-Path $base 'dist\main.js') *> (Join-Path $base 'serve.log') 2>&1