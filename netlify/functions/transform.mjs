// Netlify Functions v2 style: (req) => Response
import OpenAI from "openai";
import { toFile } from "openai/uploads";

// Convert a data URL to a Web Blob and filename (PNG/JPEG/WEBP only)
function dataUrlToBlobParts(dataUrl) {
  const m = /^data:(.+?);base64,(.+)$/.exec(dataUrl || "");
  if (!m) throw new Error("Invalid image data URL.");
  const mime = m[1];
  const b64 = m[2];
  const buf = Buffer.from(b64, "base64");
  const ext =
    mime === "image/png"  ? "png"  :
    mime === "image/jpeg" ? "jpg"  :
    mime === "image/webp" ? "webp" : null;
  if (!ext) throw new Error("Unsupported image type. Use PNG/JPEG/WEBP.");
  const blob = new Blob([buf], { type: mime });
  const filename = `upload.${ext}`;
  return { blob, mime, filename };
}

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" }
  });

export default async (req, _ctx) => {
  try {
    if (req.method !== "POST") {
      return json(405, { error: "Method not allowed" });
    }

    // Required env
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return json(500, { error: "Server not configured: OPENAI_API_KEY missing." });
    }

    // Parse JSON body safely
    let body;
    try {
      body = await req.json();
    } catch {
      return json(400, { error: "Invalid JSON body." });
    }

    const { imageDataURL } = body || {};
    if (!imageDataURL) {
      return json(400, { error: "Missing imageDataURL" });
    }

    // Guard: keep payloads small for speed/timeouts (~base64 is ~1.33x larger than bytes)
    const approxBytes = Math.floor(imageDataURL.length * 0.75);
    if (approxBytes > 4 * 1024 * 1024) {
      return json(413, { error: "Image too large. Please upload ≤ 4MB." });
    }

    // Convert to uploadable "file"
    const { blob, mime, filename } = dataUrlToBlobParts(imageDataURL);
    const apiFile = await toFile(blob, filename, { type: mime });

    const openai = new OpenAI({
      apiKey,
      organization: process.env.OPENAI_ORG, // optional
    });

    // Fixed “cloudify” prompt (hidden from users)
    const prompt =
      "I will send you pictures of fictional characters and you will recreate them like they are made of clouds in the sky, realistic style";

    // You can change size to "512x512" for faster/cheaper results
    const result = await openai.images.edit({
      model: "gpt-image-1",
      image: apiFile,
      prompt,
      size: "1024x1024",
    });

    const b64 = result?.data?.[0]?.b64_json;
    if (!b64) {
      return json(502, { error: "No image returned from model." });
    }

    return json(200, { image: `data:image/png;base64,${b64}` });
  } catch (err) {
    // Helpful diagnostics appear in Netlify function logs
    console.error(
      "transform error:",
      err?.status,
      err?.code,
      err?.message,
      err?.response?.data
    );

    // Map a few common failure modes to clearer messages
    const known =
      err?.response?.data?.error?.message ||
      (err?.code === "unsupported_file_mimetype" && "Only PNG, JPEG, or WEBP are allowed.") ||
      (err?.status === 403 && "Your OpenAI key/project doesn’t have access to gpt-image-1.") ||
      err?.message;

    return json(500, { error: known || "Failed to generate image." });
  }
};
