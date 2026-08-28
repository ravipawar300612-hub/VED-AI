# 🚀 VED AI - Production Deployment Checklist

## ✅ Critical Fixes Applied

### 1. **Database & Error Handling**
- ✅ Added explicit `CREATE TABLE` statements for `chats`, `memories`, and `blacklist`
- ✅ All `db.run()` calls now include error callbacks for proper error logging
- ✅ Database initialization function with error handling
- ✅ Process-level error handlers (uncaught exceptions, unhandled rejections)

### 2. **Input Validation**
- ✅ New validation functions: `validateMessage()`, `validateBase64()`, `sanitizeOutput()`
- ✅ All POST endpoints validate request body before processing
- ✅ Message length limits (max 5000 chars) to prevent memory issues
- ✅ Base64 validation for images and documents
- ✅ Empty input protection on all endpoints

### 3. **Security Improvements**
- ✅ Security headers added (X-Content-Type-Options, X-Frame-Options, X-XSS-Protection, HSTS)
- ✅ CORS restricted to known origins in production (configurable)
- ✅ Output sanitization to prevent XSS
- ✅ Environment variable validation for API keys

### 4. **Memory Management**
- ✅ `conversationHistory` limit increased from 30 to 50 messages
- ✅ Automatic cleanup prevents memory leaks in long-running sessions
- ✅ Timestamps added to database records for better tracking

### 5. **API Endpoints Enhanced**
- ✅ `/health` endpoint for Railway monitoring
- ✅ `/chat` - Input validation + error handling
- ✅ `/vision` - Image validation + proper error responses
- ✅ `/document` - PDF validation + error handling
- ✅ `/blacklist` - Message validation + error callbacks
- ✅ `/check-scam` - Suspicious message validation + error handling
- ✅ `/tts` - Text validation + API key check + retry logic

### 6. **Logging & Debugging**
- ✅ Comprehensive error logging with ❌ emoji for easy filtering
- ✅ Database operation failures are logged
- ✅ Quota exhaustion warnings
- ✅ Startup validation messages

---

## 🔧 Environment Variables Required

Create a `.env` file in the `server/` directory:

```env
# REQUIRED - Get from https://ai.google.dev/
GEMINI_API_KEY=your_api_key_here

# REQUIRED - For JWT authentication
JWT_SECRET=generate_a_random_strong_string_here

# OPTIONAL - ElevenLabs TTS (for voice features)
ELEVENLABS_API_KEY=your_elevenlabs_api_key
ELEVENLABS_VOICE_ID=21m00Tcm4TlvDq8ikWAM

# OPTIONAL - Frontend URL for CORS
FRONTEND_URL=https://your-railway-url.railway.app

# OPTIONAL - Environment indicator
NODE_ENV=production
```

---

## 📋 Pre-Deployment Checklist

### Local Testing
- [ ] Run `cd server && npm install`
- [ ] Create `server/.env` with all required keys
- [ ] Run `npm start` and verify startup logs
- [ ] Test `/health` endpoint returns `{"status":"ok"}`
- [ ] Test `/chat` endpoint with a simple message
- [ ] Check logs for any `❌` errors

### Railway Configuration
- [ ] Go to Railway Dashboard → Your Project
- [ ] Click "Variables" tab
- [ ] Add all environment variables from `.env`
- [ ] Verify `GEMINI_API_KEY` is set
- [ ] Verify `JWT_SECRET` is set
- [ ] Set `NODE_ENV=production`

### Post-Deployment Verification
- [ ] Visit `https://your-railway-url.railway.app/health`
- [ ] Should return: `{"status":"ok","timestamp":"...","port":...,"ai_ready":true}`
- [ ] Visit `https://your-railway-url.railway.app/` 
- [ ] Frontend should load
- [ ] Try sending a chat message
- [ ] Check Railway logs for "🚀 VED AI Server Running"

---

## 🔍 Monitoring & Troubleshooting

### Check Logs in Railway
1. Go to Railway Dashboard → Your Project
2. Click "Logs" tab
3. Look for:
   - ✅ `🚀 VED AI Server Running on Port` = Server started successfully
   - ❌ `CRITICAL: Client folder not found` = Frontend path issue
   - ⚠️ `WARNING: GEMINI_API_KEY not set` = Missing API key
   - ❌ `Failed to save` = Database errors

### Common Issues & Solutions

**Issue**: "Website cannot be found"
- Check logs for startup errors
- Verify `GEMINI_API_KEY` in Railway Variables
- Ensure frontend folder exists in repo

**Issue**: API returns 500 errors
- Check Railway logs for `❌` error messages
- Verify environment variables are set
- Check if GEMINI_API_KEY is valid

**Issue**: Quota errors from Gemini
- App will gracefully respond with friendly message
- Wait 1-2 minutes before retrying
- Check Gemini API quota at https://ai.google.dev/

**Issue**: TTS not working
- Verify `ELEVENLABS_API_KEY` is set in Railway
- TTS is optional - app works without it
- Check logs for TTS-specific errors

---

## 🛡️ Security Notes

1. **NEVER commit `.env` file** - Already in `.gitignore`
2. **Rotate JWT_SECRET regularly** - Set strong random value
3. **CORS is restricted** - Only whitelisted origins in production
4. **All input is validated** - XSS protection via output sanitization
5. **API keys are never logged** - Only in startup warnings

---

## 📈 Performance Optimizations

- ✅ Conversation history limited to 50 messages (was 30)
- ✅ Greeting responses cached (no API calls for common questions)
- ✅ Document truncation at 12KB to prevent memory issues
- ✅ Image size validated (max 10MB)
- ✅ Request timeout protection via error handling

---

## 🚀 Deployment Command (Git)

```bash
# Commit all changes
git add -A
git commit -m "Add production security fixes and validation"

# Push to GitHub (Railway will auto-deploy if connected)
git push origin main
```

---

## 📞 Support & Resources

- **Google Gemini API**: https://ai.google.dev/
- **Railway Docs**: https://docs.railway.app/
- **Express.js Docs**: https://expressjs.com/
- **Node.js Best Practices**: https://nodejs.org/en/docs/guides/nodejs-security/

---

## ✨ What's New

### Validation Functions
```javascript
validateMessage(msg)    // Validates text input
validateBase64(data)    // Validates base64 images/docs
sanitizeOutput(text)    // Prevents XSS in responses
```

### Database Tables
```sql
-- Now properly initialized with timestamps
CREATE TABLE chats (...)
CREATE TABLE memories (...)
CREATE TABLE blacklist (...)
```

### Error Handling
- All database operations have error callbacks
- Process-level error handlers prevent silent crashes
- Detailed error logging for debugging

---

## 🎯 Next Steps

1. ✅ Set up `.env` with API keys
2. ✅ Test locally: `npm start`
3. ✅ Commit and push to GitHub
4. ✅ Railway auto-deploys (if connected)
5. ✅ Verify with `/health` endpoint
6. ✅ Monitor logs for errors

**Status**: Ready for production deployment! 🎉
