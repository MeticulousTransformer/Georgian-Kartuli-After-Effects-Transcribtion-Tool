$ErrorActionPreference = 'Stop'
$repo = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
. (Join-Path $repo 'installer/runtime_windows.ps1')

function Assert-Equal($Actual,$Expected) { if ($Actual -ne $Expected) { throw "Expected '$Expected', received '$Actual'." } }
Assert-Equal (ConvertTo-CapForgeArgument 'simple') 'simple'
Assert-Equal (ConvertTo-CapForgeArgument 'has space') '"has space"'
Assert-Equal (ConvertTo-CapForgeArgument 'has"quote') '"has\"quote"'
Assert-Equal (ConvertTo-CapForgeArgument 'trailing space\') '"trailing space\\"'
$root = Join-Path $repo '.studio-test'
Assert-Equal (Assert-CapForgePath (Join-Path $root 'runtime') $root) (Join-Path $root 'runtime')
$rejected = $false
try { [void](Assert-CapForgePath (Join-Path $repo 'outside') $root) } catch { $rejected = $true }
Assert-Equal $rejected $true
foreach ($file in @('installer/runtime_windows.ps1','installer/bootstrap_windows.ps1','scripts/build_windows_launcher.ps1')) {
    $tokens=$null; $errors=$null
    [void][Management.Automation.Language.Parser]::ParseFile((Join-Path $repo $file),[ref]$tokens,[ref]$errors)
    if ($errors.Count) { throw ($errors | Out-String) }
}
Write-Output 'Native bootstrap syntax, quoting and path checks passed.'
