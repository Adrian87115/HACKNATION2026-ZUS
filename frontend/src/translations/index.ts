import plCommon from './pl/common.json'

export const resources = {
  pl: { common: plCommon },
} as const

/** Dot-paths to every leaf string in a translation object, e.g. 'appName' | 'navigation.home' */
type KeyPaths<T> = {
  [K in keyof T & string]: T[K] extends Record<string, unknown> ? `${K}.${KeyPaths<T[K]>}` : K
}[keyof T & string]

/** Any valid translation key — a plain string-literal union, so the editor can autocomplete it */
export type TranslationKey = KeyPaths<typeof plCommon>
