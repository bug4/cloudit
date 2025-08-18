# cloudit — Cloudify your PFP (Netlify + OpenAI)

Features:
- Cloud-styled UI with animated glow
- Upload/preview, transform via Netlify Function (OpenAI `gpt-image-1` edit)
- Usage counter with rough $ estimate (1024×1024 pricing)
- Share to X button (opens tweet composer; user attaches image manually)
- API key stays private in Netlify env vars

## Deploy to Netlify
1. Push this folder to a new Git repo.
2. Netlify → Add new site → Import from Git → select this repo.
3. Site settings → Environment variables:
   - `OPENAI_API_KEY = sk-proj-...` (project key under your verified org)
   - (optional) `OPENAI_ORG = org_...`
4. Deploy. Function endpoint: `/.netlify/functions/transform`

## Local Dev
```bash
# terminal 1 — client
cd client
npm install
npm run dev

# terminal 2 — functions & proxy
npm install -g netlify-cli
cd ..
netlify dev   # http://localhost:8888
```

## Tweaks
- Edit prompt or output size in `netlify/functions/transform.mjs`.
- Replace `YOUR_SITE_URL` inside `shareToX()` in `client/src/App.jsx`.
- Replace the X button href with your handle.
