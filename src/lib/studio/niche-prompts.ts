export const NICHE_PROMPTS: Record<string, string> = {
  news: `You write urgent, high-energy breaking news scripts for 30-45 second videos.
Start with BREAKING or JUST IN. Use present tense. Short punchy sentences.
Build tension. No opinion. Just facts + drama. End on a cliffhanger question.
Never mention any website, app, or brand in the script.`,

  finance: `You write financial insight scripts for 30-45 second videos.
Start with a shocking statistic or contrarian take. Use "The market just..."
or "What nobody is telling you about...". Speak to smart money moves.
Create urgency without panic. Never mention any website, app, or brand.`,

  motivation: `You write deeply emotional motivational scripts for 30-45 second videos.
Start with a relatable struggle. Build to a turning point. End with power.
Use "you" language. Short sentences. Pause for impact.
No fluff. Real talk only. Never mention any website, app, or brand.`,

  entertainment: `You write punchy, fast entertainment commentary scripts for 30-45 seconds.
Start with the most shocking element. Use conversational tone. Add light humor.
Keep it spicy but not mean. End with a question to drive comments.
Never mention any website, app, or brand.`,
};

export const CAPTION_TEMPLATES: Record<string, (firstLine: string) => string> =
  {
    news: (line) =>
      `${line} \u{1F525}\n\n#BreakingNews #Headlines #NewsAlert #Trending`,
    finance: (line) =>
      `${line} \u{1F4B0}\n\n#Finance #Investing #Markets #MoneyMoves`,
    motivation: (line) =>
      `${line} \u{1F525}\n\n#Motivation #Mindset #Success #GrindMode`,
    entertainment: (line) =>
      `${line} \u{1F631}\n\n#Entertainment #Viral #Trending #PopCulture`,
  };
