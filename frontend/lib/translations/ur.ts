import { Translations } from "./types";

// اردو — Urdu (RTL). Partial translation; untranslated keys fall back to English.
const ur = {
  meta: { name: "Urdu", code: "ur", dir: "rtl" },
  common: {
    save: "محفوظ کریں", cancel: "منسوخ کریں", continue: "جاری رکھیں", back: "پیچھے", close: "بند کریں",
    open: "کھولیں", refresh: "تازہ کریں", done: "ہو گیا", confirm: "تصدیق کریں", submit: "بھیجیں",
    loading: "لوڈ ہو رہا ہے…", error: "کچھ غلط ہو گیا", retry: "دوبارہ کوشش کریں", gotIt: "سمجھ گیا",
  },
  home: {
    install: "انسٹال کریں", earlyAccess: "ابتدائی رسائی",
    heroTitle1: "بہتر نوکریاں تلاش کریں۔",
    heroTitle2: "انٹرویو کی مشق کریں۔",
    heroTitle3: "تیزی سے نوکری حاصل کریں۔",
    heroSub: "آپ کا AI کیریئر اسسٹنٹ — تین دوستانہ اوتار CV سے آفر تک رہنمائی کرتے ہیں۔",
    chooseAvatar: "اپنا اوتار منتخب کریں",
    noSubscription: "کوئی سبسکرپشن نہیں · فی استعمال ادائیگی",
    startWithAvatar: "اپنے اوتار سے شروع کریں",
    tapToExplore: "دریافت کرنے کے لیے کوئی بھی کارڈ ٹیپ کریں",
    startWith: "{name} کے ساتھ شروع کریں",
  },
  lang: { title: "اپنی زبان منتخب کریں", sub: "ایپ کا فوری ترجمہ" },
  avatars: {
    maya: { name: "Maya", role: "نوکری تلاش کرنے والی" },
    sofia: { name: "Sofia", role: "انٹرویو کوچ" },
    aria: { name: "Aria", role: "کیریئر کوچ" },
  },
  meetAvatars: { label: "منتخب کریں", title: "اپنے اوتاروں سے ملیں", sub: "تین دوستانہ AIs، ہر ایک واضح کردار کے ساتھ۔" },
  chat: {
    placeholder: "پیغام لکھیں…", send: "بھیجیں", listening: "سن رہا ہوں…", speakReply: "جوابات بلند آواز سے پڑھیں", micPermission: "مائیکروفون تک رسائی کی اجازت دیں", typing: "ٹائپ کر رہا ہے…",
  },
  account: {
    signupTitle: "اپنا اکاؤنٹ بنائیں", signupSub: "ذاتی کیریئر مدد — 30 سیکنڈ میں شروع۔",
    loginTitle: "خوش آمدید", loginSub: "جاری رکھنے کے لیے سائن ان کریں۔",
    signupTab: "سائن اپ", loginTab: "لاگ ان",
    namePh: "آپ کا نام", emailPh: "ای میل پتہ", passwordPh: "پاس ورڈ (کم از کم 6 حروف)",
    createAccount: "اکاؤنٹ بنائیں", logIn: "لاگ ان",
    fillAll: "براہ کرم تمام فیلڈز پُر کریں۔", signupFailed: "اکاؤنٹ نہیں بنایا جا سکا۔", loginFailed: "غلط ای میل یا پاس ورڈ۔",
  },
  profile: {
    title: "آپ کا پروفائل", step: "مرحلہ",
    s1: "اہداف", s2: "تجربہ", s3: "مہارتیں", s4: "آپ کے بارے میں",
    targetRole: "مطلوبہ نوکری", location: "پسندیدہ مقام", remote: "کام کا انداز",
    salaryMin: "کم از کم تنخواہ (£/سال)", salaryMax: "زیادہ سے زیادہ تنخواہ (£/سال)",
    availability: "دستیابی", seniority: "تجربے کی سطح", years: "تجربے کے سال",
    experience: "سابقہ تجربہ", education: "تعلیم", qualifications: "اہلیتیں",
    skills: "کلیدی مہارتیں", languages: "زبانیں",
    industries: "پسندیدہ صنعتیں", industriesAvoid: "وہ صنعتیں جن سے بچنا ہے",
    strengths: "خوبیاں", weaknesses: "کمزوریاں",
    cvText: "CV (متن چسپاں کریں)", cvPaste: "اپنا CV یہاں چسپاں کریں…", cvFilename: "CV فائل کا نام",
    notes: "اضافی نوٹس", notesPh: "کچھ اور جو ہمیں جاننا چاہیے؟",
    savedTip: "آپ کا پروفائل خفیہ ہے اور صرف ذاتی نوعیت کے جوابات کے لیے استعمال ہوتا ہے۔",
    saveAndExit: "محفوظ کریں اور باہر نکلیں", next: "اگلا", finish: "مکمل کریں",
    signInFirst: "براہ کرم پہلے سائن ان کریں۔",
  },
  footer: { privacy: "رازداری", terms: "شرائط", deletion: "ڈیٹا حذف کریں", cookies: "کوکیز" },
} as unknown as Translations;

export default ur;
