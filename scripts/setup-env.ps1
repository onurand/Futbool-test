#requires -Version 5.1
<#
.SYNOPSIS
  Interactive env setup for Futbool. Writes .env (backend) and web/.env.local (frontend).

.DESCRIPTION
  Prompts for Supabase + optional provider keys (Anthropic, Stripe, OpenAI, ElevenLabs,
  Sportmonks, The Odds API). Re-runnable: existing values are read back and shown as the
  default so you can hit Enter to keep them.

  No values are sent anywhere — they are written only to local files that are gitignored.

.EXAMPLE
  cd Futbool-test
  .\scripts\setup-env.ps1
#>

[CmdletBinding()]
param()

$ErrorActionPreference = "Stop"

$repoRoot = (Resolve-Path "$PSScriptRoot\..").Path
$backendEnv = Join-Path $repoRoot ".env"
$webEnv     = Join-Path $repoRoot "web\.env.local"

function Read-EnvFile([string]$path) {
    $map = @{}
    if (Test-Path $path) {
        Get-Content $path | ForEach-Object {
            if ($_ -match "^\s*#") { return }
            if ($_ -match "^\s*([A-Z0-9_]+)\s*=\s*(.*)$") {
                $map[$matches[1]] = $matches[2]
            }
        }
    }
    return $map
}

function Ask {
    param(
        [string]$Label,
        [string]$Default = "",
        [switch]$Secret
    )
    $hint = if ($Default) { " [current: $((Mask $Default $Secret))]" } else { "" }
    $value = Read-Host "  $Label$hint"
    if ([string]::IsNullOrWhiteSpace($value)) { return $Default }
    return $value
}

function Mask([string]$v, [bool]$secret) {
    if (-not $secret) { return $v }
    if ($v.Length -le 6) { return "***" }
    return $v.Substring(0, 4) + "…" + $v.Substring($v.Length - 4)
}

function Write-EnvFile([string]$path, [hashtable]$values, [string]$header) {
    $sb = [System.Text.StringBuilder]::new()
    [void]$sb.AppendLine($header)
    foreach ($key in $values.Keys | Sort-Object) {
        [void]$sb.AppendLine("$key=$($values[$key])")
    }
    $dir = Split-Path -Parent $path
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    $sb.ToString() | Set-Content -Path $path -Encoding UTF8 -NoNewline
}

Write-Host ""
Write-Host "==> Futbool env setup" -ForegroundColor Green
Write-Host "    Files: $backendEnv"
Write-Host "           $webEnv"
Write-Host ""

$existing = Read-EnvFile $backendEnv
$existingWeb = Read-EnvFile $webEnv

# ---- Required Supabase block ----
Write-Host "Supabase (required)" -ForegroundColor Cyan
$supabaseUrl  = Ask "SUPABASE_URL (https://xxxx.supabase.co)" $existing["SUPABASE_URL"]
$supabaseAnon = Ask "SUPABASE_ANON_KEY (anon, eyJ...)" $existing["SUPABASE_ANON_KEY"] -Secret
$supabaseRole = Ask "SUPABASE_SERVICE_ROLE_KEY (service_role, eyJ...)" $existing["SUPABASE_SERVICE_ROLE_KEY"] -Secret
$supabaseJwt  = Ask "SUPABASE_JWT_SECRET" $existing["SUPABASE_JWT_SECRET"] -Secret

# Database URL is optional — backend talks to Supabase via REST primarily.
$db = Ask "DATABASE_URL (optional)" $existing["DATABASE_URL"]

# ---- Optional provider keys ----
Write-Host ""
Write-Host "Optional providers (leave blank to skip)" -ForegroundColor Cyan
$anthropic   = Ask "ANTHROPIC_API_KEY"        $existing["ANTHROPIC_API_KEY"] -Secret
$stripeSec   = Ask "STRIPE_SECRET_KEY"        $existing["STRIPE_SECRET_KEY"] -Secret
$stripeWh    = Ask "STRIPE_WEBHOOK_SECRET"    $existing["STRIPE_WEBHOOK_SECRET"] -Secret
$stripePub   = Ask "STRIPE_PUBLISHABLE_KEY"   $existing["STRIPE_PUBLISHABLE_KEY"]
$sportmonks  = Ask "SPORTMONKS_API_KEY"       $existing["SPORTMONKS_API_KEY"] -Secret
$oddsApi     = Ask "THE_ODDS_API_KEY"         $existing["THE_ODDS_API_KEY"] -Secret
$footballOrg = Ask "FOOTBALL_DATA_ORG_KEY"    $existing["FOOTBALL_DATA_ORG_KEY"] -Secret
$openai      = Ask "OPENAI_API_KEY (Whisper)" $existing["OPENAI_API_KEY"] -Secret
$eleven      = Ask "ELEVENLABS_API_KEY"       $existing["ELEVENLABS_API_KEY"] -Secret

$voiceJohn   = Ask "ELEVENLABS_VOICE_JOHN"   $existing["ELEVENLABS_VOICE_JOHN"]
$voiceCarlos = Ask "ELEVENLABS_VOICE_CARLOS" $existing["ELEVENLABS_VOICE_CARLOS"]
$voiceHans   = Ask "ELEVENLABS_VOICE_HANS"   $existing["ELEVENLABS_VOICE_HANS"]
$voiceEmre   = Ask "ELEVENLABS_VOICE_EMRE"   $existing["ELEVENLABS_VOICE_EMRE"]

# ---- App config (sensible defaults) ----
$appEnv     = if ($existing["APP_ENV"])     { $existing["APP_ENV"] }     else { "development" }
$appBase    = if ($existing["APP_BASE_URL"]){ $existing["APP_BASE_URL"] } else { "http://localhost:8000" }
$webBase    = if ($existing["WEB_BASE_URL"]){ $existing["WEB_BASE_URL"] } else { "http://localhost:3000" }
$useMock    = if ($existing["USE_MOCK_PROVIDERS"]) { $existing["USE_MOCK_PROVIDERS"] } else { "true" }
$claudeMod  = if ($existing["CLAUDE_MODEL"]) { $existing["CLAUDE_MODEL"] } else { "claude-opus-4-7" }
$redisUrl   = if ($existing["REDIS_URL"]) { $existing["REDIS_URL"] } else { "" }

# ---- Build backend .env ----
$backendValues = @{
    "APP_ENV"                    = $appEnv
    "APP_BASE_URL"               = $appBase
    "WEB_BASE_URL"               = $webBase
    "USE_MOCK_PROVIDERS"         = $useMock
    "CLAUDE_MODEL"               = $claudeMod
    "ANTHROPIC_API_KEY"          = $anthropic
    "SUPABASE_URL"               = $supabaseUrl
    "SUPABASE_ANON_KEY"          = $supabaseAnon
    "SUPABASE_SERVICE_ROLE_KEY"  = $supabaseRole
    "SUPABASE_JWT_SECRET"        = $supabaseJwt
    "DATABASE_URL"               = $db
    "REDIS_URL"                  = $redisUrl
    "STRIPE_SECRET_KEY"          = $stripeSec
    "STRIPE_PUBLISHABLE_KEY"     = $stripePub
    "STRIPE_WEBHOOK_SECRET"      = $stripeWh
    "SPORTMONKS_API_KEY"         = $sportmonks
    "THE_ODDS_API_KEY"           = $oddsApi
    "FOOTBALL_DATA_ORG_KEY"      = $footballOrg
    "OPENAI_API_KEY"             = $openai
    "ELEVENLABS_API_KEY"         = $eleven
    "ELEVENLABS_VOICE_JOHN"      = $voiceJohn
    "ELEVENLABS_VOICE_CARLOS"    = $voiceCarlos
    "ELEVENLABS_VOICE_HANS"      = $voiceHans
    "ELEVENLABS_VOICE_EMRE"      = $voiceEmre
}

Write-EnvFile $backendEnv $backendValues "# Generated by scripts/setup-env.ps1 — never commit."

# ---- Build web .env.local ----
$webValues = @{
    "NEXT_PUBLIC_SUPABASE_URL"      = $supabaseUrl
    "NEXT_PUBLIC_SUPABASE_ANON_KEY" = $supabaseAnon
    "NEXT_PUBLIC_API_BASE_URL"      = $appBase
}

Write-EnvFile $webEnv $webValues "# Generated by scripts/setup-env.ps1 — never commit."

Write-Host ""
Write-Host "Wrote $backendEnv" -ForegroundColor Green
Write-Host "Wrote $webEnv" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  Backend (terminal 1):  uvicorn backend.main:app --reload --port 8000"
Write-Host "  Frontend (terminal 2): cd web; npm run dev"
Write-Host ""
