/**
 * NATO Simulation — Discord Gateway bot.
 *
 * Runs on the operator's laptop during the sim window. Maintains a
 * persistent WebSocket to Discord and forwards every relevant message
 * to the NATO Simulation backend's ingest endpoint.
 *
 * Forwarding posture:
 *   - Skip bot messages (avoid echo loops if Discord replies trigger us).
 *   - Skip messages outside the configured guild.
 *   - If DISCORD_GATEWAY_CHANNELS is set, only forward messages from
 *     those channel IDs; otherwise forward every channel the bot can see.
 *   - Failures are logged — we do NOT retry — because during a live sim
 *     the operator would rather a dropped message than a stale one.
 */

import {
  Client,
  GatewayIntentBits,
  Events,
  Message as DiscordMessage,
} from "discord.js";

const INR_STATION_URL = requireEnv("INR_STATION_URL");
const INGEST_SECRET = requireEnv("NATO_SIM_INGEST_SECRET");
const BOT_TOKEN = requireEnv("DISCORD_BOT_TOKEN");
const GUILD_ID = process.env.DISCORD_GUILD_ID || "";
const CHANNELS = (process.env.DISCORD_GATEWAY_CHANNELS ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) {
    console.error(`missing required env var: ${name}`);
    process.exit(1);
  }
  return v;
}

async function forward(msg: DiscordMessage): Promise<void> {
  if (msg.author.bot) return;
  if (GUILD_ID && msg.guildId !== GUILD_ID) return;
  if (CHANNELS.length > 0 && !CHANNELS.includes(msg.channelId)) return;

  const channelName =
    "name" in msg.channel && typeof msg.channel.name === "string"
      ? msg.channel.name
      : msg.channelId;

  const payload = {
    channel: channelName,
    author: msg.author.username,
    content: msg.content,
    raw: {
      id: msg.id,
      channel_id: msg.channelId,
      guild_id: msg.guildId,
      ts: msg.createdTimestamp,
      attachment_count: msg.attachments.size,
    },
  };

  try {
    const res = await fetch(`${INR_STATION_URL}/api/v1/nato_sim/ingest/discord`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${INGEST_SECRET}`,
      },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      console.warn(
        `forward failed: ${res.status} for msg ${msg.id} in #${channelName}`,
      );
    } else {
      const json = (await res.json()) as { id?: string };
      console.log(
        `forwarded ${msg.id} → ${json.id ?? "?"} (#${channelName} / ${msg.author.username})`,
      );
    }
  } catch (err) {
    console.warn(`forward exception for ${msg.id}:`, err);
  }
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.DirectMessages,
  ],
});

client.once(Events.ClientReady, (c) => {
  console.log(`bot ready as ${c.user.tag}`);
  console.log(`guild filter: ${GUILD_ID || "(any)"}`);
  console.log(`channel filter: ${CHANNELS.length ? CHANNELS.join(",") : "(any)"}`);
  console.log(`forwarding to: ${INR_STATION_URL}/api/v1/nato_sim/ingest/discord`);
});

client.on(Events.MessageCreate, (msg) => {
  forward(msg).catch((err) => console.warn("forward error:", err));
});

client.on(Events.Error, (err) => console.warn("discord client error:", err));

client.login(BOT_TOKEN).catch((err) => {
  console.error("login failed:", err);
  process.exit(1);
});
