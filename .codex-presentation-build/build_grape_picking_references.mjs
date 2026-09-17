import fs from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { Presentation, PresentationFile } from "@oai/artifact-tool";

const workspaceDir = "G:\\Georgian-Kartuli-After-Effects-Transcribtion-Tool-kml";
const SKILL_DIR = "C:\\Users\\Sandro\\.codex\\plugins\\cache\\openai-primary-runtime\\presentations\\26.909.22227\\skills\\presentations";
const TMP_DIR = path.join(workspaceDir, ".codex-presentation-build");
const FINAL_PPTX = path.join(workspaceDir, "outputs", "Grape-Picking-Reference-Directions-with-links.pptx");
const RUNTIME_PYTHON = "C:\\Users\\Sandro\\.cache\\codex-runtimes\\codex-primary-runtime\\dependencies\\python\\python.exe";

const { resolvePresentationFont, finalizePresentation } = await import(
  pathToFileURL(path.join(SKILL_DIR, "container_tools", "artifact_tool_utils.mjs")).href,
);

const family = resolvePresentationFont({ fontFamily: "Arial" });
const deck = Presentation.create({ slideSize: { width: 1280, height: 720 } });

const C = { ink: "#F5F1E7", wine: "#5E1F33", wineDark: "#35111D", grape: "#8A5368", leaf: "#6F7551", straw: "#D9C27A", paper: "#F5F1E7", charcoal: "#241E1C" };

function addText(slide, text, left, top, width, height, size, color = C.ink, opts = {}) {
  const shape = slide.shapes.add({ geometry: "textbox", position: { left, top, width, height }, fill: "none", line: { fill: "none", width: 0 } });
  shape.text = text;
  shape.text.style = { typeface: family, fontSize: size, color, bold: opts.bold ?? false, italic: opts.italic ?? false, autoFit: "shrinkText", breakLine: false, marginLeft: 0, marginRight: 0, marginTop: 0, marginBottom: 0, align: opts.align ?? "left" };
  return shape;
}

function rule(slide, left, top, width, color = C.straw) {
  slide.shapes.add({ geometry: "rect", position: { left, top, width, height: 4 }, fill: color, line: { fill: color, width: 0 } });
}

function footer(slide, n) {
  addText(slide, `GRAPE PICKING / REFERENCE NOTES / ${String(n).padStart(2, "0")}`, 72, 678, 700, 18, 12, C.ink, { bold: true });
  addText(slide, "Source: videos.md", 1010, 678, 198, 18, 12, C.ink, { align: "right" });
}

function addLink(slide, label, uri, left, top, width, height, color = C.straw) {
  const shape = addText(slide, "", left, top, width, height, 20, color, { bold: true });
  shape.text = [[{
    run: label,
    textStyle: { typeface: family, fontSize: "15pt", color, underline: "sng", bold: true },
    link: { uri, isExternal: true },
  }]];
  return shape;
}

function base(bg = C.wineDark) {
  const slide = deck.slides.add();
  slide.background.fill = bg;
  return slide;
}

// 1. Cover
{
  const s = base();
  rule(s, 72, 105, 180);
  addText(s, "Grape Picking", 72, 150, 790, 88, 68, C.ink, { bold: true });
  addText(s, "Film reference directions", 76, 250, 560, 42, 30, C.straw, { bold: true });
  addText(s, "A compact reading of four supplied references for a grape-harvest film.", 76, 334, 640, 70, 24, C.ink);
  addText(s, "WORKERS / RHYTHM / WINE", 76, 566, 580, 25, 16, C.grape, { bold: true });
  addText(s, "Selected video and campaign references", 76, 605, 520, 24, 18, C.ink);
  footer(s, 1);
  s.speakerNotes.textFrame.setText("Source: F:/GrapePicking/videos.md. No external factual claims added.");
}

// 2. Main anchor
{
  const s = base(C.wine);
  addText(s, "The strongest reference", 72, 64, 620, 42, 32, C.straw, { bold: true });
  rule(s, 72, 122, 310);
  addText(s, "Champagne, France\nLaura Naylor", 72, 166, 515, 100, 43, C.ink, { bold: true });
  addText(s, "Feature-length cinéma-vérité documentary following the same harvest workers as they return each year.", 72, 306, 560, 110, 27, C.ink);
  addText(s, "The human relationships carry the film.", 72, 482, 570, 44, 30, C.straw, { bold: true });
  addText(s, "Bodies, fatigue, banter, social class, shared meals and sleeping arrangements create a temporary working community.", 705, 185, 455, 250, 26, C.ink);
  addText(s, "Vimeo reference", 705, 500, 240, 24, 18, C.ink, { bold: true });
  addLink(s, "Open on Vimeo: vimeo.com/293392791", "https://vimeo.com/293392791?utm_source=chatgpt.com", 705, 532, 400, 28);
  footer(s, 2);
  s.speakerNotes.textFrame.setText("Source: videos.md, Vimeo reference https://vimeo.com/293392791. Description paraphrases the supplied note.");
}

// 6. Source links
{
  const s = base(C.wineDark);
  addText(s, "Reference links", 72, 64, 620, 48, 40, C.ink, { bold: true });
  rule(s, 72, 128, 310);
  addText(s, "Open any title below to watch or review the original source.", 72, 174, 850, 32, 24, C.ink);
  addLink(s, "Champagne, France — Laura Naylor / Vimeo", "https://vimeo.com/293392791?utm_source=chatgpt.com", 72, 250, 800, 34);
  addLink(s, "Visual reference / Vimeo", "https://vimeo.com/1050552369?utm_source=chatgpt.com", 72, 325, 800, 34);
  addLink(s, "INNISKILLIN: The Original Startup / Ads of the World", "https://www.adsoftheworld.com/campaigns/the-original-startup?utm_source=chatgpt.com", 72, 400, 940, 34);
  addLink(s, "Harvest and pouring story / Vimeo", "https://vimeo.com/1089436364?utm_source=chatgpt.com", 72, 475, 800, 34);
  addText(s, "All links supplied in videos.md", 72, 555, 450, 25, 18, C.grape, { italic: true });
  footer(s, 6);
  s.speakerNotes.textFrame.setText("Source links copied from F:/GrapePicking/videos.md.");
}

// 3. Visual language
{
  const s = base(C.charcoal);
  addText(s, "Visual language", 72, 64, 510, 48, 40, C.ink, { bold: true });
  rule(s, 72, 128, 320);
  addText(s, "Observe the work at human scale", 72, 177, 570, 45, 30, C.straw, { bold: true });
  addText(s, "Faces", 72, 292, 220, 38, 31, C.ink, { bold: true });
  addText(s, "Hands", 365, 292, 220, 38, 31, C.ink, { bold: true });
  addText(s, "Silhouettes", 658, 292, 220, 38, 31, C.ink, { bold: true });
  addText(s, "Repetition", 951, 292, 220, 38, 31, C.ink, { bold: true });
  addText(s, "Expressions and small exchanges", 72, 350, 205, 70, 22, C.ink);
  addText(s, "Touch, tools and stained skin", 365, 350, 205, 70, 22, C.ink);
  addText(s, "Workers within the vineyard landscape", 658, 350, 205, 70, 22, C.ink);
  addText(s, "The physical pattern of picking", 951, 350, 205, 70, 22, C.ink);
  addText(s, "Use restraint. Avoid heroic advertising clichés about hard work.", 72, 525, 990, 42, 28, C.straw, { bold: true });
  footer(s, 3);
  s.speakerNotes.textFrame.setText("Source: videos.md, Vimeo reference https://vimeo.com/1050552369. The visual-language wording follows the supplied note.");
}

// 4. Reference contrast
{
  const s = base(C.paper);
  addText(s, "Two storytelling routes", 72, 64, 650, 48, 40, C.charcoal, { bold: true });
  rule(s, 72, 128, 310, C.wine);
  addText(s, "The harvest", 72, 184, 420, 45, 32, C.wine, { bold: true });
  addText(s, "An ordinary story of picking and the words around pouring wine. The supplied reference points to a 1:22 treatment.", 72, 250, 485, 150, 26, C.charcoal);
  addText(s, "The wine brand", 695, 184, 420, 45, 32, C.wine, { bold: true });
  addText(s, "INNISKILLIN tells a wine success story in one minute. The supplied note says this reference is less about the harvest itself.", 695, 250, 485, 150, 26, C.charcoal);
  addText(s, "Useful decision", 72, 490, 260, 34, 24, C.leaf, { bold: true });
  addText(s, "Let the workers and the picking lead. Let wine remain the outcome, not the protagonist.", 72, 540, 1020, 48, 31, C.charcoal, { bold: true });
  footer(s, 4);
  s.speakerNotes.textFrame.setText("Sources: videos.md, https://www.adsoftheworld.com/campaigns/the-original-startup and https://vimeo.com/1089436364. The final line is a proposed working direction inferred from the supplied reference notes.");
}

// 5. Proposed edit map
{
  const s = base(C.leaf);
  addText(s, "Working film direction", 72, 64, 620, 48, 40, C.ink, { bold: true });
  rule(s, 72, 128, 310, C.straw);
  addText(s, "A harvest story built from people, physical rhythm and the shared life around the work.", 72, 180, 975, 72, 30, C.ink, { bold: true });
  addText(s, "OPEN", 72, 330, 150, 30, 18, C.straw, { bold: true });
  addText(s, "Faces and first movements in the vines", 72, 374, 270, 84, 25, C.ink);
  addText(s, "MIDDLE", 410, 330, 150, 30, 18, C.straw, { bold: true });
  addText(s, "Hands, repetition, fatigue and banter", 410, 374, 270, 84, 25, C.ink);
  addText(s, "CLOSE", 748, 330, 150, 30, 18, C.straw, { bold: true });
  addText(s, "The group together, then wine as the result", 748, 374, 320, 84, 25, C.ink);
  addText(s, "Keep the camera close enough to feel the work, quiet enough to let the people speak for themselves.", 72, 546, 1030, 45, 27, C.ink, { italic: true });
  footer(s, 5);
  s.speakerNotes.textFrame.setText("Proposed edit map inferred from the supplied reference notes. It introduces no unverified production facts.");
}

await fs.mkdir(path.join(workspaceDir, ".codex-finalizer"), { recursive: true });
await fs.mkdir(path.dirname(FINAL_PPTX), { recursive: true });
const candidatePath = path.join(workspaceDir, ".codex-finalizer", "grape-picking-candidate.pptx");
await (await PresentationFile.exportPptx(deck)).save(candidatePath);

const requirements = { explicitTotalSlideCount: 6, requiredNativeTableOwnerSlides: [], requiredNativeChartOwnerSlides: [] };
const fontPolicy = { basis: "design", families: [family] };
await finalizePresentation({
  ...requirements,
  workspaceDir,
  candidatePath,
  finalPath: FINAL_PPTX,
  pythonExecutable: RUNTIME_PYTHON,
  integrityValidatorPath: path.join(SKILL_DIR, "container_tools", "inspect_presentation_package_integrity.py"),
  layoutValidatorPath: path.join(SKILL_DIR, "container_tools", "inspect_presentation_layout_geometry.py"),
  layoutArgs: ["--expected-slide-size-emu", "12192000,6858000", "--validate-bullet-geometry", "--validate-heading-fit"],
  requiredNativeTableOwnerSlides: [],
  fontPolicy,
  verifyArtifactToolImport: true,
  receiptPath: path.join(workspaceDir, ".codex-finalizer", "Grape-Picking-Reference-Directions-with-links.validation.json"),
});

console.log(FINAL_PPTX);
