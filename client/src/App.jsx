import React, { useEffect, useRef, useState } from "react";
import "./app.css";

// Prompt is enforced on the SERVER (functions/api/transform.js)
const SERVER_PROMPT =
  "I will send you pictures of fictional characters and you will recreate them like they are made of clouds in the sky, realistic style";

export default function App() {
  const fileInputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [srcPreview, setSrcPreview] = useState(null);
  const [outImage, setOutImage] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [usageCount, setUsageCount] = useState(0);

  useEffect(() => {
    try {
      const saved = Number(localStorage.getItem("cloudit-usage") || "0");
      setUsageCount(Number.isFinite(saved) ? saved : 0);
    } catch {}
  }, []);

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
    setSrcPreview(URL.createObjectURL(f));
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

  // Resize + convert to base64 for faster uploads
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

      const res = await fetch("/api/transform", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataURL }), // prompt enforced server-side
      });

      const ct = res.headers.get("content-type") || "";
      const data = ct.includes("application/json") ? await res.json() : {};
      if (!res.ok || !data.image) {
        throw new Error(data?.error || `Failed to transform (status ${res.status}).`);
      }

      setOutImage(data.image);

      const next = usageCount + 1;
      setUsageCount(next);
      try { localStorage.setItem("cloudit-usage", String(next)); } catch {}

      try {
        const payload = JSON.stringify({
          type: "generation",
          ts: Date.now(),
          day: new Date().toISOString().slice(0, 10),
        });
        navigator.sendBeacon("/api/analytics", new Blob([payload], { type: "application/json" }));
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

  const shareToCommunity = () => {
    window.open("https://x.com/i/communities/1957390468272001500/", "_blank", "noopener,noreferrer");
  };

  return (
    <>
      {/* FULL-SCREEN BACKGROUND VIDEO */}
      <div
        className="bg-video-wrap"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 0,
          overflow: "hidden",
          pointerEvents: "none",
        }}
        aria-hidden="true"
      >
        <video
          className="bg-video"
          src="/video.mp4"
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          style={{
            position: "absolute",
            width: "100vw",
            height: "100vh",
            objectFit: "cover",
            top: 0,
            left: 0,
          }}
        />
        <div
          className="bg-overlay"
          style={{
            position: "absolute",
            inset: 0,
            background:
              "radial-gradient(ellipse at center, rgba(0,0,0,0.22), rgba(0,0,0,0.5))",
          }}
        />
      </div>

      {/* IMPORTANT: remove the old clouds layer */}
      {/* <div className="clouds" />  <-- delete / keep commented out */}

      {/* APP CONTENT ABOVE VIDEO */}
      <div className="container" style={{ position: "relative", zIndex: 1 }}>
        <header className="header">
          <a className="brand" href="/">
            <div className="logo" />
            <div className="title">cloudit</div>
          </a>
          <div className="actions">
            <a className="btn-x" href="https://x.com/bug4sol" target="_blank" rel="noreferrer">
              ❤️ Support the Dev
            </a>
            <a
              className="btn-x"
              href="https://x.com/i/communities/1957390468272001500/"
              target="_blank"
              rel="noreferrer"
            >
              👥 CloudIt Community
            </a>
          </div>
        </header>

        <section className="hero">
          <h1 style={{ marginTop: 0, marginBottom: 6 }}>
            Cloudify your Twitter/X profile picture ☁️
          </h1>
          <div className="subtle" style={{ marginBottom: 16 }}>
            Upload a PNG/JPG/WEBP of your current PFP and we’ll turn it into a fluffy
            cloud sculpture in the sky.
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
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button className="btn" disabled={loading} onClick={transform}>
                    {loading ? "Transforming..." : "Transform"}
                  </button>
                  <button className="btn secondary" disabled={!outImage} onClick={download}>
                    Download result
                  </button>
                  <button
                    className="btn secondary"
                    disabled={!outImage}
                    onClick={shareToCommunity}
                    title="Share your result with the community"
                    style={{ display: "inline-flex", alignItems: "center", gap: 8 }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true">
                      <path fill="currentColor" d="M2 11a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1a6 6 0 0 1-6 6H9l-4 3v-3.5A6 6 0 0 1 2 12v-1z"/>
                    </svg>
                    Share in the community
                  </button>
                </div>
                {error && <div className="error" style={{ marginTop: 8 }}>{error}</div>}
              </div>
            </div>

            <div className="preview" style={{ position: "relative" }}>
              <div className="imgbox">
                {srcPreview ? <img src={srcPreview} alt="source" /> : <span>Source preview</span>}
              </div>

              <div className="imgbox" style={{ position: "relative" }}>
                {outImage ? <img src={outImage} alt="result" /> : <span>Result will appear here</span>}
                {loading && (
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: "rgba(0,0,0,0.35)",
                      display: "grid",
                      placeItems: "center",
                      borderRadius: 16
                    }}
                  >
                    <div
                      className="spinner"
                      style={{
                        width: 40,
                        height: 40,
                        border: "4px solid #fff",
                        borderTopColor: "transparent",
                        borderRadius: "50%",
                        animation: "spin 0.9s linear infinite"
                      }}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>

      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </>
  );
}
