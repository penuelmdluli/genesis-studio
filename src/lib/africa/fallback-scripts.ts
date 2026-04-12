// ============================================
// AFRICAN FALLBACK SCRIPT TEMPLATES
// Used when Claude API fails or validation fails 3x
// ============================================

/**
 * Proven fallback templates per language.
 * Each template takes a topic and produces a valid, authentic script.
 */
export const FALLBACK_TEMPLATES: Record<string, (topic: string) => string> = {
  "en-ZA": (topic: string) =>
    `Yoh South Africa! This is big news right now.

${topic}. And it is changing things here in Mzansi.

Here is what you need to know. This affects all of us. From Joburg to Cape Town, from Durban to Pretoria. Every South African needs to hear this today.

The situation is serious. But we are watching. We are staying informed. Because that is what Mzansi does.

Drop your thoughts below. What do you think about this? Follow us for more South African news every day. Stay sharp Mzansi. Sharp sharp.`.trim(),

  "en-NG": (topic: string) =>
    `Nigerians! E don happen again o!

${topic}. This is the news taking over Lagos right now.

Abeg listen well well. This one concern all of us. From Eko to Abuja, from Kano to Port Harcourt. Every Nigerian needs to know this today.

No be small thing. Matter don burst. We dey watch how e go play out.

Drop your comment below. What una think? Follow for more Nigerian news every day. Nigeria we hail thee!`.trim(),

  sw: (topic: string) =>
    `Habari Afrika! Leo tuna habari muhimu sana.

${topic}. Hii ni habari inayoathiri Afrika yetu yote.

Hapa ndipo mambo halisi. Kutoka Nairobi hadi Dar es Salaam. Kutoka Kampala hadi Kigali. Afrika inajua ukweli.

Hali ni nzito. Lakini tunashikilia pamoja. Kwa sababu Afrika ni nguvu.

Acha maoni yako hapa chini. Unafikiria nini? Fuata kwa habari zaidi kila siku. Asante Afrika.`.trim(),

  zu: (topic: string) =>
    `Sawubona Mzansi! Indaba enkulu namuhla.

${topic}. Le ndaba ithinta thina sonke.

Yebo, kusukela eGoli kuya eThekwini, kusukela ePitoli kuya eKapa. Bonke abantu baseNingizimu Afrika kumele bazwe lokhu namuhla.

Isimo sibi kodwa siyaqhubeka. Ngoba uMzansi awulali.

Shiya imibono yakho ngezansi. Follow ukuze uthole izindaba ezintsha. Siyabonga Mzansi.`.trim(),

  "en-GH": (topic: string) =>
    `Charlie! Big news from Ghana today.

${topic}. This is something every Ghanaian needs to hear right now.

My people, from Accra to Kumasi, from Tema to Tamale. This one is serious. Ghana has always been strong and we will face this with dignity.

The world is watching. And Ghana is ready.

Drop your thoughts below. What do you think? Follow for more news from Ghana every day. Yoo Ghana!`.trim(),

  "en-KE": (topic: string) =>
    `Kenya! Breaking news that affects us all.

${topic}. This is what you need to know right now.

From Nairobi to Mombasa, from Kisumu to Nakuru. Every Kenyan should be paying attention today. The situation is developing and we are keeping you informed.

East Africa is watching. Kenya is watching.

Drop your comment below. Share with someone who needs to hear this. Follow for more Kenyan news daily.`.trim(),
};

/**
 * Get a fallback script for the given language and topic.
 * Falls back to en-ZA if the language isn't supported.
 */
export function getFallbackScript(language: string, topic: string): string {
  const template = FALLBACK_TEMPLATES[language] || FALLBACK_TEMPLATES["en-ZA"];
  return template(topic);
}
