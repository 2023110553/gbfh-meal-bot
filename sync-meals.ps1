$ErrorActionPreference = 'Stop'
function Git-Checked {
    & git @args
    if ($LASTEXITCODE -ne 0) { throw "git $($args[0]) failed ($LASTEXITCODE)." }
}

Push-Location $PSScriptRoot
try {
    if ((Git-Checked branch --show-current) -ne 'main') { throw 'Use a dedicated clone on main.' }
    $changes = @(Git-Checked status --porcelain)
    if ($changes.Count) { throw 'The checkout has local changes. Commit or restore them before syncing.' }
    Git-Checked pull --ff-only origin main
    & "$PSScriptRoot\collect-meals.ps1"
    Git-Checked add -- meals.json
    & git diff --cached --quiet -- meals.json
    switch ($LASTEXITCODE) {
        0 { }
        1 { Git-Checked commit -m 'Update cafeteria meals' -- meals.json }
        default { throw 'Could not compare meals.json.' }
    }
    if ([int](Git-Checked rev-list --count 'origin/main..HEAD') -gt 0) {
        Git-Checked push origin HEAD:main
    }
} finally {
    Pop-Location
}
