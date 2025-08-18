import React, { useEffect, useRef, useState } from "react";
import "./app.css";

const DEFAULT_PROMPT =
  "I will send you pictures of fictional characters and you will recreate them like they are made of clouds in the sky, realistic style";

const PRICE_PER_IMAGE_1024 = 0.016; // rough estimate per image

export default function App() {
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [srcPreview, setSrcPreview] = useState(null);
  const [outImage, setOutImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [prompt, setPrompt] = useState(DEFAULT_PROMPT);
  const [error, setError] = useState("");

  const [usageCount, setUsageCount] = useState(0);
  const [spent, setSpent] = useState(0);

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem("cloudit-usage") || "0");
      setUsageCount(Number.isFinite(saved) ? saved : 0);
    } catch {}
  }, []);

  useEffect(() => {
    setSpent(usageCount * PRICE_PER_IMAGE_1024);
  }, [usageCount]);

  const onPick = () => fileInputRef.current?.click();

  const handleChosenFile = (f) => {
    if (!["image/png", "image/jpeg", "image/webp"].includes(f.type)) {
      setError("Please choose a PNG, JPEG, or WEBP image.");
      return;
    }
    if (f.size > 6 * 1024 * 1024) {
      setError("Please use an image up to ~6MB.");
      return;
    }
    setError("");
    setFile(f);
    setOutImage(null);
    const url = URL.createObjectURL(f);
    setSrcPreview(url);
  };

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (f) handleChosenFile(f);
  };

  const onDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f) handleChosenFile(f);
  };

  const onDragOver = (e) => e.preventDefault();

  // Utility to resize + convert file to base64
  const fileToDataURLResized = (f, maxSize, quality) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let { width, height } = img;
          if (width > height) {
            if (width > maxSize) {
              height *= maxSize / width;
              width = maxSize;
            }
          } else {
            if (height > maxSize) {
              width *= maxSize / height;
              height = maxSize;
            }
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.onerror = reject;
        img.src = event.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(f);
    });

  const transform = async () => {
    if (!file) {
      setError("Upload an image first.");
      return;
    }
    setError("");
    setLoading(true);
    setOutImage(null);
    try {
      const imageDataURL = await fileToDataURLResized(file, 1024, 0.9);

      // ⬇️ Cloudflare Pages endpoint
      const res = await fetch("/api/transform", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataURL, prompt }),
      });

      // Safer parse: handle non-JSON responses gracefully
      const ct = res.headers.get("content-type") || "";
      const data = ct.includes("application/json") ? await res.json() : {};
      if (!res.ok || !data.image) {
        throw new Error(data?.error || `Failed to transform (status ${res.status}).`);
      }

      setOutImage(data.image);

      const next = usageCount + 1;
      setUsageCount(next);
      try {
        localStorage.setItem("cloudit-usage", String(next));
      } catch {}
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const download = () => {
    if (!outImage) return;
    const a = document.createElement("a");
    a.href = outImage;
    a.download = "cloudit.png";
    a.click();
  };

  const shareToX = () => {
    const text = encodeURIComponent(
      "I just cloudified my profile picture with cloudit ☁️\nTry it here: YOUR_SITE_URL"
    );
    const url = `https://twitter.com/intent/tweet?text=${text}`;
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <>
      <div className="clouds" />
      <div className="container">
        <header className="header">
          <a className="brand" href="/">
            <div className="logo" />
            <div className="title">cloudit</div>
            <span className="badge">beta</span>
          </a>
          <div className="actions">
            <div
              className="usage-pill"
              title="Rough estimate at 1024×1024 price"
            >
              <span>
                {usageCount} {usageCount === 1 ? "image" : "images"}
              </span>
              <span className="dot" />
              <span>~${spent.toFixed(2)}</span>
            </div>
            <a
              className="btn-x"
              href="https://x.com/your_handle"
              target="_blank"
              rel="noreferrer"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 1200 1227"
                aria-hidden="true"
              >
                <path
                  fill="currentColor"
                  d="M714 519 1120 0H986L676 389 445 0H0l421 651L72 1227h134l332-428 246 428h445L714 519Zm-117 151-38-63L213 109H374l200 339 37 63 352 595H802l-205-356Z"
                />
              </svg>
              Follow
            </a>
          </div>
        </header>

        <section className="hero">
          <h1 style={{ marginTop: 0, marginBottom: 6 }}>
            Cloudify your profile picture ☁️
          </h1>
          <div className="subtle" style={{ marginBottom: 16 }}>
            Upload a PNG/JPG/WEBP. We’ll turn it into a realistic cloud
            sculpture in the sky.
          </div>

          <div className="row">
            <div>
              <div
                className="dropzone"
                onDrop={onDrop}
                onDragOver={onDragOver}
                onClick={onPick}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  style={{ display: "none" }}
                  onChange={onFile}
                />
                <p>
                  <strong>Click to upload</strong> or drag & drop an image
                </p>
                <p className="subtle">(Recommended ≤ 6MB)</p>
              </div>

              <div className="controls">
                <label style={{ fontSize: 14 }} className="subtle">
                  Prompt (optional)
                </label>
                <textarea
                  className="input"
                  rows="3"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button className="btn" disabled={loading} onClick={transform}>
                    {loading ? "Transforming..." : "Transform"}
                  </button>
                  <button
                    className="btn secondary"
                    disabled={!outImage}
                    onClick={download}
                  >
                    Download result
                  </button>
                  <button
                    className="btn secondary"
                    disabled={!outImage}
                    onClick={shareToX}
                  >
                    Share to X
                  </button>
                </div>
                {error && <div className="error">{error}</div>}
              </div>
            </div>

            <div className="preview">
              <div className="imgbox">
                {srcPreview ? (
                  <img src={srcPreview} alt="source" />
                ) : (
                  <span>Source preview</span>
                )}
              </div>
              <div className="imgbox">
                {outImage ? (
                  <img src={outImage} alt="result" />
                ) : (
                  <span>Result will appear here</span>
                )}
              </div>
              <div className="footer">
                Images are processed server-side via Cloudflare Pages Functions
                (your API key stays private).
              </div>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
