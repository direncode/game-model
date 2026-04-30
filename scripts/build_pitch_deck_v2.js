// Builds the Latent Ocean pitch deck v2 — with your edited text + 2 new slides:
//   Slide 8 (NEW): "See It Work" — screenshots from /titan and /live
//   Slide 10 (modified): CTA with QR code → www.latentocean.com
//
// Run: node scripts/build_pitch_deck_v2.js
// Output: docs/commercial/latent-ocean-pitch-final.pptx

const pptxgen = require("pptxgenjs");

// ────────── PALETTE (Midnight Executive) ──────────
const NAVY = "1E3A5F";
const CREAM = "FDFCF8";
const NEAR_BLACK = "1A1A1A";
const GOLD = "B8924A";
const SLATE = "4B5563";
const LIGHT_SLATE = "D1D5DB";
const PALE = "F4F2EC";

// ────────── TYPOGRAPHY ──────────
const FONT_HEADER = "Georgia";
const FONT_BODY = "Calibri";

// ────────── LAYOUT ──────────
const SLIDE_W = 10;
const MARGIN = 0.6;
const TOTAL_SLIDES = 10;

// ────────── ASSETS ──────────
const SHOT_TITAN = "scripts/site_shots/titan_cropped.png";
const SHOT_LIVE = "scripts/site_shots/live_cropped.png";
const QR = "scripts/site_shots/qr_latentocean.png";

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9";
pres.author = "Latent Ocean";
pres.title = "Latent Ocean — Pitch Deck";
pres.subject = "Confidential";

// ────────── HELPERS ──────────
function addSectionLabel(slide, text, color = GOLD) {
  slide.addText(text, {
    x: MARGIN, y: 0.4, w: 8, h: 0.3,
    fontSize: 12, fontFace: FONT_BODY, bold: true,
    color, charSpacing: 4,
    margin: 0,
  });
}

function addFooter(slide, n, onDark = false) {
  const c = onDark ? LIGHT_SLATE : SLATE;
  slide.addText("LATENT OCEAN  ·  CONFIDENTIAL", {
    x: MARGIN, y: 5.25, w: 4, h: 0.25,
    fontSize: 9, fontFace: FONT_BODY,
    color: c, charSpacing: 2,
    margin: 0,
  });
  slide.addText(`${n} / ${TOTAL_SLIDES}`, {
    x: SLIDE_W - MARGIN - 1, y: 5.25, w: 1, h: 0.25,
    fontSize: 9, fontFace: FONT_BODY,
    color: c, align: "right",
    margin: 0,
  });
}

// ────────── SLIDE 1: TITLE (DARK) ──────────
{
  const slide = pres.addSlide();
  slide.background = { color: NAVY };

  slide.addText("LATENT OCEAN", {
    x: 0, y: 1.7, w: SLIDE_W, h: 1.0,
    fontSize: 56, fontFace: FONT_HEADER, bold: true,
    color: "FFFFFF", align: "center", valign: "middle",
    charSpacing: 8,
    margin: 0,
  });

  slide.addText("Data that organizes itself.", {
    x: 0, y: 2.85, w: SLIDE_W, h: 0.5,
    fontSize: 24, fontFace: FONT_HEADER, italic: true,
    color: GOLD, align: "center", valign: "middle",
    margin: 0,
  });

  slide.addText("[Diren Kumaratilleke]   ·   [diren@unc.edu]", {
    x: 0, y: 4.1, w: SLIDE_W, h: 0.3,
    fontSize: 12, fontFace: FONT_BODY,
    color: LIGHT_SLATE, align: "center", charSpacing: 3,
    margin: 0,
  });

  slide.addText("[DATE]", {
    x: 0, y: 4.5, w: SLIDE_W, h: 0.3,
    fontSize: 10, fontFace: FONT_BODY,
    color: LIGHT_SLATE, align: "center", charSpacing: 2,
    margin: 0,
  });
}

// ────────── SLIDE 2: THE PROBLEM ──────────
{
  const slide = pres.addSlide();
  slide.background = { color: CREAM };

  addSectionLabel(slide, "THE PROBLEM");

  slide.addText(
    "Today's data systems chase what's common and miss what matters. The most valuable patterns hide in the rare events, the unusual signals, the connections nobody is looking for.",
    {
      x: MARGIN, y: 1.4, w: SLIDE_W - MARGIN * 2, h: 3.0,
      fontSize: 26, fontFace: FONT_HEADER,
      color: NEAR_BLACK,
      valign: "top",
      margin: 0,
    }
  );

  addFooter(slide, 2);
}

// ────────── SLIDE 3: WHY NOW ──────────
{
  const slide = pres.addSlide();
  slide.background = { color: CREAM };

  addSectionLabel(slide, "WHY NOW");

  slide.addText(
    [
      { text: "Data is surfacing like never before; it deserves vector alignment for maximum signal at scale.", options: { breakLine: true } },
      { text: "The next generation of data interpretation has to ingest its own structure.", options: { italic: true, color: GOLD } },
    ],
    {
      x: MARGIN, y: 0.95, w: SLIDE_W - MARGIN * 2, h: 1.85,
      fontSize: 20, fontFace: FONT_HEADER,
      color: NEAR_BLACK,
      align: "left",
      margin: 0,
    }
  );

  const cardY = 3.15;
  const cardH = 1.85;
  const cardW = 2.7;
  const gap = (SLIDE_W - MARGIN * 2 - cardW * 3) / 2;
  const cards = [
    { title: "INGESTION", body: "Read any kind of data which can be structured or messy, big or small." },
    { title: "FOLLOW THE FLOW", body: "Don't just see what's there and be capable of tracking how data patterns move." },
    { title: "REORGANIZE ITSELF", body: "Build its own structure as it learns. No engineer required." },
  ];

  cards.forEach((c, i) => {
    const x = MARGIN + i * (cardW + gap);
    slide.addShape(pres.shapes.RECTANGLE, {
      x, y: cardY, w: cardW, h: cardH,
      fill: { color: "FFFFFF" },
      line: { color: LIGHT_SLATE, width: 0.5 },
    });
    slide.addShape(pres.shapes.RECTANGLE, {
      x, y: cardY, w: 0.06, h: cardH,
      fill: { color: GOLD }, line: { type: "none" },
    });
    slide.addText(c.title, {
      x: x + 0.25, y: cardY + 0.2, w: cardW - 0.4, h: 0.35,
      fontSize: 12, fontFace: FONT_BODY, bold: true,
      color: NAVY, charSpacing: 3,
      margin: 0,
    });
    slide.addText(c.body, {
      x: x + 0.25, y: cardY + 0.6, w: cardW - 0.4, h: 1.1,
      fontSize: 12, fontFace: FONT_BODY,
      color: NEAR_BLACK,
      margin: 0,
    });
  });

  addFooter(slide, 3);
}

// ────────── SLIDE 4: WHAT IT IS ──────────
// Note: removed the leftover old "data seed/primitive" headline,
//       removed the duplicate sentence, fixed "ONE SHAREDLANGUAGE" spacing,
//       fixed apostrophe on "Lets".
{
  const slide = pres.addSlide();
  slide.background = { color: CREAM };

  addSectionLabel(slide, "WHAT IT IS");

  slide.addText(
    [
      { text: "A new way to read data;", options: { breakLine: true } },
      { text: "one that lets every kind of information speak the same language." },
    ],
    {
      x: MARGIN, y: 1.0, w: SLIDE_W - MARGIN * 2, h: 1.4,
      fontSize: 28, fontFace: FONT_HEADER,
      color: NEAR_BLACK,
      align: "center",
      margin: 0,
    }
  );

  slide.addText("Lets every kind of data line up against every other.", {
    x: MARGIN, y: 2.45, w: SLIDE_W - MARGIN * 2, h: 0.5,
    fontSize: 18, fontFace: FONT_HEADER, italic: true,
    color: GOLD, align: "center",
    margin: 0,
  });

  // Three labels in a row
  const labels = ["LESS NOISE", "REUSABLE PARTS", "ONE SHARED LANGUAGE"];
  const labelY = 4.0;
  const labelW = 2.7;
  const labelGap = (SLIDE_W - MARGIN * 2 - labelW * 3) / 2;
  labels.forEach((l, i) => {
    const x = MARGIN + i * (labelW + labelGap);
    slide.addShape(pres.shapes.RECTANGLE, {
      x, y: labelY, w: labelW, h: 0.6,
      fill: { color: NAVY }, line: { type: "none" },
    });
    slide.addText(l, {
      x, y: labelY, w: labelW, h: 0.6,
      fontSize: 14, fontFace: FONT_BODY, bold: true,
      color: GOLD, align: "center", valign: "middle",
      charSpacing: 3,
      margin: 0,
    });
  });

  addFooter(slide, 4);
}

// ────────── SLIDE 5: HOW IT'S DIFFERENT ──────────
{
  const slide = pres.addSlide();
  slide.background = { color: CREAM };

  addSectionLabel(slide, "WHAT MAKES IT DIFFERENT");

  slide.addText(
    "Most data systems are designed by hand. Latent Ocean grows on its own with no setup needed.",
    {
      x: MARGIN, y: 0.95, w: SLIDE_W - MARGIN * 2, h: 1.0,
      fontSize: 24, fontFace: FONT_HEADER,
      color: NEAR_BLACK,
      align: "left",
      margin: 0,
    }
  );

  const colY = 2.2;
  const colH = 2.7;
  const colW = (SLIDE_W - MARGIN * 2 - 0.4) / 2;

  // Left: Today's data
  slide.addShape(pres.shapes.RECTANGLE, {
    x: MARGIN, y: colY, w: colW, h: colH,
    fill: { color: PALE },
    line: { color: LIGHT_SLATE, width: 0.5 },
  });
  slide.addText("TODAY'S DATA", {
    x: MARGIN + 0.3, y: colY + 0.2, w: colW - 0.6, h: 0.4,
    fontSize: 12, fontFace: FONT_BODY, bold: true,
    color: SLATE, charSpacing: 4,
    margin: 0,
  });
  slide.addText(
    [
      { text: "Designed once", options: { bullet: true, breakLine: true } },
      { text: "Architecture frozen", options: { bullet: true, breakLine: true } },
      { text: "Domain-specific", options: { bullet: true, breakLine: true } },
      { text: "Brittle to new data", options: { bullet: true } },
    ],
    {
      x: MARGIN + 0.3, y: colY + 0.7, w: colW - 0.6, h: colH - 0.9,
      fontSize: 16, fontFace: FONT_BODY,
      color: SLATE,
      paraSpaceAfter: 6,
      margin: 0,
    }
  );

  // Right: Latent Ocean
  slide.addShape(pres.shapes.RECTANGLE, {
    x: MARGIN + colW + 0.4, y: colY, w: colW, h: colH,
    fill: { color: NAVY }, line: { type: "none" },
  });
  slide.addText("LATENT OCEAN", {
    x: MARGIN + colW + 0.7, y: colY + 0.2, w: colW - 0.5, h: 0.4,
    fontSize: 12, fontFace: FONT_BODY, bold: true,
    color: GOLD, charSpacing: 4,
    margin: 0,
  });
  slide.addText(
    [
      { text: "Discovers its own structure", options: { bullet: true, breakLine: true } },
      { text: "Reorganizes itself", options: { bullet: true, breakLine: true } },
      { text: "Works across domains", options: { bullet: true, breakLine: true } },
      { text: "Grows with new data", options: { bullet: true } },
    ],
    {
      x: MARGIN + colW + 0.62, y: colY + 0.7, w: colW - 0.5, h: colH - 0.9,
      fontSize: 16, fontFace: FONT_BODY,
      color: "FFFFFF",
      paraSpaceAfter: 6,
      margin: 0,
    }
  );

  addFooter(slide, 5);
}

// ────────── SLIDE 6: WHERE IT APPLIES ──────────
{
  const slide = pres.addSlide();
  slide.background = { color: CREAM };

  addSectionLabel(slide, "WHERE IT APPLIES");

  slide.addText("One system. Many worlds.", {
    x: MARGIN, y: 0.95, w: SLIDE_W - MARGIN * 2, h: 0.7,
    fontSize: 32, fontFace: FONT_HEADER,
    color: NEAR_BLACK,
    margin: 0,
  });

  const cardY = 2.0;
  const cardH = 2.0;
  const cardW = 2.7;
  const gap = (SLIDE_W - MARGIN * 2 - cardW * 3) / 2;
  const monograms = [
    { letter: "F", title: "FINANCE", desc: "Reading the SEC archive as one connected story and surfacing the companies that don't fit." },
    { letter: "M", title: "MEDICINE", desc: "Finding the connections across millions of medical papers that no practitioner has time to read." },
    { letter: "R", title: "RESEARCH", desc: "Connecting centuries of scientific thinking — finding the threads no one person could see in a lifetime of reading." },
  ];

  monograms.forEach((m, i) => {
    const x = MARGIN + i * (cardW + gap);
    slide.addShape(pres.shapes.RECTANGLE, {
      x, y: cardY, w: cardW, h: cardH,
      fill: { color: "FFFFFF" },
      line: { color: LIGHT_SLATE, width: 0.5 },
    });
    const cd = 0.85;
    const cx = x + cardW / 2 - cd / 2;
    slide.addShape(pres.shapes.OVAL, {
      x: cx, y: cardY + 0.25, w: cd, h: cd,
      fill: { color: NAVY }, line: { type: "none" },
    });
    slide.addText(m.letter, {
      x: cx, y: cardY + 0.25, w: cd, h: cd,
      fontSize: 30, fontFace: FONT_HEADER, bold: true,
      color: GOLD, align: "center", valign: "middle",
      margin: 0,
    });
    slide.addText(m.title, {
      x: x + 0.2, y: cardY + 1.2, w: cardW - 0.4, h: 0.3,
      fontSize: 13, fontFace: FONT_BODY, bold: true,
      color: NAVY, charSpacing: 3, align: "center",
      margin: 0,
    });
    slide.addText(m.desc, {
      x: x + 0.2, y: cardY + 1.5, w: cardW - 0.4, h: 0.5,
      fontSize: 10, fontFace: FONT_BODY,
      color: NEAR_BLACK, align: "center",
      margin: 0,
    });
  });

  slide.addText(
    "AND TOOLS BUILT ON TOP — FOR EVERY OTHER FIELD",
    {
      x: MARGIN, y: 4.45, w: SLIDE_W - MARGIN * 2, h: 0.4,
      fontSize: 10, fontFace: FONT_BODY,
      color: NAVY, align: "center", charSpacing: 4,
      margin: 0,
    }
  );

  addFooter(slide, 6);
}

// ────────── SLIDE 7: WHAT IT'S ALREADY DONE ──────────
{
  const slide = pres.addSlide();
  slide.background = { color: CREAM };

  addSectionLabel(slide, "WHAT IT'S ALREADY DONE");

  slide.addText("Real findings. Real domains.", {
    x: MARGIN, y: 0.95, w: SLIDE_W - MARGIN * 2, h: 0.7,
    fontSize: 32, fontFace: FONT_HEADER,
    color: NEAR_BLACK,
    margin: 0,
  });

  const rowsY = 1.95;
  const rowH = 0.95;
  const rowGap = 0.05;
  const wins = [
    "Found rare, high-value patterns in messy real-world data — patterns that line up with what experts already know, and reveal what they don't.",
    "Reads live data and surfaces what matters most — adjustable by region and timeframe.",
    "Applied a single system to multiple entirely different fields, without retraining.",
  ];

  wins.forEach((w, i) => {
    const y = rowsY + i * (rowH + rowGap);
    const nd = 0.55;
    slide.addShape(pres.shapes.OVAL, {
      x: MARGIN, y: y + (rowH - nd) / 2, w: nd, h: nd,
      fill: { color: GOLD }, line: { type: "none" },
    });
    slide.addText(`${i + 1}`, {
      x: MARGIN, y: y + (rowH - nd) / 2, w: nd, h: nd,
      fontSize: 18, fontFace: FONT_HEADER, bold: true,
      color: NAVY, align: "center", valign: "middle",
      margin: 0,
    });
    slide.addText(w, {
      x: MARGIN + nd + 0.3, y, w: SLIDE_W - MARGIN * 2 - nd - 0.3, h: rowH,
      fontSize: 14, fontFace: FONT_BODY,
      color: NEAR_BLACK,
      valign: "middle",
      margin: 0,
    });
  });

  addFooter(slide, 7);
}

// ────────── SLIDE 8 (NEW): SEE IT WORK ──────────
{
  const slide = pres.addSlide();
  slide.background = { color: CREAM };

  addSectionLabel(slide, "SEE IT WORK");

  slide.addText("It already works. With real data. Live.", {
    x: MARGIN, y: 0.95, w: SLIDE_W - MARGIN * 2, h: 0.7,
    fontSize: 28, fontFace: FONT_HEADER,
    color: NEAR_BLACK,
    margin: 0,
  });

  // Two screenshots side by side
  // Source images: 3200 x 1880 (cropped) → aspect 1.7
  // Target each: ~4.4" wide → ~2.59" tall
  const imgW = 4.35;
  const imgH = imgW / (3200 / 1880);
  const imgY = 1.85;
  const imgGap = 0.1;
  const totalW = imgW * 2 + imgGap;
  const startX = (SLIDE_W - totalW) / 2;

  // Left: Titan
  slide.addImage({
    path: SHOT_TITAN,
    x: startX, y: imgY, w: imgW, h: imgH,
  });
  slide.addText("TITAN  ·  18 SOURCES, 5,550 RECORDS, 100s", {
    x: startX, y: imgY + imgH + 0.1, w: imgW, h: 0.3,
    fontSize: 10, fontFace: FONT_BODY, bold: true,
    color: NAVY, align: "center", charSpacing: 3,
    margin: 0,
  });
  slide.addText("Live processing of public APIs in a single run.", {
    x: startX, y: imgY + imgH + 0.4, w: imgW, h: 0.3,
    fontSize: 10, fontFace: FONT_BODY, italic: true,
    color: SLATE, align: "center",
    margin: 0,
  });

  // Right: Live
  slide.addImage({
    path: SHOT_LIVE,
    x: startX + imgW + imgGap, y: imgY, w: imgW, h: imgH,
  });
  slide.addText("LIVE  ·  TWO STREAMS, REFRESHED EVERY 20s", {
    x: startX + imgW + imgGap, y: imgY + imgH + 0.1, w: imgW, h: 0.3,
    fontSize: 10, fontFace: FONT_BODY, bold: true,
    color: NAVY, align: "center", charSpacing: 3,
    margin: 0,
  });
  slide.addText("Real-time signal across two unrelated domains.", {
    x: startX + imgW + imgGap, y: imgY + imgH + 0.4, w: imgW, h: 0.3,
    fontSize: 10, fontFace: FONT_BODY, italic: true,
    color: SLATE, align: "center",
    margin: 0,
  });

  addFooter(slide, 8);
}

// ────────── SLIDE 9: DEFENSIBILITY (DARK) ──────────
{
  const slide = pres.addSlide();
  slide.background = { color: NAVY };

  slide.addText("DEFENSIBILITY", {
    x: MARGIN, y: 0.4, w: 8, h: 0.3,
    fontSize: 12, fontFace: FONT_BODY, bold: true,
    color: GOLD, charSpacing: 4,
    margin: 0,
  });

  slide.addText("Trade secrets, with timestamps no one can fake.", {
    x: MARGIN, y: 0.95, w: SLIDE_W - MARGIN * 2 - 2.5, h: 1.5,
    fontSize: 30, fontFace: FONT_HEADER,
    color: "FFFFFF",
    margin: 0,
  });

  // Seal/stamp visual on right
  const sealCX = SLIDE_W - 1.7;
  const sealCY = 1.7;
  slide.addShape(pres.shapes.OVAL, {
    x: sealCX - 0.85, y: sealCY - 0.85, w: 1.7, h: 1.7,
    fill: { color: NAVY },
    line: { color: GOLD, width: 2 },
  });
  slide.addShape(pres.shapes.OVAL, {
    x: sealCX - 0.45, y: sealCY - 0.45, w: 0.9, h: 0.9,
    fill: { color: GOLD }, line: { type: "none" },
  });
  slide.addText("✓", {
    x: sealCX - 0.45, y: sealCY - 0.5, w: 0.9, h: 0.9,
    fontSize: 36, fontFace: FONT_HEADER, bold: true,
    color: NAVY, align: "center", valign: "middle",
    margin: 0,
  });

  slide.addText(
    [
      { text: "The deep technical methods are intended to be protected as trade secrets.", options: { bullet: true, breakLine: true } },
      { text: "Every invention is cryptographically time-stamped on a public blockchain.", options: { bullet: true, breakLine: true } },
      { text: "Anyone can verify when we created it without ever seeing what it is.", options: { bullet: true } },
    ],
    {
      x: MARGIN, y: 2.65, w: SLIDE_W - MARGIN * 2, h: 2.55,
      fontSize: 17, fontFace: FONT_BODY,
      color: "FFFFFF",
      paraSpaceAfter: 22,
      margin: 0,
    }
  );

  addFooter(slide, 9, true);
}

// ────────── SLIDE 10 (modified): CTA + QR (DARK) ──────────
{
  const slide = pres.addSlide();
  slide.background = { color: NAVY };

  slide.addText(
    [
      { text: "Let's talk about what this can do", options: { breakLine: true } },
      { text: "for your domain." },
    ],
    {
      x: MARGIN, y: 0.85, w: SLIDE_W - MARGIN * 2, h: 1.5,
      fontSize: 30, fontFace: FONT_HEADER,
      color: "FFFFFF", align: "center", valign: "middle",
      margin: 0,
    }
  );

  slide.addText("A 30-minute conversation. No NDA needed for the concepts above.", {
    x: MARGIN, y: 2.35, w: SLIDE_W - MARGIN * 2, h: 0.5,
    fontSize: 16, fontFace: FONT_HEADER, italic: true,
    color: GOLD, align: "center",
    margin: 0,
  });

  // QR + URL on left, contact on right (centered around slide midline)
  const colY = 3.1;
  const qrSize = 1.4;

  // ── LEFT: see it live (QR + URL) ──
  const leftCX = SLIDE_W / 2 - 1.9;
  slide.addImage({
    path: QR,
    x: leftCX - qrSize / 2, y: colY, w: qrSize, h: qrSize,
  });
  slide.addText("SEE IT LIVE", {
    x: leftCX - 1.5, y: colY + qrSize + 0.05, w: 3, h: 0.25,
    fontSize: 9, fontFace: FONT_BODY, bold: true,
    color: GOLD, align: "center", charSpacing: 3,
    margin: 0,
  });
  slide.addText("www.latentocean.com", {
    x: leftCX - 1.5, y: colY + qrSize + 0.32, w: 3, h: 0.3,
    fontSize: 13, fontFace: FONT_BODY, bold: true,
    color: "FFFFFF", align: "center",
    margin: 0,
  });

  // ── RIGHT: contact ──
  const rightCX = SLIDE_W / 2 + 1.9;
  slide.addText("GET IN TOUCH", {
    x: rightCX - 2, y: colY + 0.15, w: 4, h: 0.25,
    fontSize: 9, fontFace: FONT_BODY, bold: true,
    color: GOLD, align: "center", charSpacing: 3,
    margin: 0,
  });
  slide.addText("Diren Kumaratilleke", {
    x: rightCX - 2, y: colY + 0.5, w: 4, h: 0.35,
    fontSize: 16, fontFace: FONT_HEADER,
    color: "FFFFFF", align: "center",
    margin: 0,
  });
  slide.addText("diren@unc.edu", {
    x: rightCX - 2, y: colY + 0.9, w: 4, h: 0.35,
    fontSize: 14, fontFace: FONT_BODY,
    color: "FFFFFF", align: "center",
    margin: 0,
  });
  slide.addText("[PHONE]", {
    x: rightCX - 2, y: colY + 1.25, w: 4, h: 0.35,
    fontSize: 12, fontFace: FONT_BODY,
    color: LIGHT_SLATE, align: "center",
    margin: 0,
  });

  addFooter(slide, 10, true);
}

// ────────── SAVE ──────────
pres
  .writeFile({ fileName: "docs/commercial/latent-ocean-pitch-final.pptx" })
  .then((name) => console.log("Wrote:", name))
  .catch((err) => {
    console.error("Build failed:", err);
    process.exit(1);
  });
