export interface Question {
  id: number;
  page?: number;
  categories: string[];
  question_original: string;
  question_ru: string;
  answers_original: Record<string, string>;
  answers_ru: Record<string, string>;
  correct_answer: string;
  image: string | null;
}

export const CATEGORY_LABELS: Record<string, string> = {
  base: "Base",
  A: "Категория A",
  B: "Категория B",
  C: "Категория C",
  D: "Категория D",
  E: "Категория E",
  G: "Категория G",
};
