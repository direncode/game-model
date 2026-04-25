# NATO Simulation — Discord Gateway Bot

Listens to every message in the simulation Discord server and forwards
it to the NATO Simulation backend for ingestion into the knowledge graph.
Runs on the **operator's laptop** during the sim window. Not deployed to
latentocean.com — Vercel / serverless can't host a persistent WebSocket
listener, and the sim only runs for one 8-hour window.

## Setup (once, tonight)

1. **Register a Discord application** at
   <https://discord.com/developers/applications>
   - Create application → General Information → copy **Application ID**
     and **Public Key**.
   - Bot tab → "Reset Token" → copy the **Bot Token** (only shown once).
   - Bot tab → Privileged Gateway Intents → enable **MESSAGE CONTENT
     INTENT**.
   - OAuth2 → URL Generator → scopes `bot` + `applications.commands`;
     permissions: View Channels, Read Message History, Send Messages, Use
     Slash Commands. Copy the generated invite URL.

2. **Invite the bot** to the AWIS simulation Discord server (requires an
   admin with Manage Server permission — ask Collection Control).

3. **Install deps**

   ```bash
   cd bot/nato_sim
   npm install
   ```

4. **Environment** — create `bot/nato_sim/.env.local` with:

   ```
   DISCORD_APP_ID=...
   DISCORD_BOT_TOKEN=...
   DISCORD_GUILD_ID=<sim server id>
   DISCORD_GATEWAY_CHANNELS=<comma-separated channel ids, or empty for all>

   INR_STATION_URL=https://latentocean.com
   NATO_SIM_INGEST_SECRET=<same long random as the backend>
   ```

5. **Register slash commands** (one-time per guild):

   ```bash
   npm run register
   ```

## Running tomorrow morning (7 am)

```bash
cd bot/nato_sim
npm start
```

Leave the terminal open for the full sim window (8 am – 4 pm). The
process reconnects on transient failures; if the laptop sleeps the bot
stops. Console logs every forwarded message.

## Interactions endpoint

Slash commands are handled by the backend at
`https://latentocean.com/api/v1/nato_sim/discord/interactions` — point
the "Interactions Endpoint URL" field in the Discord Developer Portal
there. Discord will send a ping that the backend signs and responds to;
save the application once it accepts.
