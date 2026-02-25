export interface PersonData {
  name: string;
  birth_year: number;
  death_year: number | null; // null = living
  category: string;
  approximate: boolean;
  description?: string; // one-sentence epitaph
}

export type TimelineData = PersonData[];

export type AppState = "landing" | "input" | "loading" | "error";
