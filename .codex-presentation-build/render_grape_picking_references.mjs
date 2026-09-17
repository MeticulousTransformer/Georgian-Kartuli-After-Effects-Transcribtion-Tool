import fs from "node:fs/promises";
import path from "node:path";
import { PresentationFile, FileBlob } from "@oai/artifact-tool";

const root = "G:\\Georgian-Kartuli-After-Effects-Transcribtion-Tool-kml";
const deckPath = path.join(root, "outputs", "Grape-Picking-Reference-Directions-with-links.pptx");
const out = path.join(root, ".codex-presentation-build", "rendered");
await fs.mkdir(out, { recursive: true });
const presentation = await PresentationFile.importPptx(await FileBlob.load(deckPath));
for (let i = 0; i < presentation.slides.items.length; i += 1) {
  const image = await presentation.slides.items[i].export({ format: "png", scale: 1 });
  await fs.writeFile(path.join(out, `slide-${i + 1}.png`), new Uint8Array(await image.arrayBuffer()));
}
console.log(out);
