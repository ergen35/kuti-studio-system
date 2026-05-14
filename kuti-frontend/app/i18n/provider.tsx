import { useEffect, useState, type ReactNode } from 'react';
import { I18nextProvider } from 'react-i18next';
import i18n from 'i18next';
import { initI18n } from './config';

let initialized = false;

interface I18nProviderProps {
  children: ReactNode;
}

export function I18nProvider({ children }: I18nProviderProps) {
  const [ready, setReady] = useState(initialized);

  useEffect(() => {
    if (!initialized) {
      initI18n().then(() => {
        initialized = true;
        setReady(true);
      });
    }
  }, []);

  if (!ready) {
    return (
      <div className="grid min-h-screen place-items-center">
        <div className="rounded-[7px] border border-line bg-surface p-5">
          <strong className="text-ink">Loading...</strong>
        </div>
      </div>
    );
  }

  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
