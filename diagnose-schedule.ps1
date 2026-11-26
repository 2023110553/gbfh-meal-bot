$ErrorActionPreference = 'Stop'
$task = Get-ScheduledTask -TaskName 'GBFH Meal Sync' -ErrorAction SilentlyContinue
if (!$task) {
    Write-Warning 'GBFH Meal Sync is not registered. Run install-schedule.ps1 from the repository.'
} else {
    $task | Select-Object TaskName, State, Actions, Triggers
    Get-ScheduledTaskInfo -TaskName 'GBFH Meal Sync' | Format-List LastRunTime, LastTaskResult, NextRunTime, NumberOfMissedRuns
}
$log = Join-Path $env:LOCALAPPDATA 'GBFH\sync.log'
if (Test-Path -LiteralPath $log) { Get-Content -Tail 80 -LiteralPath $log }
else { Write-Warning 'No sync log exists yet.' }
