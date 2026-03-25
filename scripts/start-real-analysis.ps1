$ErrorActionPreference = "Stop"

$port = 8002
$healthUrl = "http://localhost:$port/health"

function Test-HealthyServer {
  param([string]$Url)

  try {
    $response = Invoke-RestMethod -Uri $Url -Method Get -TimeoutSec 5
    return $response.status -eq "healthy"
  } catch {
    return $false
  }
}

if (Test-HealthyServer -Url $healthUrl) {
  Write-Host "[backend] healthy server already running on :$port, reusing existing process"
  exit 0
}

$listening = Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue | Select-Object -First 1
if ($listening) {
  Write-Host "[backend] port $port is occupied but health check failed. pid=$($listening.OwningProcess)"
  Write-Host "[backend] stop the stale process or restart it before running dev again"
  exit 1
}

Write-Host "[backend] starting real_analysis_main.py on :$port"
Set-Location (Join-Path $PSScriptRoot "..\\python-backend")
python real_analysis_main.py
