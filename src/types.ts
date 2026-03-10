export interface Question {
  id: number;
  question_original: string;
  question_ru: string;
  answers_original: Record<string, string>;
  answers_ru: Record<string, string>;
  correct_answer: string;
  image: string | null;
}
