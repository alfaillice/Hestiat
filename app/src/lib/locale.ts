import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";

export type Locale = "es" | "en" | "nl" | "fr" | "de" | "it" | "pt";

function normalizeLocale(value: string | null | undefined): Locale {
  const code = (value ?? "").toLowerCase().split(",")[0]?.split("-")[0]?.trim();
  return ["es", "en", "nl", "fr", "de", "it", "pt"].includes(code ?? "") ? code as Locale : "en";
}

export const getVisitorLocale = createServerFn({ method: "GET" }).handler(() => normalizeLocale(getRequestHeader("accept-language")));
