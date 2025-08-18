import React, { useState } from "react";

function App() {
  const [file, setFile] = useState(null);
  const [outImage, setOutImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // helper to downscale before upload
  async function fileToDataURLResized(file, maxSide = 1024, quality = 0.9) {
    const dataUrl = await new Promise((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result);
      fr.onerror = reject;
      fr.readAsDataURL(file);
    });

    const img = document.createElement("img");
    await new Promise((res, rej) => {
      img.onload = res;
      img.onerror = rej;
      img.src = dataUrl;
    });

    let { width, height } = img;
    const scale = Math.min(1, maxSide / Math.max(width, height));
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(img, 0, 0, w, h);

    return canvas.toDataURL("image/jpeg", quality);
  }

  async function handleTransform() {
    if (!file) {
      setError("Please upload an image first.");
      return;
    }
    setError("");
    setLoading(true);
    setOutImage(null);

    try {
      // resize + convert to dataURL
      const imageDataURL = await fileToDataURLResized(file, 1024, 0.9);

      const res = await fetch("/api/transform", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataURL }),
      });

      const ct = res.headers.get("content-type") || "";
      const data = ct.includes("application/json") ? await res.json() : {};
      if (!res.ok || !data.image) {
        throw new Error(data?.error || `Server error (${res.status})`);
      }

      setOutImage(data.image);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center text-white p-6">
      <h1 className="text-3xl font-bold mb-6">☁️ Cloud PFP Generator</h1>

      <input
        type="file"
        accept="image/*"
        className="mb-4"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />

      <button
        onClick={handleTransform}
        disabled={loading || !file}
        className="px-4 py-2 rounded bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600"
      >
        {loading ? "Generating..." : "Make it Cloudy"}
      </button>

      {error && <p className="mt-4 text-red-400">{error}</p>}

      {outImage && (
        <div className="mt-6">
          <h2 className="text-lg mb-2">Your Cloud Avatar:</h2>
          <img
            src={outImage}
            alt="Generated cloud avatar"
            className="max-w-xs rounded shadow"
          />
          <a
            href={outImage}
            download="cloud-avatar.png"
            className="block mt-3 px-3 py-1 bg-green-600 hover:bg-green-700 rounded"
          >
            Download
          </a>
        </div>
      )}
    </div>
  );
}

export default App;
