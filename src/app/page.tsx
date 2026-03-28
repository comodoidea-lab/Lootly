"use client";

import { useEffect, useRef, useState, useCallback } from "react";

type ImageItem = { id: string; base64: string; mimeType: string; preview: string };
type Status = "idle" | "loading" | "success" | "error";

export default function Home() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [fields, setFields] = useState("");
  const [result, setResult] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(console.error);
    }
  }, []);

  const compressImage = (dataUrl: string): Promise<{ base64: string; mimeType: string; preview: string }> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const MAX = 1920;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
          if (width > height) { height = Math.round((height * MAX) / width); width = MAX; }
          else { width = Math.round((width * MAX) / height); height = MAX; }
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d")!.drawImage(img, 0, 0, width, height);
        const compressed = canvas.toDataURL("image/jpeg", 0.85);
        resolve({ base64: compressed.split(",")[1], mimeType: "image/jpeg", preview: compressed });
      };
      img.src = dataUrl;
    });
  };

  const processFiles = useCallback((files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter((f) => f.type.startsWith("image/"));
    imageFiles.forEach((file) => {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const dataUrl = e.target?.result as string;
        const { base64, mimeType, preview } = await compressImage(dataUrl);
        setImages((prev) => [
          ...prev,
          { id: `${Date.now()}-${Math.random()}`, base64, mimeType, preview },
        ]);
        setResult("");
        setStatus("idle");
        setError("");
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) processFiles(e.target.files);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) processFiles(e.dataTransfer.files);
  };

  const handlePaste = useCallback(
    (e: ClipboardEvent) => {
      const imageItems = Array.from(e.clipboardData?.items ?? []).filter((i) =>
        i.type.startsWith("image/")
      );
      const files = imageItems.map((i) => i.getAsFile()).filter(Boolean) as File[];
      if (files.length) processFiles(files);
    },
    [processFiles]
  );

  useEffect(() => {
    document.addEventListener("paste", handlePaste);
    return () => document.removeEventListener("paste", handlePaste);
  }, [handlePaste]);

  const removeImage = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
    setResult("");
    setStatus("idle");
  };

  const handleExtract = async () => {
    if (images.length === 0) return;
    setStatus("loading");
    setError("");
    setResult("");

    try {
      const res = await fetch("/api/extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: images.map((img) => ({ base64: img.base64, mimeType: img.mimeType })),
          fields,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "エラーが発生しました");
      setResult(data.result);
      setStatus("success");
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
      setStatus("error");
    }
  };

  const handleCopy = async () => {
    if (!result) return;
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleReset = () => {
    setImages([]);
    setResult("");
    setStatus("idle");
    setError("");
  };

  return (
    <main className="min-h-dvh flex flex-col items-center px-4 pb-8 pt-6">
      {/* Header */}
      <header className="w-full max-w-lg mb-8 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <svg width="28" height="28" viewBox="0 0 512 512" className="flex-shrink-0">
            <rect width="512" height="512" rx="100" fill="#1a1a1a" />
            <path d="M 155 100 L 155 400 L 370 400 L 370 330 L 228 330 L 228 100 Z" fill="#f97316" />
          </svg>
          <h1 className="text-xl font-bold tracking-tight text-white">Lootly</h1>
        </div>
        <p className="text-xs text-[#888] hidden sm:block">写真からメモを自動抽出</p>
      </header>

      <div className="w-full max-w-lg flex flex-col gap-4">
        {/* Upload Area */}
        <div
          className={`relative rounded-2xl border-2 border-dashed transition-all
            ${isDragging
              ? "border-orange-500 bg-orange-500/10"
              : images.length > 0
              ? "border-[#2a2a2a] bg-[#111111]"
              : "border-[#2a2a2a] bg-[#111111] hover:border-orange-500/60 hover:bg-[#1a1a1a] cursor-pointer"
            }`}
          onClick={() => images.length === 0 && fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
        >
          {images.length > 0 ? (
            <div className="p-3">
              {/* Thumbnail grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', marginBottom: '12px' }}>
                {images.map((img) => (
                  <div key={img.id} style={{ position: 'relative', aspectRatio: '1/1' }} className="rounded-xl overflow-hidden bg-[#1a1a1a]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={img.preview}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                    <button
                      onClick={(e) => { e.stopPropagation(); removeImage(img.id); }}
                      className="absolute top-1 right-1 w-6 h-6 rounded-full bg-black/70 flex items-center justify-center hover:bg-black text-white text-xs leading-none"
                      aria-label="削除"
                    >
                      ✕
                    </button>
                  </div>
                ))}
                {/* Add more button */}
                <button
                  onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                  style={{ aspectRatio: '1/1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px' }}
                  className="rounded-xl border-2 border-dashed border-[#333] hover:border-orange-500/60 hover:bg-[#1a1a1a] transition-all"
                >
                  <span className="text-orange-500 text-xl leading-none">+</span>
                  <span className="text-[#666] text-xs">追加</span>
                </button>
              </div>
              {/* Actions row */}
              <div className="flex items-center justify-between px-1">
                <span className="text-xs text-[#666]">{images.length}枚選択中</span>
                <button
                  onClick={(e) => { e.stopPropagation(); handleReset(); }}
                  className="text-xs text-[#666] hover:text-red-400 transition-colors"
                >
                  すべて削除
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
              <div className="w-16 h-16 rounded-2xl bg-[#1a1a1a] flex items-center justify-center mb-3">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#f97316" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="3" width="18" height="18" rx="3" />
                  <circle cx="8.5" cy="8.5" r="1.5" />
                  <path d="m21 15-5-5L5 21" />
                </svg>
              </div>
              <p className="text-white font-medium text-sm mb-1">タップして画像を選択</p>
              <p className="text-[#666] text-xs">複数枚・ドラッグ＆ドロップ・ペーストも可</p>
            </div>
          )}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />

        {/* Fields Input */}
        <div>
          <label className="block text-xs text-[#888] mb-1.5 ml-1">抽出したい項目（任意）</label>
          <input
            type="text"
            value={fields}
            onChange={(e) => setFields(e.target.value)}
            placeholder="例：商品名、店舗名、金額"
            className="w-full rounded-xl bg-[#111111] border border-[#2a2a2a] text-white placeholder-[#555] px-4 py-3 text-sm focus:outline-none focus:border-orange-500/60 focus:bg-[#1a1a1a]"
          />
          <p className="text-[#555] text-xs mt-1.5 ml-1">空欄にするとAIが自動判断します</p>
        </div>

        {/* Extract Button */}
        <button
          onClick={handleExtract}
          disabled={images.length === 0 || status === "loading"}
          className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all
            ${images.length === 0 || status === "loading"
              ? "bg-[#2a2a2a] text-[#555] cursor-not-allowed"
              : "bg-orange-500 hover:bg-orange-600 active:scale-95 text-white shadow-lg shadow-orange-500/20"
            }`}
        >
          {status === "loading" ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              抽出中...
            </span>
          ) : (
            `抽出する${images.length > 1 ? `（${images.length}枚）` : ""}`
          )}
        </button>

        {/* Error */}
        {status === "error" && (
          <div className="rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3">
            <p className="text-red-400 text-sm">{error}</p>
          </div>
        )}

        {/* Results */}
        {status === "success" && result && (
          <div className="rounded-2xl bg-[#111111] border border-[#2a2a2a] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-[#2a2a2a]">
              <span className="text-xs font-medium text-[#888]">抽出結果</span>
              <button
                onClick={handleCopy}
                className={`flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg transition-all
                  ${copied
                    ? "bg-green-500/20 text-green-400"
                    : "bg-[#2a2a2a] text-[#aaa] hover:bg-orange-500/20 hover:text-orange-400"
                  }`}
              >
                {copied ? (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M20 6 9 17l-5-5" />
                    </svg>
                    コピー済み
                  </>
                ) : (
                  <>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    コピー
                  </>
                )}
              </button>
            </div>
            <div className="px-4 py-4">
              <pre className="text-sm text-[#e0e0e0] whitespace-pre-wrap leading-relaxed font-sans">
                {result}
              </pre>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
