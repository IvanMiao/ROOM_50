type Locale = "en" | "zh";

type IntentTag =
  | "quietReading"
  | "communityConnection"
  | "loweredOrdering"
  | "movableFurniture";

type DynamicMessageKey =
  | "builtInSample"
  | "dimensionsUnknown"
  | "dimensionsLoading"
  | "uploadAria"
  | "toastSample"
  | "toastType"
  | "toastSize"
  | "toastUpload"
  | "toastCopyPrompt"
  | "toastDownload"
  | "toastCopyPage";

interface Room50I18n {
  readonly locale: Locale;
  defaultIntent(language?: Locale): string;
  tagLabel(tag: IntentTag, language?: Locale): string;
  t(key: DynamicMessageKey, language?: Locale): string;
}

interface LocaleChangeDetail {
  locale: Locale;
  previousLocale: Locale;
}

interface Window {
  ROOM50_I18N: Room50I18n;
}

interface WindowEventMap {
  "room50:localechange": CustomEvent<LocaleChangeDetail>;
}
