const TAU = Math.PI * 2;
const LIME = "200,255,46";
const CYAN = "127,233,255";
const VIOLET = "169,139,255";
const BODY = "#0c0c13";
/** Seconds a `cd` label stays up after the runner enters a section. */
const LABEL_FOR = 2.4;
const GLYPHS = "01{}<>/;=#$";

interface Bit {
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  glyph: string;
}

interface Stop {
  /** How far down the page the section starts, 0 to 1. */
  at: number;
  name: string;
}

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));
const between = (low: number, high: number) =>
  low + Math.random() * (high - low);

/**
 * A hooded hacker who runs the length of the page along the bottom of the
 * window. Where they stand is how far the page is scrolled: scroll and they
 * sprint to keep up (laptop under one arm, shedding code and afterimages),
 * laying a lit trace behind them with a via for every section; stop and they
 * flip the laptop open and type. Entering a section they `cd` into it, and at
 * the foot of the page access is granted. Drawn on a short fixed canvas that
 * ignores input; it rests while the tab is hidden. Returns a function that
 * releases everything.
 */
export function mountRunnerScene(canvas: HTMLCanvasElement): () => void {
  const context = canvas.getContext("2d");
  if (!context) return () => {};
  const pixelRatio = Math.min(window.devicePixelRatio, 2);

  let width = 0;
  let height = 0;
  /** The figure is drawn 64 units tall; this turns units into pixels. */
  let scale = 1;
  let ground = 0;

  let x = -60;
  let velocity = 0;
  let facing = 1;
  let running = 0;
  let stride = 0;
  let progress = 0;

  let stops: Stop[] = [];
  let surveyed = -10;
  let current = -1;
  let label = "";
  let labelAt = -10;

  const bits: Bit[] = [];
  let shed = 0;

  let time = 0;
  let last = 0;
  let frame = 0;
  let disposed = false;

  // --------------------------------------------------------------- survey
  /** Finds where each section of the page starts, as a share of the scroll. */
  const survey = () => {
    surveyed = time;
    const range = document.documentElement.scrollHeight - window.innerHeight;
    stops = [];
    if (range <= 0) return;
    document
      .querySelectorAll<HTMLElement>("main > section")
      .forEach((section) => {
        const name = (
          section.id ||
          section.getAttribute("aria-labelledby") ||
          ""
        ).replace(/-heading$/, "");
        if (!name) return;
        const top = section.getBoundingClientRect().top + window.scrollY;
        // A section counts once its top is halfway up the window.
        const at = (top - window.innerHeight / 2) / range;
        if (at < 1) stops.push({ at: Math.max(0, at), name });
      });
  };

  // --------------------------------------------------------------- figure
  /** One limb: a glowing outline with the dark body laid over it. */
  const limb = (points: number[], thick: number, rim: string) => {
    context.beginPath();
    context.moveTo(points[0], points[1]);
    for (let index = 2; index < points.length; index += 2) {
      context.lineTo(points[index], points[index + 1]);
    }
    context.strokeStyle = rim;
    context.lineWidth = thick + 2.2;
    context.stroke();
    context.strokeStyle = BODY;
    context.lineWidth = thick;
    context.stroke();
  };

  /**
   * The hacker, standing on the origin and facing right, 64 units tall.
   * `run` blends the standing, typing pose (0) into the sprint (1).
   */
  const figure = (run: number, phase: number, rgb: string, ghost: boolean) => {
    const near = `rgba(${rgb},0.9)`;
    const far = `rgba(${ghost ? rgb : VIOLET},0.55)`;
    const lean = run * 0.34;
    const hipX = 0;
    const hipY = -27 + run * (1.4 + 1.6 * Math.cos(phase * 2));
    const shoulderX = hipX + Math.sin(lean) * 19;
    const shoulderY = hipY - Math.cos(lean) * 19;
    const headX = shoulderX + Math.sin(lean * 0.8) * 8.5;
    const headY = shoulderY - Math.cos(lean * 0.8) * 8.5;

    const leg = (cycle: number, rest: number, rim: string) => {
      // Angles are from straight down, positive forward.
      const thigh = run * 0.95 * Math.sin(cycle) + (1 - run) * rest;
      const flex = run * (0.3 + 1.25 * Math.max(0, Math.cos(cycle)));
      const kneeX = hipX + Math.sin(thigh) * 14;
      const kneeY = hipY + Math.cos(thigh) * 14;
      const footX = kneeX + Math.sin(thigh - flex) * 14;
      const footY = Math.min(0, kneeY + Math.cos(thigh - flex) * 14);
      limb(
        [hipX, hipY, kneeX, kneeY, footX, footY, footX + 4.5, footY],
        5,
        rim,
      );
    };
    const arm = (upper: number, bend: number, rim: string) => {
      const elbowX = shoulderX + Math.sin(upper) * 9;
      const elbowY = shoulderY + 2 + Math.cos(upper) * 9;
      const handX = elbowX + Math.sin(upper + bend) * 9;
      const handY = elbowY + Math.cos(upper + bend) * 9;
      limb([shoulderX, shoulderY + 2, elbowX, elbowY, handX, handY], 4, rim);
      return [handX, handY];
    };

    context.lineCap = "round";
    context.lineJoin = "round";

    // Far side first: the free arm pumps, or reaches over to type.
    const tap = (1 - run) * Math.sin(time * 31) * 0.07;
    arm(
      run * -0.95 * Math.sin(phase) + (1 - run) * (0.62 + tap),
      run * 1.25 + (1 - run) * 0.95,
      far,
    );
    leg(phase + Math.PI, -0.1, far);

    limb([hipX, hipY, shoulderX, shoulderY], 11, near);
    leg(phase, 0.12, near);

    // Hood, with a peak trailing behind and a lit visor in front.
    context.beginPath();
    context.arc(headX, headY, 7, 0, TAU);
    context.moveTo(headX - 5, headY - 5);
    context.lineTo(headX - 10.5 - run * 2, headY + 1.5);
    context.lineTo(headX - 4, headY + 6);
    context.closePath();
    context.fillStyle = BODY;
    context.strokeStyle = near;
    context.lineWidth = 1.2;
    context.fill();
    context.stroke();
    context.beginPath();
    context.arc(headX, headY, 5.6, 0, TAU);
    context.fill();
    if (!ghost) {
      context.strokeStyle = `rgba(${LIME},0.95)`;
      context.lineWidth = 1.6;
      context.beginPath();
      context.moveTo(headX + 2.4, headY - 0.6);
      context.lineTo(headX + 6, headY - 0.6);
      context.stroke();
    }

    // Near arm: cradling the laptop, open when standing, shut on the run.
    const [handX, handY] = arm(
      run * -0.35 + (1 - run) * 0.3,
      run * 1.75 + (1 - run) * 1.25,
      near,
    );
    if (ghost) return;
    const open = 1 - run;
    context.save();
    context.translate(handX, handY);
    context.rotate(run * (lean - 0.5));
    context.fillStyle = "#15151e";
    context.strokeStyle = `rgba(${LIME},0.85)`;
    context.lineWidth = 1;
    // Base, then the lid hinged at its far edge.
    context.beginPath();
    context.rect(-5, -1.2, 14, 2.2);
    context.fill();
    context.stroke();
    context.translate(9, -1.2);
    context.rotate(0.08 + open * 1.75);
    context.beginPath();
    context.rect(-13, -1.6, 13, 1.6);
    context.fillStyle = `rgba(${LIME},${0.25 + open * 0.6})`;
    context.fill();
    context.stroke();
    context.restore();
    if (open > 0.5) {
      // The screen's light on the hood.
      const light = context.createRadialGradient(
        handX + 8,
        handY - 8,
        0,
        handX + 8,
        handY - 8,
        20,
      );
      light.addColorStop(0, `rgba(${LIME},${0.3 * open})`);
      light.addColorStop(1, `rgba(${LIME},0)`);
      context.fillStyle = light;
      context.fillRect(handX - 12, handY - 28, 40, 40);
    }
  };

  // ----------------------------------------------------------------- loop
  const resize = () => {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    if (width === 0 || height === 0) return;
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    scale = width < 640 ? 0.85 : 1.3;
    ground = height - 7;
    surveyed = -10;
  };

  const render = (now: number) => {
    const dt = clamp((now - last) / 1000, 0, 0.05);
    last = now;
    time += dt;
    if (width === 0 || height === 0) return;
    if (time - surveyed > 1.5) survey();

    // Where on the page we are decides where the runner should be.
    const range = document.documentElement.scrollHeight - window.innerHeight;
    progress = range > 0 ? clamp(window.scrollY / range, 0, 1) : 0;
    const margin = 30 * scale + 10;
    const target = margin + progress * (width - margin * 2);
    const top = Math.max(440, width * 0.9);
    velocity =
      Math.abs(target - x) < 0.6 ? 0 : clamp((target - x) * 5, -top, top);
    x += velocity * dt;
    const moving = Math.abs(velocity) > 6;
    if (moving) facing = Math.sign(velocity);
    running += ((moving ? 1 : 0) - running) * Math.min(1, dt * 11);
    stride += Math.max(Math.abs(velocity) / (9 * scale), 10) * running * dt;

    // Announce each section as the runner gets to it.
    let reached = -1;
    stops.forEach((stop, index) => {
      if (progress >= stop.at) reached = index;
    });
    if (reached !== current) {
      // Nothing to say about the section the page opened on.
      if (current !== -1 || time > 1) {
        label = reached < 0 ? "" : `> cd /${stops[reached].name}`;
        labelAt = time;
      }
      current = reached;
    }
    const granted = range > 0 && progress > 0.992;

    // Code shed from the heels on the run, and off the screen while typing.
    shed += dt * (running > 0.5 ? 26 : 3.2);
    while (shed > 1 && bits.length < 90) {
      shed -= 1;
      const sprint = running > 0.5;
      bits.push({
        x:
          x +
          (sprint ? -facing * between(4, 20) : facing * between(10, 22)) *
            scale,
        y: ground - (sprint ? between(2, 46) : between(36, 46)) * scale,
        vx: sprint ? -velocity * between(0.05, 0.2) : between(-6, 6),
        vy: sprint ? between(-14, 14) : between(-26, -14),
        age: 0,
        life: sprint ? between(0.35, 0.8) : between(0.9, 1.5),
        glyph: GLYPHS[Math.floor(Math.random() * GLYPHS.length)],
      });
    }
    shed = Math.min(shed, 1);
    for (let index = bits.length - 1; index >= 0; index--) {
      const bit = bits[index];
      bit.age += dt;
      bit.x += bit.vx * dt;
      bit.y += bit.vy * dt;
      if (bit.age > bit.life) {
        bits[index] = bits[bits.length - 1];
        bits.pop();
      }
    }

    // ------------------------------------------------------------- draw
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, width, height);

    // The trace: dim ahead, lit behind, a via at every section.
    context.lineWidth = 1;
    context.strokeStyle = `rgba(${VIOLET},0.22)`;
    context.beginPath();
    context.moveTo(0, ground + 0.5);
    context.lineTo(width, ground + 0.5);
    context.stroke();
    const lit = clamp(x, 0, width);
    const trace = context.createLinearGradient(0, 0, lit, 0);
    trace.addColorStop(0, `rgba(${LIME},0.25)`);
    trace.addColorStop(1, `rgba(${LIME},0.95)`);
    context.strokeStyle = trace;
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(0, ground + 0.5);
    context.lineTo(lit, ground + 0.5);
    context.stroke();
    for (const stop of stops) {
      const at = margin + stop.at * (width - margin * 2);
      const passed = at <= x + 1;
      context.beginPath();
      context.arc(at, ground + 0.5, 3, 0, TAU);
      context.fillStyle = passed ? `rgb(${LIME})` : "#060608";
      context.strokeStyle = `rgba(${passed ? LIME : VIOLET},${passed ? 1 : 0.6})`;
      context.lineWidth = 1;
      context.fill();
      context.stroke();
    }

    context.font = `${Math.round(10 * scale)}px ui-monospace, monospace`;
    for (const bit of bits) {
      context.fillStyle = `rgba(${LIME},${0.8 * (1 - bit.age / bit.life)})`;
      context.fillText(bit.glyph, bit.x, bit.y);
    }

    // Afterimages streak out behind a sprint.
    const haste = clamp((Math.abs(velocity) - 160) / 500, 0, 1) * running;
    for (let ghost = 3; ghost >= 1 && haste > 0.02; ghost--) {
      context.save();
      context.globalAlpha = haste * (0.34 - ghost * 0.08);
      context.translate(
        x - facing * ghost * 15 * scale * (0.5 + haste),
        ground,
      );
      context.scale(facing * scale, scale);
      figure(running, stride - ghost * 0.5, ghost === 1 ? CYAN : VIOLET, true);
      context.restore();
    }
    context.save();
    context.translate(x, ground);
    context.scale(facing * scale, scale);
    figure(running, stride, LIME, false);
    context.restore();

    // What the terminal says, on a tag above the hood.
    const shown = granted
      ? "[ access granted ]"
      : time - labelAt < LABEL_FOR
        ? label.slice(0, Math.ceil((time - labelAt) * 30))
        : "";
    if (shown) {
      context.font = "10px ui-monospace, monospace";
      const wide = context.measureText(shown).width + 14;
      const left = clamp(x - wide / 2, 6, width - wide - 6);
      const up = ground - 64 * scale - 30;
      const blink = granted ? 0.75 + 0.25 * Math.sin(time * 6) : 1;
      context.fillStyle = granted
        ? `rgba(${LIME},${blink})`
        : "rgba(6,6,8,0.86)";
      context.strokeStyle = `rgba(${LIME},0.55)`;
      context.lineWidth = 1;
      context.beginPath();
      context.rect(Math.round(left) + 0.5, Math.round(up) + 0.5, wide, 19);
      context.fill();
      context.stroke();
      context.fillStyle = granted ? "#060608" : `rgb(${LIME})`;
      context.fillText(shown, Math.round(left) + 7, Math.round(up) + 13.5);
    }
  };

  const loop = (now: number) => {
    if (disposed || document.visibilityState !== "visible") return;
    render(now);
    frame = requestAnimationFrame(loop);
  };
  const start = () => {
    cancelAnimationFrame(frame);
    last = performance.now();
    frame = requestAnimationFrame(loop);
  };

  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  document.addEventListener("visibilitychange", start);

  resize();
  start();

  return () => {
    disposed = true;
    cancelAnimationFrame(frame);
    resizeObserver.disconnect();
    document.removeEventListener("visibilitychange", start);
  };
}
