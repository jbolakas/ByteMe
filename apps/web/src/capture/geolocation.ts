export interface FixResult {
  lat: number | null;
  lon: number | null;
  accuracy_m: number | null;
}

export function getFix(timeoutMs = 8_000): Promise<FixResult> {
  return new Promise((resolve) => {
    if (!("geolocation" in navigator)) {
      resolve({ lat: null, lon: null, accuracy_m: null });
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy_m: pos.coords.accuracy,
        }),
      () => resolve({ lat: null, lon: null, accuracy_m: null }),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 30_000 }
    );
  });
}
