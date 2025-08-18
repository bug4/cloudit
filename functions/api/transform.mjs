// Cloudflare Pages Function: POST /api/transform
// Set OPENAI_API_KEY in Cloudflare Pages → Settings → Environment variables (Production & Preview)

export const onRequestPost = async (context) => {
  try {
    const { request, env } = context;

    if (!env.OPENAI_API_KEY) {
      return json(500, { error: "Server not configured: OPENAI_API_KEY missing." });
    }

    // Parse JSON
    let body;
    try {
      body = await request.json();
    } catch {
      return json(400, { error: "Invalid JSON body." });
    }

    const { imageDataURL } = body || {};
    if (!imageDataURL) {
      return json(400, { error: "Missing imageDataURL" });
    }

    // Keep uploads small (faster + cheaper)
    const approxBytes = Math.floor(imageDataURL.length * 0.75);
    if (approxBytes > 4 * 1024 * 1024) {
      return json(413, { error: "Image too large. Please upload ≤ 4MB." });
    }

    const { blob, filename } = dataUrlToBlob(imageDataURL);

    // Fixed cloudifying prompt (hidden from users)
    const prompt =
      "I will send you pictures of fictional characters and you will recreate them like they are made of clouds in the sky, realistic style";

    // Build multipart form for OpenAI Images Edit
    const form = new FormData();
    form.append("model", "gpt-image-1");
    form.append("prompt", prompt);

    // Supported sizes: "1024x1024", "1024x1536", "1536x1024", "auto"
    // Use square 1024x1024 for consistent PFPs
    form.append("size", "1024x1024");

    // IMPORTANT: In Workers/Pages, give the filename via the 3rd param
    form.append("image", blob, filename);

    const resp = await fetch("https://api.openai.com/v1/images/edits", {
      method: "POST",
      headers: { Authorization: `Bearer ${env.OPENAI_API_KEY}` },
      body: form,
    });

    // Robust error decoding (text fallback)
    const contentType = resp.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
      const text = await resp.text();
      return json(resp.status, { error: `Upstream error: ${text.slice(0, 400)}` });
    }

    const data = await resp.json();
    if (!resp.ok) {
      return json(resp.status, { error: data?.error?.message || "OpenAI error" });
    }

    const b64 = data?.data?.[0]?.b64_json;
    if (!b64) return json(502, { error: "No image returned from model." });

    return json(200, { image: `data:image/png;base64,${b64}` });
  } catch (err) {
    return json(500, { error: err?.message || "Failed to generate image." });
  }
};

function dataUrlToBlob(dataUrl) {
  const m = /^data:(.+?);base64,(.+)$/.exec(dataUrl || "");
  if (!m) throw new Error("Invalid image data URL.");
  const mime = m[1];
  const b64 = m[2];
  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const blob = new Blob([bytes], { type: mime });
  const ext =
    mime === "image/png" ? "png" :
    mime === "image/jpeg" ? "jpg" :
    mime === "image/webp" ? "webp" : "bin";
  return { blob, filename: `upload.${ext}` };
}

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
