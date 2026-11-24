$ErrorActionPreference = 'Stop'
$sync = Join-Path $PSScriptRoot 'sync-meals.ps1'
if (!(Test-Path -LiteralPath $sync) -or !(Test-Path -LiteralPath (Join-Path $PSScriptRoot '.git'))) {
    throw 'Run this from the dedicated Git clone.'
}
$user = [Security.Principal.WindowsIdentity]::GetCurrent().Name
$action = New-ScheduledTaskAction -Execute (Join-Path $env:SystemRoot 'System32\WindowsPowerShell\v1.0\powershell.exe') -Argument ('-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "{0}"' -f $sync)
$triggers = @(
    New-ScheduledTaskTrigger -AtLogOn -User $user
    New-ScheduledTaskTrigger -Daily -At '06:30'
)
$principal = New-ScheduledTaskPrincipal -UserId $user -LogonType Interactive -RunLevel Limited
$settings = New-ScheduledTaskSettingsSet -MultipleInstances IgnoreNew -StartWhenAvailable -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 10)
Register-ScheduledTask -TaskName 'GBFH Meal Sync' -Action $action -Trigger $triggers -Principal $principal -Settings $settings -Force
