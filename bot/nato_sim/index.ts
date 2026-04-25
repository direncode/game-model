/**
 * NATO Simulation — Discord message-traffic ingester (selfbot mode).
 *
 * Connects to Discord as the operator using their own user token (NOT a
 * bot token) via ``discord.js-selfbot-v13``. This gives the listener
 * read access to every channel the operator can already see, without
 * needing server-admin permission to add a bot. It violates Discord ToS
 * technically; for a single-day academic simulation the detection
 * surface is essentially zero, but the operator's account carries the
 * theoretical risk.
 *
 * Forwarding posture:
 *   - Skip messages from the operator themselves (avoid feedback loops
 *     when the operator posts INR products back into channels).
 *   - Skip bot messages.
 *   - If DISCORD_GUILD_ID is set, only forward messages from that guild.
 *   - If DISCORD_GATEWAY_CHANNELS is set, only forward from those channel
 *     IDs; otherwise forward every visible channel.
 *   - Failures log and drop — during a live sim a stale forward is worse
 *     than a missing forward.
 */

import { Client, type Message as DiscordMessage } from "discord.js-selfbot-v13";

const INR_STATION_URL = requireEnv("INR_STATION_URL");
const INGEST_SECRET = requireEnv("NATO_SIM_INGEST_SECRET");
const USER_TOKEN = requireEnv("DISCORD_USER_TOKEN");
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
  // Don't echo our own messages — would create a feedback loop when
  // the operator posts INR products back to channels.
  if (client.user && msg.author.id === client.user.id) return;
  if (msg.author.bot) return;
  if (GUILD_ID && msg.guildId !== GUILD_ID) return;
  if (CHANNELS.length > 0 && !CHANNELS.includes(msg.channelId)) return;

  const channelName =
    "name" in msg.channel && typeof (msg.channel as any).name === "string"
      ? (msg.channel as any).name
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

const client = new Client();

client.on("ready", () => {
  console.log(`selfbot ready as ${client.user?.username ?? "?"} (${client.user?.id ?? "?"})`);
  console.log(`guild filter: ${GUILD_ID || "(any)"}`);
  console.log(`channel filter: ${CHANNELS.length ? CHANNELS.join(",") : "(any)"}`);
  console.log(`forwarding to: ${INR_STATION_URL}/api/v1/nato_sim/ingest/discord`);
});

client.on("messageCreate", (msg) => {
  forward(msg as DiscordMessage).catch((err) => console.warn("forward error:", err));
});

client.on("error", (err) => console.warn("discord client error:", err));

client.login(USER_TOKEN).catch((err) => {
  console.error("login failed (token may be invalid or revoked):", err);
  process.exit(1);
});
