import type { ParseKeys } from 'i18next'
import enCommon from './en/common.json'
import plCommon from './pl/common.json'

export const resources = {
  pl: { common: plCommon },
  en: { common: enCommon },
} as const

export const supportedLanguages = ['pl', 'en'] as const
export type SupportedLanguage = (typeof supportedLanguages)[number]

/** Any valid translation key, e.g. 'appName' | 'navigation.home' */
export type TranslationKey = ParseKeys<'common'>
