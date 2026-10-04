import type { ScrollScrubScene, ScrollScrubTheme } from "@/components/scroll-scrub/scroll-scrub";

export const scrollScrubTheme: ScrollScrubTheme = { accent: "#2854D9", background: "#17263D", ink: "#FFFFFF", muted: "#D8DEE8" };

export const scrollScrubScenes: ScrollScrubScene[] = [{
  body: "Encuentra un lugar para dormir y todo lo que merece la pena vivir alrededor.",
  clip: "/assets/world/hestiat-hero.mp4",
  id: "hero",
  kicker: "El atlas vivo",
  label: "Descubre",
  mobileClip: "/assets/world/hestiat-hero-mobile.mp4",
  mobilePoster: "/assets/world/hestiat-hero-mobile-poster.png",
  poster: "/assets/world/hestiat-hero-poster.png",
  tags: ["Alojamientos", "Experiencias", "Servicios"],
  title: "Tu viaje empieza aquí.",
}];
