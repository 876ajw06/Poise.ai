export type Seniority = "junior" | "mid" | "senior" | "staff";

export type InterviewModes = {
  voice: boolean;
  coding: boolean;
  systemDesign: boolean;
  bodyLanguage: boolean;
};

export type InterviewSetupState = {
  jobRole: string;
  company: string;
  seniority: Seniority;
  durationMin: number;
  modes: InterviewModes;
  resumeText: string;
};

export const INTERVIEW_SETUP_STORAGE_KEY = "poise_interview_setup_v1";

export function defaultInterviewModes(): InterviewModes {
  return { voice: true, coding: false, systemDesign: false, bodyLanguage: true };
}

export function defaultInterviewSetup(): InterviewSetupState {
  return {
    jobRole: "",
    company: "",
    seniority: "senior",
    durationMin: 30,
    modes: defaultInterviewModes(),
    resumeText: "",
  };
}

export function persistInterviewSetup(setup: InterviewSetupState) {
  try {
    sessionStorage.setItem(INTERVIEW_SETUP_STORAGE_KEY, JSON.stringify(setup));
  } catch {
    /* ignore quota / private mode */
  }
}

export function readInterviewSetup(): InterviewSetupState | null {
  try {
    const raw = sessionStorage.getItem(INTERVIEW_SETUP_STORAGE_KEY);
    if (!raw) return null;
    const o = JSON.parse(raw) as Partial<InterviewSetupState>;
    if (!o || typeof o !== "object") return null;
    const modes = o.modes ?? defaultInterviewModes();
    return {
      jobRole: typeof o.jobRole === "string" ? o.jobRole : "",
      company: typeof o.company === "string" ? o.company : "",
      seniority: (["junior", "mid", "senior", "staff"] as const).includes(o.seniority as Seniority)
        ? (o.seniority as Seniority)
        : "senior",
      durationMin: typeof o.durationMin === "number" && Number.isFinite(o.durationMin) ? Math.round(o.durationMin) : 30,
      modes: {
        voice: !!modes.voice,
        coding: !!modes.coding,
        systemDesign: !!modes.systemDesign,
        bodyLanguage: !!modes.bodyLanguage,
      },
      resumeText: typeof o.resumeText === "string" ? o.resumeText : "",
    };
  } catch {
    return null;
  }
}

export function interviewModesToArray(m: InterviewModes): string[] {
  const out: string[] = [];
  if (m.voice) out.push("voice");
  if (m.coding) out.push("coding");
  if (m.systemDesign) out.push("system_design");
  if (m.bodyLanguage) out.push("body_language");
  return out;
}
