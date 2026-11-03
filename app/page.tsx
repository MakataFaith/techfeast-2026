"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";

type View = "landing" | "scanner" | "scanning" | "results" | "error";
type ApiResult = Record<string, unknown>;

const resultArray = (value: unknown) => (Array.isArray(value) ? value : []);

function getResultData(response: ApiResult): ApiResult {
  return response.resultData && typeof response.resultData === "object"
    ? (response.resultData as ApiResult)
    : response;
}

export default function Home() {
  const [view, setView] = useState<View>("landing");
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [consent, setConsent] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<ApiResult | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const previewUrlRef = useRef<string | null>(null);

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    setCameraActive(false);
  };

  useEffect(() => () => stopCamera(), []);
  useEffect(
    () => () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    },
    []
  );

  const setPreviewUrl = (url: string) => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    previewUrlRef.current = url;
    setPreview(url);
  };

  const startCamera = async () => {
    setError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 1080 }, height: { ideal: 1080 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraActive(true);
    } catch {
      setError("Camera access is unavailable. You can continue with an uploaded image.");
      setCameraActive(false);
    }
  };

  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video?.videoWidth || !video.videoHeight) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.translate(canvas.width, 0);
    context.scale(-1, 1);
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const captured = new File([blob], "skin-capture.jpg", { type: "image/jpeg" });
      setFile(captured);
      setPreviewUrl(URL.createObjectURL(captured));
      stopCamera();
    }, "image/jpeg", 0.82);
  };

  const handleUpload = (selected: File | undefined) => {
    if (!selected) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(selected.type)) {
      setError("Unsupported image format. Please choose a JPEG, PNG, or WebP file.");
      return;
    }
    if (selected.size > 10 * 1024 * 1024) {
      setError("Please choose an image no larger than 10 MB.");
      return;
    }
    setError("");
    setFile(selected);
    setPreviewUrl(URL.createObjectURL(selected));
    stopCamera();
  };

  const reset = () => {
    stopCamera();
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
    setPreview(null);
    setFile(null);
    setConsent(false);
    setError("");
    setResult(null);
    setView("scanner");
  };

  const openScanner = () => {
    setView("scanner");
    requestAnimationFrame(() => {
      document.getElementById("skin-scanner")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  const startAnalysis = async () => {
    if (!file || !consent) {
      setError("Capture or upload a clear face image and provide consent before analysis.");
      return;
    }
    setView("scanning");
    setError("");
    const formData = new FormData();
    formData.append("file", file, file.name);
    try {
      const response = await fetch("/api/skin-analysis", {
        method: "POST",
        body: formData,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(
          typeof data?.error === "string"
            ? data.error
            : "The analysis could not be completed. Please try again."
        );
      }
      if (!data || typeof data !== "object") throw new Error("Unexpected analysis response.");
      setResult(getResultData(data));
      setView("results");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "The analysis could not be completed.");
      setView("error");
    }
  };

  const data = result || {};
  const label = typeof data.label === "string" ? data.label : null;
  const confidence =
    typeof data.confidence === "number" ? data.confidence : null;
  const description = typeof data.description === "string" ? data.description : null;
  const findings =
    resultArray(data.findings).length > 0
      ? resultArray(data.findings).map(String)
      : resultArray(data.concerns).map(String);
  const recommendations = resultArray(data.recommendations);
  const measurementEntries = [
    ["hydration", "Hydration Level"],
    ["oiliness", "Oil Production"],
    ["sensitivity", "Sensitivity"],
    ["elasticity", "Skin Elasticity"],
    ["brightness", "Brightness / Glow"],
  ].filter(([key]) => typeof data[key] === "number") as [string, string][];

  return (
    <main>
      {view === "landing" && (
        <section className="landing">
          <nav className="nav">
            <Image src="/logo.png" alt="AfriDam AI" width={132} height={44} priority />
            <span className="event-badge">TECHFEAST 2026</span>
          </nav>
          <div className="hero-grid">
            <div className="hero-copy">
              <p className="eyebrow">AfriDam AI × TECHFEAST 2026</p>
              <h1>Discover What Your Skin Is Telling You.</h1>
              <p className="hero-text">
                Experience intelligent skin analysis powered by AfriDam AI. Get personalised
                insights into your skin and discover a smarter approach to skincare.
              </p>
              <button className="primary-button" onClick={openScanner}>
                Start Your Free Skin Analysis
              </button>
              <p className="trust">Powered by AfriDam AI Intelligence.</p>
            </div>
            <div className="hero-visual">
              <div className="orb orb-one" />
              <div className="orb orb-two" />
              <div className="face-frame">
                <div className="scan-line" />
                <span>AI Skin Intelligence</span>
              </div>
            </div>
          </div>
        </section>
      )}

      {view === "scanner" && (
        <section id="skin-scanner" className="experience">
          <header className="experience-header">
            <button className="back-button" onClick={() => setView("landing")}>← Back</button>
            <Image src="/logo.png" alt="AfriDam AI" width={120} height={40} />
          </header>
          <div className="scanner-layout">
            <div className="scanner-card">
              <div className="scanner-box">
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview} alt="Captured skin preview" className="preview-image" />
                ) : (
                  <>
                    <video ref={videoRef} className={cameraActive ? "camera-video" : "hidden-video"} autoPlay playsInline muted />
                    {!cameraActive && (
                      <div className="idle-state">
                        <div className="face-icon">◉</div>
                        <p>Align your face within the frame</p>
                        <small>Good lighting · Face forward · No glasses</small>
                      </div>
                    )}
                    {cameraActive && <div className="corner-frame"><span /><span /><span /><span /></div>}
                    {cameraActive && <div className="live-scan-line" />}
                  </>
                )}
              </div>
              <div className="scanner-actions">
                {!preview && !cameraActive && (
                  <>
                    <button className="primary-button" onClick={startCamera}>Open Camera</button>
                    <label className="secondary-button">
                      Upload Photo
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp"
                        onChange={(event) => handleUpload(event.target.files?.[0])}
                      />
                    </label>
                  </>
                )}
                {cameraActive && <button className="primary-button" onClick={capturePhoto}>Capture Photo</button>}
                {preview && (
                  <>
                    <button className="secondary-button" onClick={reset}>Choose Another</button>
                    <label className="privacy-check">
                      <input
                        type="checkbox"
                        checked={consent}
                        onChange={(event) => setConsent(event.target.checked)}
                      />
                      <span>I consent to this image being sent securely for AI analysis.</span>
                    </label>
                    <button className="primary-button" disabled={!consent} onClick={startAnalysis}>
                      Start Analysis
                    </button>
                  </>
                )}
              </div>
              {error && <p className="inline-error" role="alert">{error}</p>}
            </div>
            <aside className="privacy-note">
              <p className="eyebrow">Before you begin</p>
              <h2>A clear photo helps provide better insights.</h2>
              <ul>
                <li>Use natural, even lighting.</li>
                <li>Keep your face fully visible.</li>
                <li>Remove heavy filters and sunglasses.</li>
              </ul>
              <p>Your image is sent directly for analysis and is not saved by this website.</p>
            </aside>
          </div>
        </section>
      )}

      {view === "scanning" && (
        <section className="status-view">
          <div className="status-card">
            {preview && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={preview} alt="Image being analysed" className="scanning-image" />
            )}
            <div className="status-scan-line" />
            <h1>Analysing your skin…</h1>
            <p>Preparing your AI-generated insights</p>
          </div>
        </section>
      )}

      {view === "results" && (
        <section className="results-view">
          <header className="experience-header">
            <span className="event-badge">TECHFEAST 2026</span>
            <Image src="/logo.png" alt="AfriDam AI" width={120} height={40} />
          </header>
          <div className="results-grid">
            <div>
              {preview && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="Analysed face" className="result-image" />
              )}
            </div>
            <article className="report">
              <p className="eyebrow">AI Diagnostic Report</p>
              {label && <h1>{label}</h1>}
              {confidence !== null && (
                <div className="confidence">
                  <span>Confidence</span>
                  <strong>{confidence}%</strong>
                </div>
              )}

              {measurementEntries.length > 0 && (
                <div className="measurements">
                  <h2>Skin Profile Analysis</h2>
                  {measurementEntries.map(([key, name]) => (
                    <div className="measurement" key={key}>
                      <div><span>{name}</span><strong>{String(data[key])}%</strong></div>
                      <div className="bar"><span style={{ width: `${Math.min(Number(data[key]), 100)}%` }} /></div>
                    </div>
                  ))}
                </div>
              )}

              {findings.length > 0 && (
                <div className="findings">
                  <h2>Key Findings</h2>
                  <div>{findings.map((finding, index) => <span key={index}>{finding}</span>)}</div>
                </div>
              )}

              {description && <div className="description"><h2>AI Clinical Analysis</h2><p>{description}</p></div>}

              {recommendations.length > 0 && (
                <div className="recommendations">
                  <h2>Recommendations</h2>
                  {recommendations.map((recommendation, index) => (
                    <div key={index}>
                      {typeof recommendation === "string"
                        ? recommendation
                        : typeof (recommendation as ApiResult).name === "string"
                          ? String((recommendation as ApiResult).name)
                          : typeof (recommendation as ApiResult).description === "string"
                            ? String((recommendation as ApiResult).description)
                            : "Recommended action"}
                    </div>
                  ))}
                </div>
              )}

              <div className="result-actions">
                <button className="secondary-button" onClick={reset}>Start Another Analysis</button>
                <button className="primary-button consultation-button" disabled>
                  Book a Specialist Consultation
                  <small>Booking link pending confirmation</small>
                </button>
              </div>
              <p className="disclaimer">
                These AI-generated insights are for skincare information and are not a medical diagnosis.
                Consult a qualified healthcare professional for health concerns.
              </p>
            </article>
          </div>
        </section>
      )}

      {view === "error" && (
        <section className="status-view">
          <div className="error-card">
            <p className="eyebrow">Analysis unavailable</p>
            <h1>We couldn&apos;t complete this scan.</h1>
            <p role="alert">{error}</p>
            <button className="primary-button" onClick={() => setView("scanner")}>Try Again</button>
          </div>
        </section>
      )}
    </main>
  );
}
