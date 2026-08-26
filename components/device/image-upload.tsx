"use client";

import * as React from "react";
import Image from "next/image";
import {
  Upload,
  Camera,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  ImageIcon,
  Maximize2,
  Smartphone,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface UploadedImage {
  url: string;
  publicId: string;
  width: number;
  height: number;
  label: string;
}

interface ImageUploadProps {
  deviceId: string;
  deviceBrand: string;
  deviceName: string;
  accent?: string;
  type?: "gallery" | "camera-sample";
  existingCount?: number;
  onUploadComplete?: (img: UploadedImage) => void;
  maxFiles?: number;
}

export function ImageUpload({
  deviceId,
  deviceBrand,
  deviceName,
  accent = "#8A2BE2",
  type = "gallery",
  existingCount = 0,
  onUploadComplete,
  maxFiles = 10,
}: ImageUploadProps) {
  const [isDragging, setIsDragging] = React.useState(false);
  const [queue, setQueue] = React.useState<
    Array<{
      file: File;
      preview: string;
      status: "pending" | "uploading" | "done" | "error";
      result?: UploadedImage;
      error?: string;
    }>
  >([]);
  const [label, setLabel] = React.useState("");
  const [showCamera, setShowCamera] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const canvasRef = React.useRef<HTMLCanvasElement>(null);
  const streamRef = React.useRef<MediaStream | null>(null);

  const remainingSlots = maxFiles - existingCount;

  const addFiles = (files: FileList | File[]) => {
    const arr = Array.from(files)
      .filter((f) => f.type.startsWith("image/"))
      .slice(0, remainingSlots - queue.length);
    setQueue((prev) => [
      ...prev,
      ...arr.map((file) => ({
        file,
        preview: URL.createObjectURL(file),
        status: "pending" as const,
      })),
    ]);
  };

  React.useEffect(() => {
    return () => {
      queue.forEach((item) => URL.revokeObjectURL(item.preview));
    };
  }, []);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };
  const handleDragLeave = () => setIsDragging(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    addFiles(e.dataTransfer.files);
  };

  const uploadSingle = async (index: number) => {
    setQueue((prev) =>
      prev.map((item, i) =>
        i === index ? { ...item, status: "uploading" } : item,
      ),
    );

    try {
      const item = queue[index];
      const formData = new FormData();
      formData.append("file", item.file);
      formData.append("deviceId", deviceId);
      formData.append("type", type);

      const res = await fetch("/api/upload", { method: "POST", body: formData });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || "Upload failed");

      const result: UploadedImage = {
        url: data.url,
        publicId: data.publicId,
        width: data.width,
        height: data.height,
        label: label || `${deviceBrand} ${deviceName} — ${type}`,
      };

      const saveRes = await fetch(`/api/device/${deviceId}/images`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: data.url, type }),
      });

      if (!saveRes.ok) {
        console.warn("[ImageUpload] Saved to Cloudinary but Firestore save failed");
      }

      setQueue((prev) =>
        prev.map((item, i) =>
          i === index ? { ...item, status: "done", result } : item,
        ),
      );

      onUploadComplete?.(result);
    } catch (err: any) {
      setQueue((prev) =>
        prev.map((item, i) =>
          i === index ? { ...item, status: "error", error: err.message } : item,
        ),
      );
    }
  };

  const uploadAll = async () => {
    for (let i = 0; i < queue.length; i++) {
      if (queue[i].status === "pending") {
        await uploadSingle(i);
      }
    }
  };

  const removeFromQueue = (index: number) => {
    setQueue((prev) => {
      URL.revokeObjectURL(prev[index].preview);
      return prev.filter((_, i) => i !== index);
    });
  };

  const startCamera = async () => {
    setShowCamera(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment", width: { ideal: 4096 }, height: { ideal: 4096 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch {
      setShowCamera(false);
    }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(video, 0, 0);

    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `camera-${Date.now()}.jpg`, {
          type: "image/jpeg",
          lastModified: Date.now(),
        });
        addFiles([file]);
        stopCamera();
      },
      "image/jpeg",
      0.95,
    );
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setShowCamera(false);
  };

  const pendingCount = queue.filter((q) => q.status === "pending").length;
  const uploadingCount = queue.filter((q) => q.status === "uploading").length;

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "relative flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed p-6 text-center transition-all",
          isDragging
            ? "border-neon-cyan bg-neon-cyan/5 scale-[1.01]"
            : "border-border hover:border-ring/50 hover:bg-card/30",
          queue.length >= remainingSlots && "pointer-events-none opacity-50",
        )}
        style={isDragging ? { borderColor: accent } : undefined}
      >
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          capture="environment"
          className="hidden"
          onChange={(e) => {
            if (e.target.files) addFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <div
          className="flex h-14 w-14 items-center justify-center rounded-full"
          style={{ background: `${accent}18` }}
        >
          <Upload className="h-6 w-6" style={{ color: accent }} />
        </div>
        <div>
          <p className="text-sm font-medium">
            Drop photos or tap to browse
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            JPG, PNG, WebP — max 20 MB each
            {type === "camera-sample" && (
              <span className="block mt-0.5">Best quality for detailed camera comparisons</span>
            )}
          </p>
        </div>
        <div className="flex gap-2 mt-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              inputRef.current?.click();
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-card/60"
          >
            <ImageIcon className="h-3.5 w-3.5" /> Gallery
          </button>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              startCamera();
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium hover:bg-card/60"
          >
            <Camera className="h-3.5 w-3.5" /> Camera
          </button>
        </div>
        {remainingSlots > 0 && (
          <p className="text-[10px] text-muted-foreground">
            {remainingSlots} slot{remainingSlots !== 1 ? "s" : ""} remaining
          </p>
        )}
      </div>

      {/* Camera viewfinder */}
      {showCamera && (
        <div className="relative overflow-hidden rounded-2xl border border-border bg-black">
          <video
            ref={videoRef}
            autoPlay
            playsInline
            muted
            className="w-full rounded-2xl"
          />
          <canvas ref={canvasRef} className="hidden" />
          <div className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-4 p-4">
            <button
              type="button"
              onClick={stopCamera}
              className="flex h-10 w-10 items-center justify-center rounded-full bg-background/80 backdrop-blur"
            >
              <X className="h-5 w-5" />
            </button>
            <button
              type="button"
              onClick={capturePhoto}
              className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-white/20 backdrop-blur transition-transform hover:scale-105 active:scale-95"
            >
              <div className="h-12 w-12 rounded-full bg-white" />
            </button>
            <div className="w-10" />
          </div>
        </div>
      )}

      {/* Label input */}
      {queue.length > 0 && (
        <input
          type="text"
          placeholder={`Optional label (e.g. "Daylight — zoom 2x")`}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          className="w-full rounded-xl border border-border bg-card/30 px-3 py-2 text-sm placeholder:text-muted-foreground focus:border-ring/50 focus:outline-none"
        />
      )}

      {/* Queue preview */}
      {queue.length > 0 && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {queue.map((item, i) => (
              <div
                key={`${item.file.name}-${i}`}
                className="group relative overflow-hidden rounded-xl border border-border bg-card/30"
              >
                <div className="relative aspect-square">
                  <Image
                    src={item.preview}
                    alt={item.file.name}
                    fill
                    sizes="(max-width: 640px) 50vw, 200px"
                    className="object-cover"
                  />
                  {item.status === "uploading" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm">
                      <Loader2 className="h-6 w-6 animate-spin" style={{ color: accent }} />
                    </div>
                  )}
                  {item.status === "done" && (
                    <div className="absolute inset-0 flex items-center justify-center bg-background/40">
                      <CheckCircle2 className="h-8 w-8 text-green-500" />
                    </div>
                  )}
                  {item.status === "error" && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-background/60 p-2 backdrop-blur-sm">
                      <AlertCircle className="h-6 w-6 text-red-500" />
                      <span className="text-[10px] text-red-400 text-center">{item.error}</span>
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => removeFromQueue(i)}
                  className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-background/80 opacity-0 backdrop-blur transition-opacity group-hover:opacity-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                <div className="flex items-center gap-1 px-2 py-1.5">
                  <Smartphone className="h-3 w-3 text-muted-foreground" />
                  <span className="truncate text-[10px] text-muted-foreground">
                    {item.file.name}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={uploadAll}
              disabled={pendingCount === 0 || uploadingCount > 0}
              className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-medium text-white transition-all disabled:opacity-50"
              style={{ background: accent }}
            >
              {uploadingCount > 0 ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" /> Uploading {uploadingCount}...
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" /> Upload {pendingCount} photo{pendingCount !== 1 ? "s" : ""}
                </>
              )}
            </button>
            <button
              type="button"
              onClick={() => {
                queue.forEach((q) => URL.revokeObjectURL(q.preview));
                setQueue([]);
              }}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Clear all
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
