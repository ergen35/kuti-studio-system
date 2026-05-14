import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';
import { Button } from '~/components/ui';
import type { SupportedLanguage } from '~/i18n';

const languages: { code: SupportedLanguage; label: string; flag: string }[] = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
];

export function LanguageSwitcher() {
  const { i18n, t } = useTranslation('common');
  const current = i18n.language as SupportedLanguage;

  const toggle = () => {
    const next = current === 'en' ? 'fr' : 'en';
    void i18n.changeLanguage(next);
  };

  const currentLang = languages.find((l) => l.code === current) || languages[0];
  const nextLang = languages.find((l) => l.code !== current) || languages[1];

  return (
    <Button variant="ghost" onClick={toggle} title={`${t('nav.switchLanguage')} (${nextLang.code.toUpperCase()})`}>
      <Languages size={16} />
      <span className="text-xs">{currentLang.code.toUpperCase()}</span>
    </Button>
  );
}
