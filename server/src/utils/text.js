// Links are the main payload of spam and phishing, and a lost-item chat never needs one
const LINK = /\b(?:https?:\/\/|www\.)\S+/gi;

export function cleanMessage(text) {
  return text
    .replace(/\r\n?/g, "\n")
    .replace(LINK, "[link removed]")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export const excerpt = (text, length = 140) => (text.length > length ? `${text.slice(0, length - 1)}…` : text);
