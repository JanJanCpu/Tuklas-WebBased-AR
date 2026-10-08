// Generated student logins for the printed login slips (bulk add / new password).

const WORDS = ["mango", "guava", "cocoa", "river", "tiger", "eagle", "lotus", "maple", "orbit", "comet", "peach", "cedar", "lemon", "panda", "rocket", "planet", "forest", "island", "violet", "falcon"];

function randomInt(max: number) {
  return crypto.getRandomValues(new Uint32Array(1))[0] % max;
}

function clean(part: string) {
  return part.normalize("NFD").replace(/[^a-z0-9]/gi, "").toLowerCase();
}

/** One name per line; blank lines and duplicates dropped. */
export function parseClassList(text: string) {
  return [...new Set(text.split(/\r?\n/).map((line) => line.trim().replace(/\s+/g, " ")).filter(Boolean))];
}

/** "Juan Dela Cruz" or SF1-style "DELA CRUZ, JUAN M." -> "juan.delacruz482" (or ".cruz482" without the comma). */
export function makeUsername(name: string) {
  let first: string;
  let last: string;
  if (name.includes(",")) {
    const [lastPart, rest] = name.split(",", 2);
    last = lastPart;
    first = rest.trim().split(" ")[0] ?? "";
  } else {
    const words = name.split(" ");
    first = words[0];
    last = words.length > 1 ? words[words.length - 1] : "";
  }
  const base = [clean(first).slice(0, 10), clean(last).slice(0, 12)].filter(Boolean).join(".") || "student";
  return `${base}${100 + randomInt(900)}`;
}

/** Lowercase word + 4 digits: easy to type on a phone, 9+ characters. */
export function makePassword() {
  return `${WORDS[randomInt(WORDS.length)]}${1000 + randomInt(9000)}`;
}
