$ErrorActionPreference = 'Stop'
$env:GIT_TERMINAL_PROMPT = '0'
$logDir = Join-Path $env:LOCALAPPDATA 'GBFH'
New-Item -ItemType Directory -Force $logDir | Out-Null
Start-Transcript -Path (Join-Path $logDir 'sync.log') -Append | Out-Null
$mutex = New-Object Threading.Mutex($false, 'Local\GBFHMealSync')
$locked = $false
$worktree = $null
function Git-Checked {
    & git @args
    if ($LASTEXITCODE -ne 0) { throw "git $($args[0]) failed ($LASTEXITCODE)." }
}
Push-Location $PSScriptRoot
try {
    $locked = $mutex.WaitOne(0)
    if (!$locked) { throw 'Another sync is running.' }
    Git-Checked fetch origin main
    $worktree = Join-Path ([IO.Path]::GetTempPath()) ('gbfh-' + [guid]::NewGuid())
    Git-Checked worktree add --detach $worktree origin/main
    Push-Location $worktree
    try {
        # Use fetched scripts and data. Preserve all edits in the user's checkout.
        & (Join-Path $worktree 'collect-meals.ps1')
        Git-Checked add -- meals.json
        & git diff --cached --quiet -- meals.json
        $diff = $LASTEXITCODE
        if ($diff -eq 1) {
            Git-Checked commit -m 'Update cafeteria meals' -- meals.json
            Git-Checked push origin HEAD:main
        } elseif ($diff -ne 0) { throw 'Could not compare meals.json.' }
    } finally { Pop-Location }
} catch {
    Write-Error $_ -ErrorAction Continue
    exit 1
} finally {
    if ($worktree) {
        # Retain failed/staged worktrees for recovery; only remove clean ones.
        $dirty = & git -C $worktree status --porcelain
        $ahead = & git -C $worktree rev-list --count 'origin/main..HEAD'
        if (!$dirty -and $ahead -eq '0') { & git worktree remove $worktree }
        else { Write-Warning "Recovery checkout retained at $worktree" }
    }
    if ($locked) { $mutex.ReleaseMutex() }
    $mutex.Dispose()
    Pop-Location
    Stop-Transcript | Out-Null
}
