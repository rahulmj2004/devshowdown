export interface Storm {
  /** Brightness of the sky right now, 0 to 1. */
  readonly flash: number;
  /** Where that light is coming from, in CSS pixels. */
  readonly x: number;
  readonly y: number;
  resize(width: number, height: number): void;
  update(dt: number): void;
  dispose(): void;
}

interface Fork {
  points: number[];
  weight: number;
  level: number;
}

interface Strike {
  forks: Fork[];
  age: number;
  /** When the channel re-lights after the first stroke. */
  again: number;
  power: number;
  x: number;
  y: number;
}

const between = (low: number, high: number) =>
  low + Math.random() * (high - low);

/**
 * Storm cloud as a small alpha texture: a few octaves of smoothed noise,
 * thresholded into banks and faded out toward the bottom. It is only ever
 * shown by the light of a flash.
 */
function cloudTexture(): HTMLCanvasElement {
  const width = 256;
  const height = 128;
  const texture = document.createElement("canvas");
  texture.width = width;
  texture.height = height;
  const context = texture.getContext("2d");
  if (!context) return texture;

  const cells = 64;
  const lattice = new Float32Array(cells * cells);
  for (let index = 0; index < lattice.length; index++) {
    lattice[index] = Math.random();
  }
  const noise = (x: number, y: number) => {
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const at = (cx: number, cy: number) =>
      lattice[(cy % cells) * cells + (cx % cells)];
    const top = at(x0, y0) + (at(x0 + 1, y0) - at(x0, y0)) * sx;
    const bottom = at(x0, y0 + 1) + (at(x0 + 1, y0 + 1) - at(x0, y0 + 1)) * sx;
    return top + (bottom - top) * sy;
  };

  const image = context.createImageData(width, height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      let value = 0;
      let scale = 1 / 52;
      let gain = 0.5;
      for (let octave = 0; octave < 4; octave++) {
        // Stretched sideways, as cloud banks are.
        value += noise(x * scale, y * scale * 2.2) * gain;
        scale *= 2.1;
        gain *= 0.5;
      }
      const density = Math.min(1, Math.max(0, (value - 0.4) / 0.32));
      const fade = Math.pow(1 - y / height, 1.3);
      const offset = (y * width + x) * 4;
      image.data[offset] = 168;
      image.data[offset + 1] = 172;
      image.data[offset + 2] = 255;
      image.data[offset + 3] = 255 * density * density * fade;
    }
  }
  context.putImageData(image, 0, 0);
  return texture;
}

/**
 * Lightning for the hero's sky, on its own canvas behind the content. Forked
 * bolts are grown by repeatedly kinking a line at its midpoints; each strikes,
 * dims, re-lights once and dies within half a second, lighting the cloud
 * around it. Between bolts the clouds flicker from within. The canvas is only
 * redrawn while something is lit.
 */
export function createStorm(
  canvas: HTMLCanvasElement,
  lite: boolean,
): Storm | null {
  const context = canvas.getContext("2d");
  if (!context) return null;
  const pixelRatio = Math.min(window.devicePixelRatio, lite ? 1 : 1.5);
  const clouds = cloudTexture();

  let width = 0;
  let height = 0;
  let strike: Strike | null = null;
  let sheet: { age: number; power: number; x: number; y: number } | null = null;
  let untilStrike = 1.2;
  let untilSheet = 2.5;
  let drift = Math.random() * 100;
  let flash = 0;
  let lightX = 0;
  let lightY = 0;
  let painted = false;

  const grow = (
    forks: Fork[],
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    weight: number,
    level: number,
  ) => {
    const reach = Math.hypot(toX - fromX, toY - fromY);
    let points = [fromX, fromY, toX, toY];
    let kink = reach * 0.17;
    for (let pass = 0; pass < (lite ? 5 : 6); pass++) {
      const finer = [points[0], points[1]];
      for (let index = 2; index < points.length; index += 2) {
        const ax = points[index - 2];
        const ay = points[index - 1];
        const bx = points[index];
        const by = points[index + 1];
        const length = Math.hypot(bx - ax, by - ay) || 1;
        const shove = between(-kink, kink);
        finer.push(
          (ax + bx) / 2 - ((by - ay) / length) * shove,
          (ay + by) / 2 + ((bx - ax) / length) * shove,
          bx,
          by,
        );
      }
      points = finer;
      kink *= 0.54;
    }
    forks.push({ points, weight, level });
    if (level >= 2) return;

    const branches =
      level === 0 ? (lite ? 2 : 3) + Math.round(Math.random()) : 1;
    const along = Math.atan2(toY - fromY, toX - fromX);
    for (let branch = 0; branch < branches; branch++) {
      const from = 2 * Math.floor(between(0.15, 0.8) * (points.length / 2 - 1));
      const angle = along + between(0.3, 0.85) * (Math.random() < 0.5 ? -1 : 1);
      const length = reach * between(0.22, 0.48) * (level === 0 ? 1 : 0.7);
      grow(
        forks,
        points[from],
        points[from + 1],
        points[from] + Math.cos(angle) * length,
        points[from + 1] + Math.sin(angle) * length,
        weight * 0.55,
        level + 1,
      );
    }
  };

  /** A stroke's light: instant, then gone in a few hundredths of a second. */
  const pulse = (age: number) => (age < 0 ? 0 : Math.exp(-age * 13));

  const draw = () => {
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.globalCompositeOperation = "source-over";
    context.globalAlpha = 1;
    context.clearRect(0, 0, width, height);
    painted = flash > 0.004;
    if (!painted) return;

    // Cloud, lit only near the flash.
    const span = Math.max(width, height);
    context.globalAlpha = Math.min(1, flash * 0.75);
    context.drawImage(
      clouds,
      -(drift % (width * 0.3)),
      0,
      width * 1.3,
      height * 0.85,
    );
    context.globalAlpha = 1;
    context.globalCompositeOperation = "destination-in";
    const reach = context.createRadialGradient(
      lightX,
      lightY,
      0,
      lightX,
      lightY,
      span * 0.62,
    );
    reach.addColorStop(0, "rgba(0,0,0,1)");
    reach.addColorStop(1, "rgba(0,0,0,0)");
    context.fillStyle = reach;
    context.fillRect(0, 0, width, height);

    // The air itself glows.
    context.globalCompositeOperation = "lighter";
    const air = context.createRadialGradient(
      lightX,
      lightY,
      0,
      lightX,
      lightY,
      span * 0.5,
    );
    air.addColorStop(0, `rgba(150,140,255,${0.24 * flash})`);
    air.addColorStop(1, "rgba(150,140,255,0)");
    context.fillStyle = air;
    context.fillRect(0, 0, width, height);

    if (!strike) return;
    const live = Math.min(
      1,
      pulse(strike.age) + 0.7 * pulse(strike.age - strike.again),
    );
    if (live < 0.03) return;
    context.lineJoin = "round";
    context.lineCap = "round";
    // Three passes per fork: a wide haze, a coloured sheath, a white core.
    const passes = [
      { colour: "#6a4dff", wide: 10, alpha: 0.1 },
      { colour: "#9fb4ff", wide: 3.4, alpha: 0.34 },
      { colour: "#f2f6ff", wide: 1, alpha: 1 },
    ];
    for (const pass of passes) {
      context.strokeStyle = pass.colour;
      for (const fork of strike.forks) {
        context.globalAlpha = Math.min(
          1,
          pass.alpha * live * (fork.level === 0 ? 1 : 0.62 / fork.level),
        );
        context.lineWidth = fork.weight * pass.wide;
        context.beginPath();
        context.moveTo(fork.points[0], fork.points[1]);
        for (let index = 2; index < fork.points.length; index += 2) {
          context.lineTo(fork.points[index], fork.points[index + 1]);
        }
        context.stroke();
      }
    }
    context.globalAlpha = 1;
  };

  return {
    get flash() {
      return flash;
    },
    get x() {
      return lightX;
    },
    get y() {
      return lightY;
    },
    resize(nextWidth, nextHeight) {
      width = nextWidth;
      height = nextHeight;
      canvas.width = Math.round(width * pixelRatio);
      canvas.height = Math.round(height * pixelRatio);
      strike = null;
      painted = false;
    },
    update(dt) {
      if (width === 0 || height === 0) return;
      drift += dt * 6;

      untilStrike -= dt;
      if (untilStrike <= 0) {
        untilStrike = between(3.5, 8);
        const fromX = between(0.12, 0.95) * width;
        const toX = fromX + between(-0.18, 0.18) * width;
        const toY = between(0.38, 0.72) * height;
        const forks: Fork[] = [];
        grow(forks, fromX, -12, toX, toY, lite ? 1.7 : 2.2, 0);
        strike = {
          forks,
          age: 0,
          again: between(0.1, 0.19),
          power: between(0.75, 1),
          x: (fromX + toX) / 2,
          y: toY * 0.4,
        };
      }
      untilSheet -= dt;
      if (untilSheet <= 0) {
        untilSheet = between(2.5, 6);
        sheet = {
          age: 0,
          power: between(0.2, 0.45),
          x: between(0.05, 0.95) * width,
          y: between(0, 0.28) * height,
        };
      }

      flash = 0;
      if (strike) {
        strike.age += dt;
        const light =
          strike.power *
          Math.min(
            1,
            pulse(strike.age) + 0.7 * pulse(strike.age - strike.again),
          );
        if (strike.age > 0.8) strike = null;
        else if (light > flash) {
          flash = light;
          lightX = strike.x;
          lightY = strike.y;
        }
      }
      if (sheet) {
        sheet.age += dt;
        // A slower double swell, deep inside the cloud.
        const light =
          sheet.power *
          Math.min(
            1,
            pulse(sheet.age * 0.45) + 0.8 * pulse((sheet.age - 0.22) * 0.45),
          );
        if (sheet.age > 1.4) sheet = null;
        else if (light > flash) {
          flash = light;
          lightX = sheet.x;
          lightY = sheet.y;
        }
      }

      if (flash > 0.004 || painted) draw();
    },
    dispose() {
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
    },
  };
}
