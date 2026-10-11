export const SEGMENTS = 46;

export interface DragonPose {
  /** Spine points, head first. */
  px: Float32Array;
  py: Float32Array;
  /** Direction the head points, in radians. */
  heading: number;
  /** Size of one design unit, in CSS pixels. */
  unit: number;
  time: number;
  /** Wing beat, from -1 (folded) to 1 (spread). */
  flap: number;
  /** How hard it is breathing fire, 0 to 1. */
  glow: number;
}

type Point = readonly [number, number];

/** Where the key light comes from: above, a little to the left. */
const LIGHT_X = -0.45;
const LIGHT_Y = -0.89;
/**
 * The dragon is seen from above. Anything that stands proud of its back
 * (spines, horns) is nudged this way on screen, which reads as height.
 */
const LIFT_X = -0.32;
const LIFT_Y = -0.74;

const HIDE_EDGE = "#0b080c";
const HIDE_SHADE = "#231619";
const HIDE_LIGHT = "#76503f";
const BONE = "#1a1113";
const IVORY = "#d9cbb0";
const HORN_ROOT = "#3b2d26";
const RIM = "rgba(168,150,232,0.34)";
const SHEEN = "rgba(255,196,164,0.17)";

/** Half-width of the body along its length: neck, shoulders, waist, tail. */
const PROFILE: readonly Point[] = [
  [0, 8],
  [0.14, 9.5],
  [0.24, 18],
  [0.34, 17.5],
  [0.42, 15],
  [0.48, 16.5],
  [0.58, 10.5],
  [0.78, 5],
  [1, 1.2],
];

function girth(along: number) {
  for (let index = 1; index < PROFILE.length; index++) {
    const [end, wide] = PROFILE[index];
    if (along > end) continue;
    const [start, narrow] = PROFILE[index - 1];
    const step = (along - start) / (end - start);
    return narrow + (wide - narrow) * step * step * (3 - 2 * step);
  }
  return PROFILE[PROFILE.length - 1][1];
}

/** Outline of half the skull, snout tip to the back, as curve ends/controls. */
const SKULL_ENDS: readonly Point[] = [
  [42, 0],
  [33, 6.5],
  [17, 8.5],
  [0, 15.5],
  [-14, 13],
  [-20, 0],
];
const SKULL_CONTROLS: readonly Point[] = [
  [40, 5],
  [24, 6],
  [8, 12],
  [-8, 17.5],
  [-20, 8],
];

/**
 * Returns a function that paints the dragon, seen from above, for a given
 * pose: a scaled hide shaded as a rounded body under a fixed light, leathery
 * wings stretched over finger bones, four tucked legs, a ridge of spines and
 * a horned head. It only ever draws with ordinary source-over compositing, so
 * the caller can light the finished layer however it likes.
 */
export function createDragonPainter() {
  const tanX = new Float32Array(SEGMENTS);
  const tanY = new Float32Array(SEGMENTS);
  const half = new Float32Array(SEGMENTS);

  let c: CanvasRenderingContext2D;
  let pose: DragonPose;
  let unit = 1;

  /** A tapered bone or limb with rounded ends and a lit upper edge. */
  const limb = (
    from: Point,
    to: Point,
    thick: number,
    thin: number,
    fill: string,
  ) => {
    const dx = to[0] - from[0];
    const dy = to[1] - from[1];
    const length = Math.hypot(dx, dy) || 1;
    const nx = -dy / length;
    const ny = dx / length;
    c.beginPath();
    c.moveTo(from[0] + (nx * thick) / 2, from[1] + (ny * thick) / 2);
    c.lineTo(to[0] + (nx * thin) / 2, to[1] + (ny * thin) / 2);
    c.arc(
      to[0],
      to[1],
      thin / 2,
      Math.atan2(ny, nx),
      Math.atan2(-ny, -nx),
      true,
    );
    c.lineTo(from[0] - (nx * thick) / 2, from[1] - (ny * thick) / 2);
    c.arc(
      from[0],
      from[1],
      thick / 2,
      Math.atan2(-ny, -nx),
      Math.atan2(ny, nx),
      true,
    );
    c.closePath();
    c.fillStyle = fill;
    c.fill();

    const lift = thin * 0.24;
    c.beginPath();
    c.moveTo(from[0] + LIFT_X * lift, from[1] + LIFT_Y * lift);
    c.lineTo(to[0] + LIFT_X * lift, to[1] + LIFT_Y * lift);
    c.strokeStyle = SHEEN;
    c.lineWidth = Math.max(0.8, thin * 0.26);
    c.stroke();
  };

  const claw = (at: Point, dx: number, dy: number, length: number) => {
    c.beginPath();
    c.moveTo(at[0] - dy * length * 0.2, at[1] + dx * length * 0.2);
    c.lineTo(at[0] + dx * length, at[1] + dy * length);
    c.lineTo(at[0] + dy * length * 0.2, at[1] - dx * length * 0.2);
    c.closePath();
    c.fillStyle = IVORY;
    c.fill();
  };

  const drawLeg = (at: number, side: number, scale: number) => {
    const fx = tanX[at];
    const fy = tanY[at];
    const nx = -fy * side;
    const ny = fx * side;
    const reach = unit * scale;
    const swing = Math.sin(pose.time * 2.1 + at) * 2 * reach;
    // Out from the body, then folded back along it, as in flight.
    const point = (from: Point, outward: number, back: number): Point => [
      from[0] + nx * outward * reach - fx * back * reach,
      from[1] + ny * outward * reach - fy * back * reach,
    ];
    const hip: Point = [
      px(at) + nx * half[at] * 0.7,
      py(at) + ny * half[at] * 0.7,
    ];
    const knee = point(hip, 15, 9);
    const ankle = point(knee, -3 + swing / reach, 23);
    const foot = point(ankle, 3, 12);
    limb(hip, knee, 10 * reach, 7.5 * reach, BONE);
    limb(knee, ankle, 7 * reach, 4.6 * reach, BONE);
    limb(ankle, foot, 4.6 * reach, 3.4 * reach, BONE);
    for (const spread of [-0.5, 0, 0.5]) {
      claw(foot, -fx + nx * spread, -fy + ny * spread, 7.5 * reach);
    }
  };

  const drawWing = (side: number) => {
    const root = 11;
    const rear = 22;
    const reach = 150 * unit;
    const open = (pose.flap + 1) / 2;
    const span = 0.5 + 0.5 * open;
    const fx = tanX[root];
    const fy = tanY[root];
    const nx = -fy * side;
    const ny = fx * side;
    const at = (from: Point, outward: number, fore: number): Point => [
      from[0] + (nx * outward * span + fx * fore) * reach,
      from[1] + (ny * outward * span + fy * fore) * reach,
    ];

    const shoulder: Point = [
      px(root) + nx * half[root] * 0.45,
      py(root) + ny * half[root] * 0.45,
    ];
    const elbow = at(shoulder, 0.34, 0.24);
    const wrist = at(elbow, 0.38, 0.12 - 0.2 * (1 - open));
    const tips = [
      at(wrist, 0.72, -0.14 - 0.22 * (1 - open)),
      at(wrist, 0.56, -0.56),
      at(wrist, 0.3, -0.84),
      at(wrist, 0.05, -0.92),
    ];
    const hip: Point = [
      px(rear) + nx * half[rear] * 0.5,
      py(rear) + ny * half[rear] * 0.5,
    ];
    const edge = [...tips, hip];

    // The leather catches more light the flatter the wing is held.
    const lit = 0.68 + 0.32 * open;
    const leather = `rgba(${Math.round(118 * lit)},${Math.round(38 * lit)},${Math.round(30 * lit)},0.94)`;
    const fold = "rgba(30,8,12,0.96)";

    // Skin ahead of the elbow, from shoulder to wrist.
    c.beginPath();
    c.moveTo(shoulder[0], shoulder[1]);
    c.quadraticCurveTo(
      (shoulder[0] + wrist[0]) / 2 + fx * reach * 0.1,
      (shoulder[1] + wrist[1]) / 2 + fy * reach * 0.1,
      wrist[0],
      wrist[1],
    );
    c.lineTo(elbow[0], elbow[1]);
    c.closePath();
    c.fillStyle = "rgba(58,17,18,0.95)";
    c.fill();

    // One panel of membrane between each pair of fingers, and a last one
    // back to the flank. Each is darkest along the bones, so it billows.
    for (let index = 0; index < edge.length - 1; index++) {
      const from = edge[index];
      const to = edge[index + 1];
      const last = index === edge.length - 2;
      const anchor = last ? elbow : wrist;
      const midX = (from[0] + to[0]) / 2;
      const midY = (from[1] + to[1]) / 2;
      c.beginPath();
      c.moveTo(wrist[0], wrist[1]);
      c.lineTo(from[0], from[1]);
      c.quadraticCurveTo(
        midX + (anchor[0] - midX) * 0.3,
        midY + (anchor[1] - midY) * 0.3,
        to[0],
        to[1],
      );
      if (last) {
        c.lineTo(shoulder[0], shoulder[1]);
        c.lineTo(elbow[0], elbow[1]);
      }
      c.closePath();
      const shade = c.createLinearGradient(from[0], from[1], to[0], to[1]);
      shade.addColorStop(0, fold);
      shade.addColorStop(0.5, leather);
      shade.addColorStop(1, fold);
      c.fillStyle = shade;
      c.fill();
      c.strokeStyle = "rgba(214,128,104,0.22)";
      c.lineWidth = 1;
      c.stroke();
    }

    // Veins.
    c.beginPath();
    for (let index = 0; index < edge.length - 1; index++) {
      const endX = (edge[index][0] + edge[index + 1][0]) / 2;
      const endY = (edge[index][1] + edge[index + 1][1]) / 2;
      const toX = wrist[0] + (endX - wrist[0]) * 0.78;
      const toY = wrist[1] + (endY - wrist[1]) * 0.78;
      c.moveTo(wrist[0], wrist[1]);
      c.lineTo(toX, toY);
      for (const branch of [0.45, 0.65]) {
        const fromX = wrist[0] + (toX - wrist[0]) * branch;
        const fromY = wrist[1] + (toY - wrist[1]) * branch;
        const tip = edge[index + (branch < 0.5 ? 0 : 1)];
        c.moveTo(fromX, fromY);
        c.lineTo(
          fromX + (tip[0] - fromX) * 0.4,
          fromY + (tip[1] - fromY) * 0.4,
        );
      }
    }
    c.strokeStyle = "rgba(14,3,6,0.42)";
    c.lineWidth = Math.max(0.8, 0.9 * unit);
    c.stroke();

    // Arm and finger bones over the skin.
    for (const tip of tips) limb(wrist, tip, 4.4 * unit, 1.3 * unit, BONE);
    limb(shoulder, elbow, 10 * unit, 7.5 * unit, BONE);
    limb(elbow, wrist, 7.5 * unit, 5.2 * unit, BONE);
    claw(wrist, fx + nx * 0.5, fy + ny * 0.5, 13 * unit);
  };

  const drawBody = () => {
    const tail = SEGMENTS - 1;

    // Tail blade: a bony leaf with a dark centre.
    const bx = -tanX[tail];
    const by = -tanY[tail];
    c.beginPath();
    c.moveTo(px(tail), py(tail));
    c.quadraticCurveTo(
      px(tail) + (bx * 10 - by * 13) * unit,
      py(tail) + (by * 10 + bx * 13) * unit,
      px(tail) + bx * 40 * unit,
      py(tail) + by * 40 * unit,
    );
    c.quadraticCurveTo(
      px(tail) + (bx * 10 + by * 13) * unit,
      py(tail) + (by * 10 - bx * 13) * unit,
      px(tail),
      py(tail),
    );
    c.fillStyle = "#2a1215";
    c.fill();
    c.strokeStyle = RIM;
    c.lineWidth = 1;
    c.stroke();

    // Silhouette first, so the shaded strips never show a seam.
    c.beginPath();
    c.moveTo(px(0) - tanY[0] * half[0], py(0) + tanX[0] * half[0]);
    for (let index = 1; index < SEGMENTS; index++) {
      c.lineTo(
        px(index) - tanY[index] * half[index],
        py(index) + tanX[index] * half[index],
      );
    }
    for (let index = tail; index >= 0; index--) {
      c.lineTo(
        px(index) + tanY[index] * half[index],
        py(index) - tanX[index] * half[index],
      );
    }
    c.closePath();
    c.lineJoin = "round";
    c.fillStyle = HIDE_EDGE;
    c.fill();
    c.strokeStyle = RIM;
    c.lineWidth = 1.2;
    c.stroke();

    // The hide, a strip at a time, shaded across its width as a cylinder
    // would be: the highlight slides toward whichever flank faces the light.
    for (let index = 0; index < tail; index++) {
      const next = index + 1;
      const ax = -tanY[index] * half[index];
      const ay = tanX[index] * half[index];
      const bx2 = -tanY[next] * half[next];
      const by2 = tanX[next] * half[next];
      // Reach a touch past the next section to cover the join.
      const ox = -tanX[next] * 0.8;
      const oy = -tanY[next] * 0.8;
      c.beginPath();
      c.moveTo(px(index) + ax, py(index) + ay);
      c.lineTo(px(next) + bx2 + ox, py(next) + by2 + oy);
      c.lineTo(px(next) - bx2 + ox, py(next) - by2 + oy);
      c.lineTo(px(index) - ax, py(index) - ay);
      c.closePath();
      const facing = -tanY[index] * LIGHT_X + tanX[index] * LIGHT_Y;
      const crest = 0.5 - 0.24 * facing;
      const hide = c.createLinearGradient(
        px(index) + ax,
        py(index) + ay,
        px(index) - ax,
        py(index) - ay,
      );
      hide.addColorStop(0, HIDE_EDGE);
      hide.addColorStop(Math.max(0.04, crest - 0.3), HIDE_SHADE);
      hide.addColorStop(crest, HIDE_LIGHT);
      hide.addColorStop(Math.min(0.96, crest + 0.3), HIDE_SHADE);
      hide.addColorStop(1, HIDE_EDGE);
      c.fillStyle = hide;
      c.fill();
    }

    // Scales: staggered rows of scallops, each with a shadow under its lip.
    c.beginPath();
    const size = 4.3 * unit;
    for (let index = 1; index < tail; index++) {
      const across = Math.floor((half[index] * 1.84) / (size * 2));
      if (across < 1) continue;
      const stagger = index % 2 === 0 ? 0 : size;
      for (let column = 0; column < across; column++) {
        const offset = (column - (across - 1) / 2) * size * 2 + stagger;
        if (Math.abs(offset) > half[index] - size * 0.7) continue;
        const cx = px(index) - tanY[index] * offset;
        const cy = py(index) + tanX[index] * offset;
        c.moveTo(cx - tanY[index] * size, cy + tanX[index] * size);
        c.quadraticCurveTo(
          cx - tanX[index] * size * 1.7,
          cy - tanY[index] * size * 1.7,
          cx + tanY[index] * size,
          cy - tanX[index] * size,
        );
      }
    }
    c.strokeStyle = "rgba(0,0,0,0.5)";
    c.lineWidth = Math.max(0.8, 1.1 * unit);
    c.stroke();
    c.save();
    c.translate(LIFT_X * unit, LIFT_Y * unit);
    c.strokeStyle = "rgba(255,190,160,0.09)";
    c.lineWidth = Math.max(0.6, 0.7 * unit);
    c.stroke();
    c.restore();

    // Spines down the back, tail first so each overlaps the one behind.
    for (let index = SEGMENTS - 6; index >= 2; index -= 2) {
      const tall = Math.min(half[index] * 0.95, 15 * unit);
      const base = 4.5 * unit;
      const tipX = px(index) - tanX[index] * base * 1.5 + LIFT_X * tall;
      const tipY = py(index) - tanY[index] * base * 1.5 + LIFT_Y * tall;
      c.beginPath();
      c.moveTo(px(index) + tanX[index] * base, py(index) + tanY[index] * base);
      c.lineTo(tipX, tipY);
      c.lineTo(px(index) - tanX[index] * base, py(index) - tanY[index] * base);
      c.closePath();
      c.fillStyle = "#0d0809";
      c.fill();
      c.beginPath();
      c.moveTo(px(index) + tanX[index] * base, py(index) + tanY[index] * base);
      c.lineTo(tipX, tipY);
      c.strokeStyle = "rgba(226,170,146,0.38)";
      c.lineWidth = 1;
      c.stroke();
    }
  };

  const drawHead = () => {
    const turn = pose.heading;
    c.save();
    c.translate(px(0), py(0));
    c.rotate(turn);
    c.scale(unit * 1.3, unit * 1.3);
    // The fixed light and lift, turned into the head's own frame.
    const cos = Math.cos(turn);
    const sin = Math.sin(turn);
    const liftX = LIFT_X * cos + LIFT_Y * sin;
    const liftY = -LIFT_X * sin + LIFT_Y * cos;

    // Cheek spikes, then horns, lie under and behind the skull.
    for (const side of [1, -1]) {
      c.fillStyle = HORN_ROOT;
      c.beginPath();
      c.moveTo(-2, 14 * side);
      c.lineTo(-22 + liftX * 4, 23 * side + liftY * 4);
      c.lineTo(-11, 13 * side);
      c.closePath();
      c.fill();
      c.beginPath();
      c.moveTo(-9, 13 * side);
      c.lineTo(-27 + liftX * 4, 16 * side + liftY * 4);
      c.lineTo(-15, 9 * side);
      c.closePath();
      c.fill();

      const tipX = -58 + liftX * 15;
      const tipY = 19 * side + liftY * 15;
      const horn = c.createLinearGradient(-12, 8 * side, tipX, tipY);
      horn.addColorStop(0, HORN_ROOT);
      horn.addColorStop(0.55, "#9b8a70");
      horn.addColorStop(1, IVORY);
      c.beginPath();
      c.moveTo(-8, 11 * side);
      c.quadraticCurveTo(-32, 24 * side, tipX, tipY);
      c.quadraticCurveTo(-34, 11 * side, -15, 3.5 * side);
      c.closePath();
      c.fillStyle = horn;
      c.fill();
      c.strokeStyle = "rgba(0,0,0,0.45)";
      c.lineWidth = 0.7;
      c.stroke();
    }

    // Skull.
    c.beginPath();
    c.moveTo(SKULL_ENDS[0][0], SKULL_ENDS[0][1]);
    for (let index = 0; index < SKULL_CONTROLS.length; index++) {
      c.quadraticCurveTo(
        SKULL_CONTROLS[index][0],
        SKULL_CONTROLS[index][1],
        SKULL_ENDS[index + 1][0],
        SKULL_ENDS[index + 1][1],
      );
    }
    for (let index = SKULL_CONTROLS.length - 1; index >= 0; index--) {
      c.quadraticCurveTo(
        SKULL_CONTROLS[index][0],
        -SKULL_CONTROLS[index][1],
        SKULL_ENDS[index][0],
        -SKULL_ENDS[index][1],
      );
    }
    c.closePath();
    const skull = c.createRadialGradient(
      9 + liftX * 7,
      liftY * 7,
      1.5,
      8,
      0,
      38,
    );
    skull.addColorStop(0, "#80574a");
    skull.addColorStop(0.42, "#2c1b1d");
    skull.addColorStop(1, HIDE_EDGE);
    c.fillStyle = skull;
    c.fill();
    c.strokeStyle = RIM;
    c.lineWidth = 0.9;
    c.stroke();

    // Plates along the snout and the crown.
    c.beginPath();
    c.moveTo(38, 0);
    c.lineTo(-6, 0);
    for (let plate = 0; plate < 6; plate++) {
      const x = 28 - plate * 7;
      const spread = 3 + plate * 1.5;
      c.moveTo(x + 3, spread);
      c.quadraticCurveTo(x - 2, 0, x + 3, -spread);
    }
    c.strokeStyle = "rgba(0,0,0,0.5)";
    c.lineWidth = 0.9;
    c.stroke();

    for (const side of [1, -1]) {
      // Nostril, lit from inside while it breathes fire.
      c.beginPath();
      c.ellipse(34.5, 3 * side, 2.1, 1.1, 0.3 * side, 0, Math.PI * 2);
      c.fillStyle = "#020101";
      c.fill();
      if (pose.glow > 0.05) {
        c.fillStyle = `rgba(255,150,50,${pose.glow})`;
        c.fill();
      }

      // Eye: an amber almond with a slit pupil, under a heavy brow.
      const halo = c.createRadialGradient(8, 8.3 * side, 0, 8, 8.3 * side, 9);
      halo.addColorStop(0, "rgba(255,170,50,0.5)");
      halo.addColorStop(1, "rgba(255,170,50,0)");
      c.fillStyle = halo;
      c.fillRect(-1, 8.3 * side - 9, 18, 18);
      c.beginPath();
      c.moveTo(12.8, 8 * side);
      c.quadraticCurveTo(8, 5.2 * side, 3.4, 8.5 * side);
      c.quadraticCurveTo(8, 10.6 * side, 12.8, 8 * side);
      c.fillStyle = pose.glow > 0.3 ? "#ffe9a6" : "#ffb53a";
      c.fill();
      c.beginPath();
      c.moveTo(10.8, 8 * side);
      c.lineTo(5.4, 8.4 * side);
      c.strokeStyle = "#0a0402";
      c.lineWidth = 1.1;
      c.stroke();
      c.beginPath();
      c.moveTo(17, 6 * side);
      c.quadraticCurveTo(8, 11.5 * side, -3, 12.5 * side);
      c.strokeStyle = "#070405";
      c.lineWidth = 2.6;
      c.lineCap = "round";
      c.stroke();
      c.lineCap = "butt";
    }
    c.restore();
  };

  const px = (index: number) => pose.px[index];
  const py = (index: number) => pose.py[index];

  return (context: CanvasRenderingContext2D, next: DragonPose) => {
    c = context;
    pose = next;
    unit = next.unit;
    for (let index = 0; index < SEGMENTS; index++) {
      const ahead = Math.max(index - 1, 0);
      const behind = Math.min(index + 1, SEGMENTS - 1);
      const dx = px(ahead) - px(behind);
      const dy = py(ahead) - py(behind);
      const length = Math.hypot(dx, dy) || 1;
      tanX[index] = dx / length;
      tanY[index] = dy / length;
      half[index] = girth(index / (SEGMENTS - 1)) * unit;
    }

    // Fire in the throat shows as a glow around the neck before it is out.
    if (next.glow > 0.02) {
      c.beginPath();
      c.moveTo(px(0), py(0));
      for (let index = 1; index < 11; index++) c.lineTo(px(index), py(index));
      c.strokeStyle = `rgba(255,128,36,${0.3 * next.glow})`;
      c.lineWidth = 34 * unit;
      c.lineCap = "round";
      c.lineJoin = "round";
      c.stroke();
      c.lineCap = "butt";
    }

    for (const side of [1, -1]) {
      drawLeg(13, side, 1.05);
      drawLeg(21, side, 1.25);
    }
    drawWing(1);
    drawWing(-1);
    drawBody();
    drawHead();
  };
}
