// ============================================
// GENESIS STUDIO — Face blend: the invented child
// ============================================
// Two photographs of two partners go in; one photograph of a child who could
// be theirs comes out. That single image is the anchor for everything the
// product renders afterwards — every later scene is filmed from it the way a
// Series episode is filmed from its reference still — so it has to exist, and
// be stored somewhere it will still be there in an hour, before any video
// generation starts. That ordering is the whole point of this step.
//
// The blend itself is not new machinery. It is the same reference-shot editor
// Series Studio and AI Action Figure already use (google/nano-banana-pro/edit),
// handed two reference images instead of one: the model is a multi-reference
// editor, so "the child of these two people" is a prompt it can take rather
// than a pipeline we have to build.
//
// The child is invented. It is not either partner, and it is not a photograph
// of a real child — which is why the prompt says so twice and why consent to
// use the two adult photographs is taken before any of it runs.

/**
 * The consent the uploader has to give, in one place so the page and the API
 * say the same sentence. Both people in the photographs are real, and only one
 * of them is at the keyboard.
 */
export const CONSENT_TEXT =
  "I confirm both people in these photos consent to their photos being used to generate this content";

/** Marks a blend job's row, the way "[tool:...]" marks a tool job. */
export const FACE_BLEND_TAG = "[face-blend]";

/**
 * How old the invented child is.
 *
 * Fixed rather than chosen, because the anchor has to be one face: every
 * later scene asks for "the child in this photograph", and a job whose age
 * moved would be asking for a different child each time. Five is old enough
 * for inherited features to have arrived — a newborn's face carries almost
 * none of the resemblance the whole product is about.
 */
export const CHILD_AGE_YEARS = 5;

/**
 * What the blend model is asked for.
 *
 * Written as a reference portrait and not as a scene: flat light, plain
 * background, straight on, nothing in frame but the child. Everything later
 * steps do — expressions, settings, motion — is easier from that than from a
 * face already half-lost in someone else's lighting.
 */
export function buildChildFacePrompt(): string {
  return [
    `Create a photorealistic studio portrait of one child, about ${CHILD_AGE_YEARS} years old,`,
    "who looks like the natural child of the two adults in these two photographs.",
    "Blend their features: face shape, eyes, nose, mouth, skin tone and hair should each plainly come from one or both of them,",
    "so the child clearly resembles both adults while being neither of them.",
    "This is an invented child who does not appear in either photograph. Do not copy either adult's face.",
    "Head and shoulders, facing the camera straight on, eyes open and looking into the lens, relaxed neutral expression with the faintest smile.",
    "Soft even daylight, plain neutral grey background, sharp focus, natural skin texture, no make-up, no props.",
    "One child alone in the frame. No adults, no other people, no text, no watermark, no border.",
  ].join(" ");
}

// ── Price ────────────────────────────────────────────────────────────────
//
// One call to nano-banana-pro/edit at roughly $0.14 an image, which is the
// same call and the same price AI Action Figure charges 25 credits for
// (FIGURE_IMAGE_CREDITS in lib/action-figure.ts). Charged here rather than
// rolled into a later video step because this step is what spends the money,
// and it is allowed to be the only thing a user runs.
//
// NOT measured against a real charge — it inherits action-figure's derivation
// and should be re-checked against a balance reading either side of a real run.
export const BLEND_CREDITS = 25;

/** Roughly how long one blend takes, for the progress copy. */
export const BLEND_ESTIMATE_SECONDS = 40;

/**
 * The stored child face for a blend job, or null while it has none.
 *
 * Later generation steps read the anchor through this rather than reaching for
 * a column name: the row has no field of its own for it (adding one is a
 * migration), so the face lives on `thumbnail_url` and this is the one place
 * that has to know that.
 */
export function childFaceUrlOf(job: { thumbnail_url?: string | null }): string | null {
  return job.thumbnail_url || null;
}
