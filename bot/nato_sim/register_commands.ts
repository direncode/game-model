/**
 * One-time registration of NATO Simulation slash commands to the
 * configured guild. Run with `npm run register`.
 *
 * Guild-scoped (not global) so they update instantly rather than the
 * ~1-hour global-command propagation delay — we don't need them anywhere
 * except the sim server.
 */

const APP_ID = requireEnv("DISCORD_APP_ID");
const BOT_TOKEN = requireEnv("DISCORD_BOT_TOKEN");
const GUILD_ID = requireEnv("DISCORD_GUILD_ID");

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`missing required env var: ${name}`);
    process.exit(1);
  }
  return v;
}

// Option types per Discord docs:
//   3 = STRING  4 = INTEGER  5 = BOOLEAN
const COMMANDS = [
  {
    name: "rfi",
    description: "Generate a Request for Information template",
    options: [
      { name: "target", description: "collection target or topic", type: 3, required: true },
    ],
  },
  {
    name: "tasking",
    description: "Generate a collection tasking template",
    options: [
      { name: "agency", description: "owning agency (CIA / DIA / NSA / NGA / FBI)", type: 3, required: true },
      { name: "target", description: "collection target", type: 3, required: true },
    ],
  },
  {
    name: "sitrep",
    description: "Current situation report in INR voice",
  },
  {
    name: "assessment",
    description: "Formal analytical product on a topic",
    options: [
      { name: "topic", description: "topic of the assessment", type: 3, required: true },
    ],
  },
  {
    name: "brief-dni",
    description: "DNI-ready briefing card",
    options: [
      { name: "topic", description: "topic", type: 3, required: true },
    ],
  },
  {
    name: "brief-potus",
    description: "POTUS-ready BLUF card (5-10 lines)",
    options: [
      { name: "topic", description: "topic", type: 3, required: true },
    ],
  },
  {
    name: "watchboard",
    description: "Dump current I&W state",
  },
  {
    name: "sources",
    description: "Return briefing paragraphs touching a given entity",
    options: [
      { name: "entity", description: "canonical name of the entity", type: 3, required: true },
    ],
  },
  {
    name: "ingest",
    description: "Pull a linked document into the corpus",
    options: [
      { name: "url", description: "URL of the document", type: 3, required: true },
    ],
  },
];

async function main(): Promise<void> {
  const url = `https://discord.com/api/v10/applications/${APP_ID}/guilds/${GUILD_ID}/commands`;
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bot ${BOT_TOKEN}`,
    },
    body: JSON.stringify(COMMANDS),
  });
  const body = await res.text();
  console.log(`status: ${res.status}`);
  if (!res.ok) {
    console.error(body);
    process.exit(1);
  }
  console.log(
    `registered ${COMMANDS.length} slash commands to guild ${GUILD_ID}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
