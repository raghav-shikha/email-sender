export type EmailClassification = {
  is_relevant: boolean;
  confidence: number; // 0..1
  category: string;
  reason: string;
};

export type EmailSummary = {
  summary_bullets: string[];
  what_they_want: string[];
  suggested_next_step: string;
  flags?: string[];
};

export type DraftResult = {
  draft_text: string;
  clarifying_questions?: string[];
};

export type ReviseResult = {
  revised_draft: string;
};

export type PushPayload = {
  email_item_id: string;
  title: string;
  body: string;
  url: string; // absolute or relative
};

