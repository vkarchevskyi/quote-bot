# Quote Bot

Telegram bot for Cloudflare Workers that receives webhook updates and replies with a generated PNG quote card.

## Behavior

- Ignores all non-text Telegram messages.
- In private chats, uses the incoming text message as the quote body.
- In groups, generates the image only after `/quote` is invoked.
- `/quote` supports two forms:
  - `/quote your text here`
  - reply to a text message with `/quote`
- Generates a black image with:
  - title `Цитати великих людей`
  - horizontal divider line
  - wrapped quote text
  - user avatar at the bottom when available
  - user `first_name` and `last_name` at the bottom
- If the user has no Telegram profile photo, the bot shows only the name.

## Stack

- TypeScript with strict compiler settings
- Cloudflare Workers
- grammY for Telegram bot handling
- `@resvg/resvg-wasm` for SVG to PNG rendering

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Create a local env file:

```bash
cp .dev.vars.example .dev.vars
```

3. Fill in:

- `BOT_TOKEN`
- `TELEGRAM_WEBHOOK_SECRET`

4. Start the local Worker:

```bash
npm run dev
```

## Deploy

1. Authenticate Wrangler if needed:

```bash
npx wrangler login
```

2. Add secrets:

```bash
npx wrangler secret put BOT_TOKEN
npx wrangler secret put TELEGRAM_WEBHOOK_SECRET
```

3. Deploy:

```bash
npm run deploy
```

## Set Telegram Webhook

After deploy, point Telegram to your Worker webhook endpoint:

```text
https://api.telegram.org/bot<BOT_TOKEN>/setWebhook?url=https://<your-worker>.workers.dev/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>&allowed_updates=["message"]
```

Replace:

- `<BOT_TOKEN>` with your real bot token
- `<your-worker>` with your deployed Worker domain
- `<TELEGRAM_WEBHOOK_SECRET>` with the same secret stored in Cloudflare

## Verification

```bash
npm run typecheck
npx wrangler deploy --dry-run --outdir dist
```
