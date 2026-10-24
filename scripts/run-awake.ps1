# Runs one npm script with "sleep when plugged in" set to Never, then restores it to
# 5 minutes however the run ends, and shows a Windows notification.
# Usage: powershell -File scripts\run-awake.ps1 collect:play groww 300000
param([Parameter(Mandatory = $true)][string]$Script, [Parameter(ValueFromRemainingArguments = $true)][string[]]$Rest)
Set-Location (Split-Path $PSScriptRoot -Parent)
New-Item -ItemType Directory -Force -Path "data\logs" | Out-Null
$statusLog = "data\collect-status.log"
$stepLog = "data\logs\$($Script.Replace(':', '-')).log"

function Log([string]$message) {
  $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm')  $message"
  Add-Content -Path $statusLog -Value $line -Encoding utf8
  Write-Output $line
}

powercfg.exe /change standby-timeout-ac 0
try {
  Log "$Script $Rest started (sleep when plugged in set to Never)."
  # npm needs "--" before script arguments; PowerShell -File would eat a literal "--".
  $npmArgs = @("run", $Script)
  if ($Rest) { $npmArgs += "--"; $npmArgs += $Rest }
  # Progress goes to the step log and to this window, so a background run can be followed.
  & npm.cmd @npmArgs 2>&1 | ForEach-Object { "$_" } | Tee-Object -FilePath $stepLog
  if ($LASTEXITCODE -eq 0) { $summary = "$Script finished. $(node --no-warnings scripts/count.mjs)." }
  else { $summary = "$Script FAILED (exit $LASTEXITCODE). Details in $stepLog" }
  Log $summary
  Add-Type -AssemblyName System.Windows.Forms
  Add-Type -AssemblyName System.Drawing
  $balloon = New-Object System.Windows.Forms.NotifyIcon
  $balloon.Icon = [System.Drawing.SystemIcons]::Information
  $balloon.Visible = $true
  $balloon.ShowBalloonTip(15000, "Discovery engine", $summary, "Info")
  Start-Sleep -Seconds 16
  $balloon.Dispose()
} finally {
  powercfg.exe /change standby-timeout-ac 5
  Log "Sleep when plugged in restored to 5 minutes."
}
