#Requires -RunAsAdministrator

[CmdletBinding()]
param(
  [string]$InstallRoot = 'C:\Services',
  [string]$Branch = 'master',
  [int]$Port = 3002,
  [string]$ServiceId = 'HireTrackServiceTickets',
  [string]$ServiceName = 'HireTrack Service Tickets',
  [string]$AppDirectoryName = 'hiretrack_service_tickets',
  [string]$TicketFile = 'C:\Services\data\service-tickets.json',
  [string]$BasePath = '/service-tickets',
  [string]$Mode = 'production',
  [string]$PythonPath = 'C:\Users\Admin\AppData\Local\Programs\Python\Python313-32\python.exe'
)

$ErrorActionPreference = 'Stop'
$appDirectory = Join-Path $InstallRoot $AppDirectoryName
$wrapperPath = Join-Path $appDirectory "$ServiceId.exe"
$healthUrl = "http://127.0.0.1:$Port/health"

function Set-ServiceEnvironment([string]$Name, [string]$Value) {
  [xml]$serviceConfig = Get-Content -LiteralPath (Join-Path $appDirectory "$ServiceId.xml")
  $node = $serviceConfig.service.env | Where-Object { $_.name -eq $Name } | Select-Object -First 1
  if (-not $node) {
    $node = $serviceConfig.CreateElement('env')
    $node.SetAttribute('name', $Name)
    [void]$serviceConfig.service.AppendChild($node)
  }
  $node.SetAttribute('value', $Value)
  $serviceConfig.Save((Join-Path $appDirectory "$ServiceId.xml"))
}

if (-not (Test-Path -LiteralPath (Join-Path $appDirectory '.git'))) {
  throw "$appDirectory is not a Git checkout. Run install-production.ps1 first."
}
if (-not (Test-Path -LiteralPath $wrapperPath)) {
  throw "$wrapperPath was not found. Run install-production.ps1 first."
}

Write-Host "Updating HireTrack Stocktakes from $Branch..." -ForegroundColor Cyan
Push-Location $appDirectory
try {
  git config core.autocrlf true
  if ($LASTEXITCODE -ne 0) { throw 'git config failed.' }
  git restore --worktree -- dist package-lock.json deploy/windows/update-production.ps1
  if ($LASTEXITCODE -ne 0) { throw 'git restore failed.' }
  git fetch origin $Branch
  if ($LASTEXITCODE -ne 0) { throw 'git fetch failed.' }
  git checkout $Branch
  if ($LASTEXITCODE -ne 0) { throw 'git checkout failed.' }
  git pull --ff-only origin $Branch
  if ($LASTEXITCODE -ne 0) { throw 'git pull failed.' }

  & $wrapperPath stop
  try {
    New-Item -ItemType Directory -Path (Join-Path $InstallRoot 'data') -Force | Out-Null
    Set-ServiceEnvironment -Name 'TICKETS_STORE_MODE' -Value 'file'
    Set-ServiceEnvironment -Name 'TICKETS_FILE_PATH' -Value $TicketFile
    Set-ServiceEnvironment -Name 'SERVICE_TICKETS_BASE_PATH' -Value $BasePath
    Set-ServiceEnvironment -Name 'SERVICE_TICKETS_MODE' -Value $Mode
    Set-ServiceEnvironment -Name 'HIRETRACK_PYTHON' -Value $PythonPath
    Set-ServiceEnvironment -Name 'HIRETRACK_ODBC_DSN' -Value 'HireTrack DSN'
    & npm.cmd ci
    if ($LASTEXITCODE -ne 0) { throw 'npm ci failed.' }
    & npm.cmd run prisma:generate
    if ($LASTEXITCODE -ne 0) { throw 'Prisma Client generation failed.' }
    & npm.cmd run build
    if ($LASTEXITCODE -ne 0) { throw 'npm run build failed.' }
    git diff --ignore-space-at-eol --exit-code -- dist
    if ($LASTEXITCODE -ne 0) { throw 'Generated dist does not match the committed build.' }
    git restore --worktree -- dist package-lock.json
    git add -- dist
    git diff --cached --exit-code
    if ($LASTEXITCODE -ne 0) { throw 'Generated dist changed the Git index unexpectedly.' }
  } catch {
    & $wrapperPath start
    throw
  }
  & $wrapperPath start
  if ($LASTEXITCODE -ne 0) { throw 'Service start failed.' }
} finally {
  Pop-Location
}

$healthy = $false
for ($attempt = 1; $attempt -le 20; $attempt += 1) {
  Start-Sleep -Seconds 1
  try {
    $health = Invoke-RestMethod -UseBasicParsing -Uri $healthUrl -TimeoutSec 3
    if ($health.ok) {
      $healthy = $true
      break
    }
  } catch {
    # Service may still be starting.
  }
}
if (-not $healthy) {
  throw "Service did not become healthy at $healthUrl. Check $appDirectory\logs."
}

Write-Host "$ServiceName is healthy at $healthUrl" -ForegroundColor Green
Write-Host "Service tickets: http://$env:COMPUTERNAME`:$Port$BasePath/" -ForegroundColor Green
