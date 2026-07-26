# Deploys the "delete-user" Edge Function to YOUR Supabase project.
# ---------------------------------------------------------------------------
# This is the one step that needs YOUR Supabase credentials, so it can't be done
# for you. You need two things (both quick, one-time):
#
#   1. Project ref  — the code in your dashboard URL:
#                     https://supabase.com/dashboard/project/<THIS-PART>
#   2. Access token — create one at:
#                     https://supabase.com/dashboard/account/tokens
#                     (click "Generate new token", copy the sbp_... value)
#
# Then just run this script from the repo root:
#
#   ./scripts/deploy-delete-user.ps1
#
# It will prompt for the two values (or read them from env vars) and deploy.
# No Docker required. When it finishes, Dashboard -> Edge Functions should show
# "delete-user" as Deployed, and user deletion in the app will work.

param(
  [string]$ProjectRef  = $env:SUPABASE_PROJECT_REF,
  [string]$AccessToken = $env:SUPABASE_ACCESS_TOKEN
)

if (-not $ProjectRef)  { $ProjectRef  = Read-Host "Supabase project ref (from your dashboard URL)" }
if (-not $AccessToken) { $AccessToken = Read-Host "Supabase access token (starts with sbp_)" }

if (-not $ProjectRef -or -not $AccessToken) {
  Write-Error "Both a project ref and an access token are required. Aborting."
  exit 1
}

$env:SUPABASE_ACCESS_TOKEN = $AccessToken

Write-Host "Deploying delete-user to project $ProjectRef ..." -ForegroundColor Cyan
npx --yes supabase functions deploy delete-user --project-ref $ProjectRef

if ($LASTEXITCODE -eq 0) {
  Write-Host "`nDone. Check Dashboard -> Edge Functions -> delete-user shows 'Deployed'." -ForegroundColor Green
} else {
  Write-Host "`nDeploy failed. Easiest fallback: paste the function code in the dashboard" -ForegroundColor Yellow
  Write-Host "(Edge Functions -> Create a new function -> name it 'delete-user' -> paste -> Deploy)." -ForegroundColor Yellow
}
