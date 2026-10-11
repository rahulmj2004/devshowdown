import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Color,
  EdgesGeometry,
  Group,
  IcosahedronGeometry,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  TorusGeometry,
  WebGLRenderer,
} from "three";

export interface HeroSceneOptions {
  reduceMotion: boolean;
  /** Fewer particles and a lower pixel ratio for small or weak devices. */
  lite: boolean;
  onFirstFrame: () => void;
  onContextLost: () => void;
}

const VIOLET = new Color("#a98bff");
const LIME = new Color("#c8ff2e");
const CYAN = new Color("#7fe9ff");

/**
 * Round, soft-edged points drawn in the fragment shader. `size` is in world
 * units and shrinks with distance; `uScale` is half the drawing-buffer height,
 * which converts that to pixels.
 */
function glowPoints(color: Color, size: number, opacity: number) {
  return new ShaderMaterial({
    uniforms: {
      uColor: { value: color },
      uSize: { value: size },
      uOpacity: { value: opacity },
      uScale: { value: 400 },
    },
    vertexShader: /* glsl */ `
      uniform float uSize;
      uniform float uScale;
      void main() {
        vec4 viewPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = uSize * uScale / -viewPosition.z;
        gl_Position = projectionMatrix * viewPosition;
      }
    `,
    fragmentShader: /* glsl */ `
      uniform vec3 uColor;
      uniform float uOpacity;
      void main() {
        float falloff = smoothstep(0.5, 0.0, length(gl_PointCoord - 0.5));
        gl_FragColor = vec4(uColor, falloff * falloff * uOpacity);
      }
    `,
    transparent: true,
    blending: AdditiveBlending,
    depthWrite: false,
  });
}

/** Deterministic pseudo-random numbers, so the field looks the same each load. */
function seeded(seed: number) {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

/**
 * The hero's luminous core: a wireframe icosahedron around a dark faceted
 * heart, two orbit rings and a slow particle shell. It leans toward the
 * pointer, sinks as the page scrolls, and stops rendering whenever it is off
 * screen or the tab is hidden. Returns a function that releases everything.
 */
export function mountHeroScene(
  canvas: HTMLCanvasElement,
  options: HeroSceneOptions,
): () => void {
  const renderer = new WebGLRenderer({
    canvas,
    alpha: true,
    antialias: !options.lite,
    powerPreference: "high-performance",
  });
  renderer.setClearColor(0x000000, 0);
  const pixelRatio = Math.min(
    window.devicePixelRatio,
    options.lite ? 1.25 : 1.75,
  );
  renderer.setPixelRatio(pixelRatio);

  const scene = new Scene();
  const camera = new PerspectiveCamera(38, 1, 0.1, 50);
  camera.position.z = 8.4;

  const disposables: { dispose: () => void }[] = [];
  const track = <T extends { dispose: () => void }>(item: T): T => {
    disposables.push(item);
    return item;
  };

  const core = new Group();
  scene.add(core);

  // Outer cage.
  const cageGeometry = track(new IcosahedronGeometry(1.9, 1));
  const cageEdges = track(new EdgesGeometry(cageGeometry));
  const cage = new LineSegments(
    cageEdges,
    track(
      new LineBasicMaterial({
        color: VIOLET,
        transparent: true,
        opacity: 0.7,
        blending: AdditiveBlending,
        depthWrite: false,
      }),
    ),
  );
  core.add(cage);

  // Glowing nodes on the cage's vertices.
  const nodeMaterial = track(glowPoints(LIME, 0.36, 1));
  const nodes = new Points(cageGeometry, nodeMaterial);
  core.add(nodes);

  // Dark faceted heart with lime seams.
  const heartGeometry = track(new IcosahedronGeometry(1.02, 0));
  const heart = new Mesh(
    heartGeometry,
    track(new MeshBasicMaterial({ color: 0x08080b })),
  );
  const heartSeams = new LineSegments(
    track(new EdgesGeometry(heartGeometry)),
    track(
      new LineBasicMaterial({
        color: LIME,
        transparent: true,
        opacity: 0.85,
      }),
    ),
  );
  const heartGroup = new Group();
  heartGroup.add(heart, heartSeams);
  core.add(heartGroup);

  // Orbit rings.
  const ringMaterial = track(
    new MeshBasicMaterial({
      color: CYAN,
      transparent: true,
      opacity: 0.5,
      blending: AdditiveBlending,
      depthWrite: false,
    }),
  );
  const ringA = new Mesh(
    track(new TorusGeometry(2.75, 0.006, 6, 180)),
    ringMaterial,
  );
  ringA.rotation.set(1.25, 0.2, 0);
  const ringB = new Mesh(
    track(new TorusGeometry(3.25, 0.004, 6, 200)),
    ringMaterial,
  );
  ringB.rotation.set(1.05, -0.55, 0.4);
  scene.add(ringA, ringB);

  // Particle shell.
  const count = options.lite ? 260 : 620;
  const random = seeded(7);
  const positions = new Float32Array(count * 3);
  for (let index = 0; index < count; index++) {
    const radius = 3.4 + random() * 4.2;
    const theta = random() * Math.PI * 2;
    const phi = Math.acos(2 * random() - 1);
    positions[index * 3] = radius * Math.sin(phi) * Math.cos(theta);
    positions[index * 3 + 1] = radius * Math.sin(phi) * Math.sin(theta) * 0.7;
    positions[index * 3 + 2] = radius * Math.cos(phi) - 1.5;
  }
  const dustGeometry = track(new BufferGeometry());
  dustGeometry.setAttribute("position", new BufferAttribute(positions, 3));
  const dustMaterial = track(glowPoints(new Color("#dfe6ff"), 0.11, 0.7));
  const dust = new Points(dustGeometry, dustMaterial);
  scene.add(dust);

  // ---------------------------------------------------------------- state
  const pointer = { x: 0, y: 0 };
  const eased = { x: 0, y: 0 };
  let scroll = 0;
  let visible = true;
  let frame = 0;
  let firstFrame = true;
  let disposed = false;
  const startedAt = performance.now();

  const resize = () => {
    const { clientWidth, clientHeight } = canvas;
    if (clientWidth === 0 || clientHeight === 0) return;
    renderer.setSize(clientWidth, clientHeight, false);
    camera.aspect = clientWidth / clientHeight;
    // Pull back on narrow canvases so the rings are not cropped.
    camera.position.z = camera.aspect < 0.9 ? 10.5 : 8.4;
    camera.updateProjectionMatrix();
    const pointScale = (clientHeight * pixelRatio) / 2;
    nodeMaterial.uniforms.uScale.value = pointScale;
    dustMaterial.uniforms.uScale.value = pointScale;
  };

  const render = () => {
    const time = (performance.now() - startedAt) / 1000;
    eased.x += (pointer.x - eased.x) * 0.045;
    eased.y += (pointer.y - eased.y) * 0.045;

    core.rotation.y = time * 0.16 + eased.x * 0.55;
    core.rotation.x = Math.sin(time * 0.22) * 0.18 + eased.y * 0.4;
    heartGroup.rotation.y = -time * 0.42;
    heartGroup.rotation.z = time * 0.2;
    const pulse = 1 + Math.sin(time * 1.3) * 0.025;
    cage.scale.setScalar(pulse);
    nodes.scale.setScalar(pulse);

    ringA.rotation.z = time * 0.12;
    ringB.rotation.z = -time * 0.085;
    dust.rotation.y = time * 0.018 + eased.x * 0.08;
    dust.rotation.x = eased.y * 0.05;

    // Layered parallax: the core drifts with the pointer and sinks on scroll.
    scene.position.x = eased.x * 0.28;
    scene.position.y = -eased.y * 0.2 + scroll * 1.6;
    scene.rotation.z = scroll * 0.25;

    renderer.render(scene, camera);
    if (firstFrame) {
      firstFrame = false;
      options.onFirstFrame();
    }
  };

  const loop = () => {
    if (disposed || !visible) return;
    render();
    frame = requestAnimationFrame(loop);
  };
  const start = () => {
    cancelAnimationFrame(frame);
    if (options.reduceMotion) {
      render();
      return;
    }
    frame = requestAnimationFrame(loop);
  };

  // ------------------------------------------------------------ listeners
  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    pointer.x = (event.clientX / window.innerWidth) * 2 - 1;
    pointer.y = (event.clientY / window.innerHeight) * 2 - 1;
  };
  const onScroll = () => {
    scroll = Math.min(window.scrollY / Math.max(window.innerHeight, 1), 1.5);
  };
  const onVisibility = () => {
    const wasVisible = visible;
    visible = inView && document.visibilityState === "visible";
    if (visible && !wasVisible) start();
  };
  const onContextLost = (event: Event) => {
    event.preventDefault();
    cancelAnimationFrame(frame);
    options.onContextLost();
  };

  let inView = true;
  const intersection = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    onVisibility();
  });
  intersection.observe(canvas);
  const resizeObserver = new ResizeObserver(() => {
    resize();
    if (options.reduceMotion) render();
  });
  resizeObserver.observe(canvas);

  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("scroll", onScroll, { passive: true });
  document.addEventListener("visibilitychange", onVisibility);
  canvas.addEventListener("webglcontextlost", onContextLost);

  resize();
  onScroll();
  start();

  return () => {
    disposed = true;
    cancelAnimationFrame(frame);
    intersection.disconnect();
    resizeObserver.disconnect();
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("scroll", onScroll);
    document.removeEventListener("visibilitychange", onVisibility);
    canvas.removeEventListener("webglcontextlost", onContextLost);
    for (const item of disposables) item.dispose();
    renderer.dispose();
  };
}
