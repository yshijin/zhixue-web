param(
  [string]$DbUrl = "jdbc:postgresql://127.0.0.1:5432/xiangmu",
  [string]$DbUser = "xiangmu",
  [string]$DbPassword = "xiangmu_dev",
  [switch]$EnableDemoReset
)

$ErrorActionPreference = "Stop"
$root = $PSScriptRoot
$jar = Join-Path $root "server\target\zhixue-server-2.0.0.jar"

if (-not (Test-Path $jar)) {
  throw "未找到 $jar。请先进入 server 目录执行 mvn package。"
}

$java = $null
if ($env:JAVA_HOME) {
  $candidate = Join-Path $env:JAVA_HOME "bin\java.exe"
  if (Test-Path $candidate) { $java = $candidate }
}
if (-not $java) {
  $cmd = Get-Command java -ErrorAction SilentlyContinue
  if ($cmd) { $java = $cmd.Source }
}
if (-not $java) {
  throw "未找到 Java。请安装 JDK 21 并设置 JAVA_HOME，或把 java 加入 PATH。"
}

$env:DB_URL = $DbUrl
$env:DB_USER = $DbUser
$env:DB_PASSWORD = $DbPassword
if ($EnableDemoReset) { $env:DEMO_RESET_ENABLED = "true" }

Write-Host "启动智学测评服务：http://127.0.0.1:8080"
Write-Host "数据库：$DbUrl"
Write-Host "JDK：$java"
Write-Host "演示数据重置：$(if ($EnableDemoReset) { '已启用' } else { '未启用' })"
Write-Host "按 Ctrl+C 停止。"

& $java -jar $jar
