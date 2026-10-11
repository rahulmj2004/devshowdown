import { createStorm } from "./storm";

export interface CircuitSceneOptions {
  /** A coarser board and fewer signals for small or weak devices. */
  lite: boolean;
  /** Holds the `[data-charge]` glyphs the board is wired to. */
  wordmark: HTMLElement | null;
  /** A second canvas behind the hero's content, for the lightning. */
  sky: HTMLCanvasElement | null;
}

const TAU = Math.PI * 2;
const VIOLET = "169,139,255";
const LIME = "200,255,46";
const CYAN = "127,233,255";
/** How far past the canvas the board is laid, so scrolling never bares an edge. */
const MARGIN = 120;
/** Seconds the board takes to draw itself outward from the wordmark. */
const REVEAL = 1.9;

interface Trace {
  /** The route from its pin on the wordmark (distance 0) to its far end. */
  path: Path2D;
  points: number[];
  /** Distance along the route at each point. */
  marks: number[];
  length: number;
  /** Index of the glyph its pin feeds. */
  glyph: number;
}

interface Signal {
  trace: Trace;
  at: number;
  /** Pixels a second; negative runs toward the wordmark. */
  speed: number;
  tail: number;
  colour: string;
  wait: number;
  /** Part of a surge: it fully charges its glyph and is answered. */
  surge: boolean;
  landed: boolean;
}

interface Ring {
  x: number;
  y: number;
  age: number;
  colour: string;
}

interface Glyph {
  node: HTMLElement;
  /** Centre and height, relative to the wordmark element. */
  cx: number;
  cy: number;
  height: number;
  charge: number;
  hold: number;
  /** Seconds until a surge reaches it; 0 when none is on its way. */
  due: number;
  applied: number;
}

const clamp = (value: number, low: number, high: number) =>
  Math.min(high, Math.max(low, value));
const between = (low: number, high: number) =>
  low + Math.random() * (high - low);

/** A soft round glow, drawn at the head of every signal. */
function glowSprite(rgb: string): HTMLCanvasElement {
  const sprite = document.createElement("canvas");
  sprite.width = sprite.height = 64;
  const context = sprite.getContext("2d");
  if (context) {
    const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
    gradient.addColorStop(0, `rgba(${rgb},1)`);
    gradient.addColorStop(0.3, `rgba(${rgb},0.45)`);
    gradient.addColorStop(1, `rgba(${rgb},0)`);
    context.fillStyle = gradient;
    context.fillRect(0, 0, 64, 64);
  }
  return sprite;
}

/**
 * The hero's circuit board, drawn on a 2D canvas behind the content. The
 * wordmark is the chip: traces are routed outward from its edges on a grid,
 * and signals run along them. One that reaches the wordmark charges the
 * letter its pin feeds, and that charge is written back as `--charge` so CSS
 * can light the type. Every so often, on a click in open space, and whenever
 * lightning strikes (see `createStorm`), a surge sweeps the whole board, the
 * name lights up and answers back down every trace. Traces near the mouse
 * glow. Rendering stops while the hero is off screen or the tab is hidden.
 * Returns a function that releases everything.
 */
export function mountCircuitScene(
  canvas: HTMLCanvasElement,
  options: CircuitSceneOptions,
): () => void {
  const context = canvas.getContext("2d");
  if (!context) return () => {};
  const { wordmark, lite } = options;
  const storm = options.sky ? createStorm(options.sky, lite) : null;

  const pixelRatio = Math.min(window.devicePixelRatio, lite ? 1 : 2);
  const glow = { [LIME]: glowSprite(LIME), [CYAN]: glowSprite(CYAN) };
  const capacity = lite ? 90 : 420;

  let width = 0;
  let height = 0;
  let unit = 1;

  // The board, in coordinates relative to the wordmark element.
  let glyphs: Glyph[] = [];
  let traces: Trace[] = [];
  let wires = new Path2D();
  let vias = new Path2D();
  let pins = new Path2D();
  let labels: { x: number; y: number; text: string }[] = [];
  const ink = { left: 0, top: 0, right: 0, bottom: 0 };
  let stale = true;
  // The wordmark's position on the canvas, refreshed every frame.
  let originX = 0;
  let originY = 0;
  let boundsLeft = 0;
  let boundsTop = 0;

  const signals: Signal[] = [];
  const rings: Ring[] = [];
  let grown = 0;
  let nextSignal = 0;
  let nextSurge = REVEAL + 0.5;
  let lastSurge = -10;
  let lastFlash = 0;
  const pointer = { x: 0, y: 0, at: -10 };

  let time = 0;
  let last = 0;
  let frame = 0;
  let inView = true;
  let visible = true;
  let disposed = false;

  // ---------------------------------------------------------------- board
  /**
   * Lays the board out around the wordmark as the browser placed it. Each
   * line of letters is a chip; walkers leave its edges one grid cell at a
   * time, straight or at 45°, never sharing a cell or crossing, and stop at
   * a via when they run out of room.
   */
  const build = () => {
    stale = false;
    for (const glyph of glyphs) glyph.node.style.removeProperty("--charge");
    const previous = glyphs;
    glyphs = [];
    traces = [];
    wires = new Path2D();
    vias = new Path2D();
    pins = new Path2D();
    labels = [];
    signals.length = 0;
    rings.length = 0;
    if (!wordmark) return;

    const origin = wordmark.getBoundingClientRect();
    const bounds = canvas.getBoundingClientRect();
    const rows: { left: number; top: number; right: number; bottom: number }[] =
      [];
    ink.left = ink.top = Infinity;
    ink.right = ink.bottom = -Infinity;
    wordmark
      .querySelectorAll<HTMLElement>("[data-charge]")
      .forEach((node, index) => {
        const rect = node.getBoundingClientRect();
        if (rect.width === 0 || rect.height === 0) return;
        const left = rect.left - origin.left;
        const top = rect.top - origin.top;
        const right = left + rect.width;
        const bottom = top + rect.height;
        glyphs.push({
          node,
          cx: (left + right) / 2,
          cy: (top + bottom) / 2,
          height: rect.height,
          charge: previous[index]?.charge ?? 0,
          hold: 0,
          due: 0,
          applied: -1,
        });
        // Letters that share a line share a chip.
        const row = rows.find(
          (each) => Math.abs(each.top - top) < rect.height / 2,
        );
        if (row) {
          row.left = Math.min(row.left, left);
          row.right = Math.max(row.right, right);
          row.bottom = Math.max(row.bottom, bottom);
        } else rows.push({ left, top, right, bottom });
        ink.left = Math.min(ink.left, left);
        ink.right = Math.max(ink.right, right);
        ink.top = Math.min(ink.top, top);
        ink.bottom = Math.max(ink.bottom, bottom);
      });
    if (glyphs.length === 0) return;

    const cell = lite ? 26 : clamp(Math.round(width / 60), 20, 28);
    const gridLeft = bounds.left - origin.left - MARGIN;
    const gridTop = bounds.top - origin.top - MARGIN;
    const columns = Math.ceil((width + MARGIN * 2) / cell);
    const lines = Math.ceil((height + MARGIN * 2) / cell);
    const taken = new Uint8Array(columns * lines);
    const crossed = new Uint8Array(columns * lines);
    const inside = (column: number, line: number) =>
      column >= 0 && column < columns && line >= 0 && line < lines;
    const centreX = (ink.left + ink.right) / 2;

    interface Walker {
      column: number;
      line: number;
      /** The way out from the chip, and the sideways step beside it. */
      outX: number;
      outY: number;
      sideX: number;
      sideY: number;
      /** Which side it tends to drift to, and how it is heading now. */
      drift: number;
      lean: number;
      cells: number[];
    }
    const walkers: Walker[] = [];
    const chips = rows.map((row) => ({
      left: Math.floor((row.left - gridLeft) / cell),
      right: Math.floor((row.right - gridLeft) / cell),
      top: Math.floor((row.top - gridTop) / cell),
      bottom: Math.floor((row.bottom - gridTop) / cell),
    }));
    for (const chip of chips) {
      for (let line = chip.top; line <= chip.bottom; line++) {
        for (let column = chip.left; column <= chip.right; column++) {
          if (inside(column, line)) taken[line * columns + column] = 1;
        }
      }
    }
    const seed = (column: number, line: number, outX: number, outY: number) => {
      if (!inside(column, line) || taken[line * columns + column]) return;
      taken[line * columns + column] = 1;
      const x = gridLeft + (column + 0.5) * cell;
      walkers.push({
        column,
        line,
        outX,
        outY,
        sideX: outY === 0 ? 0 : 1,
        sideY: outY === 0 ? 1 : 0,
        // Fan away from the middle of the name; the ends go either way.
        drift:
          outY === 0 ? (Math.random() < 0.5 ? -1 : 1) : x < centreX ? -1 : 1,
        lean: 0,
        cells: [column, line],
      });
    };
    for (const chip of chips) {
      for (let column = chip.left; column <= chip.right; column++) {
        if (Math.random() < 0.62) seed(column, chip.top - 1, 0, -1);
        // Sparser below, where the page's copy sits.
        if (Math.random() < 0.3) seed(column, chip.bottom + 1, 0, 1);
      }
      for (let line = chip.top; line <= chip.bottom; line++) {
        seed(chip.left - 1, line, -1, 0);
        seed(chip.right + 1, line, 1, 0);
      }
    }

    const finish = (walker: Walker, via: boolean) => {
      const { cells } = walker;
      if (cells.length < 8) return;
      // Start on the chip's edge and keep only the corners.
      const points = [
        gridLeft + (cells[0] + 0.5 - walker.outX * 0.5) * cell,
        gridTop + (cells[1] + 0.5 - walker.outY * 0.5) * cell,
      ];
      for (let index = 0; index < cells.length; index += 2) {
        const x = gridLeft + (cells[index] + 0.5) * cell;
        const y = gridTop + (cells[index + 1] + 0.5) * cell;
        const count = points.length;
        const straight =
          count >= 4 &&
          Math.abs(
            (points[count - 2] - points[count - 4]) * (y - points[count - 1]) -
              (points[count - 1] - points[count - 3]) * (x - points[count - 2]),
          ) < 0.01;
        if (straight) {
          points[count - 2] = x;
          points[count - 1] = y;
        } else points.push(x, y);
      }

      const path = new Path2D();
      const marks = [0];
      path.moveTo(points[0], points[1]);
      wires.moveTo(points[0], points[1]);
      for (let index = 2; index < points.length; index += 2) {
        path.lineTo(points[index], points[index + 1]);
        wires.lineTo(points[index], points[index + 1]);
        marks.push(
          marks[marks.length - 1] +
            Math.hypot(
              points[index] - points[index - 2],
              points[index + 1] - points[index - 1],
            ),
        );
      }
      const endX = points[points.length - 2];
      const endY = points[points.length - 1];
      pins.rect(points[0] - 2, points[1] - 2, 4, 4);
      if (via) {
        vias.moveTo(endX + 3.5, endY);
        vias.arc(endX, endY, 3.5, 0, TAU);
        if (!lite && Math.random() < 0.16) {
          labels.push({
            x: endX + 8,
            y: endY + 3,
            text: `0x${Math.floor(between(16, 256)).toString(16).toUpperCase()}`,
          });
        }
      }

      let nearest = 0;
      let best = Infinity;
      glyphs.forEach((glyph, index) => {
        const distance =
          Math.abs(glyph.cx - points[0]) + Math.abs(glyph.cy - points[1]);
        if (distance < best) {
          best = distance;
          nearest = index;
        }
      });
      traces.push({
        path,
        points,
        marks,
        length: marks[marks.length - 1],
        glyph: nearest,
      });
    };

    // Everyone takes a step in turn, so neighbours grow side by side.
    let walking = walkers;
    while (walking.length > 0) {
      const still: Walker[] = [];
      for (const walker of walking) {
        if (Math.random() < (walker.lean === 0 ? 0.07 : 0.42)) {
          walker.lean =
            walker.lean !== 0
              ? 0
              : Math.random() < 0.85
                ? walker.drift
                : -walker.drift;
        }
        let moved = false;
        let left = false;
        for (const lean of [walker.lean, 0, walker.drift, -walker.drift]) {
          const column = walker.column + walker.outX + walker.sideX * lean;
          const line = walker.line + walker.outY + walker.sideY * lean;
          if (!inside(column, line)) {
            left = true;
            break;
          }
          if (taken[line * columns + column]) continue;
          // A diagonal may not cut across one already laid in the same square.
          const square =
            Math.min(line, walker.line) * columns +
            Math.min(column, walker.column);
          if (lean !== 0) {
            if (crossed[square]) continue;
            crossed[square] = 1;
          }
          taken[line * columns + column] = 1;
          walker.column = column;
          walker.line = line;
          walker.lean = lean;
          walker.cells.push(column, line);
          moved = true;
          break;
        }
        if (left) finish(walker, false);
        else if (!moved) finish(walker, true);
        else if (walker.cells.length > 10 && Math.random() < 0.045)
          finish(walker, true);
        else still.push(walker);
      }
      walking = still;
    }
  };

  /** The point `distance` along a trace, written into `spot`. */
  const spot = { x: 0, y: 0 };
  const locate = (trace: Trace, distance: number) => {
    const { points, marks } = trace;
    let index = 1;
    while (index < marks.length - 1 && marks[index] < distance) index++;
    const span = marks[index] - marks[index - 1] || 1;
    const along = clamp((distance - marks[index - 1]) / span, 0, 1);
    const from = (index - 1) * 2;
    spot.x = points[from] + (points[from + 2] - points[from]) * along;
    spot.y = points[from + 1] + (points[from + 3] - points[from + 1]) * along;
  };

  // -------------------------------------------------------------- signals
  const send = (trace: Trace, inbound: boolean, wait = 0, surge = false) => {
    if (signals.length >= capacity) return;
    const speed = (surge ? between(560, 780) : between(240, 480)) * unit;
    signals.push({
      trace,
      // A surge starts close enough in that the whole name lights together.
      at: inbound
        ? surge
          ? Math.min(trace.length, speed * 0.6)
          : trace.length
        : 0,
      speed: inbound ? -speed : speed,
      tail: between(90, 150) * unit,
      colour: inbound ? LIME : CYAN,
      wait,
      surge,
      landed: false,
    });
  };

  /**
   * Fires every trace at the wordmark: as a ripple spreading from a point on
   * the canvas, or with none given, as a sweep along the name.
   */
  const sweep = (fromX?: number, fromY?: number) => {
    lastSurge = time;
    nextSurge = time + between(10, 16);
    const span = ink.right - ink.left || 1;
    traces.forEach((trace, index) => {
      if (lite && index % 2 === 1) return;
      const { points } = trace;
      const wait =
        fromX === undefined || fromY === undefined
          ? ((points[0] - ink.left) / span) * 0.7
          : Math.hypot(
              points[points.length - 2] + originX - fromX,
              points[points.length - 1] + originY - fromY,
            ) / 1700;
      send(trace, true, wait, true);
    });
    // Every letter lights as the surge gets to it, pin or no pin.
    for (const glyph of glyphs) {
      glyph.due =
        0.6 +
        (fromX === undefined || fromY === undefined
          ? ((glyph.cx - ink.left) / span) * 0.7
          : Math.hypot(glyph.cx + originX - fromX, glyph.cy + originY - fromY) /
            1700);
    }
  };

  const advance = (dt: number) => {
    if (traces.length === 0) return;
    if (grown < 1) return;

    nextSignal -= dt;
    if (nextSignal <= 0) {
      nextSignal = between(0.05, lite ? 0.5 : 0.22);
      const trace = traces[Math.floor(Math.random() * traces.length)];
      send(trace, Math.random() < 0.65);
    }
    // The mouse draws signals in from the traces around it.
    if (time - pointer.at < 0.25) {
      for (let tries = 0; tries < 3; tries++) {
        const trace = traces[Math.floor(Math.random() * traces.length)];
        locate(trace, trace.length * Math.random());
        if (
          Math.hypot(
            spot.x + originX - pointer.x,
            spot.y + originY - pointer.y,
          ) <
          150 * unit
        )
          send(trace, true);
      }
    }
    if (time >= nextSurge) sweep();

    for (let index = signals.length - 1; index >= 0; index--) {
      const signal = signals[index];
      if (signal.wait > 0) {
        signal.wait -= dt;
        continue;
      }
      signal.at += signal.speed * dt;
      const { trace } = signal;
      if (signal.speed < 0 && signal.at <= 0 && !signal.landed) {
        signal.landed = true;
        const glyph = glyphs[trace.glyph];
        if (signal.surge) {
          // The name answers down the same trace.
          send(trace, false, between(0.75, 1.05), true);
        } else {
          glyph.charge = Math.min(1, glyph.charge + 0.42);
          // Some of it spills into the letters either side.
          for (const beside of [trace.glyph - 1, trace.glyph + 1]) {
            const other = glyphs[beside];
            if (other) other.charge = Math.min(1, other.charge + 0.16);
          }
        }
        if (rings.length < 60) {
          rings.push({
            x: trace.points[0],
            y: trace.points[1],
            age: 0,
            colour: LIME,
          });
        }
      }
      const gone =
        signal.speed < 0
          ? signal.at < -signal.tail
          : signal.at - signal.tail > trace.length;
      if (gone) {
        signals[index] = signals[signals.length - 1];
        signals.pop();
      }
    }

    for (const glyph of glyphs) {
      if (glyph.due > 0) {
        glyph.due -= dt;
        if (glyph.due <= 0) {
          glyph.due = 0;
          glyph.charge = 1;
          glyph.hold = 0.9;
        }
      }
      if (glyph.hold > 0) glyph.hold -= dt;
      else glyph.charge = Math.max(0, glyph.charge - dt * 0.7);
    }
    for (let index = rings.length - 1; index >= 0; index--) {
      rings[index].age += dt;
      if (rings[index].age > 0.5) {
        rings[index] = rings[rings.length - 1];
        rings.pop();
      }
    }
  };

  /** Hands each glyph's charge to CSS, with a flicker while it is live. */
  const apply = () => {
    glyphs.forEach((glyph, index) => {
      const flicker = 0.9 + 0.1 * Math.sin(time * 23 + index * 1.7);
      const shown = glyph.charge < 0.01 ? 0 : glyph.charge * flicker;
      if (Math.abs(shown - glyph.applied) < 0.012) return;
      glyph.applied = shown;
      glyph.node.style.setProperty("--charge", shown.toFixed(3));
    });
  };

  // ----------------------------------------------------------------- draw
  /** Strokes the whole board in one style: copper, pads and labels. */
  const board = (style: CanvasGradient | string) => {
    context.strokeStyle = style;
    context.fillStyle = style;
    context.stroke(wires);
    context.stroke(vias);
    context.fill(pins);
    for (const label of labels) context.fillText(label.text, label.x, label.y);
  };

  const draw = () => {
    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
    context.clearRect(0, 0, width, height);
    if (traces.length === 0) return;
    context.translate(originX, originY);
    context.lineWidth = 1;
    context.lineJoin = "round";
    context.font = "9px ui-monospace, monospace";

    // The board itself: brightest by the name, and wiped on from it at first.
    const middleX = (ink.left + ink.right) / 2;
    const middleY = (ink.top + ink.bottom) / 2;
    const reach = Math.hypot(width, height);
    const copper = context.createRadialGradient(
      middleX,
      middleY,
      0,
      middleX,
      middleY,
      reach,
    );
    const near = lite ? 0.34 : 0.42;
    if (grown >= 1) {
      copper.addColorStop(0, `rgba(${VIOLET},${near})`);
      copper.addColorStop(0.55, `rgba(${VIOLET},0.17)`);
      copper.addColorStop(1, `rgba(${VIOLET},0.09)`);
    } else {
      const edge = 1 - Math.pow(1 - grown, 3);
      copper.addColorStop(0, `rgba(${VIOLET},${near})`);
      copper.addColorStop(
        Math.max(0, edge - 0.1),
        `rgba(${VIOLET},${near - 0.2 * edge})`,
      );
      copper.addColorStop(edge, `rgba(${LIME},${0.95 * (1 - grown)})`);
      copper.addColorStop(Math.min(1, edge + 0.004), `rgba(${LIME},0)`);
    }
    board(copper);

    context.globalCompositeOperation = "lighter";
    const warmth = clamp(1 - (time - pointer.at - 1.2), 0, 1);
    if (warmth > 0 && grown >= 1) {
      const x = pointer.x - originX;
      const y = pointer.y - originY;
      const light = context.createRadialGradient(x, y, 0, x, y, 230 * unit);
      light.addColorStop(0, `rgba(${LIME},${0.75 * warmth})`);
      light.addColorStop(0.5, `rgba(${CYAN},${0.22 * warmth})`);
      light.addColorStop(1, `rgba(${CYAN},0)`);
      board(light);
    }
    const flash = storm?.flash ?? 0;
    if (storm && flash > 0.02 && grown >= 1) {
      const x = storm.x - originX;
      const y = storm.y - originY;
      const light = context.createRadialGradient(x, y, 0, x, y, reach * 0.8);
      light.addColorStop(0, `rgba(214,222,255,${0.7 * flash})`);
      light.addColorStop(1, `rgba(214,222,255,${0.08 * flash})`);
      board(light);
    }

    // A glow behind every letter that is holding charge.
    for (const glyph of glyphs) {
      if (glyph.charge < 0.03) continue;
      const size = glyph.height * 1.9;
      context.globalAlpha = glyph.charge * 0.14;
      context.drawImage(
        glow[LIME],
        glyph.cx - size / 2,
        glyph.cy - size / 2,
        size,
        size,
      );
    }
    context.globalAlpha = 1;

    // Signals: a dash slid along the trace, twice, with a glow at its head.
    context.lineCap = "round";
    for (const signal of signals) {
      if (signal.wait > 0) continue;
      const { trace, at, tail } = signal;
      const from = clamp(signal.speed < 0 ? at : at - tail, 0, trace.length);
      const to = clamp(signal.speed < 0 ? at + tail : at, 0, trace.length);
      if (to - from < 1) continue;
      const head = signal.speed < 0 ? from : to;
      const short = Math.min(to - from, tail * 0.35);
      const shortFrom = signal.speed < 0 ? from : to - short;

      context.strokeStyle = `rgba(${signal.colour},0.4)`;
      context.lineWidth = 1.5;
      context.setLineDash([to - from, 1e5]);
      context.lineDashOffset = -from;
      context.stroke(trace.path);
      context.strokeStyle = `rgba(${signal.colour},0.95)`;
      context.lineWidth = 2;
      context.setLineDash([short, 1e5]);
      context.lineDashOffset = -shortFrom;
      context.stroke(trace.path);

      if (at >= 0 && at <= trace.length) {
        locate(trace, head);
        const size = (signal.surge ? 30 : 22) * unit;
        context.drawImage(
          glow[signal.colour as typeof LIME],
          spot.x - size / 2,
          spot.y - size / 2,
          size,
          size,
        );
      }
    }
    context.setLineDash([]);
    context.lineCap = "butt";

    // A blink at the pin when a signal lands.
    context.lineWidth = 1.25;
    for (const ring of rings) {
      const life = ring.age / 0.5;
      context.strokeStyle = `rgba(${ring.colour},${0.8 * (1 - life)})`;
      context.beginPath();
      context.arc(ring.x, ring.y, 3 + life * 13 * unit, 0, TAU);
      context.stroke();
    }
    context.globalCompositeOperation = "source-over";
  };

  // ----------------------------------------------------------------- loop
  const resize = () => {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    if (width === 0 || height === 0) return;
    canvas.width = Math.round(width * pixelRatio);
    canvas.height = Math.round(height * pixelRatio);
    storm?.resize(width, height);
    unit = clamp(width / 1000, 0.62, 1.5);
    stale = true;
  };

  const render = (now: number) => {
    // The first frame can be stamped a hair before the clock was read.
    const dt = clamp((now - last) / 1000, 0, 0.05);
    last = now;
    time += dt;
    if (width === 0 || height === 0) return;

    // Layout is read once, before anything is written.
    const bounds = canvas.getBoundingClientRect();
    boundsLeft = bounds.left;
    boundsTop = bounds.top;
    if (stale) build();
    if (wordmark) {
      const origin = wordmark.getBoundingClientRect();
      originX = origin.left - bounds.left;
      originY = origin.top - bounds.top;
    }

    grown = Math.min(1, grown + dt / REVEAL);
    advance(dt);
    storm?.update(dt);
    // A strike overhead runs through the board, out from where it hit.
    const flash = storm?.flash ?? 0;
    if (storm && flash > 0.5 && lastFlash <= 0.5 && time - lastSurge > 4) {
      if (grown >= 1) sweep(storm.x, storm.y);
    }
    lastFlash = flash;

    draw();
    apply();
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
    if (grown < 1 || x < 0 || x > width || y < 0 || y > height) return;
    // Leave real controls alone; only open space sets off a surge.
    if (event.target instanceof Element && event.target.closest("a, button"))
      return;
    if (time - lastSurge > 1.2) sweep(x, y);
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
  // The display face may land after the first layout.
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
    for (const glyph of glyphs) glyph.node.style.removeProperty("--charge");
    storm?.dispose();
  };
}
