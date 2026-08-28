# 🚀 VED AI - Railway Deployment Guide

## Problem Diagnosis
Your website was showing "cannot be found" error after 2 days because:

1. **Missing Environment Variables** - The server wasn't properly initialized
2. **No Error Logging** - Crashes were happening silently without logs
3. **No Health Checks** - Railway didn't know if the app was running
4. **Missing Frontend Detection** - Server couldn't find the client folder

---

## ✅ What I Fixed

1. **Added Environment Variable Validation** - Server now checks for required keys
2. **Added Comprehensive Error Handling** - All crashes are now logged
3. **Added Health Check Endpoint** - Railway can monitor `/health`
4. **Added Startup Error Handlers** - Port conflicts and initialization errors are caught
5. **Added Process Error Handlers** - Uncaught exceptions are logged before exit

---

## 🔧 How to Deploy on Railway

### Step 1: Set Environment Variables in Railway

Go to your Railway dashboard → Your Project → Variables

Add these variables:

```
GEMINI_API_KEY = your_api_key_from_ai.google.dev
JWT_SECRET = generate_a_random_string_here
NODE_ENV = production
```

**How to get GEMINI_API_KEY:**
1. Go to https://ai.google.dev/
2. Click "Get API Key"
3. Create a new API key
4. Copy and paste it in Railway dashboard

### Step 2: Ensure Railway Configuration is Correct

Your `railway.toml` looks good:

```toml
[build]
buildCommand = "cd server && npm install"

[deploy]
startCommand = "cd server && node server.js"
```

This is correct! Railway will:
- Install dependencies from `server/package.json`
- Run the server from the `server/` directory
- Automatically set the `PORT` environment variable

### Step 3: Verify the Deployment

Once deployed, check these URLs:

- **Health Check**: `https://your-railway-url.railway.app/health`
- **Frontend**: `https://your-railway-url.railway.app/`

The health check should return:
```json
{
  "status": "ok",
  "timestamp": "2026-08-28T10:00:00.000Z",
  "port": 8080,
  "ai_ready": true
}
```

### Step 4: Monitor Logs in Railway

If something goes wrong:

1. Go to Railway Dashboard → Your Project
2. Click "Logs" tab
3. Look for error messages starting with `❌`
4. Watch for startup messages like `🚀 VED AI Server Running on Port`

---

## 🔍 Troubleshooting

### "Website cannot be found"
**Cause**: Server crashed or didn't start  
**Solution**: 
- Check Railway logs for `❌` errors
- Verify `GEMINI_API_KEY` is set in Railway
- Check that client folder exists

### "Connection refused"
**Cause**: Port not listening  
**Solution**:
- Check if server started (look for "🚀 VED AI Server Running" in logs)
- Verify `startCommand` in railway.toml

### "404 Not Found" on API calls
**Cause**: Frontend path incorrect  
**Solution**:
- Check if `CLIENT_PATH` shows correct path in logs
- Ensure `client/` folder structure exists in repo

### AI features not working
**Cause**: Missing or invalid GEMINI_API_KEY  
**Solution**:
- Get new API key from https://ai.google.dev/
- Update in Railway Variables
- Redeploy

---

## 📋 Deployment Checklist

- [ ] GEMINI_API_KEY added to Railway Variables
- [ ] JWT_SECRET added to Railway Variables
- [ ] `railway.toml` exists with correct commands
- [ ] `server/package.json` has all dependencies
- [ ] Deployed to Railway and got a URL
- [ ] Test `/health` endpoint returns `"status": "ok"`
- [ ] Frontend loads at root URL `/`
- [ ] Chat API works at `/chat` endpoint

---

## 🚀 How to Redeploy

After making changes locally:

```bash
# 1. Test locally first
cd server
npm install
node server.js

# 2. Commit and push to Git
git add .
git commit -m "Fix deployment issues"
git push

# 3. Railway will auto-deploy (if connected to GitHub)
# Or manually redeploy through Railway dashboard
```

---

## 📞 Common Commands

### Run locally
```bash
cd server
npm install
npm start
```

### Check server is running
```bash
curl http://localhost:3000/health
```

### View environment variables (don't commit!)
```bash
cat server/.env
```

---

## ✨ New Features Added

- ✅ `/health` endpoint for monitoring
- ✅ Automatic error logging and reporting
- ✅ Environment variable validation
- ✅ Graceful shutdown on errors
- ✅ Port conflict detection
- ✅ `.env.example` for reference

---

**Need help?** Check Railway docs: https://docs.railway.app/
