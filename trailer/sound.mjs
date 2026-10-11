/**
 * The trailer's soundtrack, synthesised from nothing: no samples, no assets.
 * trailer.js decides *when* things happen and hands over a list of cues;
 * this file decides what each cue sounds like, mixes them over the music
 * and a low drone, and returns a stereo WAV for render.mjs to lay under the
 * picture. The music is written here too (see `score`): it is in A minor at
 * 120 beats a minute, because the drone is an A and the film cuts on the
 * half second.
 */
const RATE = 48000;
/** How loud the music sits against the effects, whose loudest is about 1. */
const MUSIC = 0.62;
const TAU = Math.PI * 2;

/** Repeatable noise, so two renders of the same cues sound the same. */
function seeded(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}
const random = seeded(20261011);
const between = (low, high) => low + random() * (high - low);

const samples = (seconds) => Math.max(1, Math.round(seconds * RATE));

/** Fills a buffer from a function of time (seconds) and progress (0 to 1). */
function voice(seconds, shape) {
  const out = new Float32Array(samples(seconds));
  for (let index = 0; index < out.length; index++) {
    out[index] = shape(index / RATE, index / out.length, index);
  }
  return out;
}

const white = (seconds) => voice(seconds, () => random() * 2 - 1);

/** Noise with its energy in the bass, as wind, fire and thunder have. */
function brown(seconds) {
  let level = 0;
  return voice(seconds, () => {
    level = (level + (random() * 2 - 1) * 0.06) * 0.997;
    return level * 3.2;
  });
}

/** One-pole low-pass, in place. `cutoff` in hertz. */
function lowpass(buffer, cutoff) {
  const amount = 1 - Math.exp((-TAU * cutoff) / RATE);
  let level = 0;
  for (let index = 0; index < buffer.length; index++) {
    level += amount * (buffer[index] - level);
    buffer[index] = level;
  }
  return buffer;
}

function highpass(buffer, cutoff) {
  const low = lowpass(Float32Array.from(buffer), cutoff);
  for (let index = 0; index < buffer.length; index++)
    buffer[index] -= low[index];
  return buffer;
}

/** Band-pass whose centre can move: `centre(progress)` gives hertz. */
function sweep(buffer, centre, resonance = 0.5) {
  let low = 0;
  let band = 0;
  for (let index = 0; index < buffer.length; index++) {
    const cutoff = Math.min(7000, centre(index / buffer.length));
    const tune = 2 * Math.sin((Math.PI * cutoff) / RATE);
    low += tune * band;
    const high = buffer[index] - low - resonance * band;
    band += tune * high;
    buffer[index] = band;
  }
  return buffer;
}

const shape = (buffer, envelope) => {
  for (let index = 0; index < buffer.length; index++) {
    buffer[index] *= envelope(index / RATE, index / buffer.length);
  }
  return buffer;
};

/** A tone whose pitch follows `pitch(time)`, in hertz. */
function tone(seconds, pitch, wave = Math.sin) {
  let phase = 0;
  return voice(seconds, (time) => {
    phase += (TAU * pitch(time)) / RATE;
    return wave(phase);
  });
}

const sum = (...buffers) => {
  const out = new Float32Array(Math.max(...buffers.map((b) => b.length)));
  for (const buffer of buffers) {
    for (let index = 0; index < buffer.length; index++) {
      out[index] += buffer[index];
    }
  }
  return out;
};

// ------------------------------------------------------------------ sounds
/** Each takes its cue and returns [mono buffer, gain, pan from, pan to]. */
const sounds = {
  /** A key on the boot terminal. */
  type: () => [
    sum(
      shape(highpass(white(0.03), 3000), (time) => Math.exp(-time * 300)),
      shape(
        tone(0.03, () => between(1700, 2100)),
        (time) => 0.5 * Math.exp(-time * 400),
      ),
    ),
    0.13,
  ],

  /** Air and pitch climbing into a cut. */
  riser: ({ length }) => [
    sum(
      shape(
        sweep(white(length), (progress) => 300 * 2 ** (progress * 3.6)),
        (_, progress) => progress ** 3,
      ),
      shape(
        tone(length, (time) => 110 * 2 ** ((time / length) * 2)),
        (_, progress) => 0.25 * progress ** 3,
      ),
    ),
    0.3,
  ],

  /** The boom on a cut. */
  impact: ({ power = 1 }) => [
    sum(
      shape(
        tone(1.5, (time) => 36 + 64 * Math.exp(-time * 9)),
        (time) => Math.exp(-time * 3),
      ),
      shape(lowpass(white(0.4), 900), (time) => 0.7 * Math.exp(-time * 20)),
    ),
    0.85 * power,
  ],

  /** A shorter, drier thud for type landing. */
  hit: ({ power = 1 }) => [
    sum(
      shape(
        tone(0.5, (time) => 52 + 95 * Math.exp(-time * 18)),
        (time) => Math.exp(-time * 9),
      ),
      shape(lowpass(white(0.2), 2600), (time) => 0.4 * Math.exp(-time * 40)),
    ),
    0.6 * power,
  ],

  /** Something passing quickly: the wipes and the rising type. */
  whoosh: ({ length = 0.5, low = false }) => [
    shape(
      sweep(
        white(length),
        (progress) =>
          (low ? 160 : 260) +
          (low ? 1300 : 3300) * Math.sin(Math.PI * progress) ** 2,
        0.7,
      ),
      (_, progress) => Math.sin(Math.PI * progress) ** 1.5,
    ),
    low ? 0.3 : 0.34,
    -0.7,
    0.7,
  ],

  /** Digital tearing as a card's title lands. */
  glitch: () => {
    let pitch = 0;
    let gate = 0;
    let phase = 0;
    return [
      voice(0.28, (time, progress, index) => {
        if (index % samples(0.035) === 0) {
          pitch = between(180, 2600);
          gate = random() < 0.7 ? 1 : 0;
        }
        phase += pitch / RATE;
        const square = phase % 1 < 0.5 ? 1 : -1;
        return gate * square * (1 - progress);
      }),
      0.07,
    ];
  },

  /** The prize counting up: ticks that climb in pitch as it slows. */
  count: ({ length }) => {
    const out = new Float32Array(samples(length + 0.1));
    const steps = 46;
    for (let step = 0; step < steps; step++) {
      // The figure eases out, so equal steps of it bunch up at the start.
      const progress = step / steps;
      const at = (-Math.log2(1 - progress) / 10) * length;
      if (at > length) break;
      const blip = shape(
        tone(0.035, () => 760 + 900 * progress),
        (time) => Math.exp(-time * 110),
      );
      out.set(blip.subarray(0, out.length - samples(at)), samples(at));
    }
    return [out, 0.12];
  },

  /** The prize landing. */
  bell: () => [
    sum(
      ...[
        [880, 1, 2.6],
        [1769, 0.5, 3.6],
        [2658, 0.3, 4.8],
        [3696, 0.14, 7],
      ].map(([pitch, level, decay]) =>
        shape(
          tone(2, () => pitch),
          (time) => level * Math.exp(-time * decay),
        ),
      ),
    ),
    0.2,
  ],

  /** Data chattering while the name is still noise. */
  decrypt: ({ length }) => {
    const out = new Float32Array(samples(length));
    for (let at = 0; at < length - 0.03; at += between(0.022, 0.04)) {
      const pitch = 520 * 2 ** (Math.floor(between(0, 15)) / 5);
      const blip = shape(
        tone(
          0.02,
          () => pitch,
          (phase) => (Math.sin(phase) > 0 ? 1 : -1),
        ),
        (time) => Math.exp(-time * 160),
      );
      out.set(blip, samples(at));
    }
    return [lowpass(out, 5200), 0.05];
  },

  /** One letter of the name locking into place; each a little higher. */
  lock: ({ step }) => [
    sum(
      shape(
        tone(0.09, () => 1150 + step * 95),
        (time) => Math.exp(-time * 55),
      ),
      shape(
        highpass(white(0.012), 2500),
        (time) => 0.6 * Math.exp(-time * 500),
      ),
    ),
    0.13,
    -0.6 + step * 0.12,
    -0.6 + step * 0.12,
  ],

  /** Access granted: two rising notes. */
  granted: () => [
    sum(
      ...[
        [988, 0],
        [1480, 0.09],
      ].map(([pitch, delay]) =>
        voice(0.32, (time) => {
          const since = time - delay;
          if (since < 0) return 0;
          return (
            (Math.sin(TAU * pitch * since) +
              0.3 * Math.sin(TAU * pitch * 2 * since)) *
            Math.exp(-since * 16)
          );
        }),
      ),
    ),
    0.13,
  ],

  /** Air rushing past for the whole flight through the tunnel. */
  tunnel: ({ length }) => [
    shape(
      sum(
        sweep(
          brown(length),
          (progress) => 260 + 140 * Math.sin(progress * length * 1.3),
          0.9,
        ),
        shape(
          tone(length, (time) => 41 + 2 * Math.sin(time * 3)),
          () => 0.5,
        ),
      ),
      (time) => Math.min(1, time / 0.5) * Math.min(1, (length - time) / 0.5),
    ),
    0.3,
  ],

  /** A bolt close by cracks, then rolls; a flicker in the cloud only rolls. */
  thunder: ({ power }) => {
    const near = power > 0.5;
    const wobble = between(2.5, 4.5);
    const offset = between(0, TAU);
    const roll = shape(lowpass(brown(3.4), near ? 170 : 110), (time) => {
      const swell = Math.min(1, time / (near ? 0.04 : 0.35));
      const bumps =
        (0.6 + 0.4 * Math.sin(wobble * time * TAU * 0.3 + offset)) ** 2;
      return swell * bumps * Math.exp(-time * 1.25);
    });
    const crack = near
      ? shape(highpass(white(0.25), 1200), (time) => 0.5 * Math.exp(-time * 34))
      : new Float32Array(1);
    const pan = between(-0.5, 0.5);
    return [sum(roll, crack), (near ? 0.75 : 0.4) * power ** 0.5, pan, pan];
  },
};

// ------------------------------------------------------------------- music
const hz = (midi) => 440 * 2 ** ((midi - 69) / 12);
/** Chords as [bass note, ...the notes of the chord], in MIDI numbers. */
const CHORDS = {
  Am: [33, 57, 60, 64],
  C: [36, 60, 64, 67],
  G: [31, 55, 59, 62],
  D: [38, 57, 62, 66],
  Em: [28, 59, 64, 67],
};

const drums = {
  kick: (weight = 1) =>
    sum(
      shape(
        tone(0.34, (time) => 46 + 120 * Math.exp(-time * 30)),
        (time) =>
          Math.min(1, time / 0.002) * Math.exp(-time * (11 - weight * 3)),
      ),
      shape(
        highpass(white(0.008), 2000),
        (time) => 0.3 * Math.exp(-time * 600),
      ),
    ),
  snare: () =>
    sum(
      shape(
        sweep(white(0.24), () => 2100, 1.1),
        (time) => Math.exp(-time * 21),
      ),
      shape(
        tone(0.12, (time) => 180 + 60 * Math.exp(-time * 40)),
        (time) => 0.7 * Math.exp(-time * 34),
      ),
    ),
  hat: (open = false) =>
    shape(highpass(white(open ? 0.2 : 0.05), 7000), (time) =>
      Math.exp(-time * (open ? 17 : 95)),
    ),
  crash: () =>
    shape(highpass(white(2.4), 3800), (time) => Math.exp(-time * 2.2)),
  /** Noise swelling up into a cut. */
  swell: (seconds) =>
    shape(highpass(white(seconds), 5000), (_, progress) => progress ** 2.5),
};

/** A bass note: a saw over a sine, its filter snapping shut. */
function bassNote(midi, seconds) {
  const pitch = hz(midi);
  let phase = 0;
  let level = 0;
  return voice(seconds, (time) => {
    phase += pitch / RATE;
    const raw =
      0.7 * (2 * (phase % 1) - 1) +
      Math.sin(TAU * phase) +
      0.5 * Math.sin(Math.PI * phase);
    const cutoff = 220 + 1500 * Math.exp(-time * 16);
    level += (1 - Math.exp((-TAU * cutoff) / RATE)) * (raw - level);
    return (
      level * Math.min(1, time / 0.004) * Math.min(1, (seconds - time) / 0.012)
    );
  });
}

/** A plucked note, bright at the start and mellowing as it rings. */
function pluck(midi, seconds = 0.6, bright = 1) {
  const pitch = hz(midi);
  return voice(seconds, (time) => {
    const turn = TAU * pitch * time;
    return (
      (Math.sin(turn) +
        0.5 * bright * Math.sin(2 * turn) * Math.exp(-time * 9) +
        0.32 * bright * Math.sin(3 * turn) * Math.exp(-time * 14) +
        0.16 * bright * Math.sin(5 * turn) * Math.exp(-time * 22)) *
      Math.min(1, time / 0.003) *
      Math.exp(-time * 7) *
      Math.min(1, (seconds - time) / 0.02)
    );
  });
}

/**
 * A chord held on detuned saws, the filter moving from `from` to `to` hertz
 * as it goes. Returns [left, right]: each side is tuned a little apart.
 */
function pad(notes, seconds, from, to, attack = 0.5, release = 0.8) {
  const side = (lean) => {
    const out = new Float32Array(samples(seconds));
    for (const midi of notes) {
      for (const detune of [-0.005 + lean, 0.0012, 0.006 + lean]) {
        const step = (hz(midi) * (1 + detune)) / RATE;
        let phase = random();
        for (let index = 0; index < out.length; index++) {
          phase += step;
          out[index] += 2 * (phase % 1) - 1;
        }
      }
    }
    let first = 0;
    let second = 0;
    for (let index = 0; index < out.length; index++) {
      const progress = index / out.length;
      const time = index / RATE;
      const amount =
        1 - Math.exp((-TAU * from * (to / from) ** progress) / RATE);
      first += amount * (out[index] - first);
      second += amount * (first - second);
      out[index] =
        (second / notes.length) *
        Math.min(1, time / attack) *
        Math.min(1, (seconds - time) / release);
    }
    return out;
  };
  return [side(-0.0015), side(0.002)];
}

/**
 * The music, written against the film's own timeline. `marks` says when
 * each scene starts (`title`, `events`, `prize`, `finale`), how long each
 * competition's card is up (`card`, which is one bar), and when the last
 * line lands (`close`). Returns [left, right], peaking at 1.
 *
 *   opening   a heartbeat and a few plucked notes over a dark chord
 *   title     the chord opens up, the heartbeat doubles, a roll into...
 *   events    the full beat: one chord for each competition
 *   prize     the drums drop out and it lifts, then rolls into...
 *   finale    the beat again with the tune on top, to one last chord
 */
function score(marks, duration) {
  const length = samples(duration);
  const bus = () => [new Float32Array(length), new Float32Array(length)];
  const beat = marks.card / 4;
  const step = beat / 4;
  const put = (target, buffer, at, gain = 1, pan = 0) => {
    const [left, right] = Array.isArray(buffer) ? buffer : [buffer, buffer];
    const angle = ((pan + 1) * Math.PI) / 4;
    const start = samples(at) - 1;
    for (let index = 0; index < left.length; index++) {
      const spot = start + index;
      if (spot < 0 || spot >= length) continue;
      target[0][spot] += left[index] * gain * Math.cos(angle) * Math.SQRT2;
      target[1][spot] += right[index] * gain * Math.sin(angle) * Math.SQRT2;
    }
  };
  const kit = bus();
  const low = bus();
  const chords = bus();
  const notes = bus();
  const kicks = [];
  const kick = (at, gain = 1, weight = 1) => {
    put(kit, drums.kick(weight), at, 0.95 * gain);
    kicks.push([at, gain]);
  };
  /** Snare hits getting closer together and louder, ending at `until`. */
  const roll = (from, until, peak = 0.5) => {
    for (let at = from; at < until - 0.01;) {
      const progress = (at - from) / (until - from);
      put(kit, drums.snare(), at, peak * (0.25 + 0.75 * progress ** 1.5));
      at += progress > 0.5 ? step / 2 : step;
    }
  };
  /** One bar of the full beat over `chord`, `drive` being how hard. */
  const groove = (at, chord, bars, drive = 1) => {
    const [root, ...triad] = CHORDS[chord];
    for (let index = 0; index < bars * 16; index++) {
      const time = at + index * step;
      const inBeat = index % 4;
      if (inBeat === 0) kick(time, 1);
      if (index % 8 === 4) put(kit, drums.snare(), time, 0.5 * drive);
      if (inBeat === 2) put(kit, drums.hat(true), time, 0.11 * drive, 0.25);
      else put(kit, drums.hat(), time, inBeat ? 0.05 : 0.07, -0.25);
      // Bass: the root, jumping the octave on the off-beat.
      put(
        low,
        bassNote(root + (inBeat === 2 ? 12 : 0), step * 0.92),
        time,
        inBeat === 0 ? 0.5 : 0.42,
      );
      // Arpeggio: up through the chord and over the top.
      const rung = [0, 2, 3, 1, 2, 3, 4, 2][index % 8];
      const pitch = rung < 3 ? triad[rung] + 12 : triad[rung - 3] + 24;
      put(
        notes,
        pluck(pitch, 0.4, drive),
        time,
        (inBeat === 0 ? 0.2 : 0.14) * drive,
        index % 2 ? 0.5 : -0.5,
      );
    }
  };

  // Opening: almost nothing. A heartbeat, and a few notes looking for a tune.
  put(
    chords,
    pad(CHORDS.Am.slice(0, 3), marks.title + 0.3, 140, 520, 1.2, 0.3),
    0,
    0.5,
  );
  for (let at = beat; at < marks.title - 1; at += beat * 2) {
    kick(at, 0.42, 0);
    kick(at + step * 1.5, 0.28, 0);
  }
  [
    [2, 76],
    [3.5, 72],
    [4, 81],
    [5.5, 76],
    [6, 79],
    [6.5, 72],
  ].forEach(([beats, midi], index) => {
    put(
      notes,
      pluck(midi, 0.9, 0.6),
      beats * beat,
      0.16,
      index % 2 ? 0.4 : -0.4,
    );
  });
  put(kit, drums.swell(1.1), marks.title - 1.1, 0.16);

  // Title: the chord opens as the name resolves, then a roll into the beat.
  const titled = marks.events - marks.title;
  put(kit, drums.crash(), marks.title, 0.2);
  put(
    chords,
    pad(CHORDS.Am, titled + 0.2, 300, 2600, 0.05, 0.3),
    marks.title,
    0.75,
  );
  put(
    low,
    shape(
      tone(titled, () => hz(33)),
      (time) => Math.min(1, time / 0.05) * Math.min(1, (titled - time) / 0.2),
    ),
    marks.title,
    0.42,
  );
  for (let at = marks.title; at < marks.events - 0.01; at += beat * 2) {
    kick(at, 0.85);
    if (at + beat * 1.5 < marks.events - 1) kick(at + beat * 1.5, 0.5);
  }
  const [, ...minor] = CHORDS.Am;
  for (
    let index = 0, at = marks.title + beat * 4;
    at < marks.events - 0.01;
    index++, at += beat / 2
  ) {
    const grown = (at - marks.title) / titled;
    const pitch = minor[[0, 1, 2, 1][index % 4]] + (index % 8 > 3 ? 24 : 12);
    put(
      notes,
      pluck(pitch, 0.5, grown),
      at,
      0.2 * grown,
      index % 2 ? 0.5 : -0.5,
    );
  }
  roll(marks.events - beat * 2, marks.events, 0.5);
  put(kit, drums.swell(1), marks.events - 1, 0.18);

  // Events: one chord and one bar for each competition.
  const cards = Math.round((marks.prize - marks.events) / marks.card);
  const changes = ["Am", "C", "G", "D", "Em"];
  put(kit, drums.crash(), marks.events, 0.3);
  for (let card = 0; card < cards; card++) {
    const at = marks.events + card * marks.card;
    const chord = changes[card % changes.length];
    groove(at, chord, 1, 0.85 + 0.15 * (card / cards));
    put(
      chords,
      pad(CHORDS[chord].slice(1), marks.card + 0.15, 900, 1500, 0.03, 0.15),
      at,
      0.6,
    );
  }
  roll(marks.prize - beat, marks.prize, 0.42);

  // Prize: the drums drop out and everything lifts while it counts.
  const lift = marks.finale - marks.prize;
  const half = Math.round(lift / 2 / beat) * beat;
  kick(marks.prize, 1);
  put(kit, drums.crash(), marks.prize, 0.26);
  put(
    chords,
    pad(CHORDS.C.slice(1), half + 0.2, 500, 2400, 0.05, 0.3),
    marks.prize,
    0.8,
  );
  put(
    chords,
    pad(CHORDS.D.slice(1), lift - half + 0.15, 1400, 3600, 0.05, 0.15),
    marks.prize + half,
    0.8,
  );
  for (const [at, chord, held] of [
    [marks.prize, "C", half],
    [marks.prize + half, "D", lift - half],
  ]) {
    put(
      low,
      shape(
        tone(held, () => hz(CHORDS[chord][0] + 12)),
        (time) => Math.min(1, time / 0.03) * Math.min(1, (held - time) / 0.1),
      ),
      at,
      0.4,
    );
    const [, ...triad] = CHORDS[chord];
    for (let index = 0; index * step < held - 0.01; index++) {
      const time = at + index * step;
      const grown = (time - marks.prize) / lift;
      put(
        notes,
        pluck(triad[index % 3] + (index % 6 > 2 ? 24 : 12), 0.45, 0.5 + grown),
        time,
        0.09 + 0.12 * grown,
        index % 2 ? 0.6 : -0.6,
      );
    }
  }
  kick(marks.prize + half, 0.9);
  roll(marks.finale - beat * 2, marks.finale, 0.55);
  put(kit, drums.swell(1), marks.finale - 1, 0.2);

  // Finale: the beat again, two chords to the bar, with the tune over it.
  put(kit, drums.crash(), marks.finale, 0.32);
  const tune = [
    [76, 81],
    [79, 84],
    [79, 83],
    [78, 81],
  ];
  const turns = Math.round((marks.close - marks.finale) / (beat * 2));
  for (let turn = 0; turn < turns; turn++) {
    const at = marks.finale + turn * beat * 2;
    const chord = ["Am", "C", "G", "D"][turn % 4];
    groove(at, chord, 0.5, 1);
    put(
      chords,
      pad(CHORDS[chord].slice(1), beat * 2 + 0.1, 1400, 2200, 0.02, 0.1),
      at,
      0.62,
    );
    tune[turn % 4].forEach((midi, index) => {
      const lead = sum(
        pluck(midi, 0.7, 1.4),
        shape(pluck(midi + 12, 0.7, 1), () => 0.4),
      );
      put(notes, lead, at + index * beat, 0.3, index ? 0.2 : -0.2);
    });
  }
  // The last chord, left to ring.
  const ring = duration - marks.close;
  kick(marks.close, 1);
  put(kit, drums.crash(), marks.close, 0.34);
  put(
    chords,
    pad(CHORDS.Am, ring, 2400, 380, 0.02, ring * 0.7),
    marks.close,
    0.8,
  );
  put(
    low,
    shape(
      tone(ring, () => hz(33)),
      (time) => Math.min(1, time / 0.03) * Math.exp(-time * 1.1),
    ),
    marks.close,
    0.5,
  );
  [69, 76, 81, 88].forEach((midi, index) => {
    put(
      notes,
      pluck(midi, 2.2, 1.2),
      marks.close + index * step * 2,
      0.24,
      index % 2 ? 0.5 : -0.5,
    );
  });

  // The plucked notes echo from side to side, three sixteenths behind.
  const echo = samples(step * 3);
  for (let index = echo; index < length; index++) {
    notes[0][index] += 0.32 * notes[1][index - echo];
    notes[1][index] += 0.32 * notes[0][index - echo];
  }
  // Everything that is not a drum ducks out of the way of each kick.
  const duck = new Float32Array(length).fill(1);
  for (const [at, gain] of kicks) {
    const start = samples(at) - 1;
    for (let index = 0; index < samples(0.4); index++) {
      const spot = start + index;
      if (spot < 0 || spot >= length) continue;
      const held = 1 - 0.6 * gain * Math.exp((-index / RATE) * 9);
      duck[spot] = Math.min(duck[spot], held);
    }
  }
  const out = bus();
  let peak = 0;
  for (let index = 0; index < length; index++) {
    for (const side of [0, 1]) {
      out[side][index] =
        kit[side][index] +
        duck[index] *
          (low[side][index] + 0.24 * chords[side][index] + notes[side][index]);
      peak = Math.max(peak, Math.abs(out[side][index]));
    }
  }
  for (const side of out) {
    for (let index = 0; index < length; index++) side[index] /= peak || 1;
  }
  return out;
}

/** A dark, slowly breathing bed under the whole film. */
function drone(duration) {
  const wind = shape(
    lowpass(brown(duration), 380),
    (time) => 0.5 + 0.5 * Math.sin(time * 0.9),
  );
  return sum(
    shape(wind, () => 0.5),
    ...[55, 55.4, 82.5, 110.3].map((pitch, index) =>
      shape(
        tone(duration, () => pitch),
        (time) =>
          (index < 2 ? 0.5 : 0.22) *
          (0.75 + 0.25 * Math.sin(time * (0.4 + index * 0.13))),
      ),
    ),
  );
}

/**
 * Mixes every cue into a stereo track of `duration` seconds and returns it
 * as a 16-bit WAV file.
 */
export function mixSoundtrack(cues, duration) {
  const length = samples(duration);
  const left = new Float32Array(length);
  const right = new Float32Array(length);

  const place = (buffer, at, gain, panFrom = 0, panTo = panFrom) => {
    const start = samples(at) - 1;
    for (let index = 0; index < buffer.length; index++) {
      const target = start + index;
      if (target < 0 || target >= length) continue;
      // Equal-power pan, gliding from one side to the other.
      const pan = panFrom + (panTo - panFrom) * (index / buffer.length);
      const angle = ((pan + 1) * Math.PI) / 4;
      left[target] += buffer[index] * gain * Math.cos(angle) * Math.SQRT2;
      right[target] += buffer[index] * gain * Math.sin(angle) * Math.SQRT2;
    }
  };

  place(drone(duration), 0, 0.085);
  for (const cue of cues) {
    if (cue.type === "score") {
      const [musicLeft, musicRight] = score(cue.marks, duration);
      for (let index = 0; index < length; index++) {
        left[index] += musicLeft[index] * MUSIC;
        right[index] += musicRight[index] * MUSIC;
      }
      continue;
    }
    const make = sounds[cue.type];
    if (!make) throw new Error(`No sound for cue "${cue.type}"`);
    const [buffer, gain, panFrom, panTo] = make(cue);
    place(buffer, cue.time, gain, panFrom, panTo);
  }

  // Ease in and out, tame the peaks, and use the available headroom.
  let peak = 0;
  for (let index = 0; index < length; index++) {
    const time = index / RATE;
    const master =
      Math.min(1, time / 0.3) * Math.min(1, (duration - time) / 0.7);
    left[index] = Math.tanh(left[index] * master * 1.1);
    right[index] = Math.tanh(right[index] * master * 1.1);
    peak = Math.max(peak, Math.abs(left[index]), Math.abs(right[index]));
  }
  const level = peak > 0 ? 0.89 / peak : 1;

  const header = 44;
  const wav = Buffer.alloc(header + length * 4);
  wav.write("RIFF", 0);
  wav.writeUInt32LE(wav.length - 8, 4);
  wav.write("WAVEfmt ", 8);
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(2, 22);
  wav.writeUInt32LE(RATE, 24);
  wav.writeUInt32LE(RATE * 4, 28);
  wav.writeUInt16LE(4, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36);
  wav.writeUInt32LE(length * 4, 40);
  for (let index = 0; index < length; index++) {
    wav.writeInt16LE(
      Math.round(left[index] * level * 32767),
      header + index * 4,
    );
    wav.writeInt16LE(
      Math.round(right[index] * level * 32767),
      header + index * 4 + 2,
    );
  }
  return wav;
}
