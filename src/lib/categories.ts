export type Category = {
  id: string;
  label: string;
  blurb: string;
  questions: string[];
};

export const CATEGORIES: Category[] = [
  {
    id: "behavioral",
    label: "Behavioral",
    blurb: "STAR-method stories: leadership, conflict, ownership.",
    questions: [
      "Tell me about a time you led a team through a difficult challenge.",
      "Describe a situation where you had to disagree with your manager. How did you handle it?",
      "Walk me through a project you're particularly proud of. What was your role?",
      "Tell me about a time you failed. What did you learn?",
      "Describe a moment when you had to give difficult feedback to a peer.",
    ],
  },
  {
    id: "tech",
    label: "Tech / Engineering",
    blurb: "System design, debugging stories, technical depth.",
    questions: [
      "Walk me through how you would design a URL shortener at scale.",
      "Tell me about the most complex bug you've ever debugged.",
      "How do you decide between SQL and NoSQL for a new project?",
      "Describe your approach to code review.",
      "Explain a recent technical decision you made and the tradeoffs you considered.",
    ],
  },
  {
    id: "sales",
    label: "Sales",
    blurb: "Discovery, objection handling, closing technique.",
    questions: [
      "Walk me through your most challenging deal — and how you closed it.",
      "How do you handle a prospect who says 'we don't have budget'?",
      "Sell me this pen. Take 60 seconds.",
      "Tell me about a time you lost a deal. What would you do differently?",
      "How do you build rapport with a stakeholder you've never met?",
    ],
  },
  {
    id: "leadership",
    label: "Leadership",
    blurb: "Vision, people management, executive presence.",
    questions: [
      "How do you set vision for a team during ambiguity?",
      "Describe your approach to performance management.",
      "Tell me about a time you had to let someone go. How did you handle it?",
      "How do you balance shipping speed with quality across a team?",
      "What's your philosophy on building high-trust teams?",
    ],
  },
  {
    id: "custom",
    label: "Custom",
    blurb: "Bring your own question to practice anything.",
    questions: [
      "Why do you want this role?",
      "Where do you see yourself in five years?",
      "What's your greatest weakness?",
    ],
  },
];

export function pickRandomQuestion(catId: string): string {
  const cat = CATEGORIES.find((c) => c.id === catId) ?? CATEGORIES[0];
  return cat.questions[Math.floor(Math.random() * cat.questions.length)];
}
