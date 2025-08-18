// netlify/functions/transform.mjs
import OpenAI from "openai";
import { Readable } from "node:stream";
import { toFile } from "openai/uploads";

function dataUrlToParts(dataUrl) {
  const match = /^data:(.+?);base64,(.+)$/.exec(dataUrl || "");
  if (!match) throw new Error("Invalid image data URL.");
  const mime = match[1];
  const b64 = match[2];
  const buf = Buffer.from(b64, "base64");
  const stream = Readable.from(buf);
  const ext = mime === "image/png" ? "png" :
              mime === "image/jpeg" ? "jpg" :
              mime === "image/webp" ? "webp" : null;
  if (!ext) throw new Error("Unsupported image type. Use PNG/JPEG/WEBP.");
  return { mime, stream, filename: `upload.${ext}` };
}

export default async (req, res) => {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }
  try {
    const { imageDataURL, prompt } = req.body || {};
    if (!imageDataURL) return res.status(400).json({ error: "Missing imageDataURL" });

    const effectivePrompt = (prompt && prompt.trim()) ||
      "I will send you pictures of fictional characters and you will recreate them like they are made of clouds in the sky, realistic style";

    const { mime, stream, filename } = dataUrlToParts(imageDataURL);
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      organization: process.env.OPENAI_ORG,
    });

    const apiFile = await toFile(stream, filename, { type: mime });

    const response = await openai.images.edit({
      model: "gpt-image-1",
      image: apiFile,
      prompt: effectivePrompt,
      size: "1024x1024",
    });

    const b64 = response.data?.[0]?.b64_json;
    if (!b64) throw new Error("OpenAI returned no image data.");
    return res.status(200).json({ image: `data:image/png;base64,${b64}` });
  } catch (err) {
    console.error("Transform error:", err?.status, err?.code, err?.message, err?.response?.data);
    const msg = err?.response?.data?.error?.message || err?.message || "Failed to generate image.";
    return res.status(500).json({ error: msg });
  }
};
