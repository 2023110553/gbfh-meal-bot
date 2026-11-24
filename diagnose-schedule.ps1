$ErrorActionPreference = 'Stop'
Get-ScheduledTask -TaskName 'GBFH Meal Sync' | Select-Object TaskName, State, Actions, Triggers
Get-ScheduledTaskInfo -TaskName 'GBFH Meal Sync' | Format-List LastRunTime, LastTaskResult, NextRunTime, NumberOfMissedRuns
$log = Join-Path $env:LOCALAPPDATA 'GBFH\sync.log'
if (Test-Path $log) { Get-Content -Tail 80 -LiteralPath $log }
