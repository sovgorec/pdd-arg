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
  generales: "Generales",
  A: "Категория A",
  B: "Категория B",
  "C/E": "Категория C/E",
  D: "Категория D",
};
