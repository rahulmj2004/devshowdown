// Everything in the trailer that is drawn rather than typeset: the falling
// code, the terminal hanging in the air, the tunnel of data and the hooded
// figure who codes their way through it. Two canvases are used, one behind
// the type and one in front of it, so the figure can sit in the foreground
// with text on the screen behind them.
//
// The hacker is always seen from the front, at a laptop, and is a puppet
// rather than a picture: every part is placed from the time and from the
// keys being struck, so they breathe, look about, and type.

const GLYPHS = "0123456789ABCDEF<>/{}[];=+*#$";
const TAU = Math.PI * 2;
/** How long a keystroke goes on mattering: the finger lifts, the sparks die. */
const STROKE_LIFE = 0.7;
const VIOLET = "169,139,255";
/** The cool light that picks out the hacker's edges from behind. */
const RIM = "150,150,255";

const mod = (value, size) => ((value % size) + size) % size;

/** A repeatable random number for any whole-number coordinates. */
export function hash(x, y = 0, z = 0) {
  let h = (x * 374761393 + y * 668265263 + z * 1274126177) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

export const scramble = (x, y) =>
  GLYPHS[Math.floor(hash(x, y, 7) * GLYPHS.length)];

/** "#rrggbb" to "r,g,b", for building rgba() colours. */
export const rgb = (hex) =>
  [1, 3, 5].map((at) => parseInt(hex.slice(at, at + 2), 16)).join(",");

/** One keystroke: which hand (0 left, 1 right) and finger struck, and when. */
const stroke = (id, at) => ({
  id,
  at,
  hand: hash(id, 12) < 0.5 ? 0 : 1,
  finger: Math.floor(hash(id, 13) * 4),
});

/** The recent keystrokes out of a list of the times keys are struck. */
export function scriptedTyping(keys, time) {
  const strokes = [];
  keys.forEach((at, id) => {
    if (at <= time && time - at < STROKE_LIFE) strokes.push(stroke(id, at));
  });
  return strokes;
}

/** The recent keystrokes of someone typing flat out, in bursts. */
export function freeTyping(time, rate = 13) {
  const strokes = [];
  const first = Math.max(0, Math.ceil((time - STROKE_LIFE) * rate));
  for (let id = first; id <= time * rate; id++) {
    // A short breath between bursts.
    if (hash(Math.floor(id / 8), 11) < 0.16) continue;
    strokes.push(stroke(id, id / rate));
  }
  return strokes;
}

export function createFx(backCanvas, frontCanvas) {
  for (const canvas of [backCanvas, frontCanvas]) {
    canvas.width = 1920;
    canvas.height = 1080;
  }
  const back = backCanvas.getContext("2d");
  const front = frontCanvas.getContext("2d");
  // The hacker is drawn here first, so the finished figure can be laid down
  // more than once: as the echoes streaming out behind them, or torn.
  const puppetCanvas = document.createElement("canvas");
  puppetCanvas.width = 1920;
  puppetCanvas.height = 1080;
  const puppet = puppetCanvas.getContext("2d");
  // And each part of the hacker is painted here before it joins the rest.
  const partCanvas = document.createElement("canvas");
  partCanvas.width = 1920;
  partCanvas.height = 1080;
  const part = partCanvas.getContext("2d");

  return {
    clear() {
      back.clearRect(0, 0, 1920, 1080);
      front.clearRect(0, 0, 1920, 1080);
    },

    /** Columns of code falling down the whole frame. */
    rain(time, alpha) {
      if (alpha <= 0) return;
      back.font = '22px "Geist Mono", monospace';
      for (let column = 0; column < 69; column++) {
        const speed = 5 + hash(column) * 9;
        const head = (time * speed + hash(column, 1) * 62) % 62;
        for (let trail = 0; trail < 16; trail++) {
          const row = Math.floor(head) - trail;
          if (row < 0 || row > 42) continue;
          back.fillStyle =
            trail === 0
              ? `rgba(230,255,170,${alpha})`
              : `rgba(169,139,255,${alpha * (1 - trail / 16) * 0.7})`;
          const turn = Math.floor(time * 5 + hash(column, row) * 5);
          back.fillText(
            scramble(column * 64 + row, turn),
            column * 28 + 6,
            row * 26 + 20,
          );
        }
      }
    },

    /**
     * The opening's set: the terminal the hacker's laptop throws into the air
     * beside them (trailer.html sets its text inside), and two smaller
     * read-outs on the other side. `alpha` flickers it on.
     */
    terminal(time, colour, alpha) {
      // Light thrown by the laptop, low in the frame.
      const spill = back.createRadialGradient(620, 860, 80, 620, 860, 1000);
      spill.addColorStop(0, `rgba(${colour},0.2)`);
      spill.addColorStop(1, `rgba(${colour},0)`);
      back.fillStyle = spill;
      back.fillRect(0, 0, 1920, 1080);
      if (alpha <= 0) return;

      // The beam that carries the picture from the laptop to the panel.
      const beam = back.createLinearGradient(900, 860, 1500, 640);
      beam.addColorStop(0, `rgba(${colour},${0.16 * alpha})`);
      beam.addColorStop(1, `rgba(${colour},${0.02 * alpha})`);
      back.beginPath();
      back.moveTo(880, 858);
      back.lineTo(950, 858);
      back.lineTo(1800, 650);
      back.lineTo(1100, 650);
      back.closePath();
      back.fillStyle = beam;
      back.fill();

      // The terminal.
      const [x, y, width, height] = [1100, 210, 700, 440];
      const glass = back.createLinearGradient(0, y, 0, y + height);
      glass.addColorStop(0, `rgba(${colour},${0.1 * alpha})`);
      glass.addColorStop(1, `rgba(${colour},${0.03 * alpha})`);
      back.fillStyle = "rgba(6,6,8,0.72)";
      back.fillRect(x, y, width, height);
      back.fillStyle = glass;
      back.fillRect(x, y, width, height);
      back.fillStyle = `rgba(${colour},${0.12 * alpha})`;
      back.fillRect(x, y, width, 46);
      // A band of brighter light drifts down it, as on a projection.
      const band = y + 46 + mod(time * 150, height - 46);
      back.fillStyle = `rgba(${colour},${0.07 * alpha})`;
      back.fillRect(x, band, width, Math.min(26, y + height - band));
      back.strokeStyle = `rgba(${colour},${0.38 * alpha})`;
      back.lineWidth = 2;
      back.strokeRect(x, y, width, height);
      // Brackets on the corners.
      back.strokeStyle = `rgba(${colour},${alpha})`;
      back.lineWidth = 4;
      for (const [cornerX, cornerY, signX, signY] of [
        [x, y, 1, 1],
        [x + width, y, -1, 1],
        [x, y + height, 1, -1],
        [x + width, y + height, -1, -1],
      ]) {
        back.beginPath();
        back.moveTo(cornerX + signX * 34, cornerY);
        back.lineTo(cornerX, cornerY);
        back.lineTo(cornerX, cornerY + signY * 34);
        back.stroke();
      }
      ["#ff4d6a", "#fbbf24", "#c8ff2e"].forEach((dot, index) => {
        back.beginPath();
        back.arc(x + 28 + index * 26, y + 23, 7, 0, TAU);
        back.fillStyle = dot;
        back.globalAlpha = alpha;
        back.fill();
      });
      back.fillStyle = "#a6a6b0";
      back.font = '18px "Geist Mono", monospace';
      back.fillText("devshowdown — arena", x + 250, y + 30);
      back.globalAlpha = 1;

      // The read-outs: code scrolling by, too small and too fast to read.
      for (const [left, top, wide, tall, seed] of [
        [70, 230, 250, 190, 1],
        [110, 600, 210, 150, 2],
      ]) {
        back.fillStyle = `rgba(${VIOLET},${0.05 * alpha})`;
        back.fillRect(left, top, wide, tall);
        back.strokeStyle = `rgba(${VIOLET},${0.35 * alpha})`;
        back.lineWidth = 2;
        back.strokeRect(left, top, wide, tall);
        const scroll = time * (30 + seed * 14);
        const first = Math.floor(scroll / 14);
        back.save();
        back.beginPath();
        back.rect(left, top, wide, tall);
        back.clip();
        for (let line = 0; line <= tall / 14; line++) {
          const row = first + line;
          const lineY = top + 10 + line * 14 - (scroll % 14);
          const indent = Math.floor(hash(row, seed, 31) * 4) * 14;
          const long = (0.2 + hash(row, seed, 32) * 0.6) * (wide - 40);
          back.fillStyle = `rgba(${VIOLET},${(0.25 + hash(row, seed, 33) * 0.45) * alpha})`;
          back.fillRect(left + 14 + indent, lineY, long - indent, 4);
        }
        back.restore();
      }
    },

    /**
     * A corridor of light rushing past, seen from inside. `travel` is how far
     * along it we are: growing, it comes at us; shrinking, it falls away
     * behind whoever is flying towards us. `colour` is "r,g,b".
     */
    tunnel(time, travel, colour, alpha, centreX, centreY) {
      if (alpha <= 0) return;
      const glow = back.createRadialGradient(
        centreX,
        centreY,
        0,
        centreX,
        centreY,
        520,
      );
      glow.addColorStop(0, `rgba(${colour},${0.42 * alpha})`);
      glow.addColorStop(1, `rgba(${colour},0)`);
      back.fillStyle = glow;
      back.fillRect(0, 0, 1920, 1080);

      // Frames of the corridor, small and dim far away, vast as they pass.
      const frames = 16;
      for (let index = 0; index < frames; index++) {
        const depth = mod(index + travel * 3, frames) / frames;
        const size = depth ** 2.4 * 3.2 + 0.02;
        const toward = Math.min(1, size / 1.6);
        const x = centreX + (960 - centreX) * toward;
        const y = centreY + (540 - centreY) * toward;
        const fade =
          Math.min(1, depth * 3) * (1 - Math.max(0, depth - 0.8) * 5);
        back.strokeStyle = `rgba(${colour},${alpha * fade * 0.75})`;
        back.lineWidth = 1 + depth * 4;
        back.strokeRect(
          x - 1056 * size,
          y - 594 * size,
          2112 * size,
          1188 * size,
        );
      }

      // Streaks and stray characters flying outward along the walls.
      back.lineWidth = 2;
      for (let index = 0; index < 34; index++) {
        const angle = hash(index, 3) * TAU;
        const depth = mod(hash(index, 4) + travel * 0.9, 1);
        const radius = depth ** 2.4 * 1500 + 30;
        back.strokeStyle = `rgba(${colour},${alpha * depth * 0.8})`;
        back.beginPath();
        back.moveTo(
          centreX + Math.cos(angle) * radius,
          centreY + Math.sin(angle) * radius,
        );
        back.lineTo(
          centreX + Math.cos(angle) * radius * 1.22,
          centreY + Math.sin(angle) * radius * 1.22,
        );
        back.stroke();
      }
      for (let index = 0; index < 80; index++) {
        const angle = hash(index, 5) * TAU;
        const depth = mod(hash(index, 6) + travel * 0.55, 1);
        const radius = depth ** 2.2 * 1350 + 24;
        back.font = `${Math.round(10 + depth * 36)}px "Geist Mono", monospace`;
        back.fillStyle = `rgba(${colour},${alpha * depth})`;
        back.fillText(
          scramble(index, Math.floor(time * 8 + index)),
          centreX + Math.cos(angle) * radius,
          centreY + Math.sin(angle) * radius,
        );
      }
    },

    /**
     * The hacker, face on, coding: hood up, most of them lost in the dark,
     * masked, the laptop lighting them from below and its code showing in
     * the mask's eyes. They are painted the way a figure is lit on a film set: a key
     * light (the screen, in `colour`), a cool light from behind to pick out
     * the edges, and soft shadow everywhere else. `x, y` is the middle of
     * the chest and the figure is about 800 wide at `scale` 1.
     *
     *   time     moves everything that moves on its own
     *   colour   the light of the screen, "r,g,b"; `power` is how strong
     *   strokes  the recent keystrokes (see scriptedTyping, freeTyping)
     *   look     where the head is turned, in pixels off straight ahead
     *   flare    0 to 1, the eyes of the mask blazing
     *   hover    cross-legged in mid-air, ringed with code, not at a desk
     *   wind     0 to 1, how hard the air is pulling at them
     *   tear     0 to 1, the figure breaking up like a bad signal
     *   echo     a point their afterimages stream away towards
     */
    hacker(
      x,
      y,
      scale,
      {
        time,
        colour,
        power,
        strokes = [],
        look = { x: 0, y: 0 },
        flare = 0,
        hover = false,
        wind = 0,
        tear = 0,
        echo = null,
      },
    ) {
      const c = puppet;
      const place = (context) => {
        context.setTransform(scale, 0, 0, scale, x, y);
        context.lineCap = "round";
        context.lineJoin = "round";
      };
      c.setTransform(1, 0, 0, 1, 0, 0);
      c.clearRect(0, 0, 1920, 1080);
      place(c);

      // How far down each finger is, and how hard each hand just hit.
      const press = [
        [0, 0, 0, 0],
        [0, 0, 0, 0],
      ];
      const jolt = [0, 0];
      for (const { at, hand, finger } of strokes) {
        const down = Math.exp(-(time - at) * 18);
        press[hand][finger] = Math.max(press[hand][finger], down);
        jolt[hand] = Math.max(jolt[hand], down);
      }
      const struck = Math.max(jolt[0], jolt[1]);
      const breath = Math.sin(time * 1.7);
      const rise = -breath * 3.5;
      // A screen never lights anything quite steadily.
      const lit =
        power * (0.88 + 0.12 * hash(Math.floor(time * 24), 21)) + 0.14 * struck;
      const light = (alpha) => `rgba(${colour},${Math.max(0, alpha)})`;
      const cool = (alpha) => `rgba(${RIM},${Math.max(0, alpha)})`;
      const dark = (alpha) => `rgba(0,0,0,${alpha})`;

      // The brushes. Blur is given in the figure's own units.
      const soften = (context, radius) => {
        context.filter =
          radius > 0 ? `blur(${(radius * scale).toFixed(2)}px)` : "none";
      };
      const blob = (context, atX, atY, wide, tall, paint, soft = 0) => {
        soften(context, soft);
        context.fillStyle = paint;
        context.beginPath();
        context.ellipse(atX, atY, wide, tall, 0, 0, TAU);
        context.fill();
        soften(context, 0);
      };
      const draw = (context, path, paint, width, soft = 0) => {
        soften(context, soft);
        context.strokeStyle = paint;
        context.lineWidth = width;
        context.stroke(typeof path === "string" ? new Path2D(path) : path);
        soften(context, 0);
      };
      const fade = (context, fromY, toY, stops) => {
        const gradient = context.createLinearGradient(0, fromY, 0, toY);
        stops.forEach(([at, paint]) => gradient.addColorStop(at, paint));
        return gradient;
      };
      /**
       * Paints one part of the figure: `base` lays down its shape, and
       * whatever `shade` then paints (light, shadow, folds) lands only on
       * that shape, however soft the brush.
       */
      const piece = (base, shade, pose) => {
        part.setTransform(1, 0, 0, 1, 0, 0);
        part.clearRect(0, 0, 1920, 1080);
        part.save();
        place(part);
        pose?.(part);
        base(part);
        part.globalCompositeOperation = "source-atop";
        shade(part);
        part.restore();
        c.save();
        c.setTransform(1, 0, 0, 1, 0, 0);
        c.drawImage(partCanvas, 0, 0);
        c.restore();
      };

      /** The ring of code that circles them in the air; one half at a time. */
      const orbit = (front) => {
        c.save();
        c.translate(0, 330);
        c.rotate(-0.1);
        for (let index = 0; index < 30; index++) {
          const angle = (index / 30) * TAU + time * 1.15;
          const near = Math.sin(angle);
          if (near > 0 !== front) continue;
          const size = 28 + near * 11;
          c.font = `${Math.round(size)}px "Geist Mono", monospace`;
          c.fillStyle = light((0.22 + 0.32 * (near + 1)) * power);
          c.fillText(
            scramble(index, Math.floor(time * 6 + index * 0.37)),
            Math.cos(angle) * 520 - size * 0.3,
            near * 120,
          );
        }
        c.restore();
      };

      if (hover) {
        // The screen lights the air around them, and nothing holds them up.
        const halo = c.createRadialGradient(0, 200, 40, 0, 200, 720);
        halo.addColorStop(0, light(0.42 * power));
        halo.addColorStop(1, light(0));
        c.fillStyle = halo;
        c.fillRect(-800, -600, 1600, 1500);
        blob(c, 0, 716, 420, 46, light(0.5 * power), 26);
        orbit(false);

        // Legs, crossed under the laptop.
        const legs = new Path2D(
          "M-320 470C-480 480-530 590-400 646C-260 696-90 664 0 644" +
            "C90 664 260 696 400 646C530 590 480 480 320 470Z",
        );
        piece(
          (p) => {
            p.fillStyle = "#08080d";
            p.fill(legs);
          },
          (p) => {
            blob(p, 0, 520, 330, 70, light(0.3 * lit), 34);
            draw(p, legs, cool(0.55), 10, 5);
            draw(p, "M-340 596Q-90 556 150 652", dark(0.75), 12, 5);
            draw(p, "M340 600Q200 570 60 640", dark(0.5), 10, 6);
            p.fillStyle = fade(p, 560, 700, [
              [0, dark(0)],
              [1, dark(0.75)],
            ]);
            p.fillRect(-600, 560, 1200, 160);
          },
        );
      } else {
        // The desk the laptop is on, catching a little of its light.
        c.fillStyle = fade(c, 560, 760, [
          [0, "#0b0b11"],
          [1, "#030304"],
        ]);
        c.fillRect(-2400, 560, 4800, 900);
        blob(c, 0, 600, 620, 40, light(0.16 * lit), 30);
        const sheen = c.createLinearGradient(-900, 0, 900, 0);
        sheen.addColorStop(0, light(0));
        sheen.addColorStop(0.5, light(0.4 * lit));
        sheen.addColorStop(1, light(0));
        c.fillStyle = sheen;
        c.fillRect(-900, 560, 1800, 2);
      }

      // Body: the hoodie from the neck down.
      const torso = new Path2D(
        "M-112 0C-165 28-250 56-300 98C-336 128-342 200-332 300L-312 590" +
          "L312 590L332 300C342 200 336 128 300 98C250 56 165 28 112 0" +
          "C60 30-60 30-112 0Z",
      );
      piece(
        (p) => {
          p.fillStyle = "#0a0a10";
          p.fill(torso);
        },
        (p) => {
          // The screen on the chest, falling off towards the shoulders.
          blob(p, 0, 370, 210, 180, light(0.26 * lit), 60);
          blob(p, 0, 330, 120, 60, light(0.22 * lit), 30);
          // The shadow the hood and chin throw down the front.
          blob(p, 0, 70, 210, 64, dark(0.8), 26);
          // Cloth pulling in from under the arms.
          draw(p, "M-262 190Q-180 300-70 330", dark(0.5), 16, 9);
          draw(p, "M262 190Q180 300 70 330", dark(0.5), 16, 9);
          draw(p, "M-250 214Q-170 316-74 344", light(0.1 * lit), 7, 5);
          draw(p, "M250 214Q170 316 74 344", light(0.1 * lit), 7, 5);
          draw(p, "M-200 120Q-150 200-150 300", dark(0.3), 12, 8);
          draw(p, "M200 120Q150 200 150 300", dark(0.3), 12, 8);
          // The zip.
          draw(p, "M0 44L0 345", dark(0.85), 5);
          draw(p, "M3 60L3 345", light(0.2 * lit), 1.5);
          // The cool light from behind, along the top of the shoulders.
          draw(
            p,
            torso,
            fade(p, 0, 230, [
              [0, cool(0.85)],
              [0.5, cool(0.5)],
              [1, cool(0)],
            ]),
            9,
            3.5,
          );
        },
        (p) => p.translate(0, rise * 0.5),
      );

      // Light standing in the air between the screen and their face.
      c.save();
      c.globalCompositeOperation = "lighter";
      soften(c, 26);
      c.fillStyle = fade(c, 340, -120, [
        [0, light(0.2 * lit)],
        [1, light(0)],
      ]);
      c.beginPath();
      c.moveTo(-270, 340);
      c.lineTo(270, 340);
      c.lineTo(400, -120);
      c.lineTo(-400, -120);
      c.closePath();
      c.fill();
      for (let shaft = 0; shaft < 5; shaft++) {
        const lean = (shaft - 2) / 2;
        const bright = hash(shaft, Math.floor(time * 7), 41);
        c.fillStyle = light(0.06 * lit * bright);
        c.beginPath();
        c.moveTo(lean * 230 - 14, 340);
        c.lineTo(lean * 230 + 14, 340);
        c.lineTo(lean * 370 + 70, -100);
        c.lineTo(lean * 370 - 70, -100);
        c.closePath();
        c.fill();
      }
      soften(c, 0);
      c.restore();

      // Head. The face turns further than the hood does, which is what makes
      // it a head and not a mask.
      const turn = { x: look.x + Math.sin(time * 0.8) * 3, y: look.y };
      const headPose = (p) => {
        p.translate(turn.x * 0.5, turn.y * 0.5 + rise - struck * 2);
        p.translate(0, 40);
        p.rotate(turn.x * 0.004 + Math.sin(time * 0.9 + 1) * 0.018);
        p.translate(0, -40);
      };
      const hood = new Path2D(
        "M-152 40C-178-40-182-150-162-222C-136-312-70-352 0-352" +
          "C70-352 136-312 162-222C182-150 178-40 152 40" +
          "C120 72 60 88 0 92C-60 88-120 72-152 40Z",
      );
      const opening = new Path2D(
        "M-98-40C-113-100-113-200-92-252C-70-298-35-311 0-311" +
          "C35-311 70-298 92-252C113-200 113-100 98-40" +
          "C70 10 30 34 0 40C-30 34-70 10-98-40Z",
      );
      // The mask they wear: the grinning one, moustache and all.
      const face = new Path2D(
        "M-80-205C-82-150-76-105-52-72C-34-50-14-40 0-38" +
          "C14-40 34-50 52-72C76-105 82-150 80-205" +
          "C80-262 46-292 0-292C-46-292-80-262-80-205Z",
      );
      const blaze = Math.min(1.6, 0.55 + 0.45 * lit + flare);

      // Inside the hood: the neck, and the mask.
      piece(
        (p) => {
          p.fillStyle = "#020203";
          p.fill(opening);
        },
        (p) => {
          p.translate(turn.x * 0.45, turn.y * 0.45);
          // Neck and the collar of whatever is under the hoodie.
          p.fillStyle = "#0b090c";
          p.fillRect(-50, -90, 100, 150);
          blob(p, 0, -6, 40, 34, light(0.2 * lit), 16);
          blob(p, 0, -44, 70, 22, dark(0.9), 10);

          // The shadow the mask throws on the neck, then the mask: glossy and
          // pale, so it takes the screen's colour far more than skin would.
          blob(p, 0, -34, 60, 14, dark(0.9), 8);
          p.fillStyle = "#2b2b31";
          p.fill(face);
          p.save();
          p.clip(face);
          // Lit from underneath: everything that faces down is bright, and
          // it falls away up the mask into the hood's shadow.
          p.fillStyle = fade(p, -40, -290, [
            [0, light(0.78 * lit)],
            [0.35, light(0.46 * lit)],
            [0.7, light(0.2 * lit)],
            [1, light(0.04 * lit)],
          ]);
          p.fillRect(-100, -300, 200, 270);
          // The cheeks stand proud, and are painted a little rosy.
          for (const side of [-1, 1]) {
            blob(p, side * 50, -122, 22, 18, light(0.26 * lit), 9);
            blob(p, side * 51, -128, 15, 12, "rgba(255,120,130,0.2)", 6);
            blob(p, side * 48, -112, 12, 5, "rgba(255,255,255,0.2)", 4);
            // Hollows beside the nose and under the cheekbones.
            blob(p, side * 24, -138, 8, 20, dark(0.34), 6);
            blob(p, side * 62, -92, 12, 22, dark(0.4), 9);
            // The brow ridge, bright along its underside.
            blob(p, side * 42, -200, 30, 5, light(0.22 * lit), 4);
          }
          // Nose: long and sharp, bright underneath, its shadow going up.
          blob(p, 0, -146, 8, 26, dark(0.42), 5);
          draw(p, "M-9-176L-12-134", light(0.2 * lit), 3, 2.5);
          draw(p, "M9-176L12-134", light(0.2 * lit), 3, 2.5);
          blob(p, 0, -127, 13, 6, light(0.6 * lit), 3.5);
          blob(p, 0, -128, 6, 3, "rgba(255,255,255,0.34)", 2);
          blob(p, -6.5, -122, 3.2, 2, dark(0.9), 0.8);
          blob(p, 6.5, -122, 3.2, 2, dark(0.9), 0.8);
          // Chin and lower lip catch the most of all.
          blob(p, 0, -52, 30, 9, "rgba(255,255,255,0.22)", 6);
          blob(p, 0, -88, 18, 4.5, light(0.4 * lit), 3);

          // The painted face: arched brows, the thin moustache curling up,
          // the fixed smile, the sliver of beard.
          const ink = "rgba(4,4,6,0.94)";
          for (const side of [-1, 1]) {
            p.save();
            p.scale(side, 1);
            draw(p, "M-72-204Q-46-232-15-203", ink, 4.2, 0.4);
            p.fillStyle = ink;
            p.fill(
              new Path2D(
                "M-2-113C-18-104-36-104-50-118C-56-124-59-132-58-141" +
                  "C-54-130-48-122-40-118C-28-112-14-113-2-118Z",
              ),
            );
            draw(p, "M0-96Q-22-88-43-103", ink, 2.6, 0.4);
            draw(p, "M-40-108Q-47-104-46-97", ink, 2.2, 0.4);
            p.restore();
          }
          p.fillStyle = ink;
          p.fill(new Path2D("M-5.5-82L5.5-82L0-50Z"));
          draw(p, "M-18-91Q0-84 18-91", "rgba(4,4,6,0.5)", 2, 0.8);

          // The hood's shadow over the forehead, and the sides turning away.
          p.fillStyle = fade(p, -196, -280, [
            [0, dark(0)],
            [1, dark(0.82)],
          ]);
          p.fillRect(-120, -320, 240, 140);
          const turnAway = p.createLinearGradient(-84, 0, 84, 0);
          turnAway.addColorStop(0, dark(0.82));
          turnAway.addColorStop(0.28, dark(0));
          turnAway.addColorStop(0.72, dark(0));
          turnAway.addColorStop(1, dark(0.82));
          p.fillStyle = turnAway;
          p.fillRect(-100, -300, 200, 270);

          // The eyes: narrow slits, and behind them the screen, with the
          // code on it going by.
          for (const side of [-1, 1]) {
            p.save();
            p.translate(side * 42, -176);
            p.scale(side, 1);
            const slit = new Path2D("M-27 3Q-4-17 25-2Q0 12-27 3Z");
            draw(p, slit, dark(0.6), 7, 3);
            p.fillStyle = "#020203";
            p.fill(slit);
            p.save();
            p.clip(slit);
            p.fillStyle = light(0.3 * blaze);
            p.fillRect(-30, -20, 60, 40);
            const scroll = time * 16;
            const first = Math.floor(scroll / 4);
            for (let line = 0; line < 9; line++) {
              const row = first + line;
              const indent = Math.floor(hash(row, 31) * 3) * 5;
              p.fillStyle = light((0.6 + 0.4 * hash(row, 33)) * blaze);
              p.fillRect(
                -24 + indent,
                -16 + line * 4 - (scroll % 4),
                8 + hash(row, 32) * 30,
                1.7,
              );
            }
            // The lid's shadow inside the slit.
            p.fillStyle = fade(p, -14, 2, [
              [0, dark(0.85)],
              [1, dark(0)],
            ]);
            p.fillRect(-30, -20, 60, 24);
            p.restore();
            draw(p, slit, ink, 2.2, 0.3);
            p.restore();
          }
          p.restore();
          // The mask's edge: dark where it turns under, lit along the jaw.
          draw(p, face, dark(0.75), 3, 1);
          draw(
            p,
            "M-52-72C-34-50-14-40 0-38C14-40 34-50 52-72",
            light(0.7 * lit),
            2.2,
            1,
          );
          // The glow of the eyes on the mask round them.
          p.globalCompositeOperation = "lighter";
          for (const side of [-1, 1]) {
            blob(
              p,
              side * 42,
              -176,
              34 + 16 * flare,
              18 + 14 * flare,
              light(0.14 * blaze + 0.16 * flare),
              12,
            );
          }
          p.globalCompositeOperation = "source-atop";
        },
        headPose,
      );

      // The hood itself.
      piece(
        (p) => {
          p.fillStyle = fade(p, -352, 92, [
            [0, "#0f0f16"],
            [1, "#08080c"],
          ]);
          p.beginPath();
          p.fill(
            (() => {
              const shell = new Path2D(hood);
              shell.addPath(opening);
              return shell;
            })(),
            "evenodd",
          );
        },
        (p) => {
          // Folds running down from the crown.
          for (const side of [-1, 1]) {
            p.save();
            p.scale(side, 1);
            draw(p, "M-12-350C-110-300-150-200-140-60", dark(0.7), 14, 8);
            draw(p, "M-30-346C-128-292-166-190-158-70", "#ffffff12", 6, 5);
            draw(p, "M-150-180C-160-90-140 0-90 50", dark(0.55), 16, 9);
            draw(p, "M-124-30C-110 20-60 56-10 66", dark(0.5), 12, 7);
            p.restore();
          }
          draw(p, "M0-352L0-312", dark(0.7), 4, 1.5);
          // The screen catches the cloth where it hangs under the chin.
          blob(p, 0, 74, 150, 36, light(0.34 * lit), 20);
          // Dark where the cloth rolls into the opening, then its lit lip.
          draw(p, opening, dark(0.85), 30, 9);
          draw(
            p,
            opening,
            fade(p, -311, 40, [
              [0, light(0)],
              [0.45, light(0.08 * lit)],
              [1, light(0.85 * lit)],
            ]),
            9,
            2.2,
          );
          // The cool light from behind, round the outside.
          draw(
            p,
            hood,
            fade(p, -352, 60, [
              [0, cool(1)],
              [0.55, cool(0.6)],
              [1, cool(0)],
            ]),
            11,
            4,
          );
          draw(
            p,
            hood,
            fade(p, -352, -40, [
              [0, cool(0.9)],
              [1, cool(0)],
            ]),
            2.5,
            0.8,
          );
        },
        headPose,
      );

      // Drawstrings, swinging off the bottom of the hood.
      c.save();
      headPose(c);
      for (const side of [-1, 1]) {
        const swing =
          Math.sin(time * (2.3 + wind * 6) + side) * (6 + wind * 15) -
          turn.x * 0.5;
        const endX = side * 36 + swing;
        const cord = `M${side * 36} 70Q${side * 36 + swing * 0.2} 160 ${endX} 232`;
        draw(c, cord, "#050507", 8);
        draw(c, cord, "#22222c", 5);
        draw(c, `M${endX} 226L${endX} 246`, "#7d7d8c", 6);
        draw(c, `M${endX + 1.5} 228L${endX + 1.5} 244`, light(0.8 * lit), 2);
      }
      c.restore();

      // Arms, down from the shoulders and in to the keys.
      const hands = [];
      [-1, 1].forEach((side, hand) => {
        const hit = jolt[hand];
        const shoulder = [side * 296, 150 + rise - hit * 2.5];
        const elbow = [side * (338 + hit * 3), 436 + rise * 0.4];
        const wrist = [side * 128, 316 - hit * 3];
        hands.push(wrist);
        const curve = (from, bend, to, shiftX = 0, shiftY = 0) =>
          `M${from[0] + shiftX} ${from[1] + shiftY}Q${bend[0] + shiftX} ${bend[1] + shiftY} ${to[0] + shiftX} ${to[1] + shiftY}`;
        const upperBend = [side * 352, 280];
        const foreBend = [side * 272, 446];
        piece(
          (p) => {
            draw(p, curve(shoulder, upperBend, elbow), "#0a0a10", 100);
            draw(p, curve(elbow, foreBend, wrist), "#0a0a10", 80);
          },
          (p) => {
            // The forearm's top faces the screen; the upper arm's inside
            // catches a little.
            draw(
              p,
              curve(elbow, foreBend, wrist, 0, -20),
              light(0.4 * lit),
              26,
              14,
            );
            draw(
              p,
              curve(shoulder, upperBend, elbow, -side * 30, 0),
              light(0.24 * lit),
              32,
              18,
            );
            blob(p, wrist[0], wrist[1] + 6, 60, 40, light(0.34 * lit), 18);
            // The cool edge down the outside, and under the forearm.
            draw(
              p,
              curve(shoulder, upperBend, elbow, side * 45, -8),
              cool(0.7),
              11,
              5,
            );
            draw(
              p,
              curve(elbow, foreBend, wrist, side * 6, 43),
              cool(0.4),
              9,
              5,
            );
            // Creases in the elbow, and the ribbed cuff.
            for (let crease = 0; crease < 3; crease++) {
              const out = 300 + crease * 16;
              draw(
                p,
                `M${side * out} ${384 + crease * 8}Q${side * (out + 26)} ${408 + crease * 6} ${side * (out + 6)} ${440 + crease * 4}`,
                dark(0.55),
                6,
                3,
              );
            }
            draw(
              p,
              `M${wrist[0] + side * 34} ${wrist[1] - 34}L${wrist[0] + side * 46} ${wrist[1] + 44}`,
              dark(0.6),
              7,
              3,
            );
          },
        );
      });

      // Hands, lit hard by the screen right under them.
      piece(
        (p) => {
          [-1, 1].forEach((side, hand) => {
            const [handX, handY] = hands[hand];
            const digit = (fromX, fromY, toX, toY, width) => {
              draw(p, `M${fromX} ${fromY}L${toX} ${toY}`, "#040405", width + 5);
              draw(p, `M${fromX} ${fromY}L${toX} ${toY}`, "#3b2c29", width);
            };
            // Back of the hand, thumb, then each finger dipping as it strikes.
            digit(
              handX - side * 22,
              handY - 4,
              handX + side * 25,
              handY - 6,
              46,
            );
            digit(
              handX - side * 40,
              handY + 2,
              handX - side * 60,
              handY + 26,
              17,
            );
            for (let finger = 0; finger < 4; finger++) {
              const down = press[hand][finger];
              const spread = finger - 1.5;
              const fingerX = handX + side * spread * 25;
              const knuckleY = handY + 4 - (1.5 - Math.abs(spread)) * 3;
              digit(
                fingerX,
                knuckleY + down * 6,
                fingerX + side * spread * 2,
                knuckleY + 42 + down * 10,
                19,
              );
            }
          });
        },
        (p) => {
          for (const [handX, handY] of hands) {
            // Up-lit: bright where the fingers go down to the keys, the
            // back of the hand falling off into shadow.
            p.fillStyle = fade(p, handY - 30, handY + 46, [
              [0, light(0.12 * lit)],
              [0.5, light(0.5 * lit)],
              [1, light(0.92 * lit)],
            ]);
            p.fillRect(handX - 90, handY - 40, 180, 100);
            blob(p, handX, handY - 22, 60, 16, dark(0.7), 9);
            for (let knuckle = 0; knuckle < 4; knuckle++) {
              blob(
                p,
                handX + (knuckle - 1.5) * 25,
                handY + 8,
                6,
                4,
                "rgba(255,255,255,0.16)",
                2.5,
              );
            }
          }
        },
      );

      // The laptop, its back to us, the screen's light spilling over the top.
      const lid = new Path2D(
        "M-306 338L306 338Q320 338 322 352L352 552Q354 566 340 566" +
          "L-340 566Q-354 566-352 552L-322 352Q-320 338-306 338Z",
      );
      piece(
        (p) => {
          p.fillStyle = fade(p, 338, 566, [
            [0, "#191920"],
            [0.5, "#101016"],
            [1, "#07070a"],
          ]);
          p.fill(lid);
        },
        (p) => {
          // Brushed metal: one broad soft reflection, and a darker foot.
          p.save();
          p.transform(1, 0, -0.5, 1, 0, 0);
          p.fillStyle = "rgba(255,255,255,0.035)";
          soften(p, 14);
          p.fillRect(150, 320, 150, 280);
          p.fillRect(360, 320, 40, 280);
          soften(p, 0);
          p.restore();
          draw(p, lid, "rgba(255,255,255,0.2)", 2.5, 0.6);
          blob(p, 0, 338, 330, 14, light(0.5 * lit), 10);
          // The mark on the lid: two prompts facing off across a cursor.
          const pulse = Math.min(
            1,
            0.62 + 0.2 * Math.sin(time * 3.2) + 0.3 * struck,
          );
          p.lineCap = "square";
          p.lineJoin = "miter";
          for (const [side, tint] of [
            [-1, VIOLET],
            [1, "200,255,46"],
          ]) {
            const chevron = `M${side * 46} 432L${side * 23} 455L${side * 46} 478`;
            draw(p, chevron, `rgba(${tint},${0.6 * pulse})`, 16, 10);
            draw(p, chevron, `rgba(${tint},${pulse})`, 7.5);
          }
          p.lineCap = "round";
          p.lineJoin = "round";
          if (time % 0.9 < 0.6) {
            blob(p, 0, 455, 12, 36, "rgba(243,243,238,0.3)", 8);
            p.fillStyle = "#f3f3ee";
            p.fillRect(-3.5, 426, 7, 58);
          }
        },
      );
      // The line of light along the top edge of the lid.
      c.save();
      c.globalCompositeOperation = "lighter";
      draw(c, "M-300 337L300 337", light(0.5 * lit), 16, 12);
      draw(c, "M-304 337.5L304 337.5", light(Math.min(1, 0.5 + 0.5 * lit)), 3);
      c.restore();

      // Every key struck throws a little code up off the keyboard.
      c.save();
      c.globalCompositeOperation = "lighter";
      for (const { id, at, hand } of strokes) {
        const age = time - at;
        const [handX, handY] = hands[hand];
        const speedX = (hash(id, 51) - 0.5) * 380;
        const speedY = -(240 + hash(id, 52) * 380);
        c.font = `${Math.round(16 + hash(id, 53) * 14)}px "Geist Mono", monospace`;
        c.fillStyle = light((1 - age / STROKE_LIFE) ** 1.5 * 0.85);
        c.fillText(
          scramble(id, Math.floor(time * 12)),
          handX + speedX * age,
          handY - 20 + speedY * age + 300 * age * age,
        );
      }
      c.restore();

      if (hover) orbit(true);
      c.setTransform(1, 0, 0, 1, 0, 0);

      // Lay the finished figure down: echoes first, furthest and faintest.
      if (echo) {
        for (let step = 5; step >= 1; step--) {
          const away = step / 6;
          const size = 1 - away * 0.62;
          const atX = x + (echo.x - x) * away * 0.8;
          const atY = y + (echo.y - y) * away * 0.8;
          front.globalAlpha = 0.16 * (1 - away) * (0.6 + 0.4 * wind);
          front.drawImage(
            puppetCanvas,
            atX - x * size,
            atY - y * size,
            1920 * size,
            1080 * size,
          );
        }
        front.globalAlpha = 1;
      }
      if (tear > 0) {
        // In bands, each knocked sideways, with a ghost dragged further.
        const bands = 12;
        const tall = 1080 / bands;
        for (let band = 0; band < bands; band++) {
          const knock =
            (hash(band, Math.floor(time * 30), 61) - 0.5) * 150 * tear;
          for (const [alpha, far] of [
            [0.45 * tear, 2.2],
            [1, 1],
          ]) {
            front.globalAlpha = alpha;
            front.drawImage(
              puppetCanvas,
              0,
              band * tall,
              1920,
              tall,
              knock * far,
              band * tall,
              1920,
              tall,
            );
          }
        }
      } else {
        front.drawImage(puppetCanvas, 0, 0);
      }
      // Bloom: everything bright bleeds a little into what is round it.
      front.save();
      front.globalCompositeOperation = "screen";
      front.globalAlpha = 0.36;
      front.filter = `blur(${Math.max(6, 16 * Math.min(scale, 3)).toFixed(1)}px)`;
      front.drawImage(puppetCanvas, 0, 0);
      front.restore();
    },
  };
}
