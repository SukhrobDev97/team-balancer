let botUsername = '';

export function normalizeBotUsername(raw: string): string {
  return raw.trim().replace(/^@/, '');
}

export function setBotUsername(username: string): void {
  botUsername = normalizeBotUsername(username);
}

export function getBotUsername(): string {
  return botUsername;
}

export function hasBotUsername(): boolean {
  return botUsername.length > 0;
}

/** Returns true when a non-empty username was loaded from env. */
export function initBotUsernameFromEnv(): boolean {
  const raw = process.env.BOT_USERNAME;
  if (raw == null) return false;
  const normalized = normalizeBotUsername(raw);
  if (!normalized) return false;
  setBotUsername(normalized);
  return true;
}

export async function resolveBotUsernameAtStartup(
  getMe: () => Promise<{ username?: string }>,
): Promise<void> {
  if (!hasBotUsername()) {
    initBotUsernameFromEnv();
  }

  if (!hasBotUsername()) {
    try {
      const me = await getMe();
      if (me.username) {
        setBotUsername(me.username);
      }
    } catch (err) {
      console.warn('Could not resolve bot username from getMe():', err);
    }
  }

  if (!hasBotUsername()) {
    console.warn(
      'BOT_USERNAME is not configured and getMe() returned no username; external share links will be hidden.',
    );
  }
}

export function clearBotUsernameForTests(): void {
  botUsername = '';
}
