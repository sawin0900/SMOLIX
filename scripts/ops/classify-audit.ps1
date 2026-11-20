# Классификация вывода audit-remnawave-panel.sh
# Usage: .\classify-audit.ps1 -Path .\remnawave-audit-panel.txt

param(
  [Parameter(Mandatory = $true)]
  [string]$Path
)

if (-not (Test-Path $Path)) {
  Write-Error "File not found: $Path"
  exit 1
}

$text = Get-Content -Raw -Path $Path
$hasRr = $text -match 'HINT_CLASS=E' -or ($text -match 'remnawave_reverse' -and $text -notmatch 'remnawave_reverse: not found')
$hasOpt = $text -match '/opt/remnawave' -and $text -notmatch '/opt/remnawave: missing'
$hasNode = $text -match '/opt/remnanode' -and $text -notmatch '/opt/remnanode: missing'
$hint = if ($text -match 'HINT_CLASS=([ECM])') { $Matches[1] } else { $null }

$class = $hint
if (-not $class) {
  if ($hasRr -and $hasOpt) { $class = 'E' }
  elseif ($hasOpt -or $hasNode) { $class = 'M' }
  else { $class = 'C' }
}

$label = switch ($class) {
  'E' { 'eGames stack — модули меню rr возможны точечно после backup' }
  'M' { 'mixed — только ручной перенос паттернов / осторожные модули' }
  default { 'custom — НЕ запускать install eGames на панели; только новые VPS под ноды' }
}

Write-Output "CLASS=$class"
Write-Output "LABEL=$label"
Write-Output "HAS_RR=$hasRr HAS_OPT=$hasOpt HAS_NODE=$hasNode"
Write-Output ""
Write-Output "Next safe step:"
switch ($class) {
  'E' { Write-Output "1) backup-remnawave-panel.sh  2) rr menu 7 Backup  3) не трогать install пунктов 1-2" }
  'M' { Write-Output "1) ручной backup docker/nginx  2) не запускать full install  3) новые ноды на чистом VPS" }
  default { Write-Output "1) ручной backup  2) SMOLIX admin Remnawave tab  3) eGames только «Только нода» на НОВОМ VPS" }
}
