// ============================================
// SERIES STUDIO — every language we can actually speak
// ============================================
// Generated from the live text-to-speech catalogue, then filtered to the
// locales that have BOTH a female and a male voice — a drama needs at least
// two people who do not sound like each other.
//
// Only languages that can be SPOKEN are listed. A creator picking a language
// here gets dialogue written in it, performed in it, and lip-synced to it.
// Nothing in this list is aspirational.
//
// Worth knowing: isiXhosa, Sesotho, Setswana, Sepedi, Xitsonga, siSwati,
// Tshivenda and isiNdebele have no synthetic voice from any provider we can
// reach, so they are deliberately absent rather than listed and broken. When
// a voice exists, adding it here is a one-line change.

export interface SeriesLocale {
  id: string;
  label: string;
  group: "South Africa" | "Africa" | "World";
  /** Full voice names, used directly by the speech engine. */
  female: string;
  male: string;
}

export const SERIES_LOCALES: SeriesLocale[] = [
  { id: "af-ZA", label: "Afrikaans", group: "South Africa", female: "af-ZA-AdriNeural", male: "af-ZA-WillemNeural" },
  { id: "en-ZA", label: "South African English", group: "South Africa", female: "en-ZA-LeahNeural", male: "en-ZA-LukeNeural" },
  { id: "zu-ZA", label: "isiZulu", group: "South Africa", female: "zu-ZA-ThandoNeural", male: "zu-ZA-ThembaNeural" },
  { id: "am-ET", label: "Amharic — Ethiopia", group: "Africa", female: "am-ET-MekdesNeural", male: "am-ET-AmehaNeural" },
  { id: "ar-DZ", label: "Arabic — Algeria", group: "Africa", female: "ar-DZ-AminaNeural", male: "ar-DZ-IsmaelNeural" },
  { id: "ar-EG", label: "Arabic — Egypt", group: "Africa", female: "ar-EG-SalmaNeural", male: "ar-EG-ShakirNeural" },
  { id: "ar-LY", label: "Arabic — Libya", group: "Africa", female: "ar-LY-ImanNeural", male: "ar-LY-OmarNeural" },
  { id: "ar-MA", label: "Arabic — Morocco", group: "Africa", female: "ar-MA-MounaNeural", male: "ar-MA-JamalNeural" },
  { id: "ar-TN", label: "Arabic — Tunisia", group: "Africa", female: "ar-TN-ReemNeural", male: "ar-TN-HediNeural" },
  { id: "en-KE", label: "English — Kenya", group: "Africa", female: "en-KE-AsiliaNeural", male: "en-KE-ChilembaNeural" },
  { id: "en-NG", label: "English — Nigeria", group: "Africa", female: "en-NG-EzinneNeural", male: "en-NG-AbeoNeural" },
  { id: "en-TZ", label: "English — Tanzania", group: "Africa", female: "en-TZ-ImaniNeural", male: "en-TZ-ElimuNeural" },
  { id: "so-SO", label: "Somali — Somalia", group: "Africa", female: "so-SO-UbaxNeural", male: "so-SO-MuuseNeural" },
  { id: "sw-KE", label: "Swahili — Kenya", group: "Africa", female: "sw-KE-ZuriNeural", male: "sw-KE-RafikiNeural" },
  { id: "sw-TZ", label: "Swahili — Tanzania", group: "Africa", female: "sw-TZ-RehemaNeural", male: "sw-TZ-DaudiNeural" },
  { id: "sq-AL", label: "Albanian — Albania", group: "World", female: "sq-AL-AnilaNeural", male: "sq-AL-IlirNeural" },
  { id: "ar-BH", label: "Arabic — Bahrain", group: "World", female: "ar-BH-LailaNeural", male: "ar-BH-AliNeural" },
  { id: "ar-IQ", label: "Arabic — Iraq", group: "World", female: "ar-IQ-RanaNeural", male: "ar-IQ-BasselNeural" },
  { id: "ar-JO", label: "Arabic — Jordan", group: "World", female: "ar-JO-SanaNeural", male: "ar-JO-TaimNeural" },
  { id: "ar-KW", label: "Arabic — Kuwait", group: "World", female: "ar-KW-NouraNeural", male: "ar-KW-FahedNeural" },
  { id: "ar-LB", label: "Arabic — Lebanon", group: "World", female: "ar-LB-LaylaNeural", male: "ar-LB-RamiNeural" },
  { id: "ar-OM", label: "Arabic — Oman", group: "World", female: "ar-OM-AyshaNeural", male: "ar-OM-AbdullahNeural" },
  { id: "ar-QA", label: "Arabic — Qatar", group: "World", female: "ar-QA-AmalNeural", male: "ar-QA-MoazNeural" },
  { id: "ar-SA", label: "Arabic — Saudi Arabia", group: "World", female: "ar-SA-ZariyahNeural", male: "ar-SA-HamedNeural" },
  { id: "ar-SY", label: "Arabic — Syria", group: "World", female: "ar-SY-AmanyNeural", male: "ar-SY-LaithNeural" },
  { id: "ar-AE", label: "Arabic — United Arab Emirates", group: "World", female: "ar-AE-FatimaNeural", male: "ar-AE-HamdanNeural" },
  { id: "ar-YE", label: "Arabic — Yemen", group: "World", female: "ar-YE-MaryamNeural", male: "ar-YE-SalehNeural" },
  { id: "az-AZ", label: "Azerbaijani — Latin, Azerbaijan", group: "World", female: "az-AZ-BanuNeural", male: "az-AZ-BabekNeural" },
  { id: "bn-BD", label: "Bangla — Bangladesh", group: "World", female: "bn-BD-NabanitaNeural", male: "bn-BD-PradeepNeural" },
  { id: "bn-IN", label: "Bengali — India", group: "World", female: "bn-IN-TanishaaNeural", male: "bn-IN-BashkarNeural" },
  { id: "bs-BA", label: "Bosnian — Bosnia and Herzegovina", group: "World", female: "bs-BA-VesnaNeural", male: "bs-BA-GoranNeural" },
  { id: "bg-BG", label: "Bulgarian — Bulgaria", group: "World", female: "bg-BG-KalinaNeural", male: "bg-BG-BorislavNeural" },
  { id: "my-MM", label: "Burmese — Myanmar", group: "World", female: "my-MM-NilarNeural", male: "my-MM-ThihaNeural" },
  { id: "ca-ES", label: "Catalan", group: "World", female: "ca-ES-JoanaNeural", male: "ca-ES-EnricNeural" },
  { id: "zh-HK", label: "Chinese — Cantonese, Traditional", group: "World", female: "zh-HK-HiuGaaiNeural", male: "zh-HK-WanLungNeural" },
  { id: "zh-CN", label: "Chinese — Mandarin, Simplified", group: "World", female: "zh-CN-XiaoxiaoNeural", male: "zh-CN-YunjianNeural" },
  { id: "zh-TW", label: "Chinese — Taiwanese Mandarin, Traditional", group: "World", female: "zh-TW-HsiaoChenNeural", male: "zh-TW-YunJheNeural" },
  { id: "hr-HR", label: "Croatian — Croatia", group: "World", female: "hr-HR-GabrijelaNeural", male: "hr-HR-SreckoNeural" },
  { id: "cs-CZ", label: "Czech — Czechia", group: "World", female: "cs-CZ-VlastaNeural", male: "cs-CZ-AntoninNeural" },
  { id: "da-DK", label: "Danish — Denmark", group: "World", female: "da-DK-ChristelNeural", male: "da-DK-JeppeNeural" },
  { id: "nl-BE", label: "Dutch — Belgium", group: "World", female: "nl-BE-DenaNeural", male: "nl-BE-ArnaudNeural" },
  { id: "nl-NL", label: "Dutch — Netherlands", group: "World", female: "nl-NL-ColetteNeural", male: "nl-NL-MaartenNeural" },
  { id: "en-AU", label: "English — Australia", group: "World", female: "en-AU-NatashaNeural", male: "en-AU-WilliamMultilingualNeural" },
  { id: "en-CA", label: "English — Canada", group: "World", female: "en-CA-ClaraNeural", male: "en-CA-LiamNeural" },
  { id: "en-HK", label: "English — Hong Kong SAR", group: "World", female: "en-HK-YanNeural", male: "en-HK-SamNeural" },
  { id: "en-IN", label: "English — India", group: "World", female: "en-IN-NeerjaExpressiveNeural", male: "en-IN-PrabhatNeural" },
  { id: "en-IE", label: "English — Ireland", group: "World", female: "en-IE-EmilyNeural", male: "en-IE-ConnorNeural" },
  { id: "en-NZ", label: "English — New Zealand", group: "World", female: "en-NZ-MollyNeural", male: "en-NZ-MitchellNeural" },
  { id: "en-PH", label: "English — Philippines", group: "World", female: "en-PH-RosaNeural", male: "en-PH-JamesNeural" },
  { id: "en-SG", label: "English — Singapore", group: "World", female: "en-SG-LunaNeural", male: "en-SG-WayneNeural" },
  { id: "en-GB", label: "English — United Kingdom", group: "World", female: "en-GB-LibbyNeural", male: "en-GB-RyanNeural" },
  { id: "en-US", label: "English — United States", group: "World", female: "en-US-AvaNeural", male: "en-US-AndrewNeural" },
  { id: "et-EE", label: "Estonian — Estonia", group: "World", female: "et-EE-AnuNeural", male: "et-EE-KertNeural" },
  { id: "fil-PH", label: "Filipino — Philippines", group: "World", female: "fil-PH-BlessicaNeural", male: "fil-PH-AngeloNeural" },
  { id: "fi-FI", label: "Finnish — Finland", group: "World", female: "fi-FI-NooraNeural", male: "fi-FI-HarriNeural" },
  { id: "fr-BE", label: "French — Belgium", group: "World", female: "fr-BE-CharlineNeural", male: "fr-BE-GerardNeural" },
  { id: "fr-CA", label: "French — Canada", group: "World", female: "fr-CA-SylvieNeural", male: "fr-CA-ThierryNeural" },
  { id: "fr-FR", label: "French — France", group: "World", female: "fr-FR-VivienneMultilingualNeural", male: "fr-FR-RemyMultilingualNeural" },
  { id: "fr-CH", label: "French — Switzerland", group: "World", female: "fr-CH-ArianeNeural", male: "fr-CH-FabriceNeural" },
  { id: "gl-ES", label: "Galician", group: "World", female: "gl-ES-SabelaNeural", male: "gl-ES-RoiNeural" },
  { id: "ka-GE", label: "Georgian — Georgia", group: "World", female: "ka-GE-EkaNeural", male: "ka-GE-GiorgiNeural" },
  { id: "de-AT", label: "German — Austria", group: "World", female: "de-AT-IngridNeural", male: "de-AT-JonasNeural" },
  { id: "de-DE", label: "German — Germany", group: "World", female: "de-DE-SeraphinaMultilingualNeural", male: "de-DE-FlorianMultilingualNeural" },
  { id: "de-CH", label: "German — Switzerland", group: "World", female: "de-CH-LeniNeural", male: "de-CH-JanNeural" },
  { id: "el-GR", label: "Greek — Greece", group: "World", female: "el-GR-AthinaNeural", male: "el-GR-NestorasNeural" },
  { id: "gu-IN", label: "Gujarati — India", group: "World", female: "gu-IN-DhwaniNeural", male: "gu-IN-NiranjanNeural" },
  { id: "he-IL", label: "Hebrew — Israel", group: "World", female: "he-IL-HilaNeural", male: "he-IL-AvriNeural" },
  { id: "hi-IN", label: "Hindi — India", group: "World", female: "hi-IN-SwaraNeural", male: "hi-IN-MadhurNeural" },
  { id: "hu-HU", label: "Hungarian — Hungary", group: "World", female: "hu-HU-NoemiNeural", male: "hu-HU-TamasNeural" },
  { id: "is-IS", label: "Icelandic — Iceland", group: "World", female: "is-IS-GudrunNeural", male: "is-IS-GunnarNeural" },
  { id: "id-ID", label: "Indonesian — Indonesia", group: "World", female: "id-ID-GadisNeural", male: "id-ID-ArdiNeural" },
  { id: "iu-Latn-CA", label: "Inuktitut — Latin, Canada", group: "World", female: "iu-Latn-CA-SiqiniqNeural", male: "iu-Latn-CA-TaqqiqNeural" },
  { id: "iu-Cans-CA", label: "Inuktitut — Syllabics, Canada", group: "World", female: "iu-Cans-CA-SiqiniqNeural", male: "iu-Cans-CA-TaqqiqNeural" },
  { id: "ga-IE", label: "Irish — Ireland", group: "World", female: "ga-IE-OrlaNeural", male: "ga-IE-ColmNeural" },
  { id: "it-IT", label: "Italian — Italy", group: "World", female: "it-IT-ElsaNeural", male: "it-IT-GiuseppeMultilingualNeural" },
  { id: "ja-JP", label: "Japanese — Japan", group: "World", female: "ja-JP-NanamiNeural", male: "ja-JP-KeitaNeural" },
  { id: "jv-ID", label: "Javanese — Latin, Indonesia", group: "World", female: "jv-ID-SitiNeural", male: "jv-ID-DimasNeural" },
  { id: "kn-IN", label: "Kannada — India", group: "World", female: "kn-IN-SapnaNeural", male: "kn-IN-GaganNeural" },
  { id: "kk-KZ", label: "Kazakh — Kazakhstan", group: "World", female: "kk-KZ-AigulNeural", male: "kk-KZ-DauletNeural" },
  { id: "km-KH", label: "Khmer — Cambodia", group: "World", female: "km-KH-SreymomNeural", male: "km-KH-PisethNeural" },
  { id: "ko-KR", label: "Korean — Korea", group: "World", female: "ko-KR-SunHiNeural", male: "ko-KR-HyunsuMultilingualNeural" },
  { id: "lo-LA", label: "Lao — Laos", group: "World", female: "lo-LA-KeomanyNeural", male: "lo-LA-ChanthavongNeural" },
  { id: "lv-LV", label: "Latvian — Latvia", group: "World", female: "lv-LV-EveritaNeural", male: "lv-LV-NilsNeural" },
  { id: "lt-LT", label: "Lithuanian — Lithuania", group: "World", female: "lt-LT-OnaNeural", male: "lt-LT-LeonasNeural" },
  { id: "mk-MK", label: "Macedonian — North Macedonia", group: "World", female: "mk-MK-MarijaNeural", male: "mk-MK-AleksandarNeural" },
  { id: "ms-MY", label: "Malay — Malaysia", group: "World", female: "ms-MY-YasminNeural", male: "ms-MY-OsmanNeural" },
  { id: "ml-IN", label: "Malayalam — India", group: "World", female: "ml-IN-SobhanaNeural", male: "ml-IN-MidhunNeural" },
  { id: "mt-MT", label: "Maltese — Malta", group: "World", female: "mt-MT-GraceNeural", male: "mt-MT-JosephNeural" },
  { id: "mr-IN", label: "Marathi — India", group: "World", female: "mr-IN-AarohiNeural", male: "mr-IN-ManoharNeural" },
  { id: "mn-MN", label: "Mongolian — Mongolia", group: "World", female: "mn-MN-YesuiNeural", male: "mn-MN-BataaNeural" },
  { id: "ne-NP", label: "Nepali — Nepal", group: "World", female: "ne-NP-HemkalaNeural", male: "ne-NP-SagarNeural" },
  { id: "nb-NO", label: "Norwegian Bokmål — Norway", group: "World", female: "nb-NO-PernilleNeural", male: "nb-NO-FinnNeural" },
  { id: "ps-AF", label: "Pashto — Afghanistan", group: "World", female: "ps-AF-LatifaNeural", male: "ps-AF-GulNawazNeural" },
  { id: "fa-IR", label: "Persian — Iran", group: "World", female: "fa-IR-DilaraNeural", male: "fa-IR-FaridNeural" },
  { id: "pl-PL", label: "Polish — Poland", group: "World", female: "pl-PL-ZofiaNeural", male: "pl-PL-MarekNeural" },
  { id: "pt-BR", label: "Portuguese — Brazil", group: "World", female: "pt-BR-ThalitaMultilingualNeural", male: "pt-BR-AntonioNeural" },
  { id: "pt-PT", label: "Portuguese — Portugal", group: "World", female: "pt-PT-RaquelNeural", male: "pt-PT-DuarteNeural" },
  { id: "ro-RO", label: "Romanian — Romania", group: "World", female: "ro-RO-AlinaNeural", male: "ro-RO-EmilNeural" },
  { id: "ru-RU", label: "Russian — Russia", group: "World", female: "ru-RU-SvetlanaNeural", male: "ru-RU-DmitryNeural" },
  { id: "sr-RS", label: "Serbian — Cyrillic, Serbia", group: "World", female: "sr-RS-SophieNeural", male: "sr-RS-NicholasNeural" },
  { id: "si-LK", label: "Sinhala — Sri Lanka", group: "World", female: "si-LK-ThiliniNeural", male: "si-LK-SameeraNeural" },
  { id: "sk-SK", label: "Slovak — Slovakia", group: "World", female: "sk-SK-ViktoriaNeural", male: "sk-SK-LukasNeural" },
  { id: "sl-SI", label: "Slovenian — Slovenia", group: "World", female: "sl-SI-PetraNeural", male: "sl-SI-RokNeural" },
  { id: "es-AR", label: "Spanish — Argentina", group: "World", female: "es-AR-ElenaNeural", male: "es-AR-TomasNeural" },
  { id: "es-BO", label: "Spanish — Bolivia", group: "World", female: "es-BO-SofiaNeural", male: "es-BO-MarceloNeural" },
  { id: "es-CL", label: "Spanish — Chile", group: "World", female: "es-CL-CatalinaNeural", male: "es-CL-LorenzoNeural" },
  { id: "es-CO", label: "Spanish — Colombia", group: "World", female: "es-CO-SalomeNeural", male: "es-CO-GonzaloNeural" },
  { id: "es-CR", label: "Spanish — Costa Rica", group: "World", female: "es-CR-MariaNeural", male: "es-CR-JuanNeural" },
  { id: "es-CU", label: "Spanish — Cuba", group: "World", female: "es-CU-BelkysNeural", male: "es-CU-ManuelNeural" },
  { id: "es-DO", label: "Spanish — Dominican Republic", group: "World", female: "es-DO-RamonaNeural", male: "es-DO-EmilioNeural" },
  { id: "es-EC", label: "Spanish — Ecuador", group: "World", female: "es-EC-AndreaNeural", male: "es-EC-LuisNeural" },
  { id: "es-SV", label: "Spanish — El Salvador", group: "World", female: "es-SV-LorenaNeural", male: "es-SV-RodrigoNeural" },
  { id: "es-GQ", label: "Spanish — Equatorial Guinea", group: "World", female: "es-GQ-TeresaNeural", male: "es-GQ-JavierNeural" },
  { id: "es-GT", label: "Spanish — Guatemala", group: "World", female: "es-GT-MartaNeural", male: "es-GT-AndresNeural" },
  { id: "es-HN", label: "Spanish — Honduras", group: "World", female: "es-HN-KarlaNeural", male: "es-HN-CarlosNeural" },
  { id: "es-MX", label: "Spanish — Mexico", group: "World", female: "es-MX-DaliaNeural", male: "es-MX-JorgeNeural" },
  { id: "es-NI", label: "Spanish — Nicaragua", group: "World", female: "es-NI-YolandaNeural", male: "es-NI-FedericoNeural" },
  { id: "es-PA", label: "Spanish — Panama", group: "World", female: "es-PA-MargaritaNeural", male: "es-PA-RobertoNeural" },
  { id: "es-PY", label: "Spanish — Paraguay", group: "World", female: "es-PY-TaniaNeural", male: "es-PY-MarioNeural" },
  { id: "es-PE", label: "Spanish — Peru", group: "World", female: "es-PE-CamilaNeural", male: "es-PE-AlexNeural" },
  { id: "es-PR", label: "Spanish — Puerto Rico", group: "World", female: "es-PR-KarinaNeural", male: "es-PR-VictorNeural" },
  { id: "es-ES", label: "Spanish — Spain", group: "World", female: "es-ES-XimenaNeural", male: "es-ES-AlvaroNeural" },
  { id: "es-US", label: "Spanish — United States", group: "World", female: "es-US-PalomaNeural", male: "es-US-AlonsoNeural" },
  { id: "es-UY", label: "Spanish — Uruguay", group: "World", female: "es-UY-ValentinaNeural", male: "es-UY-MateoNeural" },
  { id: "es-VE", label: "Spanish — Venezuela", group: "World", female: "es-VE-PaolaNeural", male: "es-VE-SebastianNeural" },
  { id: "su-ID", label: "Sundanese — Indonesia", group: "World", female: "su-ID-TutiNeural", male: "su-ID-JajangNeural" },
  { id: "sv-SE", label: "Swedish — Sweden", group: "World", female: "sv-SE-SofieNeural", male: "sv-SE-MattiasNeural" },
  { id: "ta-IN", label: "Tamil — India", group: "World", female: "ta-IN-PallaviNeural", male: "ta-IN-ValluvarNeural" },
  { id: "ta-MY", label: "Tamil — Malaysia", group: "World", female: "ta-MY-KaniNeural", male: "ta-MY-SuryaNeural" },
  { id: "ta-SG", label: "Tamil — Singapore", group: "World", female: "ta-SG-VenbaNeural", male: "ta-SG-AnbuNeural" },
  { id: "ta-LK", label: "Tamil — Sri Lanka", group: "World", female: "ta-LK-SaranyaNeural", male: "ta-LK-KumarNeural" },
  { id: "te-IN", label: "Telugu — India", group: "World", female: "te-IN-ShrutiNeural", male: "te-IN-MohanNeural" },
  { id: "th-TH", label: "Thai — Thailand", group: "World", female: "th-TH-PremwadeeNeural", male: "th-TH-NiwatNeural" },
  { id: "tr-TR", label: "Turkish — Türkiye", group: "World", female: "tr-TR-EmelNeural", male: "tr-TR-AhmetNeural" },
  { id: "uk-UA", label: "Ukrainian — Ukraine", group: "World", female: "uk-UA-PolinaNeural", male: "uk-UA-OstapNeural" },
  { id: "ur-IN", label: "Urdu — India", group: "World", female: "ur-IN-GulNeural", male: "ur-IN-SalmanNeural" },
  { id: "ur-PK", label: "Urdu — Pakistan", group: "World", female: "ur-PK-UzmaNeural", male: "ur-PK-AsadNeural" },
  { id: "uz-UZ", label: "Uzbek — Latin, Uzbekistan", group: "World", female: "uz-UZ-MadinaNeural", male: "uz-UZ-SardorNeural" },
  { id: "vi-VN", label: "Vietnamese — Vietnam", group: "World", female: "vi-VN-HoaiMyNeural", male: "vi-VN-NamMinhNeural" },
  { id: "cy-GB", label: "Welsh — United Kingdom", group: "World", female: "cy-GB-NiaNeural", male: "cy-GB-AledNeural" },
];

const BY_ID = new Map(SERIES_LOCALES.map((l) => [l.id, l]));

export function localeById(id: string): SeriesLocale | undefined {
  return BY_ID.get(id);
}

/** Falls back to South African English — the safest default for this audience. */
export function localeOrDefault(id: string | null | undefined): SeriesLocale {
  return BY_ID.get(id || "") || BY_ID.get("en-ZA") || SERIES_LOCALES[0];
}

export const LOCALE_GROUPS = ["South Africa", "Africa", "World"] as const;
