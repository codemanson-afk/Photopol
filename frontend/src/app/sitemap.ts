import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = "https://photopol.us";
  return [
    { url: base, lastModified: new Date() },
    { url: `${base}/ai-background-remover`, lastModified: new Date() },
    { url: `${base}/background-remover`, lastModified: new Date() },
    { url: `${base}/image-resizer`, lastModified: new Date() },
    { url: `${base}/object-remover`, lastModified: new Date() },
    { url: `${base}/image-upscaler`, lastModified: new Date() },
    { url: `${base}/product-photo-editor`, lastModified: new Date() },
    { url: `${base}/login`, lastModified: new Date() },
    { url: `${base}/register`, lastModified: new Date() },
  ];
}
