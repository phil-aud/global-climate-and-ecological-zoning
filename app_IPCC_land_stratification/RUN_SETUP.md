# 🚀 Running the Setup Script

I've created automated setup scripts for you. Choose the one for your OS:

---

## **Windows Users** ⭐ (Easiest)

### Option 1: Double-Click the Batch File (Easiest)

1. Open File Explorer
2. Navigate to: `c:\Users\phili\HLZs\GEE code\standalone-app\`
3. **Double-click** `setup-gee.bat`
4. A PowerShell window will open and run automatically
5. Follow the prompts

### Option 2: Run from PowerShell (More Control)

1. Open **PowerShell** (right-click → "Run as Administrator" for best results)
2. Navigate to the project:
   ```powershell
   cd "c:\Users\phili\HLZs\GEE code\standalone-app"
   ```
3. Run the script:
   ```powershell
   .\setup-gee.ps1
   ```

---

## **Mac/Linux Users**

1. Open **Terminal**
2. Navigate to the project:
   ```bash
   cd ~/path/to/standalone-app
   ```
3. Make the script executable:
   ```bash
   chmod +x setup-gee.sh
   ```
4. Run it:
   ```bash
   ./setup-gee.sh
   ```

---

## **⚙️ What the Script Does**

The setup script will automatically:

1. ✅ Enable required GCP APIs (Earth Engine, Compute Engine)
2. ✅ Create a service account named `gee-service-account`
3. ✅ Grant it Editor permissions
4. ✅ Create a JSON key file
5. ✅ Move the key to `functions/` directory
6. ✅ Create `functions/.env` with the credentials
7. ✅ Display your service account email

**Total time:** ~2 minutes

---

## **📌 After the Script Runs**

The script will display your service account email. **Copy it** — you'll need it next:

```
Email: gee-service-account@YOUR-PROJECT-ID.iam.gserviceaccount.com
```

### Then: Register with Earth Engine (Manual - Takes 2 minutes)

1. **Open** https://code.earthengine.google.com
2. Click your **username** (top right) → **Assets**
3. Click the **Share** button
4. **Paste your service account email** from above
5. Click **Share**
6. Now, for each of your GEE assets (HLZ, GEZ, GCZ, CRU TS):
   - Click the asset folder → **Share**
   - Add the service account email with **Reader** access
   - Click **Share**

---

## **✅ Verification Checklist**

After the script runs, verify:

- [ ] `functions/gee-key.json` exists
- [ ] `functions/.env` exists
- [ ] `functions/.env` is in `.gitignore` (don't commit secrets!)
- [ ] Service account registered with Earth Engine (via web browser)
- [ ] Each GEE asset (HLZ, GEZ, GCZ, CRU TS) is shared with the service account

---

## **❓ Troubleshooting**

| Error | Solution |
|-------|----------|
| "gcloud is not recognized" | Install Google Cloud SDK: https://cloud.google.com/sdk/docs/install |
| "ExecutionPolicy" error (Windows) | Run PowerShell as Administrator, or use `.bat` file instead |
| "Project not configured" | Run `gcloud config set project YOUR-PROJECT-ID` first |
| "Service account already exists" | That's OK — the script will continue and reuse it |
| "Permission denied" | Make sure you're logged in: `gcloud auth login` |

---

## **🚀 Next Steps (After Setup)**

Once the script completes and you've registered with Earth Engine:

1. **Update GEE asset paths** in your handlers:
   ```
   functions/handlers/queryZones.js
   functions/handlers/getMonthlyClimate.js
   functions/handlers/getAnnualSummary.js
   functions/handlers/getBioecologicalData.js
   ```

2. **Test locally:**
   ```bash
   firebase emulators:start --only functions
   ```

3. **Deploy to Firebase:**
   ```bash
   firebase deploy
   ```

---

## **Running the Script Now**

**Ready to go?** 

👉 **Windows:** Double-click `setup-gee.bat` in the project folder
👉 **Mac/Linux:** Run `./setup-gee.sh` in Terminal

Let me know if you hit any issues!
