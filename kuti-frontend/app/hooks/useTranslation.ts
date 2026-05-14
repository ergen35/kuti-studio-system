import { useTranslation as useTranslationBase } from 'react-i18next';

export function useTranslation(ns?: string | string[]) {
  return useTranslationBase(ns);
}

export { Trans } from 'react-i18next';
