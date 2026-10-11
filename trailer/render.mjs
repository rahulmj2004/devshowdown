#!/usr/bin/env node
/**
 * Renders the DevShowdown trailer to an MP4.
 *
 *   node trailer/render.mjs              render trailer/devshowdown-trailer.mp4
 *   node trailer/render.mjs --preview    serve it to watch live in a browser
 *
 * The trailer is a web page (trailer.html, trailer.js, hacker.js) that reuses
 * the site's lightning from components/hero. This script serves
 * that page, steps its clock one frame at a time in headless Chromium, and
 * pipes a screenshot of every frame into ffmpeg. Because the page's clock
 * only moves when told to, the result is smooth however slow the machine is.
 * The page also reports what happened when (keystrokes, cuts, lightning);
 * sound.mjs synthesises a soundtrack from that and it is laid under
 * the picture. Pass --silent to skip the sound.
 *
 * Needs ffmpeg with H.264: on the PATH, or pointed to with FFMPEG=/path/to/it.
 * Options: --fps 30 (or 60), --out some/file.mp4
 */
import { spawn, spawnSync } from "node:child_process";
import { once } from "node:events";
import { readFile, rm, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import ts from "typescript";
import { mixSoundtrack } from "./sound.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const engine = path.join(here, "..", "components", "hero");
const args = process.argv.slice(2);
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`);
  return index === -1 ? fallback : args[index + 1];
};
const fps = Number(option("fps", "30"));
const output = path.resolve(
  option("out", path.join(here, "devshowdown-trailer.mp4")),
);
const ffmpeg = process.env.FFMPEG || "ffmpeg";

/** The hero scene is TypeScript; hand the browser plain modules. */
async function engineModule(name) {
  const source = await readFile(path.join(engine, `${name}.ts`), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.ESNext,
      target: ts.ScriptTarget.ES2022,
    },
  });
  // Browsers need the file extension that TypeScript lets us leave off.
  return outputText.replace(/from "(\.\/[\w-]+)"/g, 'from "$1.js"');
}

const server = createServer(async (request, response) => {
  const { pathname } = new URL(request.url ?? "/", "http://localhost");
  try {
    const engineFile = /^\/engine\/([\w-]+)\.js$/.exec(pathname);
    if (engineFile) {
      response.writeHead(200, { "content-type": "text/javascript" });
      response.end(await engineModule(engineFile[1]));
    } else if (pathname === "/trailer.js" || pathname === "/hacker.js") {
      response.writeHead(200, { "content-type": "text/javascript" });
      response.end(await readFile(path.join(here, pathname)));
    } else if (pathname === "/") {
      response.writeHead(200, { "content-type": "text/html" });
      response.end(await readFile(path.join(here, "trailer.html")));
    } else {
      response.writeHead(404).end();
    }
  } catch (error) {
    response.writeHead(500).end(String(error));
  }
});
server.listen(args.includes("--preview") ? 4173 : 0, "127.0.0.1");
await once(server, "listening");
const address = `http://127.0.0.1:${server.address().port}/`;

if (args.includes("--preview")) {
  console.log(`Trailer playing at ${address} (1920×1080; Ctrl+C to stop)`);
} else {
  if (spawnSync(ffmpeg, ["-version"]).error) {
    console.error(
      `Could not run "${ffmpeg}". Install ffmpeg (e.g. brew install ffmpeg) or set FFMPEG=/path/to/ffmpeg.`,
    );
    process.exit(1);
  }

  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1,
  });
  page.on("pageerror", (error) => {
    console.error(`Page error: ${error.message}`);
    process.exitCode = 1;
  });
  await page.goto(`${address}?capture`);
  // The page's own animation clock is frozen, so poll on a real timer.
  await page.waitForFunction(() => window.__trailer, null, { polling: 100 });
  const duration = await page.evaluate(() => window.__trailer.duration);
  const frames = Math.round(duration * fps);

  // Picture first, to a scratch file; the sound is only known afterwards.
  const silent = `${output}.picture.mp4`;
  const encoder = spawn(
    ffmpeg,
    [
      "-y",
      "-loglevel",
      "error",
      "-f",
      "image2pipe",
      "-framerate",
      String(fps),
      "-c:v",
      "mjpeg",
      "-i",
      "-",
      "-c:v",
      "libx264",
      "-preset",
      "slow",
      "-crf",
      "16",
      "-pix_fmt",
      "yuv420p",
      "-colorspace",
      "bt709",
      "-color_primaries",
      "bt709",
      "-color_trc",
      "bt709",
      "-movflags",
      "+faststart",
      silent,
    ],
    { stdio: ["pipe", "inherit", "inherit"] },
  );

  for (let index = 0; index < frames; index++) {
    if (index > 0) {
      await page.evaluate((step) => window.__advance(step), 1000 / fps);
    }
    const shot = await page.screenshot({ type: "jpeg", quality: 100 });
    if (!encoder.stdin.write(shot)) await once(encoder.stdin, "drain");
    if (index % fps === 0) {
      process.stdout.write(`\r${Math.round(index / fps)}s / ${duration}s`);
    }
  }
  encoder.stdin.end();
  const [code] = await once(encoder, "close");
  const cues = await page.evaluate(() => window.__trailer.cues());
  await browser.close();
  server.close();
  if (code !== 0) {
    console.error(`\nffmpeg exited with code ${code}`);
    process.exit(1);
  }

  const track = `${output}.sound.wav`;
  const mux = args.includes("--silent")
    ? ["-i", silent, "-c", "copy"]
    : [
        "-i",
        silent,
        "-i",
        track,
        "-c:v",
        "copy",
        "-c:a",
        "aac",
        "-b:a",
        "224k",
      ];
  if (!args.includes("--silent")) {
    await writeFile(track, mixSoundtrack(cues, duration));
    const heard = (type) => cues.filter((cue) => cue.type === type).length;
    console.log(`\nSound: ${cues.length} cues (${heard("thunder")} thunder)`);
  }
  const muxed = spawnSync(
    ffmpeg,
    ["-y", "-loglevel", "error", ...mux, "-movflags", "+faststart", output],
    { stdio: "inherit" },
  );
  await rm(silent, { force: true });
  await rm(track, { force: true });
  if (muxed.status !== 0) process.exit(1);
  console.log(`\nWrote ${output}`);
}
