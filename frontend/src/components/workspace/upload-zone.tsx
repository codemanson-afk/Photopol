"use client";

import { useCallback, useRef, useState } from "react";

type Props = {
  onFile: (file: File) => void;
  busy?: boolean;
};

export function UploadZone({ onFile, busy }: Props) {
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  const accept = useCallback(
    (file: File | undefined | null) => {
      if (!file || busy) return;
      const name = (file.name || "").toLowerCase();
      const type = (file.type || "").toLowerCase();
      const okExt = /\.(jpe?g|png|webp)$/i.test(name);
      const okType =
        type.startsWith("image/") ||
        type === "" ||
        type === "application/octet-stream";
      if (!okType && !okExt) return;
      onFile(file);
    },
    [busy, onFile]
  );

  return (
    <div className="mx-auto w-full max-w-xl">
      <div
        className={`card flex flex-col items-center justify-center gap-4 border-dashed p-10 text-center md:p-14 ${
          dragging ? "border-[var(--accent)] bg-[var(--accent-soft)]" : ""
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          accept(e.dataTransfer.files?.[0]);
        }}
      >
        <h2 className="text-2xl font-bold">Upload an image</h2>
        <p className="max-w-sm text-[var(--muted)]">
          JPG, PNG, or WEBP — drag & drop or pick from your device.
        </p>
        <button
          type="button"
          className="btn btn-primary min-h-12 w-full max-w-xs"
          disabled={busy}
          onClick={() => galleryRef.current?.click()}
        >
          {busy ? "Uploading…" : "Upload Image"}
        </button>
        <div className="flex w-full max-w-xs gap-2">
          <button
            type="button"
            className="btn btn-ghost min-h-11 flex-1"
            disabled={busy}
            onClick={() => galleryRef.current?.click()}
          >
            From Photos
          </button>
          <button
            type="button"
            className="btn btn-ghost min-h-11 flex-1"
            disabled={busy}
            onClick={() => cameraRef.current?.click()}
          >
            Camera
          </button>
        </div>
      </div>
      <input
        ref={galleryRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/*"
        className="hidden"
        onChange={(e) => {
          accept(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          accept(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
