export type GeocodingResult = {
  latitude: number;
  longitude: number;
  formattedAddress?: string;
};

export async function geocodeAddress(input: {
  address?: string | null;
  city?: string | null;
  postalCode?: string | null;
  region?: string | null;
  country?: string | null;
}): Promise<GeocodingResult | null> {
  const providerUrl = process.env.GEOCODING_URL;
  const apiKey = process.env.GEOCODING_API_KEY;
  if (!providerUrl || !apiKey) return null;

  const query = [input.address, input.postalCode, input.city, input.region, input.country]
    .filter(Boolean).join(", ");

  const url = new URL(providerUrl);
  url.searchParams.set("q", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", "1");

  const response = await fetch(url, {
    headers: { "User-Agent": "Hestiat/1.0 contact@hestiat.com" },
    cache: "no-store",
  });
  if (!response.ok) return null;

  const data = await response.json();
  const first = Array.isArray(data) ? data[0] : data?.results?.[0];
  if (!first) return null;

  const latitude = Number(first.lat ?? first.latitude);
  const longitude = Number(first.lon ?? first.lng ?? first.longitude);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  return { latitude, longitude, formattedAddress: first.display_name ?? first.formattedAddress };
}
