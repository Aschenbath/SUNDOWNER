param(
  [string]$PersistTo = 'D:\Codex\tmp_toDel\_sundowner-readme-data',
  [int]$Port = 8787,
  [string]$CompatibilityDate = '2026-06-30'
)

$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$tmpRoot = [System.IO.Path]::GetFullPath('D:\Codex\tmp_toDel')
$persistPath = [System.IO.Path]::GetFullPath($PersistTo)
$logDir = Join-Path $tmpRoot '_logs'
$outLog = Join-Path $logDir 'sundowner-readme-wrangler.out.log'
$errLog = Join-Path $logDir 'sundowner-readme-wrangler.err.log'
$wranglerProcess = $null
$startedServer = $false

function Assert-UnderTmpRoot {
  param([string]$Path)
  if (-not $Path.StartsWith($tmpRoot, [System.StringComparison]::OrdinalIgnoreCase)) {
    throw "Refusing to clean path outside D:\Codex\tmp_toDel: $Path"
  }
}

function Stop-ReadmeServer {
  param([int]$TargetPort)

  $owners = Get-NetTCPConnection -LocalPort $TargetPort -ErrorAction SilentlyContinue |
    Select-Object -ExpandProperty OwningProcess -Unique
  foreach ($owner in $owners) {
    Stop-Process -Id $owner -Force -ErrorAction SilentlyContinue
  }

  $wranglerNodes = Get-CimInstance Win32_Process |
    Where-Object { $_.Name -eq 'node.exe' -and $_.CommandLine -match 'wrangler\\bin\\wrangler\.js' }
  foreach ($node in $wranglerNodes) {
    Stop-Process -Id $node.ProcessId -Force -ErrorAction SilentlyContinue
  }
}

function Wait-ForLocalServer {
  param([string]$Url)

  for ($i = 0; $i -lt 80; $i++) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing -Uri $Url -TimeoutSec 3
      if ($response.StatusCode -ge 200) {
        return
      }
    } catch {
      Start-Sleep -Milliseconds 250
    }
  }

  throw "Local server did not become ready at $Url"
}

try {
  $listeningPort = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue |
    Where-Object { $_.State -eq 'Listen' }
  if ($listeningPort) {
    throw "Port $Port is already in use. Stop that process or pass a different -Port."
  }

  Assert-UnderTmpRoot $persistPath
  if (Test-Path -LiteralPath $persistPath) {
    Remove-Item -LiteralPath $persistPath -Recurse -Force
  }
  New-Item -ItemType Directory -Force -Path $persistPath | Out-Null
  New-Item -ItemType Directory -Force -Path $logDir | Out-Null
  Remove-Item -LiteralPath $outLog, $errLog -Force -ErrorAction SilentlyContinue

  $wranglerArgs = @(
    'node_modules\wrangler\bin\wrangler.js',
    'pages', 'dev', './',
    '--kv', 'img_url',
    '--d1', 'img_d1',
    '--r2', 'img_r2',
    '--binding', 'BASIC_USER=readme-admin',
    '--binding', 'BASIC_PASS=readme-password',
    '--binding', 'AUTH_CODE=readme-upload-code',
    '--ip', '127.0.0.1',
    '--port', [string]$Port,
    '--persist-to', $persistPath,
    '--compatibility-date', $CompatibilityDate,
    '--show-interactive-dev-session=false',
    '--log-level', 'warn'
  )

  $wranglerProcess = Start-Process -FilePath 'node.exe' `
    -ArgumentList $wranglerArgs `
    -WorkingDirectory $repoRoot `
    -RedirectStandardOutput $outLog `
    -RedirectStandardError $errLog `
    -WindowStyle Hidden `
    -PassThru
  $startedServer = $true

  Wait-ForLocalServer "http://127.0.0.1:$Port/login"

  $env:README_SCREENSHOT_BASE_URL = "http://127.0.0.1:$Port"
  $env:README_SCREENSHOT_USER = 'readme-admin'
  $env:README_SCREENSHOT_PASS = 'readme-password'

  Push-Location $repoRoot
  try {
    & node.exe scripts\capture-readme-screenshots.mjs
    if ($LASTEXITCODE -ne 0) {
      throw "README screenshot capture failed with exit code $LASTEXITCODE"
    }
  } finally {
    Pop-Location
  }
} finally {
  if ($startedServer) {
    Stop-ReadmeServer $Port
  } elseif ($wranglerProcess -and -not $wranglerProcess.HasExited) {
    Stop-Process -Id $wranglerProcess.Id -Force -ErrorAction SilentlyContinue
  }
}
