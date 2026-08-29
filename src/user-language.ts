import { Language } from './types.js';

const userLanguages = new Map<number, Language>();

export function setUserLanguage(userId: number, language: Language): void {
  userLanguages.set(userId, language);
}

export function getUserLanguage(userId: number): Language {
  return userLanguages.get(userId) ?? 'uz';
}

export function resolveMatchLanguage(entity: { language?: Language }): Language {
  return entity.language ?? 'uz';
}
