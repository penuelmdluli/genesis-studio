/**
 * JSON-LD Structured Data for SEO
 * Renders <script type="application/ld+json"> tags.
 * Works in both server and client components.
 */

const websiteSchema = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Genesis Studio",
  url: "https://ivideostudio.ai",
  description:
    "AI video creation platform. Text to video, dance transfer, short films. 12 AI models.",
  potentialAction: {
    "@type": "SearchAction",
    target: "https://ivideostudio.ai/explore?q={search_term_string}",
    "query-input": "required name=search_term_string",
  },
};

const appSchema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "Genesis Studio",
  applicationCategory: "MultimediaApplication",
  operatingSystem: "Web",
  url: "https://ivideostudio.ai",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
    description: "100 free credits, no credit card required",
  },
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.8",
    ratingCount: "25",
  },
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "What is Genesis Studio?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Genesis Studio is an AI video creation platform that lets you generate videos from text prompts, images, and reference videos. It offers 12+ AI models for text-to-video, image-to-video, dance transfer, and full short film creation with audio.",
      },
    },
    {
      "@type": "Question",
      name: "Is Genesis Studio free?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes, sign up with 100 free credits, no credit card required. You can generate multiple AI videos for free and upgrade to a paid plan for more credits and premium features.",
      },
    },
    {
      "@type": "Question",
      name: "What AI models does Genesis Studio use?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Genesis Studio offers 12+ AI models including Wan 2.2, Kling 3.0, and other state-of-the-art video generation models. Each model excels at different styles and use cases, from fast drafts to cinematic quality output.",
      },
    },
    {
      "@type": "Question",
      name: "Can I use Genesis Studio videos commercially?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes, all videos generated on paid plans come with full commercial usage rights. You can use them for social media, marketing, YouTube, client work, and any other commercial purpose.",
      },
    },
  ],
};

export function WebSiteSchema() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }}
    />
  );
}

export function AppSchema() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(appSchema) }}
    />
  );
}

export function FAQSchema() {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
    />
  );
}
