import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Easy Planner Lite",
    short_name: "EasyPlan",
    description: "광고 없는 개인용 근무패턴 플래너",
    start_url: "/",
    display: "standalone",
    background_color: "#dce8c7",
    theme_color: "#4c6e3b",
    lang: "ko",
    icons: [
      {
        src: "/favicon.ico",
        sizes: "48x48",
        type: "image/x-icon",
      },
    ],
  };
}
