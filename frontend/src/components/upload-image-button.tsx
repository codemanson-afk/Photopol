"use client";

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { setPendingUpload } from "@/lib/pending-upload";

type Props = {
  className?: string;
  children?: React.ReactNode;
};

export function UploadImageButton({ className = "btn btn-primary", children = "Upload Image" }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  return (
    <>
      <button type="button" className={className} onClick={() => inputRef.current?.click()}>
        {children}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = "";
          if (!file) return;
          setPendingUpload(file);
          router.push("/workspace");
        }}
      />
    </>
  );
}
