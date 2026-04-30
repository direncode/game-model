// Builds the Latent Ocean pitch deck — emailed PDF, mixed/older audience.
// Run: node scripts/build_pitch_deck.js

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
const SLIDE_H = 5.625;
const MARGIN = 0.6;
const TOTAL_SLIDES = 9;

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9";
pres.author = "Latent Ocean";
pres.title = "Latent Ocean — Pitch Deck";
pres.subject = "Confidential";

// ────────── HELPERS ──────────
function addSectionLabel(slide, text, onDark = false) {
  slide.addText(text, {
    x: MARGIN, y: 0.4, w: 8, h: 0.3,
    fontSize: 12, fontFace: FONT_BODY, bold: true,
    color: GOLD, charSpacing: 4,
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

  slide.addText("AI that grows itself.", {
    x: 0, y: 2.85, w: SLIDE_W, h: 0.5,
    fontSize: 24, fontFace: FONT_HEADER, italic: true,
    color: GOLD, align: "center", valign: "middle",
    margin: 0,
  });

  slide.addText("[YOUR NAME]   ·   [TITLE]   ·   [EMAIL@DOMAIN]", {
    x: 0, y: 4.1, w: SLIDE_W, h: 0.3,
    fontSize: 12, fontFace: FONT_BODY,
    color: LIGHT_SLATE, align: "center",
    charSpacing: 3,
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
    "The world's most valuable patterns are buried in data nobody can connect.",
    {
      x: MARGIN, y: 1.4, w: 5.0, h: 3.0,
      fontSize: 30, fontFace: FONT_HEADER,
      color: NEAR_BLACK,
      valign: "top",
      margin: 0,
    }
  );

  // 3 disconnected circles in a triangle on the right
  const r = 0.55;
  const positions = [
    { x: 7.3, y: 1.7, label: "SCIENCE" },
    { x: 8.6, y: 2.7, label: "FINANCE" },
    { x: 7.0, y: 3.8, label: "MEDICINE" },
  ];
  for (const p of positions) {
    slide.addShape(pres.shapes.OVAL, {
      x: p.x - r, y: p.y - r, w: r * 2, h: r * 2,
      fill: { color: NAVY }, line: { type: "none" },
    });
    slide.addText(p.label, {
      x: p.x - 1.2, y: p.y + r + 0.05, w: 2.4, h: 0.3,
      fontSize: 10, fontFace: FONT_BODY, bold: true,
      color: SLATE, align: "center", charSpacing: 2,
      margin: 0,
    });
  }

  addFooter(slide, 2);
}

// ────────── SLIDE 3: WHY NOW ──────────
{
  const slide = pres.addSlide();
  slide.background = { color: CREAM };

  addSectionLabel(slide, "WHY NOW");

  slide.addText(
    [
      { text: "AI today is built once and stays still.", options: { breakLine: true } },
      { text: "The next generation has to grow.", options: { italic: true, color: GOLD } },
    ],
    {
      x: MARGIN, y: 0.95, w: SLIDE_W - MARGIN * 2, h: 1.5,
      fontSize: 28, fontFace: FONT_HEADER,
      color: NEAR_BLACK,
      align: "left",
      margin: 0,
    }
  );

  const cardY = 3.0;
  const cardH = 1.85;
  const cardW = 2.7;
  const gap = (SLIDE_W - MARGIN * 2 - cardW * 3) / 2;
  const cards = [
    { title: "DATA EXPLOSION", body: "The volume of meaningful data is doubling roughly every 18 months." },
    { title: "MODELS GO STALE", body: "Static AI architectures can't keep pace with what they're learning on." },
    { title: "INSIGHT IS SCARCE", body: "The patterns that matter most cross domains — and rarely surface alone." },
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
      fontSize: 13, fontFace: FONT_BODY,
      color: NEAR_BLACK,
      margin: 0,
    });
  });

  addFooter(slide, 3);
}

// ────────── SLIDE 4: WHAT IT IS ──────────
{
  const slide = pres.addSlide();
  slide.background = { color: CREAM };

  addSectionLabel(slide, "WHAT IT IS");

  slide.addText(
    [
      { text: "A system that finds hidden connections", options: { breakLine: true } },
      { text: "across any kind of data." },
    ],
    {
      x: MARGIN, y: 1.0, w: SLIDE_W - MARGIN * 2, h: 1.4,
      fontSize: 28, fontFace: FONT_HEADER,
      color: NEAR_BLACK,
      align: "center",
      margin: 0,
    }
  );

  slide.addText("—and reorganizes itself as it learns.", {
    x: MARGIN, y: 2.45, w: SLIDE_W - MARGIN * 2, h: 0.5,
    fontSize: 20, fontFace: FONT_HEADER, italic: true,
    color: GOLD, align: "center",
    margin: 0,
  });

  // Network: 3 horizontal nodes connected by gold lines
  const cy = 4.1;
  const r = 0.45;
  const xs = [SLIDE_W / 2 - 2.2, SLIDE_W / 2, SLIDE_W / 2 + 2.2];
  const labels = ["SCIENCE", "FINANCE", "MEDICINE"];

  // Lines (drawn first, so circles cover their endpoints)
  for (let i = 0; i < xs.length - 1; i++) {
    slide.addShape(pres.shapes.LINE, {
      x: xs[i], y: cy,
      w: xs[i + 1] - xs[i], h: 0,
      line: { color: GOLD, width: 2 },
    });
  }
  // Long line spanning all three (visually shows full connection)
  slide.addShape(pres.shapes.LINE, {
    x: xs[0], y: cy,
    w: xs[2] - xs[0], h: 0,
    line: { color: GOLD, width: 2 },
  });

  xs.forEach((x, i) => {
    slide.addShape(pres.shapes.OVAL, {
      x: x - r, y: cy - r, w: r * 2, h: r * 2,
      fill: { color: NAVY }, line: { type: "none" },
    });
    slide.addText(labels[i], {
      x: x - 1.0, y: cy + r + 0.08, w: 2.0, h: 0.3,
      fontSize: 9, fontFace: FONT_BODY, bold: true,
      color: SLATE, align: "center", charSpacing: 2,
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
    [
      { text: "Most AI is " },
      { text: "built", options: { italic: true } },
      { text: ". Latent Ocean is " },
      { text: "grown", options: { italic: true, color: GOLD, bold: true } },
      { text: "." },
    ],
    {
      x: MARGIN, y: 0.95, w: SLIDE_W - MARGIN * 2, h: 1.0,
      fontSize: 30, fontFace: FONT_HEADER,
      color: NEAR_BLACK,
      align: "left",
      margin: 0,
    }
  );

  const colY = 2.3;
  const colH = 2.6;
  const colW = (SLIDE_W - MARGIN * 2 - 0.4) / 2;

  // Left column: Today's AI
  slide.addShape(pres.shapes.RECTANGLE, {
    x: MARGIN, y: colY, w: colW, h: colH,
    fill: { color: PALE },
    line: { color: LIGHT_SLATE, width: 0.5 },
  });
  slide.addText("TODAY'S AI", {
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

  // Right column: Latent Ocean
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
    { letter: "F", title: "FINANCE", desc: "Patterns in markets, filings, and disclosures — surfaced." },
    { letter: "M", title: "MEDICINE", desc: "Connections across millions of medical papers — discovered." },
    { letter: "R", title: "RESEARCH", desc: "Cross-era links across centuries of scientific work — revealed." },
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
      fontSize: 11, fontFace: FONT_BODY,
      color: NEAR_BLACK, align: "center",
      margin: 0,
    });
  });

  slide.addText(
    "ALSO:  CLIMATE  ·  PATENTS  ·  LINGUISTICS  ·  TRADE  ·  LAW",
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
    "Found hidden connections across three centuries of scientific work — patterns no individual reading would reveal.",
    "Surfaced a novel signal in linguistic data that conventional analysis missed.",
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
      fontSize: 15, fontFace: FONT_BODY,
      color: NEAR_BLACK,
      valign: "middle",
      margin: 0,
    });
  });

  addFooter(slide, 7);
}

// ────────── SLIDE 8: WHY DEFENSIBLE (DARK) ──────────
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
      { text: "Our methods are protected as trade secrets — never published, never patented.", options: { bullet: true, breakLine: true } },
      { text: "Every invention is cryptographically time-stamped on a public blockchain.", options: { bullet: true, breakLine: true } },
      { text: "Anyone can verify when we created it. No one ever sees what it is.", options: { bullet: true } },
    ],
    {
      x: MARGIN, y: 2.65, w: SLIDE_W - MARGIN * 2, h: 2.55,
      fontSize: 17, fontFace: FONT_BODY,
      color: "FFFFFF",
      paraSpaceAfter: 22,
      margin: 0,
    }
  );

  addFooter(slide, 8, true);
}

// ────────── SLIDE 9: CTA (DARK) ──────────
{
  const slide = pres.addSlide();
  slide.background = { color: NAVY };

  slide.addText(
    [
      { text: "Let's talk about what this can do", options: { breakLine: true } },
      { text: "for your domain." },
    ],
    {
      x: MARGIN, y: 1.4, w: SLIDE_W - MARGIN * 2, h: 1.7,
      fontSize: 32, fontFace: FONT_HEADER,
      color: "FFFFFF", align: "center", valign: "middle",
      margin: 0,
    }
  );

  slide.addText("A 30-minute conversation. No NDA needed for the concepts above.", {
    x: MARGIN, y: 3.2, w: SLIDE_W - MARGIN * 2, h: 0.5,
    fontSize: 18, fontFace: FONT_HEADER, italic: true,
    color: GOLD, align: "center",
    margin: 0,
  });

  slide.addText("[YOUR NAME]   ·   [EMAIL@DOMAIN]   ·   [PHONE]", {
    x: MARGIN, y: 4.05, w: SLIDE_W - MARGIN * 2, h: 0.35,
    fontSize: 14, fontFace: FONT_BODY,
    color: "FFFFFF", align: "center", charSpacing: 3,
    margin: 0,
  });

  slide.addText("LATENT OCEAN", {
    x: MARGIN, y: 4.55, w: SLIDE_W - MARGIN * 2, h: 0.3,
    fontSize: 10, fontFace: FONT_BODY, bold: true,
    color: GOLD, align: "center", charSpacing: 6,
    margin: 0,
  });

  addFooter(slide, 9, true);
}

// ────────── SAVE ──────────
pres
  .writeFile({ fileName: "docs/commercial/latent-ocean-pitch.pptx" })
  .then((name) => console.log("Wrote:", name))
  .catch((err) => {
    console.error("Build failed:", err);
    process.exit(1);
  });
