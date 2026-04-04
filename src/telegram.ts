export type TelegramAvatar = {
  bytes: Uint8Array;
};

type TelegramResponse<T> = {
  ok: boolean;
  result: T;
  description?: string;
};

type TelegramPhotoSize = {
  file_id: string;
};

type TelegramUserProfilePhotos = {
  photos: TelegramPhotoSize[][];
};

type TelegramFile = {
  file_path?: string;
};

export async function fetchUserAvatar(
  botToken: string,
  userId: number,
): Promise<TelegramAvatar | null> {
  const photos = await callTelegram<TelegramUserProfilePhotos>(botToken, "getUserProfilePhotos", {
    user_id: userId,
    limit: 1,
  });

  const firstPhoto = photos.photos[0];
  const bestSize = firstPhoto?.[firstPhoto.length - 1];

  if (!bestSize) {
    return null;
  }

  const file = await callTelegram<TelegramFile>(botToken, "getFile", {
    file_id: bestSize.file_id,
  });

  if (!file.file_path) {
    return null;
  }

  const fileResponse = await fetch(
    `https://api.telegram.org/file/bot${botToken}/${file.file_path}`,
  );

  if (!fileResponse.ok) {
    throw new Error(`Telegram file download failed with status ${fileResponse.status}`);
  }

  return {
    bytes: new Uint8Array(await fileResponse.arrayBuffer()),
  };
}

async function callTelegram<T>(
  botToken: string,
  method: string,
  payload: Record<string, number | string>,
): Promise<T> {
  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Telegram API request failed with status ${response.status}`);
  }

  const data = (await response.json()) as TelegramResponse<T>;

  if (!data.ok) {
    throw new Error(data.description ?? `Telegram API method ${method} failed`);
  }

  return data.result;
}
