# Setup GEE Service Account for Standalone App (Linux/Mac)
# This script creates a service account in GCP and configures it for use with Earth Engine
#
# Prerequisites:
# - gcloud CLI installed
# - Already logged in: gcloud auth login
# - A GCP project created

#!/bin/bash

SERVICE_ACCOUNT_NAME="${1:-gee-service-account}"
DISPLAY_NAME="${2:-GEE Service Account for Standalone App}"

echo ""
echo "========================================"
echo "  GEE Service Account Setup Script"
echo "========================================"
echo ""

# Get current project
PROJECT_ID=$(gcloud config get-value project 2>/dev/null)
if [ -z "$PROJECT_ID" ]; then
    echo "❌ Error: No GCP project configured"
    echo "Run: gcloud config set project YOUR-PROJECT-ID"
    exit 1
fi

echo "📌 Project ID: $PROJECT_ID"
echo ""

# Step 1: Enable APIs
echo "📡 Step 1: Enabling required APIs..."
gcloud services enable earthengine.googleapis.com --quiet 2>/dev/null
gcloud services enable compute.googleapis.com --quiet 2>/dev/null
echo "✅ APIs enabled"
echo ""

# Step 2: Create Service Account
echo "👤 Step 2: Creating service account..."
SERVICE_ACCOUNT_EMAIL="$SERVICE_ACCOUNT_NAME@$PROJECT_ID.iam.gserviceaccount.com"

gcloud iam service-accounts create "$SERVICE_ACCOUNT_NAME" \
    --display-name="$DISPLAY_NAME" \
    --quiet 2>/dev/null

if [ $? -eq 0 ]; then
    echo "✅ Service account created: $SERVICE_ACCOUNT_EMAIL"
else
    echo "⚠️  Service account may already exist. Continuing..."
fi
echo ""

# Step 3: Grant IAM Permissions
echo "🔐 Step 3: Granting permissions..."
gcloud projects add-iam-policy-binding "$PROJECT_ID" \
    --member="serviceAccount:$SERVICE_ACCOUNT_EMAIL" \
    --role="roles/editor" \
    --quiet 2>/dev/null

echo "✅ Permissions granted"
echo ""

# Step 4: Create JSON Key
echo "🔑 Step 4: Creating JSON key..."
KEY_FILE="gee-key.json"
FUNCTIONS_DIR="functions"

gcloud iam service-accounts keys create "$KEY_FILE" \
    --iam-account="$SERVICE_ACCOUNT_EMAIL" 2>/dev/null

if [ -f "$KEY_FILE" ]; then
    echo "✅ JSON key created: $KEY_FILE"
else
    echo "❌ Failed to create JSON key"
    exit 1
fi
echo ""

# Step 5: Move Key to Functions Directory
echo "📂 Step 5: Moving key to functions directory..."
if [ ! -d "$FUNCTIONS_DIR" ]; then
    echo "❌ Error: functions directory not found"
    echo "Make sure you're running this from: standalone-app/"
    exit 1
fi

mv "$KEY_FILE" "$FUNCTIONS_DIR/$KEY_FILE"
echo "✅ Key moved to: $FUNCTIONS_DIR/$KEY_FILE"
echo ""

# Step 6: Create .env File
echo "📝 Step 6: Creating .env file..."
ENV_FILE="$FUNCTIONS_DIR/.env"

# Read the JSON and format it compactly
KEY_JSON=$(cat "$FUNCTIONS_DIR/$KEY_FILE" | tr -d '\n' | sed 's/  */ /g')
echo "GEE_SERVICE_ACCOUNT_KEY=$KEY_JSON" > "$ENV_FILE"

echo "✅ .env file created: $ENV_FILE"
echo ""

# Step 7: Display Summary
echo "========================================"
echo "  ✅ Setup Complete!"
echo "========================================"
echo ""

echo "📌 SERVICE ACCOUNT DETAILS:"
echo "   Email: $SERVICE_ACCOUNT_EMAIL"
echo "   Key:   $FUNCTIONS_DIR/$KEY_FILE"
echo "   Env:   $ENV_FILE"
echo ""

echo "⚠️  IMPORTANT - Register with Earth Engine:"
echo "   1. Save this email:"
echo "      $SERVICE_ACCOUNT_EMAIL"
echo ""
echo "   2. Visit: https://code.earthengine.google.com/profile"
echo ""
echo "   3. In GEE Code Editor:"
echo "      - Click your username (top right)"
echo "      - Click 'Assets'"
echo "      - Click 'Share' button"
echo "      - Paste the email above"
echo "      - Click 'Share'"
echo ""
echo "   4. Share your GEE assets:"
echo "      - For each folder (HLZ, GEZ, GCZ, CRU TS):"
echo "      - Click folder → Share"
echo "      - Add service account email with 'Reader' access"
echo ""

echo "🚀 NEXT STEPS:"
echo "   1. Verify .env file is in .gitignore:"
echo "      grep '.env' .gitignore"
echo ""
echo "   2. Update GEE asset paths in handlers:"
echo "      - functions/handlers/queryZones.js"
echo "      - functions/handlers/getMonthlyClimate.js"
echo "      - functions/handlers/getAnnualSummary.js"
echo "      - functions/handlers/getBioecologicalData.js"
echo ""
echo "   3. Test locally:"
echo "      firebase emulators:start --only functions"
echo ""
echo "   4. Deploy:"
echo "      firebase deploy"
echo ""

echo "✨ Setup script completed successfully!"
echo ""
