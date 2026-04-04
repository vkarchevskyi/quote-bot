import { Bot, InputFile } from "grammy";
import type { Context } from "grammy";

import { renderQuoteImage } from "./render-image";
import { fetchUserAvatar } from "./telegram";

export type Env = {
  BOT_TOKEN: string;
  TELEGRAM_WEBHOOK_SECRET: string;
};

type QuoteRequest = {
  quote: string;
  firstName: string;
  lastName: string | undefined;
  userId: number;
};

export function createBot(env: Env): Bot {
  const bot = new Bot(env.BOT_TOKEN);

  bot.command("quote", async (ctx) => {
    const quoteRequest = getQuoteRequest(ctx);

    if (!quoteRequest) {
      await ctx.reply(
        "Use /quote <text> or reply to a text message with /quote.",
      );
      return;
    }

    await sendQuoteImage(ctx, env.BOT_TOKEN, quoteRequest);
  });

  bot.on("message:text", async (ctx) => {
    if (ctx.chat.type !== "private" || isCommandMessage(ctx)) {
      return;
    }

    await sendQuoteImage(ctx, env.BOT_TOKEN, {
      quote: ctx.message.text.trim(),
      firstName: ctx.from.first_name,
      lastName: ctx.from.last_name,
      userId: ctx.from.id,
    });
  });

  bot.catch((error) => {
    console.error("Telegram bot error", error.error);
  });

  return bot;
}

async function sendQuoteImage(
  ctx: Context,
  botToken: string,
  quoteRequest: QuoteRequest,
): Promise<void> {
  if (!quoteRequest.quote) {
    return;
  }

  await ctx.replyWithChatAction("upload_photo");

  const avatar = await fetchUserAvatar(botToken, quoteRequest.userId).catch(
    (error: unknown) => {
      console.error("Failed to fetch Telegram avatar", error);
      return null;
    },
  );

  const image = await renderQuoteImage({
    quote: quoteRequest.quote,
    firstName: quoteRequest.firstName,
    lastName: quoteRequest.lastName,
    avatar,
  });

  await ctx.replyWithPhoto(new InputFile(image, "quote.png"));
}

function getQuoteRequest(ctx: Context): QuoteRequest | null {
  const commandText = ctx.match;
  const messageAuthor = ctx.from;

  if (typeof commandText === "string" && messageAuthor) {
    const quote = commandText.trim();
    if (quote) {
      return {
        quote,
        firstName: messageAuthor.first_name,
        lastName: messageAuthor.last_name,
        userId: messageAuthor.id,
      };
    }
  }

  const repliedMessage = ctx.message?.reply_to_message;
  if (repliedMessage?.text && repliedMessage.from) {
    const quote = repliedMessage.text.trim();
    if (quote) {
      return {
        quote,
        firstName: repliedMessage.from.first_name,
        lastName: repliedMessage.from.last_name,
        userId: repliedMessage.from.id,
      };
    }
  }

  return null;
}

function isCommandMessage(ctx: Context): boolean {
  const firstEntity = ctx.message?.entities?.[0];
  return firstEntity?.type === "bot_command" && firstEntity.offset === 0;
}
