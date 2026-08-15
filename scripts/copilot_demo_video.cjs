const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const VIDEO_DIR = path.join(ROOT, "docs/submission/video");
const SHOTS_DIR = path.join(VIDEO_DIR, "shots");
const TIMELINE_PATH = path.join(VIDEO_DIR, "timeline.json");
const OUTPUT = path.join(ROOT, "docs/submission/FireOps-AI-GOAI-demo.mp4");
const NARRATION = path.join(VIDEO_DIR, "narration.m4a");
const TRANSCRIPT = path.join(VIDEO_DIR, "transcript.json");
const MANIFEST = path.join(VIDEO_DIR, "render-manifest.json");
const timeline = JSON.parse(fs.readFileSync(TIMELINE_PATH, "utf8"));
const work = fs.mkdtempSync(path.join(os.tmpdir(), "fireops-video-"));

function run(command, args, options = {}) {
  const result = spawnSync(command, args, { encoding: "utf8", maxBuffer: 20 * 1024 * 1024, ...options });
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || `${command} failed`);
  return result.stdout;
}

function duration(file) {
  return Number(run("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "default=nw=1:nk=1", file]).trim());
}

function main() {
  const segments = [];
  const actualCues = [];
  let actualStart = 0;

  for (const [index, cue] of timeline.cues.entries()) {
    const seconds = cue.end - cue.start;
    const shot = path.join(SHOTS_DIR, `${cue.id}.png`);
    if (!fs.existsSync(shot)) throw new Error(`missing shot: ${shot}`);
    const voice = path.join(work, `${cue.id}.aiff`);
    run("say", ["-v", timeline.voice.name, "-r", String(timeline.voice.rate), "-o", voice, cue.narration]);
    const voiceDuration = duration(voice);
    const speechWindow = Math.max(1, seconds - 0.45);
    const tempo = voiceDuration > speechWindow ? voiceDuration / speechWindow : 1;
    const audioFilter = `${tempo > 1.005 ? `atempo=${tempo.toFixed(5)},` : ""}apad=pad_dur=${seconds.toFixed(3)},atrim=duration=${seconds.toFixed(3)},afade=t=in:st=0:d=0.08,afade=t=out:st=${Math.max(0, seconds - 0.2).toFixed(3)}:d=0.2`;
    const frames = Math.round(seconds * timeline.fps);
    const videoFilter = `scale=${timeline.width}:${timeline.height}:force_original_aspect_ratio=decrease,pad=${timeline.width}:${timeline.height}:(ow-iw)/2:(oh-ih)/2:#071018,zoompan=z='min(max(zoom,pzoom)+0.00010,1.015)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${timeline.width}x${timeline.height}:fps=${timeline.fps},fade=t=in:st=0:d=0.18,fade=t=out:st=${Math.max(0, seconds - 0.18).toFixed(3)}:d=0.18`;
    const segment = path.join(work, `${String(index).padStart(2, "0")}.mp4`);
    run("ffmpeg", [
      "-y", "-loop", "1", "-i", shot, "-i", voice,
      "-filter_complex", `[0:v]${videoFilter}[v];[1:a]${audioFilter}[a]`,
      "-map", "[v]", "-map", "[a]", "-t", seconds.toFixed(3), "-r", String(timeline.fps),
      "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
      "-c:a", "aac", "-b:a", "192k", "-ar", "48000", "-ac", "2", "-movflags", "+faststart", segment,
    ]);
    const actualDuration = duration(segment);
    actualCues.push({
      id: cue.id,
      expected_start: cue.start,
      expected_end: cue.end,
      actual_start: actualStart,
      actual_end: actualStart + actualDuration,
      motion: "deterministic-zoompan",
      narration_source_duration: voiceDuration,
      tempo,
    });
    actualStart += actualDuration;
    segments.push(segment);
    console.log(`rendered ${cue.id} (${seconds}s)`);
  }

  const concat = path.join(work, "segments.txt");
  fs.writeFileSync(concat, segments.map((file) => `file '${file.replace(/'/g, "'\\''")}'`).join("\n"));
  const base = path.join(work, "base.mp4");
  run("ffmpeg", ["-y", "-f", "concat", "-safe", "0", "-i", concat, "-c", "copy", base]);
  run("ffmpeg", ["-y", "-i", base, "-c", "copy", "-movflags", "+faststart", OUTPUT]);
  run("ffmpeg", ["-y", "-i", OUTPUT, "-vn", "-c:a", "copy", NARRATION]);

  fs.writeFileSync(TRANSCRIPT, `${JSON.stringify({ schema_version: "fireops-transcript/v1", language: "zh-CN", cues: timeline.cues.map(({ id, start, end, narration: text }) => ({ id, start, end, text })) }, null, 2)}\n`);
  fs.writeFileSync(MANIFEST, `${JSON.stringify({ schema_version: "fireops-video-render/v1", timeline: "timeline.json", output: path.basename(OUTPUT), duration: duration(OUTPUT), fps: timeline.fps, width: timeline.width, height: timeline.height, cues: actualCues }, null, 2)}\n`);
  console.log(`video: ${OUTPUT}`);
}

try {
  main();
} catch (error) {
  console.error(error.message || error);
  process.exit(1);
}
