/**
 * Provenance for assets this machine did not create.
 *
 * The rule is: measure what you can, demand what you can't.
 *
 * Size, duration and format are measurable, so inventory.mjs ffprobes them off
 * the file and never reads them from a note. A note that disagrees with the
 * file is wrong by definition, so trusting one would only ever introduce an
 * error. Where a clip came from, what licence it carries and whether it has
 * been screened for Content ID are *not* measurable — nothing in the bytes
 * records them — so they have to be written down, and those are the fields
 * worth refusing over.
 *
 * The asymmetry in severity is deliberate. A missing dimension costs you a
 * slightly soft frame. A missing licence costs you an ad you cannot prove you
 * were allowed to run, and an unscreened music bed costs you a Content ID
 * claim on a live campaign — on Pixabay roughly 95% of tracks are registered,
 * which is a coin-flip you lose most of the time.
 *
 * No provider is named here. Two sidecar conventions already exist in the wild
 * on this project — `clip.mp4.json` beside the file, and `clip.json` sharing
 * its stem — so both are accepted. Any fetcher that writes either shape works:
 * an MCP connector, a curl of a public CDN URL, or a human with a browser.
 */
import { existsSync, readFileSync } from "fs";
import { basename, dirname, extname, join } from "path";

/** Fields no measurement can recover. Absence of any one is an error. */
export const REQUIRED = ["source", "page", "license"];

/**
 * Content ID states. `clear` and `registered` both mean somebody looked;
 * `registered` additionally means do not use it on Meta or YouTube.
 */
export const SCREEN_STATES = new Set(["clear", "registered", "not-applicable"]);

/** `<file>.json` first, then `<stem>.json`. Returns a path or null. */
export function findSidecar(full) {
  const beside = `${full}.json`;
  if (existsSync(beside)) return beside;
  const stem = join(dirname(full), `${basename(full, extname(full))}.json`);
  if (existsSync(stem) && stem !== full) return stem;
  return null;
}

/**
 * True when a file is in a folder where *something* carries a sidecar.
 *
 * This is what distinguishes footage you shot from footage you fetched without
 * asking anyone to declare it. Your own photo folders have no sidecars at all
 * and are left alone; a download folder where four of five files were noted is
 * exactly the case worth catching, because the fifth is the one that ships
 * unattributed.
 */
export function inAcquiredDir(full, allFiles) {
  const dir = dirname(full);
  return allFiles.some((f) => dirname(f) === dir && f !== full && findSidecar(f));
}

/**
 * Read and check one asset's provenance.
 *
 * Returns `{ sidecar, data, problems }`. `problems` entries are
 * `{ severity: "error" | "warning", message }`. `data` is null when there is
 * no sidecar and none was required.
 */
export function readProvenance(full, { kind, allFiles = [] } = {}) {
  const sidecar = findSidecar(full);
  const problems = [];

  if (!sidecar) {
    if (inAcquiredDir(full, allFiles)) {
      problems.push({
        severity: "error",
        message:
          "no provenance note, but its neighbours have one — so this was fetched and not recorded. " +
          `Write ${basename(full)}.json with source, page and license.`,
      });
    }
    return { sidecar: null, data: null, problems };
  }

  let data;
  try {
    data = JSON.parse(readFileSync(sidecar, "utf8"));
  } catch (e) {
    return {
      sidecar,
      data: null,
      problems: [{ severity: "error", message: `provenance note is not valid JSON (${e.message})` }],
    };
  }

  const missing = REQUIRED.filter((f) => !data[f] || String(data[f]).trim() === "");
  if (missing.length) {
    problems.push({
      severity: "error",
      message: `provenance note is missing ${missing.join(", ")} — nothing in the file can supply these`,
    });
  }

  // Audio is where an unscreened asset actually costs money, so it is the one
  // kind that must carry a verdict. Absence is not "probably fine", it is "no
  // one has looked" — and that is the state this field exists to make visible.
  if (kind === "audio") {
    const state = data.contentId ?? data.content_id;
    if (!state) {
      problems.push({
        severity: "error",
        message:
          'no Content ID screen recorded. Check the track page for the "Content ID Registered" ' +
          'badge, then add "contentId": "clear" or "registered" to the note',
      });
    } else if (!SCREEN_STATES.has(state)) {
      problems.push({
        severity: "error",
        message: `contentId "${state}" is not one of ${[...SCREEN_STATES].join(", ")}`,
      });
    } else if (state === "registered") {
      problems.push({
        severity: "error",
        message:
          "is Content ID registered, so it will be claimed on Meta and YouTube. Pick another track.",
      });
    }
  }

  // A declared size is not used for anything — the file was measured — but a
  // mismatch means the note describes a different file, which is worth saying
  // out loud even though the render is unaffected.
  if (data.dimensions && typeof data.dimensions === "string") {
    problems.push({
      severity: "info",
      message: `declares ${data.dimensions}; ignored in favour of the measured size`,
    });
  }

  return { sidecar, data, problems };
}

/** Collapse one asset's problems into the worst severity present. */
export function worstSeverity(problems) {
  if (problems.some((p) => p.severity === "error")) return "error";
  if (problems.some((p) => p.severity === "warning")) return "warning";
  return problems.length ? "info" : null;
}
