import { Bot, InputFile } from "grammy";

import { renderQuoteImage } from "./render-image";
import { fetchUserAvatar } from "./telegram";

export type Env = {
  BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET: string;
};

export function createBot(env: Env): Bot {
  const bot = new Bot(env.BOT_TOKEN);

  bot.on("message:text", async (ctx) => {
    const quote = ctx.message.text.trim();

    if (!quote) {
      return;
    }

    await ctx.replyWithChatAction("upload_photo");

    const avatar = await fetchUserAvatar(env.BOT_TOKEN, ctx.from.id).catch((error: unknown) => {
      console.error("Failed to fetch Telegram avatar", error);
      return null;
    });

    const image = await renderQuoteImage({
      quote,
      firstName: ctx.from.first_name,
      lastName: ctx.from.last_name,
      avatar,
    });

    await ctx.replyWithPhoto(new InputFile(image, "quote.png"));
  });

  bot.catch((error) => {
    console.error("Telegram bot error", error.error);
  });

  return bot;
}
