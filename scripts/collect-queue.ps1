# Runs the remaining collectors one after another, writes progress to
# data\collect-status.log, keeps the laptop awake while running, and shows a
# Windows notification at the end. Run from the discovery-engine folder.
$ErrorActionPreference = "Continue"
Set-Location (Split-Path $PSScriptRoot -Parent)
New-Item -ItemType Directory -Force -Path "data\logs" | Out-Null
$statusLog = "data\collect-status.log"

Add-Type @"
using System;
using System.Runtime.InteropServices;
public static class Awake {
  [DllImport("kernel32.dll")] public static extern uint SetThreadExecutionState(uint flags);
}
"@
# Stay awake until this script ends (continuous + system required). Closing the lid can still sleep the laptop.
[Awake]::SetThreadExecutionState([uint32]"0x80000001") | Out-Null

function Log([string]$message) {
  $line = "$(Get-Date -Format 'yyyy-MM-dd HH:mm')  $message"
  Add-Content -Path $statusLog -Value $line -Encoding utf8
  Write-Output $line
}

function Count([string]$source) {
  return (node --no-warnings scripts/count.mjs $source)
}

function Notify([string]$message) {
  Add-Type -AssemblyName System.Windows.Forms
  Add-Type -AssemblyName System.Drawing
  $balloon = New-Object System.Windows.Forms.NotifyIcon
  $balloon.Icon = [System.Drawing.SystemIcons]::Information
  $balloon.Visible = $true
  $balloon.ShowBalloonTip(15000, "Discovery engine", $message, "Info")
  Start-Sleep -Seconds 16
  $balloon.Dispose()
}

# Before starting, "sleep when plugged in" was set to Never by hand. The finally
# block puts it back to 5 minutes (the user's setting) however the queue ends.
try {
Log "Queue started. Waiting for Reddit to finish."
while (Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object { $_.CommandLine -like "*collect-reddit*" }) {
  Start-Sleep -Seconds 30
}
Log "Reddit finished: $(Count 'reddit')"

$steps = @(
  @{ Name = "YouTube"; Script = "collect:youtube"; Args = @(); Source = "youtube" },
  @{ Name = "TradingQ&A"; Script = "collect:tradingqna"; Args = @(); Source = "tradingqna" },
  @{ Name = "Groww backfill"; Script = "collect:play"; Args = @("--", "groww", "300000"); Source = "play_store" }
)
$failed = @()
foreach ($step in $steps) {
  Log "$($step.Name) started."
  $stepLog = "data\logs\$($step.Script.Replace(':', '-')).log"
  & npm.cmd run $step.Script @($step.Args) *> $stepLog
  if ($LASTEXITCODE -eq 0) {
    Log "$($step.Name) finished: $(Count $step.Source)"
  } else {
    $failed += $step.Name
    Log "$($step.Name) FAILED (exit $LASTEXITCODE). Details in $stepLog"
  }
}

$total = node --no-warnings scripts/count.mjs
if ($failed.Count -eq 0) { $summary = "All collection done. $total." } else { $summary = "Collection finished, but failed: $($failed -join ', '). $total." }
Log $summary
Notify $summary
} finally {
  powercfg.exe /change standby-timeout-ac 5
  Log "Sleep when plugged in restored to 5 minutes."
  [Awake]::SetThreadExecutionState([uint32]"0x80000000") | Out-Null
}
