---
name: ad-motionify
description: "Turn finished ad copy into moving video — composite ad-creative's copy layers over real footage, real photographs, or procedurally generated brand-exact plates, add drift or a wet-pigment warp, and lay a synthesised bed or a supplied track underneath. Use this when someone wants their static ads or slide reel to become proper motion, wants background video or b-roll behind their ad copy, wants music or a voiceover added to a cut, wants the same ad at several durations, or asks to do any of it without paying for a video model. Routes on what assets actually exist: real footage where it fits, generated plates where it does not."
---

# Motion for ads that already have their words right

`ad-creative` produces the ad. This gives it a background, movement and sound.

The division matters and is worth stating plainly: **`ad-creative` must keep working for someone
who has nothing but a browser and ffmpeg.** This skill is allowed to assume more — real footage, a
local model, a paid generator — and so it lives separately rather than as a flag. Nothing here can
break a plain static render.

The copy is never re-rendered. It arrives as transparent-ground PNGs that `ad-creative` exported,
and is composited unchanged, so the headline, the CTA and the legal line are the exact pixels that
skill produced. A video model asked to animate a frame containing a crisis phone number will happily
return a different phone number.

## Order of operations

0. **Check ffmpeg is present.** That and node is the entire dependency list.
1. **Export the copy layers** from ad-creative.
2. **Inventory the assets** — or establish there are none, which is a real answer.
3. **Write `motion.json`.**
4. **Plan**, and read the decisions it prints.
5. **Propose** — render frames and look at them.
6. **Assemble**, once approved.

## 1. Export the copy layers

```bash
node <ad-creative>/scripts/export-layers.mjs --campaign ./campaign.json --out ./layers
```

That writes RGBA PNGs plus `layers.json`, which carries the measured boxes for the headline,
subline, CTA and fine print, and the slide timing. Both matter here: the boxes are how the scrim is
placed against real coordinates, and the timing is how a 13s and a 20s cut stay consistent.

One layer set is one placement. For several placements, run it once per size into separate folders —
a second run into the same folder overwrites `layers.json`.

## 2. Inventory the assets

```bash
node scripts/inventory.mjs --assets ./assets --out ./inventory.json
```

This describes files and nothing else — no brand, no campaign — so the same output serves any
business. It scores every asset against every placement and prints a table, because what it finds is
one of the things a human has to agree with.

**It gates on fitness, not presence.** "Has b-roll" and "has usable b-roll" are different questions,
and the difference is where this goes wrong:

- **Resolution.** Past ~1.15x upscale a photograph softens; past ~1.4x it looks upscaled. WhatsApp
  re-encodes video to roughly 480p, so footage that arrived that way is usually finished before it
  starts — the fix is the original off the phone, not a sharpen filter.
- **Shape.** A 2400x1020 photo is high-resolution and still wrong for 9:16, because only 24% of the
  frame survives the crop. That is a composition failure, not a sharpness one, and no resolution
  fixes it.
- **Vectors and logos are exempt.** An SVG has no native resolution, and a wordmark sits at 5% of
  the width in a corner — scoring either for full-frame coverage is a category error. A raster with
  a vector sibling is dropped in favour of the vector.
- **Finished creative is excluded.** Anything in a `build`/`out`/`exports` folder, named like a
  deliverable, or sized within a few pixels of a placement. Skip this and last month's ad becomes
  this month's background. The tolerance is not fussiness: a real finished ad in testing came out of
  its editor at 1080x1352 and walked straight through an exact match against 1080x1350.

Pass `--include-finished` to override. If the folder is empty or missing, say so and carry on —
that routes to generated plates, which is a legitimate outcome and the common one.

### Measure what you can, demand what you can't

Size, duration and format are measured off the file with `ffprobe`, every time. A note that
disagrees with the file is simply wrong, so trusting one can only introduce an error — and this is
not a hypothetical. The first real folder this ran against had three stock images whose notes
declared 3933x2622, 4000x6000 and 2912x5184, while the files on disk were 1280x853, 853x1280 and
719x1280. The notes recorded the *original* dimensions; what had actually been downloaded was a
preview. Trusted, all three would have cleared the fitness gate; measured, all three are too soft
and get rejected.

Where a file came from, what licence it carries, and whether it has been screened for Content ID
are **not** measurable — nothing in the bytes records them — so they have to be written down, and
these are the fields worth refusing over. Put a JSON note next to each acquired file, either
`clip.mp4.json` or `clip.json`:

```json
{ "source": "<provider>", "page": "https://…/the-page-you-got-it-from",
  "license": "<licence name>", "contentId": "clear" }
```

- `source`, `page`, `license` — required on anything acquired. Missing any one blocks the asset.
- `contentId` — required on **audio** only: `clear`, `registered`, or `not-applicable`. Absence
  means nobody looked, which is the state this field exists to make visible. `registered` is
  refused outright rather than warned about: it *will* be claimed on Meta and YouTube.
- Measurable fields are ignored if present, and reported so the mismatch is visible.

**Your own footage needs no note.** A folder with no notes at all is a folder of things you shot,
and is left alone. The rule triggers per folder: if a file's neighbours carry notes and it does not,
that is a download nobody recorded, and it blocks — because the unrecorded one is the one that
ships unattributed.

`inventory.mjs` exits 2 when anything is blocked, and `plan.mjs` routes around those assets to a
generated plate rather than rendering them and warning afterwards. Putting the question after the
work is the same mistake as acquiring before asking: by then the frames exist and the pressure is
to ship them.

## 3. Write `motion.json`

```json
{
  "brand": "./brand.json",
  "layers": ["./layers"],
  "inventory": "./inventory.json",
  "seconds": [13, 20],
  "budget": { "tier": 0 },
  "background": { "kind": "auto", "generator": "wash", "motion": "warp" },
  "audio": { "kind": "bed", "key": "Am" }
}
```

- **`seconds`** is a list. One manifest, several durations, timing derived rather than typed.
- **`background.kind`** — `auto` (real assets where they fit, generated where they do not),
  `assets`, `generated`, or `files` with an explicit list.
- **`background.motion`** — `warp`, `kenburns`, `none`. Photographs are drifted rather than warped
  regardless, and the planner says so when it overrides you.
- **`audio.kind`** — `bed`, `file`, `none`.
- **`budget.tier`** is a ceiling and a *permission*, never an instruction to spend. Planning refuses
  rather than quietly going past it, and a tier above 0 still renders Tier 0 first and asks. Tier 0
  is everything the scripts do on their own.

## 4. Plan

```bash
node scripts/plan.mjs --manifest ./motion.json --out ./timeline.json
```

`plan()` is a pure function of manifest, inventory, layers and brand. It touches no files and runs
no ffmpeg, so routing can be tested against fixture inventories — empty, stills-only, has-video —
without rendering anything. Rendering is the slow part and the least likely to be wrong.

`timeline.json` is the artifact that matters: every asset resolved, every duration computed, every
fallback recorded with its reason. It is diffable, so changing one line of copy and regenerating
tells you exactly what moved.

**Routing is per placement, not per campaign.** A business can easily have photographs that work
beautifully at 1:1 and are unusable at 9:16 — that is the normal case for any landscape library, and
deciding once per campaign gets it wrong for half the outputs.

## 5. Propose, and actually look

```bash
node scripts/propose.mjs --timeline ./timeline.json
```

Renders the first slide and the CTA slide as real composites, prints every decision with its reason,
and stops.

**`assemble.mjs` refuses to run until the timeline is approved.** This is not ceremony. Running this
pipeline across three real businesses, the two defects that mattered were a headline that read as
bossy and a generated background that had quietly grown a shape nobody asked for. Neither is visible
in a manifest, a timeline, or a table. Both are obvious in one frame.

Put the frames in front of the person and ask about all five: **assets** (is this the right thing to
show), **business** (recognisable as theirs), **language** (read it aloud), **emotions** (right tone,
not bossy), **blurb** (fine print correct, and still true). Then set `"approved": true`.

## 6. Assemble

```bash
node scripts/assemble.mjs --timeline ./timeline.json --out ./out
```

Writes a silent cut and, if audio is configured, a second file with the track. Silent is kept
deliberately: music gets swapped, and a baked-in track cannot be changed without re-encoding.

## How the background gets made

### Generated plates

```bash
node scripts/backgrounds.mjs --brand ./brand.json --generator flow --size story-9x16 --out plate.png
```

`wash`, `phyllotaxis`, `flow`, `rings`, `grid`, `noise`. All deterministic from a seed, all exact to
the brand hex, all free and about a second each.

The geometric ones are a genuine win rather than an approximation of a model. Phyllotaxis, flow
fields and concentric rings are *computable*: the same seed gives the same plate on any machine, and
the palette is arithmetic. A diffusion model asked for "abstract brand-coloured texture" returns
something plausible in roughly the right colours, returns something different next time, and cannot
be told `#0F1729` and be believed.

### Motion

`warp` drives ffmpeg's `displace` with two slowly-evolving perlin fields, so pixels flow like wet
pigment. Its real advantage is structural: **`displace` can only relocate pixels that already
exist**, so it cannot invent a colour, a shape or a face. Asked to animate a painting, a generative
video model produced a cyan bleed, a pale bloom and a blank-faced figure that were not in the
source. This cannot, by construction. It is fluid motion, not narrative motion — it bleeds paint, it
cannot turn a head.

Photographs get `kenburns` instead, and the planner overrides `warp` to do it. A rippling face reads
as a broken file rather than a style.

### Looping

Short sources are boomeranged — played forward then reversed — so the first and last frames are
identical and the loop point is invisible. This is what makes duration independent of the source: a
5s plate fills 13s, 20s or 30s seamlessly. It matters beyond tidiness, because most video models cap
out around 15 seconds, so a 20s ad cannot be one generation at all.

## The scrim is measured, not chosen

White copy over a bright frame is illegible; a heavy scrim over a dark plate buries the background.
Both are the same mistake — a constant where a measurement belongs.

So the background is sampled, the copy colour is read from the brand, and the alpha is solved for a
real contrast ratio. Measured on the band where the copy actually sits, using the boxes from
`layers.json`, rather than the whole frame — a headline does not care about sky it never touches.

Real numbers from three plates, same brand, same target:

| Plate | Mean RGB | Alpha needed |
|---|---|---|
| Dark ink wash | 26,40,56 | **0** — white is already at 15.5:1 |
| Red velvet | 153,44,76 | **0.40** |
| Bright workshop photo | 116,90,71 | **0.52** |

Any fixed value is wrong for two of those three.

**Known limit:** this is a mean, not a worst case. A small blown highlight inside the band can still
undercut a letterform. Widening the target is the cheap defence; looking at the proposal frame is
the honest one.

## Audio

```bash
node scripts/audio.mjs --seconds 20 --out ./bed.wav
```

Sparse plucked notes with a 12ms attack and a long exponential decay, each carrying two harmonics,
over filtered brown noise.

Two things here were learned the hard way. **Held tones are not music** — a chord of sustained sines
is the acoustic recipe for a gong, and pure sines have no harmonics to read as an instrument. An
early attempt held four sines for the whole clip and measured 2.0 LU of range: nothing changed for
twenty seconds and it sounded like it. **A bed belongs at about −23 LUFS** — normalising it to −16,
the figure for voice-forward content, lifts a static tone by 12dB and makes it the loudest thing in
the ad.

A supplied track shorter than the cut is boomeranged before looping, so the wrap is inaudible rather
than a click every few seconds.

## Fetching stock, when a provider is connected

Nothing in this skill downloads anything. Like the paid generators below, acquisition is something
**you** do and then hand over as ordinary files — `scripts/` has no network code and names no
vendor, so the same instructions work with whatever a given machine has available.

If a stock provider is reachable — an MCP connector for one, or simply a public media URL you can
fetch — and the business has no footage of its own that fits, stock is worth offering before a
generated plate. It is free, so unlike a paid generator there is no cost to preflight. What it is
not is unexamined: three things have to be true before a fetched file is usable.

1. **Write the note.** Source, page, licence, and for audio a Content ID screen. See *Measure what
   you can, demand what you can't* above. `inventory.mjs` enforces this, so a fetch without a note
   is work you will redo.
2. **Let it be measured.** Download the largest rendition the provider actually serves, then run
   `inventory.mjs` and read the table. A provider's metadata often describes the original while the
   download is a preview; the fitness verdict is the only answer that counts.
3. **Check it is atmosphere, not evidence.** A stock clip of *someone else's* workshop is no more
   this client's workshop than a generated one. See *Generate atmosphere, never evidence* — the rule
   is about what an image claims, not about how it was made, so it applies to stock exactly as it
   applies to a diffusion model.

Audio deserves its own caution. Free stock music is where Content ID bites hardest — on at least
one large library roughly 95% of tracks are registered, which is a coin-flip you lose most of the
time, and the claim lands on the very platforms these ads run on. Screen the track page before
downloading, not after assembling. A synthesised bed costs nothing and carries no claim at all,
which is why it stays the default.

## Trying a paid generator, after the free one

Tier 0 renders first, always. Only then is it worth asking whether paying would improve it.

**Never initiate a paid call.** `budget.tier` above 0 is *permission*, not an instruction — if Tier 0
covers the job, use Tier 0 and say so. The person pays for these, and on a client job it is not even
your account.

Once the Tier 0 frames exist, offer the upgrade — but only when the background is a **generated
plate**. If real footage is already carrying the ad there is nothing to buy, and offering anyway
just invites spending for its own sake.

The offer needs four things before anyone says yes:

1. **The free version, rendered.** Not described — on screen, next to the question. This is the
   comparison, and sometimes it wins: asked to animate a painterly still, a video generator returned
   a cyan bleed, a pale bloom and a blank-faced figure that were not in the source, while the local
   warp could not invent any of them because `displace` only relocates existing pixels.
2. **Which connector.** Check what is actually available in the session — Higgsfield, a Gemini image
   model, whatever is connected — and ask which to use if there is more than one. Never pick
   silently, and if none is connected, say so and stop at Tier 0.
3. **The cost, before the call.** Preflight it where the connector supports that and show the number.
   A generation that is cheap per image is not cheap across five slides and three placements.
4. **The prompt, in full.** This is where *generate atmosphere, never evidence* is actually enforced.
   Paid models are photoreal by default, so this is exactly where a synthetic "workshop photo" gets
   made by accident. The prompt should ask for texture and abstraction; refuse a request to depict
   premises, a team, an event, a product or customers at any tier.

On a yes: generate, save the files beside the campaign, and point the manifest at them —

```json
"background": { "kind": "files", "files": ["./acquired/plate-1.png", "./acquired/plate-2.png"] }
```

— then re-run `plan.mjs` and `propose.mjs`. The acquired images are ordinary background files from
that point on; nothing downstream knows or cares that they were paid for.

On a no, or no connector: the Tier 0 cut is already rendered and is a finished ad. That is the
normal outcome, not a fallback.

## What this does not do

- **No 16:9.** There would be no matching copy layer; adding one means adding it to ad-creative first.
- **No display banners.** Motion in a 728x90 is noise, and the networks that accept animation there
  want HTML5, not an MP4.
- **No voiceover yet.** Local TTS is the obvious next tier; synthetic voice also carries disclosure
  expectations on most platforms, and for some categories a synthetic voice actively fights the
  message.
- **No figurative image generation.** See below — that is a boundary, not a gap.

## Generate atmosphere, never evidence

Texture, linework and abstract plates claim nothing, so generate them freely — that is this skill's
whole Tier 0.

Anything depicting the premises, the team, an event, the product or the customers is a factual claim
about the business and has to be real. A synthetic workshop photo in an ad for a workshop is a
misleading representation whatever the intent, and the same applies to fabricated attendees. This is
why `background.kind` has no "generate me a photograph" option: the missing feature is the point.

The corollary is worth saying too — **the more real footage a business owns, the less it should
generate.** For a business whose product is visual, the footage *is* the product, and generating it
is both worse and arguably misleading. Generation is a fallback for asset poverty.

## Files

```
scripts/inventory.mjs       assets -> inventory.json, gated on fitness
scripts/plan.mjs            manifest + inventory + layers -> timeline.json (pure)
scripts/propose.mjs         timeline -> frames to look at; the approval gate
scripts/assemble.mjs        timeline -> MP4s; the only module that knows ffmpeg's filter graph
scripts/backgrounds.mjs     procedural plates, brand-exact and deterministic
scripts/motion.mjs          warp, kenburns, boomerang loops, clip segments
scripts/audio.mjs           the bed, the mux, loudness measurement
scripts/lib/provenance.mjs  sidecar discovery + the fields no measurement recovers
scripts/lib/placements.mjs  placement specs + the fitness rules
scripts/lib/scrim.mjs       contrast maths and the measured scrim
scripts/lib/png.mjs         a dependency-free PNG encoder
scripts/lib/util.mjs        args, ffmpeg, ffprobe, colour
references/manifest.md      every motion.json field
references/routing.md       how assets become decisions
```
