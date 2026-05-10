import { Translations } from "./types";

// Polski — partial translation. Untranslated keys auto-fallback to English
// via i18n.t().
const pl = {
  meta: { name: "Polish", code: "pl", dir: "ltr" },
  common: {
    save: "Zapisz", cancel: "Anuluj", continue: "Dalej", back: "Wstecz", close: "Zamknij",
    open: "Otwórz", refresh: "Odśwież", done: "Gotowe", confirm: "Potwierdź", submit: "Wyślij",
    loading: "Ładowanie…", error: "Coś poszło nie tak", retry: "Spróbuj ponownie", gotIt: "Rozumiem",
  },
  home: {
    install: "Zainstaluj", earlyAccess: "Wczesny dostęp",
    heroTitle1: "Znajdź lepsze oferty.",
    heroTitle2: "Ćwicz rozmowy.",
    heroTitle3: "Szybciej znajdź pracę.",
    heroSub: "Twój asystent kariery AI — trzy przyjazne awatary prowadzą Cię od CV do oferty.",
    chooseAvatar: "Wybierz awatara",
    noSubscription: "Brak subskrypcji · Płatność za użycie",
    startWithAvatar: "Zacznij z awatarem",
    tapToExplore: "Dotknij karty aby odkryć",
    startWith: "Zacznij z {name}",
  },
  lang: { title: "Wybierz język", sub: "Natychmiastowe tłumaczenie aplikacji" },
  avatars: {
    maya: { name: "Maya", role: "Wyszukiwarka pracy" },
    sofia: { name: "Sofia", role: "Trener rozmów" },
    aria: { name: "Aria", role: "Trener kariery" },
  },
  meetAvatars: { label: "Wybierz", title: "Poznaj swoje awatary", sub: "Trzy przyjazne AI, każde z jasną rolą." },
  chat: {
    placeholder: "Napisz wiadomość…", send: "Wyślij", listening: "Słucham…", speakReply: "Czytaj odpowiedzi na głos", micPermission: "Zezwól na dostęp do mikrofonu", typing: "pisze…",
  },
  account: {
    signupTitle: "Utwórz konto", signupSub: "Spersonalizowana pomoc — start w 30 sekund.",
    loginTitle: "Witaj ponownie", loginSub: "Zaloguj się aby kontynuować.",
    signupTab: "Rejestracja", loginTab: "Logowanie",
    namePh: "Twoje imię", emailPh: "Adres email", passwordPh: "Hasło (min. 6 znaków)",
    createAccount: "Utwórz konto", logIn: "Zaloguj się",
    fillAll: "Wypełnij wszystkie pola.", signupFailed: "Nie udało się utworzyć konta.", loginFailed: "Błędny email lub hasło.",
  },
  profile: {
    title: "Twój profil", step: "Krok",
    s1: "Cele", s2: "Doświadczenie", s3: "Umiejętności", s4: "O Tobie",
    targetRole: "Wymarzona praca", location: "Preferowana lokalizacja", remote: "Tryb pracy",
    salaryMin: "Min. wynagrodzenie (£/rok)", salaryMax: "Maks. wynagrodzenie (£/rok)",
    availability: "Dostępność", seniority: "Poziom doświadczenia", years: "Lata doświadczenia",
    experience: "Poprzednie doświadczenie", education: "Wykształcenie", qualifications: "Kwalifikacje",
    skills: "Kluczowe umiejętności", languages: "Języki",
    industries: "Preferowane branże", industriesAvoid: "Branże do unikania",
    strengths: "Mocne strony", weaknesses: "Słabe strony",
    cvText: "CV (wklej tekst)", cvPaste: "Wklej swoje CV tutaj…", cvFilename: "Nazwa pliku CV",
    notes: "Dodatkowe notatki", notesPh: "Coś jeszcze powinniśmy wiedzieć?",
    savedTip: "Twój profil jest szyfrowany i służy tylko do personalizacji.",
    saveAndExit: "Zapisz i wyjdź", next: "Dalej", finish: "Zakończ",
    signInFirst: "Najpierw się zaloguj.",
  },
  footer: { privacy: "Polityka prywatności", terms: "Warunki", deletion: "Usuń dane", cookies: "Pliki cookie" },
} as unknown as Translations;

export default pl;
