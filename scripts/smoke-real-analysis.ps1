$ErrorActionPreference = "Stop"

$baseUrl = if ($env:REAL_AUDIO_API_BASE -and $env:REAL_AUDIO_API_BASE.Trim()) {
  $env:REAL_AUDIO_API_BASE.Trim()
} else {
  "http://localhost:8002"
}

$sampleUrls = @(
  "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
  "https://www.youtube.com/watch?v=fAVQnVkB2ho"
)

Write-Host "[smoke] checking health: $baseUrl/health"
$health = Invoke-RestMethod -Uri "$baseUrl/health" -Method Get
if ($health.status -ne "healthy") {
  throw "health check failed"
}

Write-Host "[smoke] ffmpeg: $($health.services.audio_pipeline.ffmpeg_available) / librosa: $($health.services.audio_analysis_deps.librosa)"

$results = @()
foreach ($url in $sampleUrls) {
  Write-Host "[smoke] analyzing $url"
  $body = @{ url = $url } | ConvertTo-Json
  $response = Invoke-RestMethod -Uri "$baseUrl/analyze" -Method Post -ContentType "application/json" -Body $body

  $mode = if ($response.data.metadata.result_mode) { $response.data.metadata.result_mode } else { "unknown" }
  $method = if ($response.data.metadata.analysis_method) { $response.data.metadata.analysis_method } else { "unknown" }
  $results += [PSCustomObject]@{
    title = $response.data.title
    mode = $mode
    method = $method
    tempo = $response.data.tempo
    audio_ext = $response.data.metadata.audio_ext
  }
}

$results | Format-Table -AutoSize
