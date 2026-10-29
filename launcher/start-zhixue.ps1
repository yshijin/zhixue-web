# 智学测评项目一键启动脚本
# 由桌面快捷方式调用：start-zhixue.cmd
param([switch]$NoBrowser)

$ErrorActionPreference = "Stop"

$Root = Split-Path $PSScriptRoot -Parent
$Jar = Join-Path $Root "server\target\zhixue-server-2.0.0.jar"
$JarName = "zhixue-server-2.0.0.jar"
$Mvn = "D:\tools\apache-maven-3.9.16\bin\mvn.cmd"
$PgCtl = "D:\dev\pgsql\bin\pg_ctl.exe"
$PgData = Join-Path $Root ".local\pgdata"
$PgLog = Join-Path $Root ".local\pg.log"
$PgStartOut = Join-Path $Root ".local\pg-start.out.log"
$PgStartErr = Join-Path $Root ".local\pg-start.err.log"
$ServerOut = Join-Path $Root ".local\server-launcher.out.log"
$ServerErr = Join-Path $Root ".local\server-launcher.err.log"
$PidFile = Join-Path $Root ".local\server.pid"
$Url = "http://127.0.0.1:8080"
$JavaHome = "C:\Program Files\Eclipse Adoptium\jdk-21.0.10.7-hotspot"
$Java = Join-Path $JavaHome "bin\java.exe"
$script:serverProc = $null

function Write-Step([string]$Message) {
    Write-Host "[启动] $Message" -ForegroundColor Cyan
}

function Write-Ok([string]$Message) {
    Write-Host "[完成] $Message" -ForegroundColor Green
}

function Fail([string]$Message) {
    Write-Host ""
    Write-Host "[失败] $Message" -ForegroundColor Red
    if ($script:serverProc -and -not $script:serverProc.HasExited) {
        try { Stop-Process -Id $script:serverProc.Id -Force -ErrorAction SilentlyContinue } catch { }
    }
    if (Test-Path $PidFile) { Remove-Item $PidFile -Force -ErrorAction SilentlyContinue }
    Write-Host "请查看上面的提示或 .local 目录下的日志。" -ForegroundColor Yellow
    exit 1
}

trap {
    Fail "发生未预期错误：$($_.Exception.Message)"
}

function Test-Port([int]$Port) {
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $client.Connect("127.0.0.1", $Port)
        return $true
    } catch {
        return $false
    } finally {
        $client.Close()
    }
}

function Wait-Health([int]$Seconds) {
    $deadline = (Get-Date).AddSeconds($Seconds)
    while ((Get-Date) -lt $deadline) {
        if ($script:serverProc -and $script:serverProc.HasExited) { return $null }
        try {
            $health = Invoke-RestMethod -Uri "$Url/api/health" -TimeoutSec 2
            if ($health.status -eq "ok" -and $health.database -eq "up") { return $health }
        } catch { }
        Start-Sleep -Milliseconds 500
    }
    return $null
}

function Open-App {
    Write-Host ""
    Write-Ok "智学测评已经启动"
    Write-Host "访问地址：$Url" -ForegroundColor White
    Write-Host "演示账号：admin / 123456" -ForegroundColor Gray
    Write-Host "后端日志：$ServerOut" -ForegroundColor Gray
    Write-Host "关闭此窗口不会停止服务；停止请双击“智学测评项目-一键停止”。" -ForegroundColor Gray
    Write-Host ""
    if (-not $script:NoBrowser) {
        Start-Process $Url
    }
    Start-Sleep -Seconds 4
    exit 0
}

# 0. 环境检查
if (-not (Test-Path $Java)) {
    Fail "找不到 JDK 21：$Java"
}
$env:JAVA_HOME = $JavaHome
$env:Path = "$JavaHome\bin;$env:Path"

New-Item -ItemType Directory -Force -Path (Join-Path $Root ".local") | Out-Null

# 1. 已有服务就直接打开；如果数据库没连上，先启动数据库
$serverAlreadyRunning = $false
try {
    $health = Invoke-RestMethod -Uri "$Url/api/health" -TimeoutSec 2
    if ($health.status -eq "ok") {
        if ($health.database -eq "up") {
            Write-Step "服务已经在运行，直接打开浏览器。"
            if (-not $script:NoBrowser) { Start-Process $Url }
            Start-Sleep -Seconds 3
            exit 0
        }
        $serverAlreadyRunning = $true
        Write-Step "后端已在运行，但数据库未连接，准备启动 PostgreSQL。"
    }
} catch { }

# 2. 检查 8080 是否被其他程序占用
if (-not $serverAlreadyRunning -and (Test-Port 8080)) {
    $conn = Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
    $ownerPid = 0
    if ($conn) { $ownerPid = $conn.OwningProcess }
    $owner = $null
    if ($ownerPid) { $owner = Get-CimInstance Win32_Process -Filter "ProcessId=$ownerPid" -ErrorAction SilentlyContinue }
    if ($owner -and $owner.CommandLine -and ($owner.CommandLine -like "*$JarName*" -or $owner.CommandLine -like "*ZhixueApplication*")) {
        $serverAlreadyRunning = $true
        Write-Step "检测到智学后端正在启动或运行，等待它就绪。"
    } else {
        Fail "8080 端口被其他程序占用（PID $ownerPid）。请先关闭占用程序，或使用“一键停止”。"
    }
}

# 3. 启动 PostgreSQL（如果没运行）
if (-not (Test-Port 5432)) {
    Write-Step "PostgreSQL 未运行，正在启动..."
    if (-not (Test-Path $PgCtl)) { Fail "找不到 PostgreSQL 启动程序：$PgCtl" }
    if (-not (Test-Path $PgData)) { Fail "找不到数据库数据目录：$PgData" }
    Start-Process -FilePath $PgCtl -ArgumentList @("-D", $PgData, "-l", $PgLog, "start") `
        -WindowStyle Hidden -RedirectStandardOutput $PgStartOut -RedirectStandardError $PgStartErr | Out-Null
    $pgReady = $false
    for ($i = 0; $i -lt 40; $i++) {
        Start-Sleep -Milliseconds 500
        if (Test-Port 5432) { $pgReady = $true; break }
    }
    if (-not $pgReady) { Fail "PostgreSQL 未能在 20 秒内启动，请查看 $PgLog" }
}
Write-Step "PostgreSQL 正常（5432）。"

# 4. 如果后端已经在运行，只等数据库恢复并打开页面
if ($serverAlreadyRunning) {
    Write-Step "等待后端恢复数据库连接..."
    $health = Wait-Health 30
    if (-not $health) { Fail "后端没有在 30 秒内恢复，请查看 $ServerErr" }
    Open-App
}

# 5. 判断是否需要重新构建
$needBuild = -not (Test-Path $Jar)
if (-not $needBuild) {
    $jarTime = (Get-Item $Jar).LastWriteTimeUtc
    $sourceFiles = @()
    $sourceFiles += Get-ChildItem (Join-Path $Root "server\src") -Recurse -File -ErrorAction SilentlyContinue
    $sourceFiles += Get-ChildItem $Root -File -Filter "*.html" -ErrorAction SilentlyContinue
    $sourceFiles += Get-ChildItem (Join-Path $Root "assets") -Recurse -File -ErrorAction SilentlyContinue
    $pom = Get-Item (Join-Path $Root "server\pom.xml") -ErrorAction SilentlyContinue
    if ($pom) { $sourceFiles += $pom }
    $changed = $sourceFiles | Where-Object { $_ -and $_.LastWriteTimeUtc -gt $jarTime } | Select-Object -First 1
    if ($changed) {
        $needBuild = $true
        Write-Step "检测到源码更新：$($changed.FullName)"
    }
}

if ($needBuild) {
    if (-not (Test-Path $Mvn)) { Fail "找不到 Maven：$Mvn" }
    Write-Step "正在编译打包，第一次或修改代码后可能需要几十秒..."
    Push-Location (Join-Path $Root "server")
    try {
        & $Mvn -q -DskipTests package
        if ($LASTEXITCODE -ne 0) { Fail "Maven 构建失败，请查看上方输出。" }
    } finally {
        Pop-Location
    }
    if (-not (Test-Path $Jar)) { Fail "构建完成但没有找到 jar：$Jar" }
}

# 6. 后台启动后端
Write-Step "启动后端服务..."
if (Test-Path $PidFile) { Remove-Item $PidFile -Force -ErrorAction SilentlyContinue }
if (Test-Path $ServerOut) { Remove-Item $ServerOut -Force -ErrorAction SilentlyContinue }
if (Test-Path $ServerErr) { Remove-Item $ServerErr -Force -ErrorAction SilentlyContinue }

$script:serverProc = Start-Process -FilePath $Java -ArgumentList @("-jar", $Jar) `
    -WorkingDirectory $Root -WindowStyle Hidden `
    -RedirectStandardOutput $ServerOut -RedirectStandardError $ServerErr -PassThru

Set-Content -Path $PidFile -Value $script:serverProc.Id -Encoding ASCII

# 7. 等待健康检查
Write-Step "等待服务就绪..."
$health = Wait-Health 60
if (-not $health) {
    Fail "后端没有在 60 秒内就绪。请查看 $ServerErr 或 $ServerOut"
}

Open-App
