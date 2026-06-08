import { existsSync, readdirSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { extname, join, parse } from "node:path";

const MUSIC_DIR = "assets/music";
const COVER_SIZE = process.env.MUSIC_COVER_SIZE || "512";
const FORCE = process.argv.includes("--force");

const mp3Files = readdirSync(MUSIC_DIR, { withFileTypes: true })
  .filter((entry) => entry.isFile() && extname(entry.name).toLowerCase() === ".mp3")
  .map((entry) => entry.name)
  .sort((left, right) => left.localeCompare(right, "zh-Hans-CN"));

let extracted = 0;
let skipped = 0;
let withoutCover = 0;
let failed = 0;

for (const file of mp3Files) {
  const input = join(MUSIC_DIR, file);
  const id = parse(file).name;
  const output = join(MUSIC_DIR, `${id}.jpg`);

  if (!FORCE && existsSync(output)) {
    skipped += 1;
    continue;
  }

  if (!hasEmbeddedCover(input)) {
    withoutCover += 1;
    continue;
  }

  if (FORCE && existsSync(output)) {
    rmSync(output);
  }

  const result = spawnSync(
    "ffmpeg",
    [
      "-v",
      "error",
      "-y",
      "-i",
      input,
      "-map",
      "0:v:0",
      "-frames:v",
      "1",
      "-vf",
      `scale='min(${COVER_SIZE},iw)':-2`,
      "-q:v",
      "3",
      output,
    ],
    { encoding: "utf8" },
  );

  if (result.status === 0 && existsSync(output)) {
    extracted += 1;
    continue;
  }

  failed += 1;
  console.warn(`Failed to extract cover for ${file}`);
  if (result.stderr) {
    console.warn(result.stderr.trim());
  }
}

console.log(`Checked ${mp3Files.length} MP3 files`);
console.log(`Extracted ${extracted} covers`);
console.log(`Skipped ${skipped} existing covers`);
console.log(`Without embedded cover ${withoutCover}`);
console.log(`Failed ${failed}`);

function hasEmbeddedCover(file) {
  const result = spawnSync(
    "ffprobe",
    [
      "-v",
      "error",
      "-select_streams",
      "v",
      "-show_entries",
      "stream=index",
      "-of",
      "csv=p=0",
      file,
    ],
    { encoding: "utf8" },
  );

  return result.status === 0 && result.stdout.trim().length > 0;
}
