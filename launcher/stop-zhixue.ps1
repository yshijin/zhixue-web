# 智学测评项目一键停止脚本
# 只停止后端，PostgreSQL 保持运行
$ErrorActionPreference = "Stop"

$Root = Split-Path $PSScriptRoot -Parent
$PidFile = Join-Path $Root ".local\server.pid"
$Stopped = $false

function Write-Ok([string]$Message) {
    Write-Host "[完成] $Message" -ForegroundColor Green
}

function Write-Info([string]$Message) {
    Write-Host "[提示] $Message" -ForegroundColor Yellow
}

if (Test-Path $PidFile) {
    $savedPid = Get-Content $PidFile -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($savedPid -match "^\d+$") {
        $process = Get-Process -Id ([int]$savedPid) -ErrorAction SilentlyContinue
        if ($process -and $process.ProcessName -eq "java") {
            $info = Get-CimInstance Win32_Process -Filter "ProcessId=$([int]$savedPid)" -ErrorAction SilentlyContinue
            if ($info -and $info.CommandLine -and ($info.CommandLine -like "*zhixue-server-2.0.0.jar*" -or $info.CommandLine -like "*ZhixueApplication*")) {
                Stop-Process -Id ([int]$savedPid) -Force
                $Stopped = $true
            }
        }
    }
    Remove-Item $PidFile -Force -ErrorAction SilentlyContinue
}

if (-not $Stopped) {
    $conn = Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($conn) {
        $owner = Get-CimInstance Win32_Process -Filter "ProcessId=$($conn.OwningProcess)" -ErrorAction SilentlyContinue
        if ($owner -and $owner.CommandLine -and ($owner.CommandLine -like "*zhixue-server-2.0.0.jar*" -or $owner.CommandLine -like "*ZhixueApplication*")) {
            Stop-Process -Id $conn.OwningProcess -Force
            $Stopped = $true
        }
    }
}

if ($Stopped) {
    Write-Ok "智学测评后端已停止。"
} else {
    Write-Info "没有发现正在运行的智学测评后端。"
}

Write-Host "PostgreSQL 仍在运行；如无其他用途，可保持不动。" -ForegroundColor Gray
Start-Sleep -Seconds 3
exit 0
