// ============================================
// AFRICAN PRONUNCIATION GUIDE
// Rewrites difficult African words into phonetic
// versions BEFORE sending to FAL Kokoro TTS
// ============================================

export const PRONUNCIATION_CORRECTIONS: Record<string, string> = {
  // South African
  Ramaphosa: "Ra-ma-PO-sa",
  Eskom: "ES-kom",
  Mzansi: "mZAN-si",
  Tshwane: "SHWAA-neh",
  Johannesburg: "jo-HAN-ess-burg",
  Khayelitsha: "KAY-yeh-LEET-sha",
  Bafana: "ba-FA-na",
  Springboks: "SPRING-boks",
  Ubuntu: "oo-BOON-too",
  Zuma: "ZOO-ma",
  Malema: "ma-LEH-ma",
  Limpopo: "lim-PO-po",
  Mpumalanga: "mm-poo-ma-LANG-ga",
  KwaZulu: "kwa-ZOO-loo",
  Soweto: "so-WEH-to",
  Pretoria: "preh-TOR-ia",
  Sandton: "SAND-ton",
  Cyril: "SIR-il",
  Thabo: "TA-bo",
  Naledi: "na-LEH-di",
  Gwede: "GWEH-deh",
  Mantashe: "man-TA-sheh",
  Nkandla: "n-KAND-la",
  Bheki: "BEH-ki",
  Cele: "SEH-leh",
  Pravin: "pra-VEEN",
  Gordhan: "GOR-dan",
  Siyabonga: "see-ya-BONG-ga",
  Ngiyabonga: "n-gee-ya-BONG-ga",
  Sawubona: "sa-woo-BO-na",
  Haibo: "HY-bo",
  Umhlanga: "oom-SHLAN-ga",

  // Nigerian
  Tinubu: "ti-NOO-boo",
  Okonkwo: "oh-KONK-wo",
  Buhari: "boo-HA-ri",
  Abuja: "a-BOO-ja",
  Obasanjo: "oh-ba-SAN-jo",
  Nollywood: "NOL-ee-wood",
  Naira: "NYE-ra",
  Oshodi: "oh-SHO-di",
  Dangote: "dan-GO-teh",
  Osinbajo: "oh-sin-BA-jo",
  Fashola: "fa-SHO-la",
  Abubakar: "a-boo-BA-kar",
  Emefiele: "eh-meh-FEE-leh",
  Sanusi: "sa-NOO-si",

  // Kenyan / East African
  Nairobi: "ny-ROH-bi",
  Ruto: "ROO-to",
  Uhuru: "oo-HOO-roo",
  Kibera: "ki-BEH-ra",
  Odinga: "oh-DING-ga",
  Westlands: "WEST-lands",
  Kenyatta: "ken-YA-ta",
  Machakos: "ma-CHA-kos",
  Mombasa: "mom-BA-sa",
  Kisumu: "ki-SOO-moo",

  // Ghanaian
  Accra: "AK-ra",
  Kumasi: "koo-MA-si",
  Mahama: "ma-HA-ma",
  "Akufo-Addo": "a-KOO-fo A-do",
  Kantanka: "kan-TAN-ka",
  Tamale: "ta-MA-leh",

  // Pan-African terms
  ECOWAS: "EE-ko-was",
  SADC: "SAR-deck",
  Kilimanjaro: "kil-ih-man-JA-ro",
  Serengeti: "seh-ren-GEH-ti",
  Sahara: "sa-HA-ra",
  Mogadishu: "mo-ga-DEE-shoo",
  Kigali: "ki-GA-li",
  Harare: "ha-RA-reh",
  Lusaka: "loo-SA-ka",
  Maputo: "ma-POO-to",
  Windhoek: "VINT-hook",
  Gaborone: "ha-bo-RO-neh",
};

/**
 * Apply pronunciation corrections before sending to TTS.
 * Replaces whole words only (case-insensitive).
 */
export function applyPronunciationCorrections(script: string): string {
  let corrected = script;
  for (const [word, phonetic] of Object.entries(PRONUNCIATION_CORRECTIONS)) {
    const escaped = word.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
    const regex = new RegExp(`\\b${escaped}\\b`, "gi");
    corrected = corrected.replace(regex, phonetic);
  }
  return corrected;
}
