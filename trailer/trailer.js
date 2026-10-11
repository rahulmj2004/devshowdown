// The trailer's timeline. Everything on screen is a pure function of the
// time since the start, written to inline styles and two canvases once per
// frame, so the renderer can step through it frame by frame (see render.mjs).
// The story: a masked hacker at a laptop opens the arena, we dive into the
// code behind the eye of the mask, the name decrypts, they code their way down a tunnel of data
// through all five competitions, and come out at the prize.
import { createStorm } from "/engine/storm.js";
import {
  createFx,
  freeTyping,
  hash,
  rgb,
  scramble,
  scriptedTyping,
} from "/hacker.js";

/**
 * Everything the trailer says. It mirrors config/site.ts and config/events.ts;
 * update both together. Nothing here is invented: dates and venue are not
 * announced, so the closing card says exactly that.
 */
const content = {
  boot: ["mount /arena", "load competitions [5]", "ready"],
  tagline: "Enter the arena. Prove your skills.",
  events: [
    {
      title: "Debugging",
      line: "Find the bug. Fix the chaos.",
      accent: "#ff4d6a",
    },
    {
      title: "Blind Coding",
      line: "No peeking. Pure instinct.",
      accent: "#a98bff",
    },
    {
      title: "Treasure Hunt",
      line: "Follow the clues. Unlock the unknown.",
      accent: "#c8ff2e",
    },
    {
      title: "Speed Typing",
      line: "Fingers faster than thought.",
      accent: "#7fe9ff",
    },
    { title: "Coding", line: "Turn ideas into impact.", accent: "#a98bff" },
  ],
  prize: 15000,
  prizeLine: ["Five competitions.", "One arena."],
  headline: ["Code.", "Compete.", "Conquer."],
  announcement: {
    label: "Announced",
    text: "Dates, venue and registration details coming soon",
  },
};

/** When each scene starts, in seconds. */
const AT = {
  intro: 0,
  title: 4.5,
  events: 9.5,
  prize: 19.5,
  finale: 23,
  end: 30,
};
const CARD = (AT.prize - AT.events) / content.events.length;
/** The opening: when each terminal line starts typing, and how fast. */
const TYPING = { starts: [0.7, 1.5, 2.3], rate: 30 };
/** Where the hacker sits in the opening: the middle of their chest. */
const SEAT = { x: 620, y: 520 };
/** When they look up from the screen, and how long the look takes. */
const GLANCE = { at: 2.85, length: 0.5 };
/** When the camera starts into the mask, and the eye it aims at. */
const DIVE = { at: 3.35, length: 1.15, x: SEAT.x + 42, y: SEAT.y - 176 };
/** Where the tunnel falls away to behind the hacker as they fly at us. */
const AHEAD = { x: 1480, y: 500 };
/** How the name decrypts: first letter lands at `start`, then one per `step`. */
const DECRYPT = {
  title: { start: 0.75, step: 0.14 },
  finale: { start: 0.6, step: 0.09 },
};

// ------------------------------------------------------------------ maths
const clamp = (value) => Math.min(1, Math.max(0, value));
/** Progress through a window that opens at `start` and lasts `length`. */
const span = (time, start, length) => clamp((time - start) / length);
const mix = (from, to, amount) => from + (to - from) * amount;
const outExpo = (x) => (x >= 1 ? 1 : 1 - Math.pow(2, -10 * x));
const inOutQuart = (x) =>
  x < 0.5 ? 8 * x ** 4 : 1 - Math.pow(-2 * x + 2, 4) / 2;
const outBack = (x) => 1 + 2.7 * Math.pow(x - 1, 3) + 1.7 * Math.pow(x - 1, 2);

// -------------------------------------------------------------------- dom
const $ = (selector, root = document) => root.querySelector(selector);
const make = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
};

/** Splits text into characters that can rise out of a mask one by one. */
function characters(parent, text) {
  return [...text].map((character) => {
    const mask = make("span", "char-mask");
    const glyph = make("span", "char", character);
    mask.append(glyph);
    parent.append(mask);
    return glyph;
  });
}

const rise = (glyph, amount) => {
  glyph.style.transform = `translateY(${(1 - amount) * 108}%) rotate(${(1 - amount) * 4}deg)`;
};

/**
 * Builds the DEVSHOWDOWN wordmark `width` pixels wide. Each letter gets a
 * box of its own final width, so it can show any character while it is still
 * encrypted without the word jittering.
 */
function wordmark(root, width) {
  const glyphs = [..."DEVSHOWDOWN"].map((letter, index) => {
    const glyph = make("span", index < 3 ? "glyph outline" : "glyph", letter);
    glyph.dataset.letter = letter;
    root.append(glyph);
    return glyph;
  });
  root.style.fontSize = "100px";
  const widths = glyphs.map((glyph) => glyph.getBoundingClientRect().width);
  const size = width / widths.reduce((total, each) => total + each, 0);
  root.style.fontSize = `${size * 100}px`;
  glyphs.forEach((glyph, index) => {
    glyph.style.width = `${widths[index] * size}px`;
  });
  return glyphs;
}

/** Shows the wordmark as noise that locks into place letter by letter. */
function decrypt(glyphs, local, { start, step }) {
  glyphs.forEach((glyph, index) => {
    const lands = start + index * step;
    if (local < index * 0.03) {
      glyph.style.opacity = "0";
      return;
    }
    glyph.style.opacity = "1";
    const locked = local >= lands;
    glyph.textContent = locked
      ? glyph.dataset.letter
      : scramble(index, Math.floor(local * 24));
    // Lime while it is noise, cooling to the page colour once it lands.
    const cooled = locked ? span(local, lands, 0.35) : 0;
    const colour = `color-mix(in oklab, #c8ff2e ${(1 - cooled) * 100}%, #f3f3ee)`;
    glyph.style.setProperty("--outline-color", colour);
    if (!glyph.classList.contains("outline")) glyph.style.color = colour;
    const punch = locked ? 1 - span(local, lands, 0.2) : 0;
    glyph.style.transform = `scale(${1 + 0.12 * punch})`;
  });
}
const decrypted = ({ start, step }) => start + 10 * step;

const stage = $("#stage");
const shake = $("#shake");
const scenes = {
  intro: $("#intro"),
  title: $("#title"),
  events: $("#events"),
  prize: $("#prize"),
  finale: $("#finale"),
};
const flash = $("#flash");
const fade = $("#fade");
const sweep = $("#sweep");
const grid = $(".grid");
const backCanvas = $("#back");
const frontCanvas = $("#front");

await document.fonts.ready;
const fx = createFx(backCanvas, frontCanvas);

// Intro.
const terminal = $("#intro .lines");

// Title.
const titleMark = $("#title .wordmark");
const titleGlyphs = wordmark(titleMark, 1640);
titleMark.style.top = `${700 - 60 - titleMark.getBoundingClientRect().height}px`;
const titleRule = $("#title .rule");
const titleBeam = $("#title .beam");
const titleTagline = $("#title .tagline");

// Events.
const cards = content.events.map((event, index) => {
  const card = make("div", "card");
  card.style.setProperty("--accent", event.accent);
  const eyebrow = make("p", "eyebrow");
  eyebrow.innerHTML = `Competition <b>${String(index + 1).padStart(2, "0")}</b> / ${String(content.events.length).padStart(2, "0")}`;
  const number = make(
    "p",
    "number display outline",
    String(index + 1).padStart(2, "0"),
  );
  const ghosts = ["#ff4d6a", "#7fe9ff"].map((colour) => {
    const ghost = make("p", "name ghost display", event.title);
    ghost.style.color = colour;
    return ghost;
  });
  const name = make("p", "name display");
  const glyphs = characters(name, event.title);
  const bar = make("div", "bar");
  const line = make("p", "line", event.line);
  const pips = make("div", "pips");
  content.events.forEach((_, pip) => {
    pips.append(make("i", pip <= index ? "on" : ""));
  });
  const hud = make("p", "hud");
  card.append(number, eyebrow, ...ghosts, name, bar, line, pips, hud);
  scenes.events.append(card);
  return { card, eyebrow, number, ghosts, glyphs, bar, line, pips, hud, event };
});

// Prize.
const prizeFigure = $("#prize .figure");
const prizeBody = prizeFigure.parentElement;
const prizeEyebrow = $("#prize .eyebrow");
const prizeNote = $("#prize .note");
const prizeSub = $("#prize .sub");
prizeSub.innerHTML = `${content.prizeLine[0]} <b>${content.prizeLine[1]}</b>`;
const prizeRings = [...document.querySelectorAll("#prize .rings i")];
const rupees = new Intl.NumberFormat("en-IN");

// Finale.
const finaleMark = $("#finale .wordmark");
const finaleGlyphs = wordmark(finaleMark, 1380);
finaleMark.style.top = `${560 - 50 - finaleMark.getBoundingClientRect().height}px`;
const finaleRule = $("#finale .rule");
const headline = $("#finale .headline");
const headlineWords = content.headline.map((word, index) => {
  const mask = make("span", "char-mask");
  const glyph = make(
    "span",
    index === content.headline.length - 1 ? "char lime" : "char",
    word,
  );
  mask.append(glyph);
  headline.append(mask, " ");
  return glyph;
});
const pill = $("#finale .pill");
$("b", pill).textContent = content.announcement.label;
$("span", pill).textContent = content.announcement.text;
const finaleTagline = $("#finale .tagline");
finaleTagline.textContent = content.tagline;

// Lightning, for the two scenes where the name is on screen.
const sky = $("#sky");
const storm = createStorm(sky, false);
storm?.resize(1920, 1080);
let stormLit = false;

// ------------------------------------------------------------------ sound
// The page makes no sound itself. It keeps a list of cues (what happens,
// and when) that render.mjs turns into a soundtrack with sound.mjs. Almost
// all are known up front from the timeline; lightning is not scripted, so
// thunder is added as each strike is noticed.
const cues = [];
// The music is written to the same timeline: it changes with each scene and
// each competition, and lands its last chord with the announcement.
cues.push({
  type: "score",
  time: 0,
  marks: { ...AT, card: CARD, close: AT.finale + 4 },
});
/** Every keystroke in the opening, for the clicks and the hacker's fingers. */
const keys = [];
content.boot.forEach((line, index) => {
  for (let typed = 1; typed <= line.length; typed++) {
    keys.push(TYPING.starts[index] + typed / TYPING.rate);
  }
});
for (const time of keys) cues.push({ type: "type", time });
cues.push({ type: "riser", time: DIVE.at, length: DIVE.length });
for (const cut of [AT.events, AT.prize, AT.finale]) {
  cues.push({ type: "riser", time: cut - 0.9, length: 0.9 });
}
for (const cut of [AT.title, AT.events, AT.prize, AT.finale]) {
  cues.push({ type: "impact", time: cut });
}
for (const [from, timing] of [
  [AT.title, DECRYPT.title],
  [AT.finale, DECRYPT.finale],
]) {
  cues.push({ type: "decrypt", time: from + 0.05, length: decrypted(timing) });
  for (let letter = 0; letter < 11; letter++) {
    cues.push({
      type: "lock",
      time: from + timing.start + letter * timing.step,
      step: letter,
    });
  }
  cues.push({ type: "hit", time: from + decrypted(timing), power: 0.9 });
}
cues.push({ type: "tunnel", time: AT.events, length: AT.prize - AT.events });
content.events.forEach((_, index) => {
  const start = AT.events + index * CARD;
  cues.push({ type: "whoosh", time: start, length: 0.5 });
  cues.push({ type: "glitch", time: start + 0.24 });
  cues.push({ type: "hit", time: start + 0.32, power: 0.8 });
  cues.push({ type: "granted", time: start + 1 });
});
cues.push({ type: "count", time: AT.prize + 0.25, length: 1.7 });
cues.push({ type: "bell", time: AT.prize + 1.95 });
cues.push({ type: "hit", time: AT.prize + 1.95, power: 0.7 });
content.headline.forEach((_, index) => {
  cues.push({
    type: "hit",
    time: AT.finale + 2 + index * 0.5 + 0.12,
    power: index === content.headline.length - 1 ? 1.2 : 0.8,
  });
});

const probe = document.createElement("canvas");
probe.width = 16;
probe.height = 9;
const probeContext = probe.getContext("2d", { willReadFrequently: true });
let skyLight = 0;
let lastThunder = -1;

/** Lightning: the sky suddenly holding far more light than a moment ago. */
function listen(time) {
  probeContext.clearRect(0, 0, 16, 9);
  probeContext.drawImage(sky, 0, 0, 16, 9);
  const { data } = probeContext.getImageData(0, 0, 16, 9);
  let total = 0;
  for (let index = 3; index < data.length; index += 4) total += data[index];
  const light = total / (144 * 255);
  if (
    light > 0.008 &&
    light > skyLight * 1.5 + 0.004 &&
    time - lastThunder > 0.4
  ) {
    cues.push({ type: "thunder", time, power: Math.min(1, light / 0.07) });
    lastThunder = time;
  }
  skyLight = light;
}

// ----------------------------------------------------------------- scenes
function intro(time) {
  fx.rain(time, 0.3);
  // The terminal stutters on as the laptop starts throwing it.
  const thrown =
    span(time, 0.15, 0.4) *
    (time < 0.6 && hash(Math.floor(time * 30)) < 0.35 ? 0.3 : 1);
  fx.terminal(time, "200,255,46", thrown);

  let html = "";
  content.boot.forEach((line, index) => {
    const typed = Math.floor((time - TYPING.starts[index]) * TYPING.rate);
    if (typed <= 0) return;
    const last = index === content.boot.length - 1;
    const caret = typed >= line.length && last && time % 0.5 < 0.28 ? "█" : "";
    const tail = typed > line.length + 4 && !last ? " ..." : "";
    html += `<div><b>&gt;</b> ${line.slice(0, typed)}${tail}${caret}</div>`;
  });
  terminal.innerHTML = html;

  // They read what they type, then look straight up at us, and the camera
  // goes in through the eye of the mask.
  const up = inOutQuart(span(time, GLANCE.at, GLANCE.length));
  const dive = span(time, DIVE.at, DIVE.length) ** 3;
  const zoom = 1 + 19 * dive;
  // The eye it is aimed at ends up filling the middle of the frame.
  const centred = inOutQuart(span(time, DIVE.at, DIVE.length * 0.8));
  const lensX = mix(DIVE.x, 960, centred);
  const lensY = mix(DIVE.y, 540, centred);
  fx.hacker(
    lensX + (SEAT.x - DIVE.x) * zoom,
    lensY + (SEAT.y - DIVE.y) * zoom,
    zoom,
    {
      time,
      colour: "200,255,46",
      power: 0.75 + 0.25 * up,
      strokes: scriptedTyping(keys, time),
      look: {
        x: (1 - up) * (16 + Math.sin(time * 1.1) * 9),
        y: (1 - up) * (9 + Math.sin(time * 1.9) * 2),
      },
      flare: 0.5 * up + 0.5 * span(time, DIVE.at, DIVE.length),
    },
  );
  // Everything else is left behind.
  for (const layer of [scenes.intro, backCanvas]) {
    layer.style.transformOrigin = `${DIVE.x}px ${DIVE.y}px`;
    layer.style.transform = `translate(${lensX - DIVE.x}px, ${lensY - DIVE.y}px) scale(${1 + 3 * dive})`;
    layer.style.opacity = String(1 - span(time, DIVE.at + 0.35, 0.5));
  }
}

function title(time) {
  const local = time - AT.title;
  fx.rain(time, 0.42);
  decrypt(titleGlyphs, local, DECRYPT.title);
  // A scan line crosses the word as it resolves.
  const scanned = span(
    local,
    DECRYPT.title.start - 0.1,
    10 * DECRYPT.title.step + 0.2,
  );
  titleBeam.style.left = `${mix(140, 1780, scanned)}px`;
  titleBeam.style.opacity = String(scanned > 0 && scanned < 1 ? 0.9 : 0);
  titleRule.style.transform = `scaleX(${inOutQuart(span(local, 0.4, 1.1))})`;
  const typed = Math.floor((local - 2.7) * 34);
  const caret = typed < content.tagline.length ? "_" : "";
  titleTagline.textContent =
    typed > 0 ? content.tagline.slice(0, typed) + caret : "";
  // A slow push in, then everything drops away for the cut.
  const out = span(local, AT.events - AT.title - 0.5, 0.45);
  scenes.title.style.transform = `scale(${1 + 0.035 * (local / 5) + 0.2 * out * out})`;
  scenes.title.style.opacity = String(1 - out);
}

function events(time) {
  const elapsed = time - AT.events;
  const current = Math.min(cards.length - 1, Math.floor(elapsed / CARD));
  const local = elapsed - current * CARD;
  cards.forEach((item, index) => {
    item.card.style.display = index === current ? "block" : "none";
  });
  const { card, eyebrow, number, ghosts, glyphs, bar, line, pips, hud, event } =
    cards[current];
  stage.style.setProperty("--accent", event.accent);

  // The tunnel never stops, and surges as each competition comes up.
  let travel = elapsed * 0.5;
  for (let index = 0; index <= current; index++) {
    travel += 0.5 * (1 - Math.exp(-(elapsed - index * CARD) * 3));
  }
  const surge = Math.exp(-local * 3);
  const here =
    span(elapsed, 0, 0.4) * (1 - span(elapsed, CARD * cards.length - 0.3, 0.3));
  const colour = rgb(event.accent);
  // It falls away behind the hacker, who is coming at us, still coding.
  fx.tunnel(time, -travel, colour, here, AHEAD.x, AHEAD.y);
  frontCanvas.style.opacity = String(here);
  fx.hacker(
    AHEAD.x + 110 + Math.sin(time * 1.3) * 16,
    738 + Math.sin(time * 2.1) * 11 - surge * 20,
    0.47 + surge * 0.03,
    {
      time,
      colour,
      power: 0.75 + 0.25 * surge,
      strokes: freeTyping(time),
      // Mostly on the screen, with a look across at each name as it lands.
      look: {
        x: Math.sin(time * 0.9) * 8 - 22 * surge,
        y: 5 + Math.sin(time * 1.6) * 3 - 5 * surge,
      },
      flare: 0.6 * surge,
      hover: true,
      wind: 0.45 + 0.55 * surge,
      // They break up for an instant on the same beat the title tears.
      tear: local > 0.24 ? 1 - span(local, 0.24, 0.2) : 0,
      echo: AHEAD,
    },
  );

  // A slab of the accent colour wipes each card on.
  sweep.style.transform = `translateX(${mix(-140, 140, inOutQuart(span(local, 0, 0.5)))}%) skewX(-18deg)`;
  // Nothing of the card shows until the slab has covered the frame.
  const shown = local > 0.2;
  const leaving = Math.pow(span(local, CARD - 0.24, 0.24), 2);
  card.style.opacity = shown ? String(1 - leaving) : "0";
  card.style.transform = `translateY(${-40 * leaving}px)`;

  eyebrow.style.opacity = String(span(local, 0.25, 0.3));
  pips.style.opacity = String(span(local, 0.25, 0.3));
  const arrived = outExpo(span(local, 0.2, 0.9));
  number.style.transform = `translateX(${mix(160, 0, arrived) - local * 26}px)`;
  number.style.opacity = String(arrived * 0.55);

  glyphs.forEach((glyph, index) => {
    rise(glyph, outExpo(span(local, 0.22 + index * 0.028, 0.6)));
  });
  // Red and cyan copies tear sideways for a moment as the title lands.
  const tear = 1 - span(local, 0.24, 0.42);
  ghosts.forEach((ghost, index) => {
    const live = local > 0.24 && tear > 0;
    const slice = Math.floor(time * 30 + index * 3) % 5;
    ghost.style.opacity = live ? "0.85" : "0";
    ghost.style.transform = `translateX(${(index ? -1 : 1) * 26 * tear}px)`;
    ghost.style.clipPath = `inset(${slice * 18}% 0 ${Math.max(0, 64 - slice * 18)}% 0)`;
  });

  bar.style.transform = `scaleX(${inOutQuart(span(local, 0.42, 0.55))})`;
  const told = outExpo(span(local, 0.6, 0.6));
  line.style.opacity = String(told);
  line.style.transform = `translateY(${mix(26, 0, told)}px)`;

  // Each competition is a lock being picked.
  const breached = span(local, 0.4, 0.6);
  hud.style.opacity = String(span(local, 0.35, 0.15));
  if (breached < 1) {
    const blocks = Math.round(breached * 12);
    const percent = String(Math.round(breached * 100)).padStart(3, " ");
    hud.textContent = `breaching ${"█".repeat(blocks)}${"░".repeat(12 - blocks)} ${percent}%`;
    hud.classList.remove("granted");
  } else {
    hud.textContent = "[ access granted ]";
    hud.classList.add("granted");
    // It stutters on for a moment before holding.
    const stutter = local < 1.3 && hash(Math.floor(local * 16)) < 0.3;
    hud.style.opacity = stutter ? "0.3" : "1";
  }
}

function prize(time) {
  const local = time - AT.prize;
  fx.rain(time, 0.16);
  stage.style.setProperty("--accent", "#c8ff2e");
  const counted = outExpo(span(local, 0.25, 1.7));
  prizeFigure.textContent = `₹${rupees.format(Math.round(content.prize * counted))}`;
  // The figure kicks as the count lands.
  const kick = local > 1.95 ? Math.exp(-(local - 1.95) * 7) : 0;
  prizeFigure.style.transform = `scale(${mix(0.86, 1, outExpo(span(local, 0.15, 0.8))) + 0.07 * kick})`;
  prizeEyebrow.style.opacity = String(span(local, 0.1, 0.3));
  prizeNote.style.opacity = String(span(local, 1.9, 0.3));
  const told = outExpo(span(local, 2.05, 0.7));
  prizeSub.style.opacity = String(told);
  prizeSub.style.transform = `translateY(${mix(40, 0, told)}px)`;
  prizeRings.forEach((ring, index) => {
    const phase = (local * 0.55 + index / prizeRings.length) % 1;
    ring.style.transform = `scale(${1 + phase * 2.6})`;
    ring.style.opacity = String((1 - phase) * 0.3 * span(local, 0.2, 0.5));
  });
  const out = span(local, AT.finale - AT.prize - 0.3, 0.3);
  prizeBody.style.opacity = String(1 - out);
  prizeBody.style.transform = `scale(${1 + 0.12 * out})`;
}

function finale(time) {
  const local = time - AT.finale;
  fx.rain(time, 0.34);
  stage.style.setProperty("--accent", "#a98bff");
  decrypt(finaleGlyphs, local, DECRYPT.finale);
  finaleRule.style.transform = `scaleX(${inOutQuart(span(local, 0.4, 1))})`;
  headlineWords.forEach((word, index) => {
    const landed = span(local, 2 + index * 0.5, 0.45);
    word.style.transform = `translateY(${(1 - outExpo(landed)) * 108}%) scale(${landed > 0 ? outBack(landed) : 1})`;
  });
  const posted = outExpo(span(local, 4, 0.7));
  pill.style.opacity = String(posted);
  pill.style.transform = `translate(-50%, ${mix(30, 0, posted)}px)`;
  finaleTagline.style.opacity = String(span(local, 4.8, 0.7));
  scenes.finale.style.transform = `scale(${1 + 0.03 * (local / 7)})`;
}

// --------------------------------------------------------------- playback
const order = [
  ["intro", AT.intro, AT.title, intro],
  ["title", AT.title, AT.events, title],
  ["events", AT.events, AT.prize, events],
  ["prize", AT.prize, AT.finale, prize],
  ["finale", AT.finale, Infinity, finale],
];
const cuts = [AT.title, AT.events, AT.prize, AT.finale];
/** Moments that rattle the frame: [from, length, pixels]. */
const rumbles = [
  [AT.title + decrypted(DECRYPT.title), 0.7, 7],
  [AT.finale + decrypted(DECRYPT.finale), 0.7, 6],
  ...content.events.map((_, index) => [
    AT.events + index * CARD + 0.3,
    0.45,
    4,
  ]),
];

let previous = 0;
function frame(time) {
  const dt = Math.min(0.05, Math.max(0, time - previous));
  previous = time;

  fx.clear();
  for (const layer of [backCanvas, frontCanvas, scenes.intro]) {
    layer.style.transform = "none";
    layer.style.opacity = "1";
  }
  for (const [name, from, to, update] of order) {
    const live = time >= from && time < to;
    scenes[name].style.visibility = live ? "visible" : "hidden";
    if (live) update(time);
  }
  if (time < AT.events || time >= AT.prize) {
    sweep.style.transform = "translateX(-140%) skewX(-18deg)";
  }
  if (time < AT.events) stage.style.setProperty("--accent", "#a98bff");

  const stormy =
    (time >= AT.title && time < AT.events - 0.4) || time >= AT.finale;
  if (stormy) storm?.update(dt);
  else if (stormLit) storm?.dispose();
  stormLit = stormy;
  listen(time);

  grid.style.backgroundPosition = `${time * 9}px ${time * 9}px`;

  let rumble = 0;
  for (const [from, length, pixels] of rumbles) {
    if (time >= from && time < from + length) {
      rumble += pixels * (1 - span(time, from, length));
    }
  }
  shake.style.transform = `translate(${Math.sin(time * 61) * rumble}px, ${Math.cos(time * 47) * rumble}px)`;

  // A white flash on each cut, and a fade to black at the very end.
  let burst = 0;
  for (const cut of cuts) {
    if (time >= cut) burst = Math.max(burst, Math.exp(-(time - cut) * 9));
  }
  // The dive into the screen whites out just before it cuts.
  if (time < AT.title) {
    burst = Math.max(burst, span(time, AT.title - 0.25, 0.25) ** 2);
  }
  flash.style.opacity = String(burst * 0.85);
  fade.style.opacity = String(span(time, AT.end - 0.7, 0.6));
}

let startedAt = performance.now();
const loop = () => {
  let time = (performance.now() - startedAt) / 1000;
  // Watched live (not being rendered), it simply plays again.
  if (time > AT.end + 1 && !("__advance" in window)) {
    startedAt = performance.now();
    time = 0;
    previous = 0;
  }
  frame(time);
  requestAnimationFrame(loop);
};
frame(0);
requestAnimationFrame(loop);

/**
 * Read by render.mjs: how long the film is (which also says the page is
 * ready to be stepped), and the sound cues gathered so far.
 */
window.__trailer = { duration: AT.end, cues: () => cues };
