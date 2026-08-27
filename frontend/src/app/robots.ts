import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/workspace", "/history", "/home", "/dashboard", "/projects", "/credits", "/billing", "/settings", "/admin", "/tools"],
    },
    sitemap: "https://photopol.us/sitemap.xml",
  };
}
