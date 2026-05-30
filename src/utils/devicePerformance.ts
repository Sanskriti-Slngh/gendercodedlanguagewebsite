export type DeviceMode = {
  isLimitedDevice: boolean;
  maxPoints: number;
  reason: string;
  memory: number | null;
  cores: number | null;
  isSmallScreen: boolean;
  isTouchDevice: boolean;
};

const LIMITED_MAX_POINTS = 1000;
const LIMITED_REASON =
  "This device may not smoothly render the full dataset, so the map is showing a lighter version.";

export function getDeviceMode(): DeviceMode {
  if (typeof window === "undefined" || typeof navigator === "undefined") {
    return createDeviceMode({
      isLimitedDevice: false,
      maxPoints: Infinity,
      reason: "",
      memory: null,
      cores: null,
      isSmallScreen: false,
      isTouchDevice: false,
    });
  }

  const signals = getDeviceSignals();

  if (signals.prefersReducedMotion) {
    return createLimitedDeviceMode(
      signals,
      "Reduced motion is enabled, so the map is showing a lighter version."
    );
  }

  // Phones and tablets cannot load or render the full ~80k point dataset in
  // mobile Safari without crashing the tab. Limit them up front — do not rely
  // on the WebGL benchmark here (it uses too few points to predict memory use).
  if (isMobileLikeDevice(signals)) {
    return createLimitedDeviceMode(
      signals,
      "Mobile devices use a lighter version of the map to keep the page stable."
    );
  }

  if (signals.memory !== null && signals.memory <= 2) {
    return createLimitedDeviceMode(signals, LIMITED_REASON);
  }

  if (signals.cores !== null && signals.cores <= 2) {
    return createLimitedDeviceMode(signals, LIMITED_REASON);
  }

  if (!canRenderFullPointCloud()) {
    return createLimitedDeviceMode(signals, LIMITED_REASON);
  }

  return createDeviceMode({
    isLimitedDevice: false,
    maxPoints: Infinity,
    reason: "",
    memory: signals.memory,
    cores: signals.cores,
    isSmallScreen: signals.isSmallScreen,
    isTouchDevice: signals.isTouchDevice,
  });
}

type DeviceSignals = {
  memory: number | null;
  cores: number | null;
  isSmallScreen: boolean;
  isTouchDevice: boolean;
  prefersReducedMotion: boolean;
};

function getDeviceSignals(): DeviceSignals {
  const width = window.innerWidth;
  const nav = navigator as Navigator & {
    deviceMemory?: number;
    hardwareConcurrency?: number;
    userAgentData?: { mobile?: boolean };
  };

  return {
    memory:
      typeof nav.deviceMemory === "number" ? nav.deviceMemory : null,
    cores:
      typeof nav.hardwareConcurrency === "number"
        ? nav.hardwareConcurrency
        : null,
    isSmallScreen: width < 768,
    isTouchDevice:
      "ontouchstart" in window || navigator.maxTouchPoints > 0,
    prefersReducedMotion: window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches,
  };
}

function isMobileLikeDevice(signals: DeviceSignals): boolean {
  if (typeof navigator === "undefined") return false;

  const nav = navigator as Navigator & { userAgentData?: { mobile?: boolean } };
  if (nav.userAgentData?.mobile === true) return true;

  const ua = navigator.userAgent;

  if (/iPhone|iPod|Android.*Mobile|Windows Phone/i.test(ua)) return true;

  // iPad and iPadOS "desktop" mode (reports MacIntel + touch).
  if (/iPad/i.test(ua)) return true;
  if (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) {
    return true;
  }

  // Touch-primary device with a phone-sized screen (not a touch laptop).
  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  if (signals.isSmallScreen && coarsePointer) return true;

  return false;
}

function createLimitedDeviceMode(
  signals: DeviceSignals,
  reason: string
): DeviceMode {
  return createDeviceMode({
    isLimitedDevice: true,
    maxPoints: LIMITED_MAX_POINTS,
    reason,
    memory: signals.memory,
    cores: signals.cores,
    isSmallScreen: signals.isSmallScreen,
    isTouchDevice: signals.isTouchDevice,
  });
}

function createDeviceMode(mode: DeviceMode): DeviceMode {
  return mode;
}

const BENCHMARK_POINT_COUNT = 8000;
const BENCHMARK_FRAMES = 4;
const BENCHMARK_MAX_AVG_FRAME_MS = 33;

function getWebGlContext(canvas: HTMLCanvasElement): WebGLRenderingContext | null {
  const contextOptions: WebGLContextAttributes = {
    antialias: false,
    depth: true,
    powerPreference: "high-performance",
  };

  const webgl = canvas.getContext("webgl", contextOptions);
  if (webgl) return webgl;

  return canvas.getContext(
    "experimental-webgl",
    contextOptions
  ) as WebGLRenderingContext | null;
}

function canRenderFullPointCloud(): boolean {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;

    const gl = getWebGlContext(canvas);
    if (!gl) return false;

    const positions = new Float32Array(BENCHMARK_POINT_COUNT * 3);
    for (let i = 0; i < positions.length; i += 1) {
      positions[i] = Math.random() * 2 - 1;
    }

    const buffer = gl.createBuffer();
    if (!buffer) return false;

    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.STATIC_DRAW);

    const program = createShaderProgram(
      gl,
      `
        attribute vec3 position;
        uniform float pointSize;
        void main() {
          gl_Position = vec4(position.xy, position.z * 0.5 + 0.5, 1.0);
          gl_PointSize = pointSize;
        }
      `,
      `
        precision mediump float;
        void main() {
          gl_FragColor = vec4(0.55, 0.55, 0.55, 1.0);
        }
      `
    );

    if (!program) {
      gl.deleteBuffer(buffer);
      return false;
    }

    gl.useProgram(program);

    const positionLocation = gl.getAttribLocation(program, "position");
    gl.enableVertexAttribArray(positionLocation);
    gl.vertexAttribPointer(positionLocation, 3, gl.FLOAT, false, 0, 0);

    const pointSizeLocation = gl.getUniformLocation(program, "pointSize");
    gl.uniform1f(pointSizeLocation, 4.0);
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    for (let i = 0; i < 2; i += 1) {
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clearColor(0.95, 0.97, 1.0, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.drawArrays(gl.POINTS, 0, BENCHMARK_POINT_COUNT);
      gl.finish();
    }

    const start = performance.now();
    for (let i = 0; i < BENCHMARK_FRAMES; i += 1) {
      gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.drawArrays(gl.POINTS, 0, BENCHMARK_POINT_COUNT);
      gl.finish();
    }
    const avgFrameMs = (performance.now() - start) / BENCHMARK_FRAMES;

    gl.deleteBuffer(buffer);
    gl.deleteProgram(program);
    releaseWebGlContext(gl);

    return avgFrameMs <= BENCHMARK_MAX_AVG_FRAME_MS;
  } catch {
    return false;
  }
}

function createShaderProgram(
  gl: WebGLRenderingContext,
  vertexSource: string,
  fragmentSource: string
): WebGLProgram | null {
  const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
  if (!vertexShader || !fragmentShader) return null;

  const program = gl.createProgram();
  if (!program) return null;

  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.linkProgram(program);

  gl.deleteShader(vertexShader);
  gl.deleteShader(fragmentShader);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    gl.deleteProgram(program);
    return null;
  }

  return program;
}

function compileShader(
  gl: WebGLRenderingContext,
  type: number,
  source: string
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }

  return shader;
}

function releaseWebGlContext(gl: WebGLRenderingContext) {
  const loseContext = gl.getExtension("WEBGL_lose_context");
  loseContext?.loseContext();
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
