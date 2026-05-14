import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';

// Import namespaces EN
import enCommon from '~/locales/en/common.json';
import enHome from '~/locales/en/home.json';
import enProject from '~/locales/en/project.json';
import enCharacters from '~/locales/en/characters.json';
import enStory from '~/locales/en/story.json';
import enAssets from '~/locales/en/assets.json';
import enGeneration from '~/locales/en/generation.json';
import enWarnings from '~/locales/en/warnings.json';
import enVersions from '~/locales/en/versions.json';
import enExports from '~/locales/en/exports.json';
import enSettings from '~/locales/en/settings.json';

// Import namespaces FR
import frCommon from '~/locales/fr/common.json';
import frHome from '~/locales/fr/home.json';
import frProject from '~/locales/fr/project.json';
import frCharacters from '~/locales/fr/characters.json';
import frStory from '~/locales/fr/story.json';
import frAssets from '~/locales/fr/assets.json';
import frGeneration from '~/locales/fr/generation.json';
import frWarnings from '~/locales/fr/warnings.json';
import frVersions from '~/locales/fr/versions.json';
import frExports from '~/locales/fr/exports.json';
import frSettings from '~/locales/fr/settings.json';

export const resources = {
  en: {
    common: enCommon,
    home: enHome,
    project: enProject,
    characters: enCharacters,
    story: enStory,
    assets: enAssets,
    generation: enGeneration,
    warnings: enWarnings,
    versions: enVersions,
    exports: enExports,
    settings: enSettings,
  },
  fr: {
    common: frCommon,
    home: frHome,
    project: frProject,
    characters: frCharacters,
    story: frStory,
    assets: frAssets,
    generation: frGeneration,
    warnings: frWarnings,
    versions: frVersions,
    exports: frExports,
    settings: frSettings,
  },
} as const;

export const supportedLanguages = ['en', 'fr'] as const;
export type SupportedLanguage = typeof supportedLanguages[number];

export function initI18n() {
  return i18n
    .use(LanguageDetector)
    .use(initReactI18next)
    .init({
      resources,
      fallbackLng: 'en',
      supportedLngs: supportedLanguages,
      defaultNS: 'common',
      ns: [
        'common',
        'home',
        'project',
        'characters',
        'story',
        'assets',
        'generation',
        'warnings',
        'versions',
        'exports',
        'settings',
      ],
      interpolation: {
        escapeValue: false,
      },
      detection: {
        order: ['localStorage', 'navigator', 'htmlTag'],
        caches: ['localStorage'],
        lookupLocalStorage: 'kuti-language',
      },
    });
}
