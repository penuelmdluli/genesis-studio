export interface ProductAdScene {
  label: string;
  purpose: string;
  suggestedDuration: 5 | 10;
  motionStyle:
    | "slow-zoom-in"
    | "orbit"
    | "slide-reveal"
    | "zoom-out-dramatic"
    | "ken-burns"
    | "push-in";
  textPosition: "top" | "center" | "bottom";
}

export interface ProductAdTemplate {
  id: string;
  name: string;
  description: string;
  icon: string; // lucide icon name
  sceneStructure: ProductAdScene[];
  suggestedMusicMood: string;
  totalDuration: number;
  suggestedTone: string;
}

export const PRODUCT_AD_TEMPLATES: ProductAdTemplate[] = [
  // Flash Sale (4 scenes, 20s) - urgency focused
  {
    id: "flash-sale",
    name: "Flash Sale",
    description: "High-urgency countdown ad that creates FOMO and drives immediate purchases",
    icon: "Zap",
    suggestedMusicMood: "energetic",
    totalDuration: 20,
    suggestedTone: "urgent",
    sceneStructure: [
      {
        label: "Attention Grabber",
        purpose: "Bold text overlay with product flash — stop the scroll instantly",
        suggestedDuration: 5,
        motionStyle: "zoom-out-dramatic",
        textPosition: "center",
      },
      {
        label: "Product Hero Shot",
        purpose: "Show the product in its best light with price slash animation",
        suggestedDuration: 5,
        motionStyle: "orbit",
        textPosition: "bottom",
      },
      {
        label: "Urgency Builder",
        purpose: "Countdown timer or limited stock messaging to create scarcity",
        suggestedDuration: 5,
        motionStyle: "push-in",
        textPosition: "center",
      },
      {
        label: "Call to Action",
        purpose: "Clear CTA with discount code or swipe-up prompt",
        suggestedDuration: 5,
        motionStyle: "slow-zoom-in",
        textPosition: "center",
      },
    ],
  },

  // Product Launch (5 scenes, 30s) - reveal focused
  {
    id: "product-launch",
    name: "Product Launch",
    description: "Build anticipation and reveal your new product with cinematic flair",
    icon: "Rocket",
    suggestedMusicMood: "dramatic",
    totalDuration: 30,
    suggestedTone: "inspirational",
    sceneStructure: [
      {
        label: "Teaser",
        purpose: "Mysterious silhouette or blurred preview to build curiosity",
        suggestedDuration: 5,
        motionStyle: "slow-zoom-in",
        textPosition: "center",
      },
      {
        label: "Problem Statement",
        purpose: "Highlight the pain point your product solves",
        suggestedDuration: 5,
        motionStyle: "ken-burns",
        textPosition: "top",
      },
      {
        label: "The Reveal",
        purpose: "Dramatic product unveiling with full glory shot",
        suggestedDuration: 10,
        motionStyle: "zoom-out-dramatic",
        textPosition: "bottom",
      },
      {
        label: "Key Features",
        purpose: "Rapid showcase of 2-3 standout features or benefits",
        suggestedDuration: 5,
        motionStyle: "slide-reveal",
        textPosition: "bottom",
      },
      {
        label: "Launch CTA",
        purpose: "Release date, pre-order link, or waitlist signup",
        suggestedDuration: 5,
        motionStyle: "push-in",
        textPosition: "center",
      },
    ],
  },

  // Before/After (4 scenes, 20s) - transformation
  {
    id: "before-after",
    name: "Before / After",
    description: "Show dramatic transformation results that prove your product works",
    icon: "ArrowRightLeft",
    suggestedMusicMood: "upbeat",
    totalDuration: 20,
    suggestedTone: "friendly",
    sceneStructure: [
      {
        label: "The Before",
        purpose: "Show the problem state — messy, broken, or undesirable situation",
        suggestedDuration: 5,
        motionStyle: "ken-burns",
        textPosition: "top",
      },
      {
        label: "The Transition",
        purpose: "Product in action — the magic moment of transformation",
        suggestedDuration: 5,
        motionStyle: "slide-reveal",
        textPosition: "center",
      },
      {
        label: "The After",
        purpose: "Stunning result that speaks for itself — clean, beautiful, fixed",
        suggestedDuration: 5,
        motionStyle: "zoom-out-dramatic",
        textPosition: "bottom",
      },
      {
        label: "Get Yours",
        purpose: "Reinforce the transformation with a clear purchase prompt",
        suggestedDuration: 5,
        motionStyle: "slow-zoom-in",
        textPosition: "center",
      },
    ],
  },

  // Feature Highlight (3 scenes, 15s) - focused demo
  {
    id: "feature-highlight",
    name: "Feature Highlight",
    description: "Zero in on one killer feature and show exactly why it matters",
    icon: "Crosshair",
    suggestedMusicMood: "corporate",
    totalDuration: 15,
    suggestedTone: "professional",
    sceneStructure: [
      {
        label: "Hook Question",
        purpose: "Ask a relatable question that your feature answers",
        suggestedDuration: 5,
        motionStyle: "push-in",
        textPosition: "center",
      },
      {
        label: "Feature Demo",
        purpose: "Show the feature in action with close-up detail",
        suggestedDuration: 5,
        motionStyle: "slow-zoom-in",
        textPosition: "bottom",
      },
      {
        label: "Benefit + CTA",
        purpose: "State the benefit clearly and direct to next step",
        suggestedDuration: 5,
        motionStyle: "orbit",
        textPosition: "center",
      },
    ],
  },

  // Testimonial Style (4 scenes, 20s) - social proof
  {
    id: "testimonial",
    name: "Testimonial Style",
    description: "Leverage social proof with real customer stories and results",
    icon: "Star",
    suggestedMusicMood: "emotional",
    totalDuration: 20,
    suggestedTone: "friendly",
    sceneStructure: [
      {
        label: "Customer Intro",
        purpose: "Introduce the real customer or their relatable scenario",
        suggestedDuration: 5,
        motionStyle: "slow-zoom-in",
        textPosition: "bottom",
      },
      {
        label: "Their Problem",
        purpose: "What they struggled with before finding your product",
        suggestedDuration: 5,
        motionStyle: "ken-burns",
        textPosition: "top",
      },
      {
        label: "The Result",
        purpose: "Their success story, metrics, or emotional transformation",
        suggestedDuration: 5,
        motionStyle: "zoom-out-dramatic",
        textPosition: "center",
      },
      {
        label: "Join Them CTA",
        purpose: "Invite viewer to get the same results — link or offer",
        suggestedDuration: 5,
        motionStyle: "push-in",
        textPosition: "center",
      },
    ],
  },

  // Unboxing (4 scenes, 20s) - discovery
  {
    id: "unboxing",
    name: "Unboxing",
    description: "Create excitement through the discovery and reveal of your product",
    icon: "Package",
    suggestedMusicMood: "trendy",
    totalDuration: 20,
    suggestedTone: "friendly",
    sceneStructure: [
      {
        label: "Package Arrival",
        purpose: "Beautiful packaging shot that builds anticipation",
        suggestedDuration: 5,
        motionStyle: "slow-zoom-in",
        textPosition: "top",
      },
      {
        label: "The Opening",
        purpose: "Hands opening the box — tactile, satisfying moment",
        suggestedDuration: 5,
        motionStyle: "push-in",
        textPosition: "bottom",
      },
      {
        label: "First Impressions",
        purpose: "Product lifted out, admired from all angles",
        suggestedDuration: 5,
        motionStyle: "orbit",
        textPosition: "bottom",
      },
      {
        label: "In Use + CTA",
        purpose: "Quick shot of product in action with purchase link",
        suggestedDuration: 5,
        motionStyle: "slide-reveal",
        textPosition: "center",
      },
    ],
  },

  // Comparison (3 scenes, 15s) - us vs them
  {
    id: "comparison",
    name: "Comparison",
    description: "Position your product against competitors with a clear side-by-side",
    icon: "Scale",
    suggestedMusicMood: "corporate",
    totalDuration: 15,
    suggestedTone: "professional",
    sceneStructure: [
      {
        label: "The Other Way",
        purpose: "Show the competitor or old way — frustrating, slow, expensive",
        suggestedDuration: 5,
        motionStyle: "ken-burns",
        textPosition: "top",
      },
      {
        label: "Your Way",
        purpose: "Your product solving the same problem — faster, better, easier",
        suggestedDuration: 5,
        motionStyle: "slide-reveal",
        textPosition: "bottom",
      },
      {
        label: "Winner CTA",
        purpose: "Clear verdict with switch-now messaging and offer",
        suggestedDuration: 5,
        motionStyle: "zoom-out-dramatic",
        textPosition: "center",
      },
    ],
  },

  // Lifestyle (4 scenes, 20s) - product in context
  {
    id: "lifestyle",
    name: "Lifestyle",
    description: "Show your product naturally integrated into an aspirational daily life",
    icon: "Sun",
    suggestedMusicMood: "chill",
    totalDuration: 20,
    suggestedTone: "calm",
    sceneStructure: [
      {
        label: "Setting the Scene",
        purpose: "Beautiful environment that resonates with your target audience",
        suggestedDuration: 5,
        motionStyle: "ken-burns",
        textPosition: "top",
      },
      {
        label: "Product in Context",
        purpose: "Product being used naturally in the lifestyle setting",
        suggestedDuration: 5,
        motionStyle: "slow-zoom-in",
        textPosition: "bottom",
      },
      {
        label: "The Moment",
        purpose: "Emotional payoff — joy, relief, satisfaction from using the product",
        suggestedDuration: 5,
        motionStyle: "orbit",
        textPosition: "center",
      },
      {
        label: "Aspirational CTA",
        purpose: "Invite viewer into this lifestyle with a soft, branded close",
        suggestedDuration: 5,
        motionStyle: "zoom-out-dramatic",
        textPosition: "center",
      },
    ],
  },
];
