export type DeviceMode = {
    isLimitedDevice: boolean;
    maxPoints: number;
    reason: string;
    memory: number;
    cores: number;
    isSmallScreen: boolean;
    isTouchDevice: boolean;
  };
  
  export function getDeviceMode(): DeviceMode {
    if (typeof window === "undefined" || typeof navigator === "undefined") {
      return {
        isLimitedDevice: false,
        maxPoints: Infinity,
        reason: "",
        memory: 8,
        cores: 8,
        isSmallScreen: false,
        isTouchDevice: false,
      };
    }
  
    const width = window.innerWidth;
    const isSmallScreen = width < 768;
  
    const nav = navigator as Navigator & {
      deviceMemory?: number;
      hardwareConcurrency?: number;
    };
  
    const memory = nav.deviceMemory ?? 4;
    const cores = nav.hardwareConcurrency ?? 4;
  
    const isTouchDevice =
      "ontouchstart" in window || navigator.maxTouchPoints > 0;
  
    const prefersReducedMotion = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
  
    const isLimitedDevice =
      isSmallScreen ||
      isTouchDevice ||
      memory <= 4 ||
      cores <= 4 ||
      prefersReducedMotion;
  
    if (isLimitedDevice) {
      return {
        isLimitedDevice: true,
        maxPoints: 1000,
        reason:
          "This device may not smoothly render the full dataset, so the map is showing a lighter version.",
        memory,
        cores,
        isSmallScreen,
        isTouchDevice,
      };
    }
  
    return {
      isLimitedDevice: false,
      maxPoints: Infinity,
      reason: "",
      memory,
      cores,
      isSmallScreen,
      isTouchDevice,
    };
  }
  
  type MaybeGenderPoint = {
    gender_label?: string;
    genderLabel?: string;
  };
  
  function pointGender(point: MaybeGenderPoint): string {
    return (point.genderLabel ?? point.gender_label ?? "").toLowerCase().trim();
  }
  
  export function limitPointsForDevice<T extends MaybeGenderPoint>(
    points: T[],
    maxPoints: number
  ): T[] {
    if (!Number.isFinite(maxPoints)) return points;
    if (points.length <= maxPoints) return points;
  
    const women = points.filter((p) => pointGender(p) === "woman");
    const men = points.filter((p) => pointGender(p) === "man");
    const other = points.filter((p) => {
      const g = pointGender(p);
      return g !== "woman" && g !== "man";
    });
  
    const half = Math.floor(maxPoints / 2);
  
    const sampledWomen = evenSample(women, half);
    const sampledMen = evenSample(men, half);
  
    const remaining = maxPoints - sampledWomen.length - sampledMen.length;
    const sampledOther = evenSample(other, remaining);
  
    return [...sampledWomen, ...sampledMen, ...sampledOther];
  }
  
  function evenSample<T>(items: T[], n: number): T[] {
    if (n <= 0) return [];
    if (items.length <= n) return items;
  
    const result: T[] = [];
  
    for (let i = 0; i < n; i += 1) {
      const index = Math.floor((i * items.length) / n);
      result.push(items[index]);
    }
  
    return result;
  }