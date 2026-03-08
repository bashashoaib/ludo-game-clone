param(
  [int]$StartHour = 13
)

$ErrorActionPreference = 'Stop'
$projectRoot = 'C:\Users\shoai\OneDrive\Documents\ludo-game-clone'
$outputDir = Join-Path $projectRoot 'reports'
$edgePath = 'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
$namespace = 'bashashoaib_ludo_game'
$tz = [TimeZoneInfo]::FindSystemTimeZoneById('India Standard Time')
$nowIndia = [TimeZoneInfo]::ConvertTimeFromUtc([DateTime]::UtcNow, $tz)

if (-not (Test-Path $outputDir)) {
  New-Item -ItemType Directory -Path $outputDir | Out-Null
}

$dateKey = $nowIndia.ToString('yyyyMMdd')
$reportStamp = $nowIndia.ToString('yyyy-MM-dd_HH-mm')
$rows = @()
$total = 0

for ($hour = $StartHour; $hour -le $nowIndia.Hour; $hour++) {
  $hourKey = '{0}{1:00}' -f $dateKey, $hour
  $apiUrl = "https://countapi.mileshilliard.com/api/v1/get/${namespace}_hour_${hourKey}"
  $value = 0
  try {
    $result = Invoke-RestMethod $apiUrl
    if ($null -ne $result.value) { $value = [int]$result.value }
  } catch {
    $value = 0
  }
  $total += $value
  $rows += [PSCustomObject]@{
    Hour = ('{0:00}:00' -f $hour)
    Visits = $value
  }
}

$htmlRows = ($rows | ForEach-Object {
  "<tr><td>$($_.Hour)</td><td>$($_.Visits)</td></tr>"
}) -join "`n"

$html = @"
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Ludo Visitor Report</title>
  <style>
    body { font-family: Segoe UI, Arial, sans-serif; margin: 32px; color: #1d2430; }
    h1 { margin-bottom: 6px; }
    .note { color: #555; margin-bottom: 24px; }
    .summary { margin: 18px 0 24px; padding: 16px; background: #f5f7fb; border-radius: 12px; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #d9deea; padding: 10px 12px; text-align: left; }
    th { background: #1f3b73; color: white; }
    tr:nth-child(even) { background: #f8faff; }
  </style>
</head>
<body>
  <h1>Royal Ludo Visitor Report</h1>
  <p class="note">Report date: $($nowIndia.ToString('dd MMM yyyy')) | Time window: $('{0:00}:00' -f $StartHour) to $($nowIndia.ToString('HH:mm')) India Standard Time</p>
  <div class="summary">
    <strong>Total tracked visits in this time window:</strong> $total<br>
    <strong>Tracking type:</strong> Background browser visit tracking<br>
    <strong>Important note:</strong> This is a background visit count, not a guaranteed exact unique-person count.
  </div>
  <table>
    <thead>
      <tr>
        <th>Hour</th>
        <th>Tracked Visits</th>
      </tr>
    </thead>
    <tbody>
      $htmlRows
    </tbody>
  </table>
</body>
</html>
"@

$htmlPath = Join-Path $outputDir "visitor_report_${reportStamp}.html"
$pdfPath = Join-Path $outputDir "visitor_report_${reportStamp}.pdf"
$html | Set-Content -Path $htmlPath -Encoding UTF8

if (Test-Path $edgePath) {
  & $edgePath --headless --disable-gpu --print-to-pdf="$pdfPath" "$htmlPath" | Out-Null
}

Write-Output "HTML: $htmlPath"
Write-Output "PDF: $pdfPath"
Write-Output "Total visits: $total"
