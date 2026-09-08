export type HostDraft = { id?: string; type?: string };

const KEY = "hestiat_host_draft";

export function getHostDraft(): HostDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export function setHostDraft(draft: HostDraft) {
  if (typeof window !== "undefined") localStorage.setItem(KEY, JSON.stringify(draft));
}

export function clearHostDraft() {
  if (typeof window !== "undefined") localStorage.removeItem(KEY);
}

export async function saveListingStep(data: Record<string, unknown>) {
  const draft = getHostDraft();
  if (!draft?.id) throw new Error("No existe un borrador activo.");
  const res = await fetch(`/api/anfitrion/alojamientos/${draft.id}/onboarding`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("No se pudo guardar.");
  return res.json();
}
