import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Shower Tracker",
    short_name: "Shower",
    description: "One shower at a time. Hot water coordination for the household.",
    start_url: "/",
    display: "standalone",
    background_color: "#F5F0E8",
    theme_color: "#F5F0E8",
    icons: [
      {
        src: "/icon",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
