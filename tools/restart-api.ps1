$processes = Get-CimInstance Win32_Process -Filter "name = 'node.exe'" | Where-Object { $_.CommandLine -match 'Software-Certificados' }
foreach ($process in $processes) { Stop-Process -Id $process.ProcessId -Force -ErrorAction SilentlyContinue }
Start-Sleep -Seconds 2
Start-Process -FilePath 'cmd.exe' -ArgumentList '/c', 'npm run dev:api > api-run.log 2>&1' -WorkingDirectory 'C:\Users\formi\Desktop\Software-Certificados' -WindowStyle Hidden
Start-Sleep -Seconds 8
Get-Content -Tail 30 'api-run.log'
