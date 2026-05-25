"use client";

import { useState } from "react";

type ImageWithFallbackProps = {
  src?: string | null;
  alt: string;
  className: string;
  placeholderClassName: string;
  label?: string;
};

export function ImageWithFallback({ alt, className, label = "無圖片", placeholderClassName, src }: ImageWithFallbackProps) {
  const [failed, setFailed] = useState(false);
  const cleanSrc = typeof src === "string" ? src.trim() : "";

  if (!cleanSrc || failed) {
    return (
      <div className={placeholderClassName}>
        {label}
      </div>
    );
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={cleanSrc} alt={alt} className={className} onError={() => setFailed(true)} />;
}
