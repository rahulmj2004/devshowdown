import { SEGMENTS, createDragonPainter } from "./dragon-art";
import { createStorm } from "./storm";

export interface DragonSceneOptions {
  /** Fewer particles and a lower pixel ratio for small or weak devices. */
  lite: boolean;
  /** Holds the `[data-ember]` glyphs the dragon can set alight. */
  wordmark: HTMLElement | null;
  /** A canvas behind the hero's content, for the lightning. */
  sky: HTMLCanvasElement | null;
}

const TAU = Math.PI * 2;
/** Heat a glyph settles back to once it has been lit. */
const SMOULDER = 0.3;

/** Flame colour by age: white-hot, yellow, orange, red, dying ember. */
const RAMP = [
  "255,248,224",
  "255,214,110",
  "255,146,44",
  "255,78,18",
  "168,28,10",
];

const BREATH = 0;
const FLAME = 1;
const SPARK = 2;

interface Particle {
  kind: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  age: number;
  life: number;
  from: number;
  to: number;
  /** Where on the colour ramp the particle starts (0 is hottest). */
  start: number;
  alpha: number;
  seed: number;
}

interface Glyph {
  node: HTMLElement;
  /** Centre and height, relative to the wordmark element. */
  cx: number;
  cy: number;
  height: number;
  /** Points on the glyph's upward-facing edges, as x/y pairs. */
  rim: number[];
  heat: number;
  lit: boolean;
  applied: number;
  debt: number;
}

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));
const wrap = (angle: number) => {
  const turned = (angle + Math.PI) % TAU;
  return (turned < 0 ? turned + TAU : turned) - Math.PI;
};
const between = (low: number, high: number) =>
  low + Math.random() * (high - low);

/** A soft round blob; every flame is one of these, stretched and tinted. */
function flameSprite(rgb: string): HTMLCanvasElement {
  const sprite = document.createElement("canvas");
  sprite.width = sprite.height = 64;
  const context = sprite.getContext("2d");
  if (context) {
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, `rgba(${rgb},1)`);
    gradient.addColorStop(0.35, `rgba(${rgb},0.5)`);
    gradient.addColorStop(1, `rgba(${rgb},0)`);
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);
  }
  return sprite;
}

/**
 * The hero's dragon, drawn on a 2D canvas laid over the whole section, under
 * a sky that throws lightning (see `createStorm`), which lights it too. It
 * circles the core, follows the mouse while it is up there, and every so
 * often rakes the wordmark with fire. Each glyph keeps its own heat: flames
 * rise from the letter's real outline, and the same value is written back as
 * `--heat` so CSS can turn the type molten. Clicking open space makes it
 * breathe where it is. Rendering stops while the hero is off screen or the
 * tab is hidden. Returns a function that releases everything.
 */
export function mountDragonScene(
  canvas: HTMLCanvasElement,
  options: DragonSceneOptions,
): () => void {
  const context = canvas.getContext("2d");
  if (!context) return () => {};
  const { wordmark, lite } = options;
  const storm = options.sky ? createStorm(options.sky, lite) : null;

  const pixelRatio = Math.min(window.devicePixelRatio, lite ? 1 : 1.5);
  const sprites = RAMP.map(flameSprite);
  const capacity = lite ? 700 : 2400;
  const particles: Particle[] = [];
  let alive = 0;

  let width = 0;
  let height = 0;
  let unit = 1;

  // Spine, head first. Each point trails the one before it.
  const px = new Float32Array(SEGMENTS);
  const py = new Float32Array(SEGMENTS);
  let heading = Math.PI;
  let speed = 0;
  let sway = 0;
  let placed = false;

  // Wordmark geometry, relative to the wordmark element.
  let glyphs: Glyph[] = [];
  const ink = { left: 0, top: 0, right: 0, bottom: 0 };
  let glyphScale = 1;
  let stale = true;
  // The wordmark's position on the canvas, refreshed every frame.
  let originX = 0;
  let originY = 0;
  let boundsLeft = 0;
  let boundsTop = 0;

  // Behaviour.
  let strafe: { stage: number; direction: number; since: number } | null = null;
  let strafeDirection = -1;
  let nextStrafe = 0.2;
  let burst = 0;
  let burstX = 0;
  let burstY = 0;
  const pointer = { x: 0, y: 0, at: -10 };
  let breathing = false;
  let aim = 0;
  let glow = 0;
  let breathDebt = 0;
  let sparkDebt = 0;

  let visible = true;
  let inView = true;
  let disposed = false;
  let frame = 0;
  let last = 0;
  // Let the opening sequence clear before anything flies in.
  let time = document.documentElement.dataset.intro === "play" ? -1.7 : -0.5;

  // ------------------------------------------------------------ particles
  const spawn = (): Particle | null => {
    if (alive >= capacity) return null;
    let particle = particles[alive];
    if (!particle) {
      particle = {
        kind: 0,
        x: 0,
        y: 0,
        vx: 0,
        vy: 0,
        age: 0,
        life: 1,
        from: 0,
        to: 0,
        start: 0,
        alpha: 1,
        seed: 0,
      };
      particles.push(particle);
    }
    alive++;
    particle.age = 0;
    particle.seed = Math.random() * TAU;
    return particle;
  };

  const breathe = (dt: number, mouthX: number, mouthY: number) => {
    const headVx = Math.cos(heading) * speed;
    const headVy = Math.sin(heading) * speed;
    const reach = Math.sqrt(unit);

    breathDebt += (lite ? 200 : 460) * dt;
    for (; breathDebt >= 1; breathDebt--) {
      const particle = spawn();
      if (!particle) break;
      const angle = aim + between(-0.13, 0.13);
      const velocity = between(640, 1080) * reach;
      particle.kind = BREATH;
      particle.x = mouthX + between(-3, 3) * unit;
      particle.y = mouthY + between(-3, 3) * unit;
      particle.vx = Math.cos(angle) * velocity + headVx * 0.5;
      particle.vy = Math.sin(angle) * velocity + headVy * 0.5;
      particle.life = between(0.4, 0.85);
      particle.from = 9 * unit;
      particle.to = between(55, 105) * unit;
      particle.start = 0;
      particle.alpha = 0.42;
    }

    sparkDebt += (lite ? 14 : 34) * dt;
    for (; sparkDebt >= 1; sparkDebt--) {
      const particle = spawn();
      if (!particle) break;
      const angle = aim + between(-0.4, 0.4);
      const velocity = between(300, 900) * reach;
      particle.kind = SPARK;
      particle.x = mouthX;
      particle.y = mouthY;
      particle.vx = Math.cos(angle) * velocity;
      particle.vy = Math.sin(angle) * velocity;
      particle.life = between(0.6, 1.4);
      particle.from = between(2, 4.5);
      particle.to = 1;
      particle.start = 0.2;
      particle.alpha = 1;
    }

    // Whatever the fire reaches heats up.
    const impactX = mouthX + Math.cos(aim) * 170 * unit - originX;
    const impactY = mouthY + Math.sin(aim) * 170 * unit - originY;
    for (const glyph of glyphs) {
      const range = 150 * unit + glyph.height * 0.55;
      // A strafing run lights every line of the wordmark it passes over.
      const distance = strafe
        ? Math.abs(glyph.cx - impactX)
        : Math.hypot(glyph.cx - impactX, glyph.cy - impactY);
      if (distance >= range) continue;
      glyph.heat = Math.min(1, glyph.heat + dt * 4 * (1 - distance / range));
      if (glyph.heat > 0.5) glyph.lit = true;
    }
  };

  const burn = (dt: number) => {
    const cooling = 1 - Math.exp(-dt * 0.25);
    for (const glyph of glyphs) {
      glyph.heat += ((glyph.lit ? SMOULDER : 0) - glyph.heat) * cooling;
      if (glyph.heat < 0.03 || glyph.rim.length === 0) continue;

      const { heat } = glyph;
      glyph.debt += (0.3 + 0.7 * heat) * (lite ? 60 : 170) * dt;
      for (; glyph.debt >= 1; glyph.debt--) {
        const particle = spawn();
        if (!particle) break;
        const point = 2 * Math.floor(Math.random() * (glyph.rim.length / 2));
        const spark = heat > 0.6 && Math.random() < 0.06;
        particle.kind = spark ? SPARK : FLAME;
        particle.x = originX + glyph.rim[point];
        particle.y = originY + glyph.rim[point + 1];
        // Some fire licks down the face of the letter, not just off the top.
        if (heat > 0.5 && Math.random() < 0.25) {
          particle.y += Math.random() * glyph.height * 0.55;
        }
        if (spark) {
          particle.vx = between(-90, 90);
          particle.vy = -between(160, 360);
          particle.life = between(0.6, 1.3);
          particle.from = between(2, 4);
          particle.to = 1;
          particle.start = 0.2;
          particle.alpha = 1;
          continue;
        }
        particle.vx = between(-12, 12) * glyphScale;
        particle.vy = -between(70, 190) * glyphScale * (0.5 + 0.9 * heat);
        particle.life = between(0.35, 0.8) * (0.6 + 0.6 * heat);
        particle.from = between(30, 52) * glyphScale * (0.6 + 0.6 * heat);
        particle.to = particle.from * 0.15;
        particle.start = (1 - heat) * 0.18;
        particle.alpha = 0.2 + 0.16 * heat;
      }
    }
  };

  const advance = (dt: number) => {
    for (let index = alive - 1; index >= 0; index--) {
      const particle = particles[index];
      particle.age += dt;
      if (particle.age >= particle.life) {
        alive--;
        particles[index] = particles[alive];
        particles[alive] = particle;
        continue;
      }
      if (particle.kind === BREATH) {
        const drag = Math.exp(-2.3 * dt);
        particle.vx *= drag;
        particle.vy =
          particle.vy * drag - 150 * dt * (particle.age / particle.life);
      } else if (particle.kind === FLAME) {
        particle.vx += Math.sin(time * 6 + particle.seed) * 60 * dt;
        particle.vy -= 30 * dt;
      } else {
        particle.vx *= Math.exp(-0.8 * dt);
        particle.vy += 300 * dt;
      }
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
    }
  };

  const paint = (kind: number) => {
    for (let index = 0; index < alive; index++) {
      const particle = particles[index];
      if (
        particle.kind !== kind &&
        !(kind === BREATH && particle.kind === SPARK)
      )
        continue;
      const life = particle.age / particle.life;
      const ramp = particle.start + Math.pow(life, 0.65) * (1 - particle.start);
      const size = particle.from + (particle.to - particle.from) * life;
      // Letter flames are drawn as upright tongues, not round puffs.
      const tall = particle.kind === FLAME ? 1.7 : 1;
      const fade =
        particle.kind === SPARK
          ? 1 - life
          : Math.min(1, life * 10) * (1 - life);
      context.globalAlpha = fade * particle.alpha;
      context.drawImage(
        sprites[Math.min(RAMP.length - 1, Math.floor(ramp * RAMP.length))],
        particle.x - size / 2,
        particle.y - (size * tall) / 2,
        size,
        size * tall,
      );
    }
    context.globalAlpha = 1;
  };

  // ------------------------------------------------------------- wordmark
  /**
   * Rasterises each glyph where the browser laid it out and keeps the points
   * along its upward-facing edges, so flames rise from the letterforms and
   * not from their boxes.
   */
  const measure = () => {
    stale = false;
    for (const glyph of glyphs) glyph.node.style.removeProperty("--heat");
    const previous = glyphs;
    glyphs = [];
    if (!wordmark) return;
    const nodes = wordmark.querySelectorAll<HTMLElement>("[data-ember]");
    if (nodes.length === 0) return;

    const style = getComputedStyle(wordmark);
    const fontSize = parseFloat(style.fontSize);
    glyphScale = clamp(fontSize / 200, 0.45, 1.1);

    // How far below the top of a one-line box this font's baseline sits.
    const probe = document.createElement("span");
    probe.style.cssText =
      "position:absolute;visibility:hidden;display:inline-block;white-space:nowrap";
    probe.textContent = "H";
    const mark = document.createElement("span");
    mark.style.cssText = "display:inline-block;width:0;height:0";
    probe.append(mark);
    wordmark.append(probe);
    const baseline =
      mark.getBoundingClientRect().top - probe.getBoundingClientRect().top;
    probe.remove();

    const scratch = document.createElement("canvas");
    const pen = scratch.getContext("2d", { willReadFrequently: true });
    if (!pen) return;
    const origin = wordmark.getBoundingClientRect();
    const grid = Math.max(3, Math.round(fontSize / 44));
    ink.left = ink.top = Infinity;
    ink.right = ink.bottom = -Infinity;

    nodes.forEach((node, index) => {
      const rect = node.getBoundingClientRect();
      const boxWidth = Math.ceil(rect.width);
      const boxHeight = Math.ceil(rect.height);
      if (boxWidth === 0 || boxHeight === 0) return;
      const left = rect.left - origin.left;
      const top = rect.top - origin.top;

      scratch.width = boxWidth;
      scratch.height = boxHeight;
      pen.font = `${style.fontStyle} ${style.fontWeight} ${fontSize}px ${style.fontFamily}`;
      pen.fillStyle = "#fff";
      pen.fillText(
        (node.textContent ?? "").toUpperCase(),
        0,
        parseFloat(getComputedStyle(node).paddingTop) + baseline,
      );
      const pixels = pen.getImageData(0, 0, boxWidth, boxHeight).data;
      const filled = (x: number, y: number) =>
        y >= 0 && pixels[(y * boxWidth + x) * 4 + 3] > 96;

      const rim: number[] = [];
      let inkTop = boxHeight;
      let inkBottom = 0;
      for (let y = 0; y < boxHeight; y += grid) {
        for (let x = 0; x < boxWidth; x += grid) {
          if (!filled(x, y)) continue;
          inkTop = Math.min(inkTop, y);
          inkBottom = Math.max(inkBottom, y);
          if (!filled(x, y - grid)) rim.push(left + x, top + y);
        }
      }
      if (rim.length === 0) return;

      const before = previous[index];
      glyphs.push({
        node,
        cx: left + boxWidth / 2,
        cy: top + (inkTop + inkBottom) / 2,
        height: inkBottom - inkTop,
        rim,
        heat: before?.heat ?? 0,
        lit: before?.lit ?? false,
        applied: -1,
        debt: 0,
      });
      ink.left = Math.min(ink.left, left);
      ink.right = Math.max(ink.right, left + boxWidth);
      ink.top = Math.min(ink.top, top + inkTop);
      ink.bottom = Math.max(ink.bottom, top + inkBottom);
    });
  };

  /** Hands each glyph's heat to CSS, with a flicker while it burns. */
  const temper = () => {
    glyphs.forEach((glyph, index) => {
      const flicker = 0.88 + 0.12 * Math.sin(time * 9 + index * 1.7);
      const shown = glyph.heat < 0.01 ? 0 : glyph.heat * flicker;
      if (Math.abs(shown - glyph.applied) < 0.012) return;
      glyph.applied = shown;
      glyph.node.style.setProperty("--heat", shown.toFixed(3));
    });
  };

  // ---------------------------------------------------------------- brain
  const think = (dt: number) => {
    const wide = width >= 1024;
    const textLeft = originX + ink.left;
    const textRight = originX + ink.right;
    const textTop = originY + ink.top;
    let targetX: number;
    let targetY: number;
    let pace = 250;
    let agility = 2.3;
    let serpentine = 0.16;
    breathing = false;
    aim = heading;

    if (!strafe && glyphs.length > 0 && time >= nextStrafe) {
      strafe = { stage: 0, direction: strafeDirection, since: time };
      strafeDirection = -strafeDirection;
    }

    if (strafe) {
      // Line up beyond one end of the wordmark, then fly its length.
      const { direction } = strafe;
      const run = textTop - 24 * unit;
      const entry =
        direction < 0 ? textRight + 170 * unit : textLeft - 170 * unit;
      const exit =
        direction < 0 ? textLeft - 260 * unit : textRight + 260 * unit;
      pace = 360;
      agility = 3.2;
      if (strafe.stage === 0) {
        targetX = entry;
        targetY = run - 30 * unit;
        if (Math.hypot(targetX - px[0], targetY - py[0]) < 80 * unit) {
          strafe.stage = 1;
        }
      } else {
        targetX = exit;
        targetY = run;
        serpentine = 0.1;
        const over =
          direction < 0
            ? px[0] < textRight + 140 * unit && px[0] > textLeft - 40 * unit
            : px[0] > textLeft - 140 * unit && px[0] < textRight + 40 * unit;
        const facing = direction < 0 ? Math.PI : 0;
        breathing = over && Math.abs(wrap(heading - facing)) < 0.7;
        // Angle the fire down into the letters.
        aim = heading + 0.45 * direction;
      }
      const passed = (px[0] - exit) * direction > 0;
      if ((strafe.stage === 1 && passed) || time - strafe.since > 10) {
        strafe = null;
        nextStrafe = time + 15;
      }
    } else if (burst > 0) {
      burst -= dt;
      targetX = burstX;
      targetY = burstY;
      agility = 4;
      breathing = true;
    } else if (time - pointer.at < 2.2 && pointer.y < originY + ink.bottom) {
      targetX = pointer.x;
      targetY = pointer.y;
      agility = 3;
      // Close in, then idle around the cursor instead of overshooting.
      const gap = Math.hypot(targetX - px[0], targetY - py[0]);
      pace = gap < 90 * unit ? 110 : 330;
    } else {
      // Chase a point a little further round an ellipse about the core.
      const centreX = width * (wide ? 0.7 : 0.5);
      const centreY = height * 0.2;
      const radiusX = width * (wide ? 0.24 : 0.36);
      const radiusY = height * (wide ? 0.12 : 0.1);
      const around =
        Math.atan2((py[0] - centreY) / radiusY, (px[0] - centreX) / radiusX) +
        0.85;
      const drift = 1 + 0.18 * Math.sin(time * 0.6);
      targetX = centreX + Math.cos(around) * radiusX * drift;
      targetY = centreY + Math.sin(around) * radiusY * drift;
    }

    const wanted = Math.atan2(targetY - py[0], targetX - px[0]);
    heading += clamp(wrap(wanted - heading), -agility * dt, agility * dt);
    speed += (pace * unit - speed) * Math.min(1, dt * 2);
    sway = Math.sin(time * 4.2) * serpentine;
    px[0] += Math.cos(heading + sway) * speed * dt;
    py[0] += Math.sin(heading + sway) * speed * dt;

    const spacing = 9 * unit;
    for (let index = 1; index < SEGMENTS; index++) {
      const dx = px[index - 1] - px[index];
      const dy = py[index - 1] - py[index];
      const gap = Math.hypot(dx, dy) || 1;
      px[index] = px[index - 1] - (dx / gap) * spacing;
      py[index] = py[index - 1] - (dy / gap) * spacing;
    }

    glow += ((breathing ? 1 : 0) - glow) * Math.min(1, dt * 7);
  };

  // --------------------------------------------------------------- dragon
  // The dragon is painted on a layer of its own so that firelight and
  // lightning can be laid over it alone; the lit result is then stamped onto
  // the canvas. Only the part of the layer it occupies is ever touched.
  const layer = document.createElement("canvas");
  const brush = layer.getContext("2d");
  const paintDragon = createDragonPainter();
  const used = { left: 0, top: 0, width: 0, height: 0 };

  const drawDragon = (mouthX: number, mouthY: number) => {
    if (!brush) return;
    brush.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    brush.globalCompositeOperation = "source-over";
    brush.clearRect(used.left, used.top, used.width, used.height);

    let left = Infinity;
    let top = Infinity;
    let right = -Infinity;
    let bottom = -Infinity;
    for (let index = 0; index < SEGMENTS; index++) {
      left = Math.min(left, px[index]);
      right = Math.max(right, px[index]);
      top = Math.min(top, py[index]);
      bottom = Math.max(bottom, py[index]);
    }
    // Room for the wings; snapped so the stamp lands on whole device pixels.
    const margin = 250 * unit;
    left = Math.max(0, Math.floor((left - margin) / 4) * 4);
    top = Math.max(0, Math.floor((top - margin) / 4) * 4);
    right = Math.min(width, Math.ceil((right + margin) / 4) * 4);
    bottom = Math.min(height, Math.ceil((bottom + margin) / 4) * 4);
    used.left = left;
    used.top = top;
    used.width = Math.max(0, right - left);
    used.height = Math.max(0, bottom - top);
    if (used.width === 0 || used.height === 0) return;

    paintDragon(brush, {
      px,
      py,
      heading: heading + sway * 0.6,
      unit,
      time,
      flap: Math.sin(time * (strafe ? 9 : 6.5)),
      glow,
    });

    // Light falls only where the dragon already is.
    brush.globalCompositeOperation = "source-atop";
    if (glow > 0.02) {
      const fire = brush.createRadialGradient(
        mouthX,
        mouthY,
        0,
        mouthX,
        mouthY,
        320 * unit,
      );
      fire.addColorStop(0, `rgba(255,150,50,${0.62 * glow})`);
      fire.addColorStop(1, "rgba(255,110,30,0)");
      brush.fillStyle = fire;
      brush.fillRect(used.left, used.top, used.width, used.height);
    }
    const flash = storm?.flash ?? 0;
    if (storm && flash > 0.02) {
      const bolt = brush.createRadialGradient(
        storm.x,
        storm.y,
        0,
        storm.x,
        storm.y,
        Math.max(width, height) * 0.9,
      );
      bolt.addColorStop(0, `rgba(196,208,255,${0.62 * flash})`);
      bolt.addColorStop(1, `rgba(196,208,255,${0.14 * flash})`);
      brush.fillStyle = bolt;
      brush.fillRect(used.left, used.top, used.width, used.height);
    }

    context.drawImage(
      layer,
      used.left * pixelRatio,
      used.top * pixelRatio,
      used.width * pixelRatio,
      used.height * pixelRatio,
      used.left,
      used.top,
      used.width,
      used.height,
    );
  };

  // ----------------------------------------------------------------- loop
  const resize = () => {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    if (width === 0 || height === 0) return;
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    layer.width = canvas.width;
    layer.height = canvas.height;
    used.width = used.height = 0;
    storm?.resize(width, height);
    unit = clamp(width / 1000, 0.62, 1.5);
    stale = true;
    if (!placed) {
      // Start out of sight beyond the top-right corner, strung out in a line.
      placed = true;
      for (let index = 0; index < SEGMENTS; index++) {
        px[index] = width + (140 + index * 9) * unit;
        py[index] = height * 0.12;
      }
    }
  };

  const render = (now: number) => {
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    time += dt;
    if (width === 0 || height === 0) return;

    // Layout is read once, before anything is written.
    const bounds = canvas.getBoundingClientRect();
    boundsLeft = bounds.left;
    boundsTop = bounds.top;
    if (stale) measure();
    if (wordmark) {
      const origin = wordmark.getBoundingClientRect();
      originX = origin.left - bounds.left;
      originY = origin.top - bounds.top;
    }

    const flying = time > 0;
    if (flying) think(dt);
    const mouthX = px[0] + Math.cos(heading) * 55 * unit;
    const mouthY = py[0] + Math.sin(heading) * 55 * unit;
    if (flying && breathing) breathe(dt, mouthX, mouthY);
    burn(dt);
    advance(dt);
    storm?.update(dt);

    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, width, height);

    // The wordmark's own fire, behind the dragon.
    context.globalCompositeOperation = "lighter";
    for (const glyph of glyphs) {
      if (glyph.heat < 0.03) continue;
      const size = glyph.height * 1.7;
      context.globalAlpha =
        glyph.heat * (0.13 + 0.04 * Math.sin(time * 11 + glyph.cx));
      context.drawImage(
        sprites[2],
        originX + glyph.cx - size / 2,
        originY + glyph.cy - size / 2,
        size,
        size,
      );
    }
    paint(FLAME);

    context.globalCompositeOperation = "source-over";
    if (flying) drawDragon(mouthX, mouthY);

    // Its breath, over everything.
    context.globalCompositeOperation = "lighter";
    paint(BREATH);
    if (glow > 0.02) {
      const size = 110 * unit * glow;
      context.globalAlpha = glow;
      context.drawImage(
        sprites[1],
        mouthX - size / 2,
        mouthY - size / 2,
        size,
        size,
      );
      context.globalAlpha = 1;
    }
    context.globalCompositeOperation = "source-over";

    temper();
  };

  const loop = (now: number) => {
    if (disposed || !visible) return;
    render(now);
    frame = requestAnimationFrame(loop);
  };
  const start = () => {
    cancelAnimationFrame(frame);
    last = performance.now();
    frame = requestAnimationFrame(loop);
  };

  // ------------------------------------------------------------ listeners
  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerType !== "mouse") return;
    pointer.x = event.clientX - boundsLeft;
    pointer.y = event.clientY - boundsTop;
    if (pointer.y < height) pointer.at = time;
  };
  const onPointerDown = (event: PointerEvent) => {
    const x = event.clientX - boundsLeft;
    const y = event.clientY - boundsTop;
    if (time < 0 || strafe || x < 0 || x > width || y < 0 || y > height) return;
    // Leave real controls alone; only open space calls down fire.
    if (event.target instanceof Element && event.target.closest("a, button"))
      return;
    burst = 0.9;
    burstX = x;
    burstY = y;
  };
  const onVisibility = () => {
    const wasVisible = visible;
    visible = inView && document.visibilityState === "visible";
    if (visible && !wasVisible) start();
  };

  const intersection = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    onVisibility();
  });
  intersection.observe(canvas);
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(canvas);
  if (wordmark) resizeObserver.observe(wordmark);
  // The display face may land after the first measurement.
  void document.fonts?.ready.then(() => {
    stale = true;
  });

  window.addEventListener("pointermove", onPointerMove, { passive: true });
  window.addEventListener("pointerdown", onPointerDown, { passive: true });
  document.addEventListener("visibilitychange", onVisibility);

  resize();
  start();

  return () => {
    disposed = true;
    cancelAnimationFrame(frame);
    intersection.disconnect();
    resizeObserver.disconnect();
    window.removeEventListener("pointermove", onPointerMove);
    window.removeEventListener("pointerdown", onPointerDown);
    document.removeEventListener("visibilitychange", onVisibility);
    for (const glyph of glyphs) glyph.node.style.removeProperty("--heat");
    storm?.dispose();
  };
}
