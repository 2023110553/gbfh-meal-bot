param(
    [string]$OutputPath = (Join-Path $PSScriptRoot 'meals.json'),
    [string]$HtmlPath,
    [datetime]$Date = [TimeZoneInfo]::ConvertTimeBySystemTimeZoneId([datetime]::UtcNow, 'Korea Standard Time').Date
)
$ErrorActionPreference = 'Stop'
$sunday = $Date.Date.AddDays(-[int]$Date.DayOfWeek)
$meals = [ordered]@{}
if (Test-Path -LiteralPath $OutputPath) {
    $existing = Get-Content -Raw -Encoding UTF8 -LiteralPath $OutputPath | ConvertFrom-Json
    foreach ($entry in $existing.PSObject.Properties) {
        if ($entry.Name -ge $sunday.ToString('yyyy-MM-dd')) { $meals[$entry.Name] = $entry.Value }
    }
}
function Read-Lines([string]$Markup) {
    $Markup = $Markup -replace '(?i)<br\s*/?>|</(?:p|div|li)>', "`n"
    $clean = [Net.WebUtility]::HtmlDecode(($Markup -replace '<[^>]+>', ''))
    $clean -split '\r?\n' | ForEach-Object { $_.Trim() } | Where-Object { $_ }
}
$updated = 0
$offsets = if ($HtmlPath) { @(0) } else { @(0, 7) }
foreach ($offset in $offsets) {
    $week = $sunday.AddDays($offset)
    try {
        $html = if ($HtmlPath) { Get-Content -LiteralPath $HtmlPath -Raw -Encoding UTF8 } else {
            $url = 'https://www.gbfh.co.kr/0206/cafeteria/menu/w2/?symd=' + $week.AddDays(6).ToString('yyyyMMdd')
            (Invoke-WebRequest -UseBasicParsing -Uri $url -TimeoutSec 15).Content
        }
        $table = [regex]::Match($html, '(?is)<table\b[^>]*class\s*=\s*["''][^"'']*\btable-board\s+food\b[^"'']*["''][^>]*>(.*?)</table>')
        if (!$table.Success) { throw 'Meal table missing from response.' }
        $rows = @([regex]::Matches($table.Groups[1].Value, '(?is)<tr\b[^>]*>(.*?)</tr>') | ForEach-Object {
            $cells = [regex]::Matches($_.Groups[1].Value, '(?is)<td\b[^>]*>(.*?)</td>')
            if ($cells.Count -eq 5) { ,$cells }
        })
        if ($rows.Count -ne 7) { throw "Expected 7 meal rows, found $($rows.Count)." }
        $weekMeals = [ordered]@{}
        for ($i = 0; $i -lt 7; $i++) {
            $day = $week.AddDays($i)
            $cells = $rows[$i]
            $label = @(Read-Lines $cells[1].Groups[1].Value) -join ' '
            if ($label -notmatch '^\s*(\d{1,2})월\s*(\d{1,2})일\s*$' -or [int]$Matches[1] -ne $day.Month -or [int]$Matches[2] -ne $day.Day) {
                throw "Unexpected meal date: $label"
            }
            $item = [ordered]@{
                breakfast = @(Read-Lines $cells[2].Groups[1].Value)
                lunch = @(Read-Lines $cells[3].Groups[1].Value)
                dinner = @(Read-Lines $cells[4].Groups[1].Value)
            }
            if ($item.breakfast.Count + $item.lunch.Count + $item.dinner.Count) {
                $weekMeals[$day.ToString('yyyy-MM-dd')] = $item
            }
        }
        foreach ($key in $weekMeals.Keys) { $meals[$key] = $weekMeals[$key]; $updated++ }
    } catch { Write-Warning "$($week.ToString('yyyy-MM-dd')): $_" }
}
if (!$updated) { throw 'No meals collected. Existing output was preserved.' }
$target = $ExecutionContext.SessionState.Path.GetUnresolvedProviderPathFromPSPath($OutputPath)
$tmp = "$target.$([guid]::NewGuid()).tmp"
try {
    [IO.File]::WriteAllText($tmp, ($meals | ConvertTo-Json -Depth 6), [Text.UTF8Encoding]::new($false))
    if ([IO.File]::Exists($target)) { [IO.File]::Replace($tmp, $target, $null) } else { [IO.File]::Move($tmp, $target) }
} finally { if ([IO.File]::Exists($tmp)) { [IO.File]::Delete($tmp) } }
Write-Output "Updated $updated dates in $target"
