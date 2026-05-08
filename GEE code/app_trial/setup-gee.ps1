# Setup GEE Service Account for Standalone App
# This script creates a service account in GCP and configures it for use with Earth Engine
# 
# Prerequisites:
# - gcloud CLI installed (https://cloud.google.com/sdk/docs/install)
# - Already logged in: gcloud auth login
# - A GCP project created

param(
    [string]$ServiceAccountName = "gee-service-account",
    [string]$DisplayName = "GEE Service Account for Standalone App"
)

$ErrorActionPreference = "Continue"

Write-Host "`n========================================" -ForegroundColor Green
Write-Host "  GEE Service Account Setup Script" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Green

# Get current project
$ProjectId = gcloud config get-value project 2>$null
if (-not $ProjectId) {
    Write-Host "❌ Error: No GCP project configured" -ForegroundColor Red
    Write-Host "Run: gcloud config set project YOUR-PROJECT-ID" -ForegroundColor Yellow
    exit 1
}

Write-Host "📌 Project ID: $ProjectId`n" -ForegroundColor Cyan

# Step 1: Enable APIs
Write-Host "📡 Step 1: Enabling required APIs..." -ForegroundColor Yellow
gcloud services enable earthengine.googleapis.com --quiet 2>$null
gcloud services enable compute.googleapis.com --quiet 2>$null
Write-Host "✅ APIs enabled`n" -ForegroundColor Green

# Step 2: Create Service Account
Write-Host "👤 Step 2: Creating service account..." -ForegroundColor Yellow
$ServiceAccountEmail = "$ServiceAccountName@$ProjectId.iam.gserviceaccount.com"

gcloud iam service-accounts create $ServiceAccountName `
    --display-name="$DisplayName" `
    --quiet 2>$null

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Service account created: $ServiceAccountEmail`n" -ForegroundColor Green
} else {
    Write-Host "⚠️  Service account may already exist. Continuing...`n" -ForegroundColor Yellow
}

# Step 3: Grant IAM Permissions
Write-Host "🔐 Step 3: Granting permissions..." -ForegroundColor Yellow
gcloud projects add-iam-policy-binding $ProjectId `
    --member="serviceAccount:$ServiceAccountEmail" `
    --role="roles/editor" `
    --quiet 2>$null

Write-Host "✅ Permissions granted`n" -ForegroundColor Green

# Step 4: Create JSON Key
Write-Host "🔑 Step 4: Creating JSON key..." -ForegroundColor Yellow
$KeyFile = "gee-key.json"
$FunctionsDir = "functions"

gcloud iam service-accounts keys create $KeyFile `
    --iam-account="$ServiceAccountEmail" 2>$null

if (Test-Path $KeyFile) {
    Write-Host "✅ JSON key created: $KeyFile`n" -ForegroundColor Green
} else {
    Write-Host "❌ Failed to create JSON key" -ForegroundColor Red
    exit 1
}

# Step 5: Move Key to Functions Directory
Write-Host "📂 Step 5: Moving key to functions directory..." -ForegroundColor Yellow
if (-not (Test-Path $FunctionsDir)) {
    Write-Host "❌ Error: functions directory not found" -ForegroundColor Red
    Write-Host "Make sure you're running this from: standalone-app/" -ForegroundColor Yellow
    exit 1
}

Move-Item -Path $KeyFile -Destination "$FunctionsDir/$KeyFile" -Force
Write-Host "✅ Key moved to: $FunctionsDir/$KeyFile`n" -ForegroundColor Green

# Step 6: Create .env File
Write-Host "📝 Step 6: Creating .env file..." -ForegroundColor Yellow

$keyJsonContent = Get-Content "$FunctionsDir/$KeyFile" -Raw
$CompactJson = $keyJsonContent -replace '\r?\n', '' -replace '\s+', ' '

$envContent = "GEE_SERVICE_ACCOUNT_KEY=$CompactJson"

$EnvFile = "$FunctionsDir/.env"
Set-Content -Path $EnvFile -Value $envContent -Encoding UTF8

Write-Host "✅ .env file created: $EnvFile`n" -ForegroundColor Green

# Step 7: Display Summary
Write-Host "========================================" -ForegroundColor Green
Write-Host "  ✅ Setup Complete!" -ForegroundColor Green
Write-Host "========================================`n" -ForegroundColor Green

Write-Host "📌 SERVICE ACCOUNT DETAILS:" -ForegroundColor Cyan
Write-Host "   Email: $ServiceAccountEmail" -ForegroundColor White
Write-Host "   Key:   $FunctionsDir/$KeyFile"
Write-Host "   Env:   $EnvFile`n"

Write-Host "⚠️  IMPORTANT - Register with Earth Engine:" -ForegroundColor Yellow
Write-Host "   1. Save this email:" -ForegroundColor White
Write-Host "      $ServiceAccountEmail" -ForegroundColor Cyan
Write-Host ""
Write-Host "   2. Visit: https://code.earthengine.google.com/profile" -ForegroundColor White
Write-Host ""
Write-Host "   3. In GEE Code Editor:" -ForegroundColor White
Write-Host "      - Click your username (top right)" -ForegroundColor White
Write-Host "      - Click 'Assets'" -ForegroundColor White
Write-Host "      - Click 'Share' button" -ForegroundColor White
Write-Host "      - Paste the email above" -ForegroundColor White
Write-Host "      - Click 'Share'" -ForegroundColor White
Write-Host ""
Write-Host "   4. Share your GEE assets:" -ForegroundColor White
Write-Host "      - For each folder `(HLZ, GEZ, GCZ, CRU TS`):" -ForegroundColor White
Write-Host "      - Click folder → Share" -ForegroundColor White
Write-Host "      - Add service account email with 'Reader' access" -ForegroundColor White
Write-Host ""

Write-Host "`n🚀 NEXT STEPS:" -ForegroundColor Green
Write-Host "   1. Verify .env file is in .gitignore:" -ForegroundColor White
Write-Host '      grep ".env" .gitignore' -ForegroundColor Cyan
Write-Host ""
Write-Host "   2. Update GEE asset paths in handlers:" -ForegroundColor White
Write-Host "      - functions/handlers/queryZones.js" -ForegroundColor Cyan
Write-Host "      - functions/handlers/getMonthlyClimate.js" -ForegroundColor Cyan
Write-Host "      - functions/handlers/getAnnualSummary.js" -ForegroundColor Cyan
Write-Host "      - functions/handlers/getBioecologicalData.js" -ForegroundColor Cyan
Write-Host ""
Write-Host "   3. Test locally:" -ForegroundColor White
Write-Host "      firebase emulators:start --only functions" -ForegroundColor Cyan
Write-Host ""
Write-Host "   4. Deploy:" -ForegroundColor White
Write-Host "      firebase deploy`n" -ForegroundColor Cyan

Write-Host "✨ Setup script completed successfully!`n" -ForegroundColor Green
