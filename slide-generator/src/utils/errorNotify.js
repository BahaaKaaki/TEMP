// Friendly user-facing error surface.
//
// The app used to swallow many failures (AI router retries, per-slide PPTX
// export errors, agent step errors) and silently fall back to degraded paths,
// which left the user staring at partial output with no indication anything
// went wrong. We keep producing whatever partial result the caller already
// has, but stop hiding the fact that something failed by asking the caller
// to post this message into the chat.

const DEFAULT_MESSAGE = "I'm having some problems right now. Please try again in a moment.";

/**
 * Build a friendly chat message for a caught error, and log the raw error to
 * the console for debugging. Use the return value with `addMessage('assistant', ...)`.
 *
 * @param {unknown} err - the caught error (any shape; logged as-is)
 * @param {{ tag?: string }} [opts] - optional short tag, surfaces only in the console label
 * @returns {string} user-facing friendly message
 */
export function friendlyChatError(err, { tag = '' } = {}) {
  const label = tag ? `[${tag}]` : '[error]';
  console.error(label, err);
  return DEFAULT_MESSAGE;
}

export const FRIENDLY_ERROR_MESSAGE = DEFAULT_MESSAGE;
