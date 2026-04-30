// v4 — adds three new slides + simplifies slide 3 + renames output:
//   Slide 3:  "Why Now" headline rewritten to drop vector-alignment jargon
//   NEW Slide 5: "How It Works" — 48-bit fingerprint + 4D score vector in plain language
//   NEW Slide 6: "Before & After" — messy rows vs structurally aware rows
//   NEW Slide 7: "Use Case · Real Estate" — concrete tangible scenario
//   Output renamed: "Latent Ocean System Slides.pptx"
//
// Run: node scripts/build_pitch_deck_v4.js

const pptxgen = require("pptxgenjs");

// ────────── PALETTE ──────────
const NAVY = "1E3A5F";
const CREAM = "FDFCF8";
const NEAR_BLACK = "1A1A1A";
const GOLD = "B8924A";
const SLATE = "4B5563";
const LIGHT_SLATE = "D1D5DB";
const PALE = "F4F2EC";
const HIGHLIGHT_BG = "FFF4D6"; // pale gold for highlighting "the unusual row"

const FONT_HEADER = "Georgia";
const FONT_BODY = "Calibri";

const SLIDE_W = 10;
const MARGIN = 0.6;
const TOTAL_SLIDES = 15;

const SHOTS = {
  home: "scripts/site_shots/home_cropped.png",
  platform: "scripts/site_shots/platform_cropped.png",
  titan: "scripts/site_shots/titan_cropped.png",
  live: "scripts/site_shots/live_cropped.png",
};

const pres = new pptxgen();
pres.layout = "LAYOUT_16x9";
pres.author = "Latent Ocean";
pres.title = "Latent Ocean System Slides";

// ────────── HELPERS ──────────
function addSectionLabel(slide, text) {
  slide.addText(text, {
    x: MARGIN, y: 0.4, w: 8, h: 0.3,
    fontSize: 12, fontFace: FONT_BODY, bold: true,
    color: GOLD, charSpacing: 4,
    margin: 0,
  });
}

function addFooter(slide, n, onDark = false) {
  const c = onDark ? LIGHT_SLATE : SLATE;
  slide.addText("LATENT OCEAN", {
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

function addScreenshotSlide(slide, slideNum, sectionTag, headline, screenshotPath, caption) {
  slide.background = { color: CREAM };
  slide.addText(sectionTag, {
    x: MARGIN, y: 0.3, w: 8, h: 0.25,
    fontSize: 11, fontFace: FONT_BODY, bold: true,
    color: GOLD, charSpacing: 4,
    margin: 0,
  });
  slide.addText(headline, {
    x: MARGIN, y: 0.55, w: SLIDE_W - MARGIN * 2, h: 0.5,
    fontSize: 20, fontFace: FONT_HEADER, italic: true,
    color: NEAR_BLACK,
    margin: 0,
  });
  const imgH = 3.85;
  const imgW = imgH * (3200 / 1880);
  slide.addImage({
    path: screenshotPath,
    x: (SLIDE_W - imgW) / 2, y: 1.05, w: imgW, h: imgH,
  });
  slide.addText(caption, {
    x: MARGIN, y: 4.95, w: SLIDE_W - MARGIN * 2, h: 0.25,
    fontSize: 10, fontFace: FONT_BODY, italic: true,
    color: SLATE, align: "center",
    margin: 0,
  });
  addFooter(slide, slideNum);
}

// ════════════════════════════════════════════════════════════════════
// 1: TITLE
// ════════════════════════════════════════════════════════════════════
{
  const slide = pres.addSlide();
  slide.background = { color: NAVY };
  slide.addText("LATENT OCEAN", {
    x: 0, y: 1.7, w: SLIDE_W, h: 1.0,
    fontSize: 56, fontFace: FONT_HEADER, bold: true,
    color: "FFFFFF", align: "center", valign: "middle",
    charSpacing: 8, margin: 0,
  });
  slide.addText("Data that organizes itself.", {
    x: 0, y: 2.85, w: SLIDE_W, h: 0.5,
    fontSize: 24, fontFace: FONT_HEADER, italic: true,
    color: GOLD, align: "center", valign: "middle", margin: 0,
  });
  slide.addText("Diren Kumaratilleke   ·   direnavk@outlook.com", {
    x: 0, y: 4.1, w: SLIDE_W, h: 0.3,
    fontSize: 12, fontFace: FONT_BODY,
    color: LIGHT_SLATE, align: "center", charSpacing: 3, margin: 0,
  });
  slide.addText("www.latentocean.com", {
    x: 0, y: 4.5, w: SLIDE_W, h: 0.3,
    fontSize: 12, fontFace: FONT_BODY, bold: true,
    color: GOLD, align: "center", charSpacing: 3, margin: 0,
  });
}

// ════════════════════════════════════════════════════════════════════
// 2: THE PROBLEM
// ════════════════════════════════════════════════════════════════════
{
  const slide = pres.addSlide();
  slide.background = { color: CREAM };
  addSectionLabel(slide, "THE PROBLEM");
  slide.addText(
    "Today's data systems chase what's common and miss what matters. The most valuable patterns hide in the rare events, the unusual signals, the connections nobody is looking for.",
    {
      x: MARGIN, y: 1.4, w: SLIDE_W - MARGIN * 2, h: 3.0,
      fontSize: 26, fontFace: FONT_HEADER,
      color: NEAR_BLACK, valign: "top", margin: 0,
    }
  );
  addFooter(slide, 2);
}

// ════════════════════════════════════════════════════════════════════
// 3: WHY NOW (simplified — no more "vector alignment for maximum signal at scale")
// ════════════════════════════════════════════════════════════════════
{
  const slide = pres.addSlide();
  slide.background = { color: CREAM };
  addSectionLabel(slide, "WHY NOW");

  slide.addText(
    [
      { text: "Data is multiplying faster than anyone can understand it.", options: { breakLine: true } },
      { text: "The next generation of systems has to organize itself.", options: { italic: true, color: GOLD } },
    ],
    {
      x: MARGIN, y: 0.95, w: SLIDE_W - MARGIN * 2, h: 1.85,
      fontSize: 22, fontFace: FONT_HEADER,
      color: NEAR_BLACK, align: "left", margin: 0,
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
      fill: { color: "FFFFFF" }, line: { color: LIGHT_SLATE, width: 0.5 },
    });
    slide.addShape(pres.shapes.RECTANGLE, {
      x, y: cardY, w: 0.06, h: cardH,
      fill: { color: GOLD }, line: { type: "none" },
    });
    slide.addText(c.title, {
      x: x + 0.25, y: cardY + 0.2, w: cardW - 0.4, h: 0.35,
      fontSize: 12, fontFace: FONT_BODY, bold: true,
      color: NAVY, charSpacing: 3, margin: 0,
    });
    slide.addText(c.body, {
      x: x + 0.25, y: cardY + 0.6, w: cardW - 0.4, h: 1.1,
      fontSize: 12, fontFace: FONT_BODY,
      color: NEAR_BLACK, margin: 0,
    });
  });
  addFooter(slide, 3);
}

// ════════════════════════════════════════════════════════════════════
// 4: WHAT IT IS
// ════════════════════════════════════════════════════════════════════
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
      color: NEAR_BLACK, align: "center", margin: 0,
    }
  );
  slide.addText("Lets every kind of data line up against every other.", {
    x: MARGIN, y: 2.45, w: SLIDE_W - MARGIN * 2, h: 0.5,
    fontSize: 18, fontFace: FONT_HEADER, italic: true,
    color: GOLD, align: "center", margin: 0,
  });

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
      charSpacing: 3, margin: 0,
    });
  });
  addFooter(slide, 4);
}

// ════════════════════════════════════════════════════════════════════
// 5 (NEW): HOW IT WORKS — 48-bit fingerprint + 4D score in plain language
// ════════════════════════════════════════════════════════════════════
{
  const slide = pres.addSlide();
  slide.background = { color: CREAM };
  addSectionLabel(slide, "HOW IT WORKS");

  slide.addText("Two things, attached to every row.", {
    x: MARGIN, y: 0.85, w: SLIDE_W - MARGIN * 2, h: 0.6,
    fontSize: 28, fontFace: FONT_HEADER,
    color: NEAR_BLACK, margin: 0,
  });

  // Two big cards, side by side
  const cardY = 1.7;
  const cardH = 3.2;
  const cardW = (SLIDE_W - MARGIN * 2 - 0.5) / 2;

  const items = [
    {
      x: MARGIN,
      numeral: "48",
      unit: "BITS",
      title: "A FINGERPRINT",
      body: "A barcode for every row of data. Two rows that are similar get similar barcodes. Two rows that are different get very different ones. This is how the system knows what belongs together, across millions of rows.",
    },
    {
      x: MARGIN + cardW + 0.5,
      numeral: "4",
      unit: "NUMBERS",
      title: "AN UNUSUALNESS SCORE",
      body: "Four numbers per row. How predictable it is, how rare its position is, how anomalous it looks, and how all of that combines into one signal. The score tells you whether a row is ordinary, or worth a closer look.",
    },
  ];

  items.forEach((it) => {
    // Card background
    slide.addShape(pres.shapes.RECTANGLE, {
      x: it.x, y: cardY, w: cardW, h: cardH,
      fill: { color: "FFFFFF" }, line: { color: LIGHT_SLATE, width: 0.5 },
    });
    // Top navy bar with monogram numeral
    slide.addShape(pres.shapes.RECTANGLE, {
      x: it.x, y: cardY, w: cardW, h: 1.1,
      fill: { color: NAVY }, line: { type: "none" },
    });
    slide.addText(it.numeral, {
      x: it.x, y: cardY + 0.05, w: cardW, h: 0.85,
      fontSize: 56, fontFace: FONT_HEADER, bold: true,
      color: GOLD, align: "center", valign: "middle",
      margin: 0,
    });
    slide.addText(it.unit, {
      x: it.x, y: cardY + 0.85, w: cardW, h: 0.25,
      fontSize: 9, fontFace: FONT_BODY, bold: true,
      color: LIGHT_SLATE, align: "center", charSpacing: 4,
      margin: 0,
    });
    // Title
    slide.addText(it.title, {
      x: it.x + 0.3, y: cardY + 1.25, w: cardW - 0.6, h: 0.35,
      fontSize: 13, fontFace: FONT_BODY, bold: true,
      color: NAVY, charSpacing: 3, align: "center",
      margin: 0,
    });
    // Body
    slide.addText(it.body, {
      x: it.x + 0.3, y: cardY + 1.7, w: cardW - 0.6, h: cardH - 1.85,
      fontSize: 12, fontFace: FONT_BODY,
      color: NEAR_BLACK, align: "left",
      margin: 0,
    });
  });

  addFooter(slide, 5);
}

// ════════════════════════════════════════════════════════════════════
// 6 (NEW): BEFORE & AFTER
// ════════════════════════════════════════════════════════════════════
{
  const slide = pres.addSlide();
  slide.background = { color: CREAM };
  addSectionLabel(slide, "BEFORE & AFTER");

  slide.addText("What rows looked like.   What rows look like now.", {
    x: MARGIN, y: 0.85, w: SLIDE_W - MARGIN * 2, h: 0.5,
    fontSize: 22, fontFace: FONT_HEADER, italic: true,
    color: NEAR_BLACK, margin: 0,
  });

  // Two tables side by side
  const tableY = 1.7;
  const tableW = (SLIDE_W - MARGIN * 2 - 0.5) / 2;
  const tableH = 2.6;

  // ─── BEFORE table ───
  const beforeX = MARGIN;
  // Label band above table
  slide.addText("BEFORE  ·  JUST ROWS", {
    x: beforeX, y: tableY - 0.4, w: tableW, h: 0.3,
    fontSize: 11, fontFace: FONT_BODY, bold: true,
    color: SLATE, charSpacing: 3,
    margin: 0,
  });

  const beforeData = [
    [
      { text: "ID", options: { bold: true, color: "FFFFFF", fill: { color: NAVY }, align: "left" } },
      { text: "DATE", options: { bold: true, color: "FFFFFF", fill: { color: NAVY }, align: "left" } },
      { text: "AMOUNT", options: { bold: true, color: "FFFFFF", fill: { color: NAVY }, align: "right" } },
    ],
    [{ text: "A-1024" }, { text: "Mar 12" }, { text: "$340,000", options: { align: "right" } }],
    [{ text: "A-1025" }, { text: "Mar 14" }, { text: "$415,000", options: { align: "right" } }],
    [{ text: "A-1026" }, { text: "Mar 18" }, { text: "$398,000", options: { align: "right" } }],
    [{ text: "A-1027" }, { text: "Mar 21" }, { text: "$372,000", options: { align: "right" } }],
    [{ text: "A-1028" }, { text: "Mar 25" }, { text: "$450,000", options: { align: "right" } }],
  ];
  slide.addTable(beforeData, {
    x: beforeX, y: tableY, w: tableW,
    fontSize: 11, fontFace: FONT_BODY,
    color: NEAR_BLACK,
    border: { pt: 0.5, color: LIGHT_SLATE },
    rowH: 0.32,
  });

  slide.addText("Same as every other row. Nothing tells you which one matters.", {
    x: beforeX, y: tableY + tableH + 0.05, w: tableW, h: 0.3,
    fontSize: 10, fontFace: FONT_BODY, italic: true,
    color: SLATE, margin: 0,
  });

  // ─── AFTER table ───
  const afterX = MARGIN + tableW + 0.5;
  slide.addText("AFTER  ·  STRUCTURALLY AWARE", {
    x: afterX, y: tableY - 0.4, w: tableW, h: 0.3,
    fontSize: 11, fontFace: FONT_BODY, bold: true,
    color: GOLD, charSpacing: 3,
    margin: 0,
  });

  const afterData = [
    [
      { text: "ID", options: { bold: true, color: "FFFFFF", fill: { color: NAVY }, align: "left" } },
      { text: "FINGERPRINT", options: { bold: true, color: "FFFFFF", fill: { color: NAVY }, align: "left" } },
      { text: "SCORE", options: { bold: true, color: "FFFFFF", fill: { color: NAVY }, align: "right" } },
    ],
    [{ text: "A-1024" }, { text: "11010110…", options: { color: SLATE } }, { text: "0.21", options: { align: "right", color: SLATE } }],
    [{ text: "A-1025" }, { text: "11010101…", options: { color: SLATE } }, { text: "0.18", options: { align: "right", color: SLATE } }],
    [{ text: "A-1026" }, { text: "11011010…", options: { color: SLATE } }, { text: "0.24", options: { align: "right", color: SLATE } }],
    [
      { text: "A-1027", options: { bold: true, fill: { color: HIGHLIGHT_BG } } },
      { text: "00101110…", options: { bold: true, color: NAVY, fill: { color: HIGHLIGHT_BG } } },
      { text: "0.91", options: { bold: true, align: "right", color: NAVY, fill: { color: HIGHLIGHT_BG } } },
    ],
    [{ text: "A-1028" }, { text: "11010111…", options: { color: SLATE } }, { text: "0.22", options: { align: "right", color: SLATE } }],
  ];
  slide.addTable(afterData, {
    x: afterX, y: tableY, w: tableW,
    fontSize: 11, fontFace: FONT_BODY,
    color: NEAR_BLACK,
    border: { pt: 0.5, color: LIGHT_SLATE },
    rowH: 0.32,
  });

  slide.addText("A-1027 surfaces immediately. Its fingerprint is unlike its neighbors and its score is high.", {
    x: afterX, y: tableY + tableH + 0.05, w: tableW, h: 0.3,
    fontSize: 10, fontFace: FONT_BODY, italic: true,
    color: NAVY, margin: 0,
  });

  addFooter(slide, 6);
}

// ════════════════════════════════════════════════════════════════════
// 7: USE CASE — SEC FILINGS
//   One finding, plainly told. Three independent source cards beneath
//   it (matches the 3-card visual grammar of slides 3 & 9). Third-person
//   voice throughout — no "we" / "our" / "us".
// ════════════════════════════════════════════════════════════════════
{
  const slide = pres.addSlide();
  slide.background = { color: CREAM };
  addSectionLabel(slide, "USE CASE  ·  SEC FILINGS");

  // ── Headline — matches the cadence of slide 6 ──
  slide.addText(
    [
      { text: "Five thousand filers in.", options: { breakLine: true } },
      { text: "One stood out.", options: { italic: true, color: GOLD } },
    ],
    {
      x: MARGIN, y: 0.85, w: SLIDE_W - MARGIN * 2, h: 0.95,
      fontSize: 26, fontFace: FONT_HEADER,
      color: NEAR_BLACK, margin: 0,
    }
  );

  // ── Compact finding card — focal point ──
  const cardW = 7.6;
  const cardX = (SLIDE_W - cardW) / 2;
  const cardY = 1.95;
  const cardH = 1.25;

  slide.addShape(pres.shapes.RECTANGLE, {
    x: cardX, y: cardY, w: cardW, h: cardH,
    fill: { color: "FFFFFF" }, line: { color: LIGHT_SLATE, width: 0.5 },
  });
  slide.addShape(pres.shapes.RECTANGLE, {
    x: cardX, y: cardY, w: 0.06, h: cardH,
    fill: { color: GOLD }, line: { type: "none" },
  });
  slide.addText("TOP-1 OUT OF 4,999 PUBLIC FILERS", {
    x: cardX + 0.35, y: cardY + 0.15, w: cardW - 0.7, h: 0.22,
    fontSize: 10, fontFace: FONT_BODY, bold: true,
    color: GOLD, charSpacing: 4, margin: 0,
  });
  slide.addText("American Electric Power", {
    x: cardX + 0.35, y: cardY + 0.4, w: cardW - 0.7, h: 0.45,
    fontSize: 24, fontFace: FONT_HEADER, bold: true,
    color: NAVY, margin: 0,
  });
  slide.addText("Asset Retirement Obligation", {
    x: cardX + 0.35, y: cardY + 0.85, w: cardW - 0.7, h: 0.32,
    fontSize: 14, fontFace: FONT_HEADER, italic: true,
    color: NEAR_BLACK, margin: 0,
  });

  // ── 3 source cards — independent verification, badge-like ──
  slide.addText("INDEPENDENTLY VERIFIED  ·  THREE SOURCES", {
    x: MARGIN, y: 3.35, w: SLIDE_W - MARGIN * 2, h: 0.25,
    fontSize: 10, fontFace: FONT_BODY, bold: true,
    color: SLATE, charSpacing: 3, margin: 0,
  });

  const sourceY = 3.65;
  const sourceH = 1.55;
  const sourceW = 2.7;
  const sourceGap = (SLIDE_W - MARGIN * 2 - sourceW * 3) / 2;

  const sources = [
    {
      brand: "DELOITTE",
      meta: "On the Radar  ·  Jul 2025",
      quote: "Asset retirement obligations require “significant management estimates” and rank among the highest-scrutiny disclosures.",
      url: "https://dart.deloitte.com/USDART/home/publications/deloitte/on-the-radar/environmental-obligations-aro",
    },
    {
      brand: "EY",
      meta: "2025 SEC Comment Letter Trends",
      quote: "AROs remain a recurring topic in SEC staff reviews of utility 10-Ks.",
      url: "https://www.ey.com/content/dam/ey-unified-site/ey-com/en-us/technical/accountinglink/documents/ey-secru28204-251us-09-11-2025.pdf",
    },
    {
      brand: "AEP 10-K",
      meta: "Annual Report  ·  FY 2023",
      quote: "Cook nuclear decommissioning ARO of $2.4B, plus material coal-ash retirement liabilities.",
      url: "https://docs.aep.com/docs/investors/filings/docs/AEP_10K_2023.pdf",
    },
  ];

  sources.forEach((s, i) => {
    const x = MARGIN + i * (sourceW + sourceGap);
    // Card background
    slide.addShape(pres.shapes.RECTANGLE, {
      x, y: sourceY, w: sourceW, h: sourceH,
      fill: { color: "FFFFFF" }, line: { color: LIGHT_SLATE, width: 0.5 },
    });
    // Top navy bar with brand
    slide.addShape(pres.shapes.RECTANGLE, {
      x, y: sourceY, w: sourceW, h: 0.55,
      fill: { color: NAVY }, line: { type: "none" },
    });
    slide.addText(
      [
        {
          text: s.brand,
          options: {
            hyperlink: { url: s.url },
            color: GOLD,
          },
        },
      ],
      {
        x, y: sourceY, w: sourceW, h: 0.55,
        fontSize: 14, fontFace: FONT_HEADER, bold: true,
        align: "center", valign: "middle",
        charSpacing: 3, margin: 0,
      }
    );
    // Meta line under brand bar
    slide.addText(s.meta, {
      x: x + 0.15, y: sourceY + 0.6, w: sourceW - 0.3, h: 0.22,
      fontSize: 8, fontFace: FONT_BODY, bold: true,
      color: SLATE, align: "center", charSpacing: 2,
      margin: 0,
    });
    // Quote / fact
    slide.addText(s.quote, {
      x: x + 0.18, y: sourceY + 0.85, w: sourceW - 0.36, h: sourceH - 0.95,
      fontSize: 10, fontFace: FONT_BODY, italic: true,
      color: NEAR_BLACK, align: "left", valign: "top",
      margin: 0,
    });
  });

  addFooter(slide, 7);
}

// ════════════════════════════════════════════════════════════════════
// 8: WHAT MAKES IT DIFFERENT (was 5)
// ════════════════════════════════════════════════════════════════════
{
  const slide = pres.addSlide();
  slide.background = { color: CREAM };
  addSectionLabel(slide, "WHAT MAKES IT DIFFERENT");

  slide.addText(
    "Most data systems are designed by hand. Latent Ocean grows on its own with no setup needed.",
    {
      x: MARGIN, y: 0.95, w: SLIDE_W - MARGIN * 2, h: 1.0,
      fontSize: 24, fontFace: FONT_HEADER,
      color: NEAR_BLACK, align: "left", margin: 0,
    }
  );

  const colY = 2.2;
  const colH = 2.7;
  const colW = (SLIDE_W - MARGIN * 2 - 0.4) / 2;

  slide.addShape(pres.shapes.RECTANGLE, {
    x: MARGIN, y: colY, w: colW, h: colH,
    fill: { color: PALE }, line: { color: LIGHT_SLATE, width: 0.5 },
  });
  slide.addText("TODAY'S DATA", {
    x: MARGIN + 0.3, y: colY + 0.2, w: colW - 0.6, h: 0.4,
    fontSize: 12, fontFace: FONT_BODY, bold: true,
    color: SLATE, charSpacing: 4, margin: 0,
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
      color: SLATE, paraSpaceAfter: 6, margin: 0,
    }
  );

  slide.addShape(pres.shapes.RECTANGLE, {
    x: MARGIN + colW + 0.4, y: colY, w: colW, h: colH,
    fill: { color: NAVY }, line: { type: "none" },
  });
  slide.addText("LATENT OCEAN", {
    x: MARGIN + colW + 0.7, y: colY + 0.2, w: colW - 0.5, h: 0.4,
    fontSize: 12, fontFace: FONT_BODY, bold: true,
    color: GOLD, charSpacing: 4, margin: 0,
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
      color: "FFFFFF", paraSpaceAfter: 6, margin: 0,
    }
  );
  addFooter(slide, 8);
}

// ════════════════════════════════════════════════════════════════════
// 9: WHERE IT APPLIES (was 6)
// ════════════════════════════════════════════════════════════════════
{
  const slide = pres.addSlide();
  slide.background = { color: CREAM };
  addSectionLabel(slide, "WHERE IT APPLIES");
  slide.addText("One system. Many worlds.", {
    x: MARGIN, y: 0.95, w: SLIDE_W - MARGIN * 2, h: 0.7,
    fontSize: 32, fontFace: FONT_HEADER,
    color: NEAR_BLACK, margin: 0,
  });
  const cardY = 2.0;
  const cardH = 2.0;
  const cardW = 2.7;
  const gap = (SLIDE_W - MARGIN * 2 - cardW * 3) / 2;
  const monograms = [
    { letter: "F", title: "FINANCE", desc: "Reading the SEC archive as one connected story and surfacing the companies that don't fit." },
    { letter: "M", title: "MEDICINE", desc: "Finding the connections across millions of medical papers that no practitioner has time to read." },
    { letter: "R", title: "RESEARCH", desc: "Connecting centuries of scientific thinking. Finding the threads no one person could see in a lifetime of reading." },
  ];
  monograms.forEach((m, i) => {
    const x = MARGIN + i * (cardW + gap);
    slide.addShape(pres.shapes.RECTANGLE, {
      x, y: cardY, w: cardW, h: cardH,
      fill: { color: "FFFFFF" }, line: { color: LIGHT_SLATE, width: 0.5 },
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
      color: GOLD, align: "center", valign: "middle", margin: 0,
    });
    slide.addText(m.title, {
      x: x + 0.2, y: cardY + 1.2, w: cardW - 0.4, h: 0.3,
      fontSize: 13, fontFace: FONT_BODY, bold: true,
      color: NAVY, charSpacing: 3, align: "center", margin: 0,
    });
    slide.addText(m.desc, {
      x: x + 0.2, y: cardY + 1.5, w: cardW - 0.4, h: 0.5,
      fontSize: 10, fontFace: FONT_BODY,
      color: NEAR_BLACK, align: "center", margin: 0,
    });
  });
  slide.addText("AND TOOLS BUILT ON TOP  ·  FOR EVERY OTHER FIELD", {
    x: MARGIN, y: 4.45, w: SLIDE_W - MARGIN * 2, h: 0.4,
    fontSize: 10, fontFace: FONT_BODY,
    color: NAVY, align: "center", charSpacing: 4, margin: 0,
  });
  addFooter(slide, 9);
}

// ════════════════════════════════════════════════════════════════════
// 10: WHAT IT'S ALREADY DONE (was 7)
// ════════════════════════════════════════════════════════════════════
{
  const slide = pres.addSlide();
  slide.background = { color: CREAM };
  addSectionLabel(slide, "WHAT IT'S ALREADY DONE");
  slide.addText("Real findings. Real domains.", {
    x: MARGIN, y: 0.95, w: SLIDE_W - MARGIN * 2, h: 0.7,
    fontSize: 32, fontFace: FONT_HEADER,
    color: NEAR_BLACK, margin: 0,
  });
  const rowsY = 1.95;
  const rowH = 0.95;
  const rowGap = 0.05;
  const wins = [
    "Found rare, high-value patterns in messy real-world data. Patterns that line up with what experts already know, and reveal what they don't.",
    "Reads live data and surfaces what matters most. Adjustable by region and timeframe.",
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
      color: NAVY, align: "center", valign: "middle", margin: 0,
    });
    slide.addText(w, {
      x: MARGIN + nd + 0.3, y, w: SLIDE_W - MARGIN * 2 - nd - 0.3, h: rowH,
      fontSize: 14, fontFace: FONT_BODY,
      color: NEAR_BLACK, valign: "middle", margin: 0,
    });
  });
  addFooter(slide, 10);
}

// ════════════════════════════════════════════════════════════════════
// 11-14: SCREENSHOT SLIDES
// ════════════════════════════════════════════════════════════════════
addScreenshotSlide(pres.addSlide(), 11, "SEE IT WORK  ·  LANDING",
  "Every row, structurally aware.", SHOTS.home,
  "The home page. What visitors see first.");

addScreenshotSlide(pres.addSlide(), 12, "SEE IT WORK  ·  PLATFORM",
  "Structural fingerprints. A first-class column.", SHOTS.platform,
  "The product, explained. One primitive, fifteen data shapes.");

addScreenshotSlide(pres.addSlide(), 13, "SEE IT WORK  ·  TITAN",
  "Everything, at once, in 33 seconds.", SHOTS.titan,
  "Eighteen public APIs, processed live, in a single deterministic run.");

addScreenshotSlide(pres.addSlide(), 14, "SEE IT WORK  ·  LIVE",
  "Real-time. Really real.", SHOTS.live,
  "Two streaming sources, scored every twenty seconds.");

// ════════════════════════════════════════════════════════════════════
// 15 (final): DEFENSIBILITY
// ════════════════════════════════════════════════════════════════════
{
  const slide = pres.addSlide();
  slide.background = { color: NAVY };
  slide.addText("DEFENSIBILITY", {
    x: MARGIN, y: 0.4, w: 8, h: 0.3,
    fontSize: 12, fontFace: FONT_BODY, bold: true,
    color: GOLD, charSpacing: 4, margin: 0,
  });
  slide.addText("Trade secrets, with timestamps no one can fake.", {
    x: MARGIN, y: 0.95, w: SLIDE_W - MARGIN * 2 - 2.5, h: 1.5,
    fontSize: 30, fontFace: FONT_HEADER,
    color: "FFFFFF", margin: 0,
  });
  const sealCX = SLIDE_W - 1.7;
  const sealCY = 1.7;
  slide.addShape(pres.shapes.OVAL, {
    x: sealCX - 0.85, y: sealCY - 0.85, w: 1.7, h: 1.7,
    fill: { color: NAVY }, line: { color: GOLD, width: 2 },
  });
  slide.addShape(pres.shapes.OVAL, {
    x: sealCX - 0.45, y: sealCY - 0.45, w: 0.9, h: 0.9,
    fill: { color: GOLD }, line: { type: "none" },
  });
  slide.addText("✓", {
    x: sealCX - 0.45, y: sealCY - 0.5, w: 0.9, h: 0.9,
    fontSize: 36, fontFace: FONT_HEADER, bold: true,
    color: NAVY, align: "center", valign: "middle", margin: 0,
  });
  slide.addText(
    [
      { text: "The deep technical methods are intended to be protected as trade secrets.", options: { bullet: true, breakLine: true } },
      { text: "Every invention is cryptographically time-stamped on a public blockchain.", options: { bullet: true, breakLine: true } },
      { text: "Anyone can verify the creation timestamp without ever seeing the invention itself.", options: { bullet: true } },
    ],
    {
      x: MARGIN, y: 2.65, w: SLIDE_W - MARGIN * 2, h: 2.55,
      fontSize: 17, fontFace: FONT_BODY,
      color: "FFFFFF", paraSpaceAfter: 22, margin: 0,
    }
  );
  addFooter(slide, 15, true);
}

// ────────── SAVE ──────────
pres
  .writeFile({ fileName: "docs/commercial/Latent Ocean System Slides.pptx" })
  .then((name) => console.log("Wrote:", name))
  .catch((err) => {
    console.error("Build failed:", err);
    process.exit(1);
  });
