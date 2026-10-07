/**
 * Provenance tests: measure what you can, demand what you can't.
 *
 * The validator half runs against real files in a temp folder, because the
 * thing being tested is "did somebody write the note next to the file" and a
 * mock filesystem would assume away the only question. The routing half stays
 * pure, like the rest of plan().
 *
 *   node --test tests/
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, mkdirSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";
import { readProvenance, findSidecar } from "../scripts/lib/provenance.mjs";
import { plan } from "../scripts/plan.mjs";

const dir = () => mkdtempSync(join(tmpdir(), "prov-"));
const touch = (p, body = "x") => (writeFileSync(p, body), p);
const note = (p, obj) => (writeFileSync(p, JSON.stringify(obj)), p);

const GOOD = { source: "stock", page: "https://example.com/p/1", license: "Example Content License" };

test("finds a sidecar written beside the file", () => {
  const d = dir();
  const f = touch(join(d, "clip.mp4"));
  note(join(d, "clip.mp4.json"), GOOD);
  assert.equal(findSidecar(f), join(d, "clip.mp4.json"));
});

test("finds a sidecar that shares the stem", () => {
  // The convention a curl-based fetcher used in the wild: punch.mp3 + punch.json.
  const d = dir();
  const f = touch(join(d, "punch.mp3"));
  note(join(d, "punch.json"), GOOD);
  assert.equal(findSidecar(f), join(d, "punch.json"));
});

test("own footage needs no note at all", () => {
  // A folder with no sidecars anywhere is a folder of things you shot.
  const d = dir();
  const a = touch(join(d, "workshop.jpg"));
  const b = touch(join(d, "founders.jpg"));
  const { problems } = readProvenance(a, { kind: "image", allFiles: [a, b] });
  assert.deepEqual(problems, []);
});

test("a file whose neighbours are noted but it is not, is an error", () => {
  // Downloaded five, recorded four: the fifth is the one that ships unattributed.
  const d = dir();
  const noted = touch(join(d, "a.jpg"));
  note(join(d, "a.jpg.json"), GOOD);
  const bare = touch(join(d, "b.jpg"));
  const { problems } = readProvenance(bare, { kind: "image", allFiles: [noted, bare] });
  assert.equal(problems.length, 1);
  assert.equal(problems[0].severity, "error");
  assert.match(problems[0].message, /neighbours have one/);
});

test("missing licence is an error, because no measurement recovers it", () => {
  const d = dir();
  const f = touch(join(d, "clip.mp4"));
  note(join(d, "clip.mp4.json"), { source: "stock", page: "https://example.com/p/1" });
  const { problems } = readProvenance(f, { kind: "video", allFiles: [f] });
  assert.equal(problems[0].severity, "error");
  assert.match(problems[0].message, /missing license/);
});

test("audio with no Content ID screen is an error", () => {
  const d = dir();
  const f = touch(join(d, "bed.mp3"));
  note(join(d, "bed.mp3.json"), GOOD);
  const { problems } = readProvenance(f, { kind: "audio", allFiles: [f] });
  assert.equal(problems.length, 1);
  assert.match(problems[0].message, /Content ID screen/);
});

test("audio screened clear passes", () => {
  const d = dir();
  const f = touch(join(d, "bed.mp3"));
  note(join(d, "bed.mp3.json"), { ...GOOD, contentId: "clear" });
  const { problems } = readProvenance(f, { kind: "audio", allFiles: [f] });
  assert.deepEqual(problems, []);
});

test("audio known to be Content ID registered is refused outright", () => {
  // Screened is not the same as usable. Knowing it will be claimed is a reason
  // to refuse, not a reason to proceed with a note in the margin.
  const d = dir();
  const f = touch(join(d, "bed.mp3"));
  note(join(d, "bed.mp3.json"), { ...GOOD, contentId: "registered" });
  const { problems } = readProvenance(f, { kind: "audio", allFiles: [f] });
  assert.equal(problems[0].severity, "error");
  assert.match(problems[0].message, /claimed on Meta and YouTube/);
});

test("video needs no Content ID screen", () => {
  const d = dir();
  const f = touch(join(d, "clip.mp4"));
  note(join(d, "clip.mp4.json"), GOOD);
  const { problems } = readProvenance(f, { kind: "video", allFiles: [f] });
  assert.deepEqual(problems, []);
});

test("a declared size is reported but never trusted", () => {
  const d = dir();
  const f = touch(join(d, "clip.mp4"));
  note(join(d, "clip.mp4.json"), { ...GOOD, dimensions: "1920x1374" });
  const { problems } = readProvenance(f, { kind: "video", allFiles: [f] });
  assert.equal(problems.length, 1);
  assert.equal(problems[0].severity, "info", "a measurable field must never block");
  assert.match(problems[0].message, /ignored in favour of the measured size/);
});

test("unparseable note is an error, not a silent pass", () => {
  const d = dir();
  const f = touch(join(d, "clip.mp4"));
  writeFileSync(join(d, "clip.mp4.json"), "{ not json");
  const { problems } = readProvenance(f, { kind: "video", allFiles: [f] });
  assert.equal(problems[0].severity, "error");
  assert.match(problems[0].message, /not valid JSON/);
});

test("sidecars are per-folder, so a noted folder does not incriminate a clean one", () => {
  const d = dir();
  mkdirSync(join(d, "stock"));
  mkdirSync(join(d, "mine"));
  const fetched = touch(join(d, "stock", "a.jpg"));
  note(join(d, "stock", "a.jpg.json"), GOOD);
  const own = touch(join(d, "mine", "b.jpg"));
  const { problems } = readProvenance(own, { kind: "image", allFiles: [fetched, own] });
  assert.deepEqual(problems, [], "own folder is untouched by the stock folder next door");
});

// ---- routing ----------------------------------------------------------------

const brand = { name: "T", colours: { ground: "#0F1729", ink: "#FFF", body: "#CCC", accent: "#3B82F6" } };
const layerSet = () => ({
  seconds: 13, xfade: 0.45, transition: "slideup",
  layers: Array.from({ length: 3 }, (_, i) => ({
    file: `slide-${i + 1}-story-9x16-alpha.png`,
    path: `/layers/slide-${i + 1}.png`,
    width: 1080, height: 1920,
    boxes: { head: { top: 700, bottom: 1100 }, foot: { top: 1560, bottom: 1620 } },
  })),
});
const asset = (over = {}) => ({
  file: "stock/a.jpg", path: "/assets/stock/a.jpg", kind: "image", role: "broll",
  overlay: false, width: 2000, height: 3000,
  fitness: { "story-9x16": { upscale: 1.0, retain: 1.0, verdict: "ok" } },
  provenanceProblems: [], unusable: false, ...over,
});
const sampler = () => [90, 90, 90];
const run = (manifest, inventory) =>
  plan({ manifest, inventory, layerSets: [layerSet()], brand, sampler });

test("a fitting asset with good provenance is still used", () => {
  const t = run({ seconds: [13], background: { kind: "auto" } }, { assets: [asset()], counts: { usable: 1 } });
  assert.equal(t.renders[0].slides[0].background.source, "still");
});

test("the same asset with no provenance is routed around, not rendered and warned about", () => {
  const t = run(
    { seconds: [13], background: { kind: "auto" } },
    { assets: [asset({ unusable: true })], counts: { usable: 1 } },
  );
  assert.equal(
    t.renders[0].slides[0].background.source,
    "generated",
    "an asset we cannot prove we may use must not reach the render",
  );
  assert.match(t.decisions.join(" "), /no recorded provenance/);
});

test("asking explicitly for assets still refuses an unprovable one", () => {
  const t = run(
    { seconds: [13], background: { kind: "assets" } },
    { assets: [asset({ unusable: true })], counts: { usable: 1 } },
  );
  assert.equal(t.renders[0].slides[0].background.source, "generated");
});

test("one bad note does not taint a good sibling", () => {
  const t = run(
    { seconds: [13], background: { kind: "auto" } },
    {
      assets: [asset({ file: "stock/bad.jpg", path: "/assets/stock/bad.jpg", unusable: true }), asset()],
      counts: { usable: 2 },
    },
  );
  assert.equal(t.renders[0].slides[0].background.source, "still");
  assert.equal(t.renders[0].slides[0].background.file, "/assets/stock/a.jpg");
});
