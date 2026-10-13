// The title font (Cloister Black TR) is third-party and kept out of the repository
// (assets/licensed/fonts/, see CREDITS.md). When this machine has it, it is registered here;
// otherwise titles and names fall back to the serif in --font-title.

const files = import.meta.glob<string>("../assets/licensed/fonts/CloisterBlackTR.ttf", { eager: true, query: "?url", import: "default" });

/** Resolves once the font is ready (or straight away when it isn't available). */
export async function loadTitleFont(): Promise<void> {
  const url = Object.values(files)[0];
  if (!url) return;
  try {
    const face = new FontFace("Cloister Black TR", `url(${url}) format("truetype")`, { display: "block" });
    document.fonts.add(await face.load());
  } catch {
    // Unreadable file: the fallback font is used.
  }
}
