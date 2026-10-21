/** getRandomValues also works on a phone's HTTP LAN test origin. randomUUID does not. */
export function commandId() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");
}
