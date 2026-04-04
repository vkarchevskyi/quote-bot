import { Resvg, initWasm } from "@resvg/resvg-wasm";
import resvgWasm from "@resvg/resvg-wasm/index_bg.wasm";

import fontData from "../assets/NotoSans-Regular.bin";
import type { TelegramAvatar } from "./telegram";

const wasmReady = initWasm(resvgWasm);
const fontBuffer = new Uint8Array(fontData);

const IMAGE_WIDTH = 1080;
const IMAGE_HEIGHT = 1350;
const CONTENT_WIDTH = 820;
const CONTENT_LEFT = 130;
const QUOTE_TOP = 300;
const QUOTE_HEIGHT = 690;
const QUOTE_CLIP_PADDING = 6;
const QUOTE_COLOR = "#f5f5f5";
const DIVIDER_COLOR = "#4a4a4a";
const FOOTER_Y = 1180;
const AVATAR_SIZE = 88;
const AVATAR_IMAGE_HREF = "https://quote-bot.local/avatar";

type RenderQuoteImageParams = {
  quote: string;
  firstName: string;
  lastName: string | undefined;
  avatar: TelegramAvatar | null;
};

export async function renderQuoteImage({
  quote,
  firstName,
  lastName,
  avatar,
}: RenderQuoteImageParams): Promise<Uint8Array> {
  await wasmReady;

  const displayName = [firstName, lastName].filter(Boolean).join(" ");
  const fittedQuote = fitQuoteText(quote);
  const quoteTextY = QUOTE_TOP + fittedQuote.fontSize;
  const defsMarkup = renderDefs(Boolean(avatar));
  const avatarMarkup = avatar ? renderAvatar() : "";
  const footerTextX = avatar ? 270 : CONTENT_LEFT;
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${IMAGE_WIDTH}" height="${IMAGE_HEIGHT}" viewBox="0 0 ${IMAGE_WIDTH} ${IMAGE_HEIGHT}">
      ${defsMarkup}
      <rect width="100%" height="100%" fill="#000000"/>
      <text x="${IMAGE_WIDTH / 2}" y="132" fill="#ffffff" text-anchor="middle" font-family="Noto Sans" font-size="54" letter-spacing="1.2">Цитати великих людей</text>
      <line x1="${CONTENT_LEFT}" y1="180" x2="${CONTENT_LEFT + CONTENT_WIDTH}" y2="180" stroke="${DIVIDER_COLOR}" stroke-width="3" stroke-linecap="round"/>
      <g clip-path="url(#quote-clip)">
        <text x="${CONTENT_LEFT}" y="${quoteTextY}" fill="${QUOTE_COLOR}" font-family="Noto Sans" font-size="${fittedQuote.fontSize}" xml:space="preserve">
          ${fittedQuote.lines
            .map((line, index) => `<tspan x="${CONTENT_LEFT}" dy="${index === 0 ? 0 : fittedQuote.lineHeight}">${escapeXml(line)}</tspan>`)
            .join("")}
        </text>
      </g>
      ${avatarMarkup}
      <text x="${footerTextX}" y="${FOOTER_Y + 20}" fill="#ffffff" font-family="Noto Sans" font-size="34">${escapeXml(displayName)}</text>
    </svg>
  `;

  const resvg = new Resvg(svg, {
    background: "#000000",
    font: {
      fontBuffers: [fontBuffer],
      defaultFontFamily: "Noto Sans",
      sansSerifFamily: "Noto Sans",
      defaultFontSize: 16,
    },
  });

  if (avatar) {
    const imagesToResolve = resvg.imagesToResolve() as string[];
    if (imagesToResolve.includes(AVATAR_IMAGE_HREF)) {
      resvg.resolveImage(AVATAR_IMAGE_HREF, avatar.bytes);
    }
  }

  const rendered = resvg.render();
  resvg.free();
  return rendered.asPng();
}

function renderDefs(hasAvatar: boolean): string {
  const avatarClipMarkup = hasAvatar
    ? `
      <clipPath id="avatar-clip">
        <circle cx="${CONTENT_LEFT + AVATAR_SIZE / 2}" cy="${FOOTER_Y - 48 + AVATAR_SIZE / 2}" r="${AVATAR_SIZE / 2}"/>
      </clipPath>
    `
    : "";

  return `
    <defs>
      <clipPath id="quote-clip">
        <rect x="${CONTENT_LEFT - QUOTE_CLIP_PADDING}" y="${QUOTE_TOP - QUOTE_CLIP_PADDING}" width="${CONTENT_WIDTH + QUOTE_CLIP_PADDING * 2}" height="${QUOTE_HEIGHT + QUOTE_CLIP_PADDING * 2}"/>
      </clipPath>
      ${avatarClipMarkup}
    </defs>
  `;
}

function renderAvatar(): string {
  const avatarX = CONTENT_LEFT;
  const avatarY = FOOTER_Y - 48;

  return `
    <circle cx="${avatarX + AVATAR_SIZE / 2}" cy="${avatarY + AVATAR_SIZE / 2}" r="${AVATAR_SIZE / 2}" fill="#1f1f1f"/>
    <image href="${AVATAR_IMAGE_HREF}" x="${avatarX}" y="${avatarY}" width="${AVATAR_SIZE}" height="${AVATAR_SIZE}" preserveAspectRatio="xMidYMid slice" clip-path="url(#avatar-clip)"/>
  `;
}

function fitQuoteText(input: string): { fontSize: number; lineHeight: number; lines: string[] } {
  const sanitized = sanitizeQuote(input);
  const fontSizes = [76, 68, 62, 56, 50, 46, 42, 38, 34];
  const widthCache = new Map<string, number>();

  const measureTextWidth = (value: string, fontSize: number): number => {
    const cacheKey = `${fontSize}:${value}`;
    const cachedWidth = widthCache.get(cacheKey);
    if (cachedWidth !== undefined) {
      return cachedWidth;
    }

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${CONTENT_WIDTH * 2}" height="${fontSize * 3}" viewBox="0 0 ${CONTENT_WIDTH * 2} ${fontSize * 3}">
        <text x="0" y="${fontSize}" fill="#ffffff" font-family="Noto Sans" font-size="${fontSize}" xml:space="preserve">${escapeXml(value)}</text>
      </svg>
    `;

    const resvg = new Resvg(svg, {
      font: {
        fontBuffers: [fontBuffer],
        defaultFontFamily: "Noto Sans",
        sansSerifFamily: "Noto Sans",
        defaultFontSize: 16,
      },
    });

    const bbox = resvg.getBBox() ?? resvg.innerBBox();
    const width = bbox?.width ?? 0;
    bbox?.free();
    resvg.free();

    widthCache.set(cacheKey, width);
    return width;
  };

  for (const fontSize of fontSizes) {
    const lineHeight = Math.round(fontSize * 1.34);
    const maxLines = Math.max(3, Math.floor(QUOTE_HEIGHT / lineHeight));
    const lines = wrapText(sanitized, fontSize, CONTENT_WIDTH, maxLines, measureTextWidth);

    if (lines.length <= maxLines) {
      return { fontSize, lineHeight, lines };
    }
  }

  const fallbackFontSize = 34;
  const fallbackLineHeight = Math.round(fallbackFontSize * 1.34);
  return {
    fontSize: fallbackFontSize,
    lineHeight: fallbackLineHeight,
    lines: wrapText(
      sanitized,
      fallbackFontSize,
      CONTENT_WIDTH,
      Math.floor(QUOTE_HEIGHT / fallbackLineHeight),
      measureTextWidth,
    ),
  };
}

function sanitizeQuote(input: string): string {
  return input
    .replace(/\r\n?/g, "\n")
    .replace(/\t/g, " ")
    .split("\n")
    .map((line) => line.trim().replace(/\s+/g, " "))
    .join("\n")
    .trim()
    .slice(0, 900);
}

function wrapText(
  input: string,
  fontSize: number,
  maxWidth: number,
  maxLines: number,
  measureTextWidth: (value: string, fontSize: number) => number,
): string[] {
  const paragraphs = input.split("\n");
  const lines: string[] = [];

  for (const [paragraphIndex, paragraph] of paragraphs.entries()) {
    if (!paragraph) {
      if (lines.length > 0 && lines[lines.length - 1] !== "") {
        lines.push("");
      }
      continue;
    }

    const words = paragraph.split(" ");
    let currentLine = "";

    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;

      if (measureTextWidth(candidate, fontSize) <= maxWidth) {
        currentLine = candidate;
        continue;
      }

      if (currentLine) {
        lines.push(currentLine);
        if (lines.length >= maxLines) {
          return truncateLines(lines, maxLines, fontSize, maxWidth, measureTextWidth);
        }
      }

      if (measureTextWidth(word, fontSize) <= maxWidth) {
        currentLine = word;
        continue;
      }

      const brokenWordLines = breakLongWord(word, fontSize, maxWidth, measureTextWidth);
      for (let index = 0; index < brokenWordLines.length - 1; index += 1) {
        const brokenLine = brokenWordLines[index];
        if (!brokenLine) {
          continue;
        }

        lines.push(brokenLine);
        if (lines.length >= maxLines) {
          return truncateLines(lines, maxLines, fontSize, maxWidth, measureTextWidth);
        }
      }

      currentLine = brokenWordLines[brokenWordLines.length - 1] ?? "";
    }

    if (currentLine) {
      lines.push(currentLine);
      const hasMoreParagraphs = paragraphIndex < paragraphs.length - 1;
      if (lines.length >= maxLines && hasMoreParagraphs) {
        return truncateLines(lines, maxLines, fontSize, maxWidth, measureTextWidth);
      }
    }
  }

  return lines;
}

function breakLongWord(
  word: string,
  fontSize: number,
  maxWidth: number,
  measureTextWidth: (value: string, fontSize: number) => number,
): string[] {
  const parts: string[] = [];
  let current = "";

  for (const char of Array.from(word)) {
    const candidate = current + char;
    if (measureTextWidth(candidate, fontSize) <= maxWidth || current.length === 0) {
      current = candidate;
      continue;
    }

    parts.push(current);
    current = char;
  }

  if (current) {
    parts.push(current);
  }

  return parts;
}

function truncateLines(
  lines: string[],
  maxLines: number,
  fontSize: number,
  maxWidth: number,
  measureTextWidth: (value: string, fontSize: number) => number,
): string[] {
  const slicedLines = lines.slice(0, maxLines);
  const lastLine = slicedLines[maxLines - 1] ?? "";
  slicedLines[maxLines - 1] = trimToWidth(
    `${lastLine}...`,
    fontSize,
    maxWidth,
    measureTextWidth,
  );
  return slicedLines;
}

function trimToWidth(
  value: string,
  fontSize: number,
  maxWidth: number,
  measureTextWidth: (value: string, fontSize: number) => number,
): string {
  let trimmed = "";

  for (const char of Array.from(value)) {
    const candidate = trimmed + char;
    if (measureTextWidth(candidate, fontSize) > maxWidth) {
      break;
    }
    trimmed = candidate;
  }

  return trimmed.endsWith("...") ? trimmed : `${trimmed.replace(/\.*$/, "")}...`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
