"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import type { Question } from "@/types";
import { useStorage } from "@/hooks/useStorage";
import { shuffle } from "@/lib/fisherYates";

type Lang = "es" | "ru";
type Mode = "all" | "with_images" | "errors" | "exam";

export default function Home() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<number[]>([]);
  const [index, setIndex] = useState(0);
  const [lang, setLang] = useState<Lang>("ru");
  const [mode, setMode] = useState<Mode>("all");
  const [currentStreak, setCurrentStreak] = useState(0);
  const [sessionBestStreak, setSessionBestStreak] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  const storage = useStorage();

  const filteredQuestions = questions.filter((q) => {
    if (mode === "with_images") return !!q.image;
    if (mode === "errors") return storage.wrongIds.includes(q.id);
    return true;
  });

  const buildOrder = useCallback(() => {
    let ids = filteredQuestions.map((q) => q.id);
    if (mode === "exam") {
      ids = shuffle(ids).slice(0, 20);
    } else {
      ids = shuffle(ids);
    }
    setOrder(ids);
    setIndex(0);
    setAnswered(false);
    setSelected(null);
  }, [mode, filteredQuestions]);

  useEffect(() => {
    fetch("/api/questions")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Не удалось загрузить вопросы"))))
      .then((data: Question[]) => {
        setQuestions(data);
        setError(null);
      })
      .catch((e) => setError(e?.message || "Ошибка"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (questions.length > 0 && filteredQuestions.length > 0) {
      buildOrder();
    }
  }, [mode, questions.length]);

  const currentId = order[index];
  const current = questions.find((q) => q.id === currentId);

  const handleAnswer = (letter: string) => {
    if (!current || answered) return;
    setSelected(letter);
    setAnswered(true);
    storage.setTotalAnswered(storage.totalAnswered + 1);
    const correct = letter === current.correct_answer;
    if (correct) {
      const nextStreak = currentStreak + 1;
      setCurrentStreak(nextStreak);
      setSessionBestStreak((prev) => Math.max(prev, nextStreak));
      storage.setTotalCorrect(storage.totalCorrect + 1);
      if (nextStreak > storage.bestStreak) {
        storage.setBestStreak(nextStreak);
      }
    } else {
      setCurrentStreak(0);
      storage.addWrongId(current.id);
    }
  };

  const handleNext = () => {
    if (index < order.length - 1) {
      setIndex((i) => i + 1);
      setAnswered(false);
      setSelected(null);
    } else {
      buildOrder();
    }
  };

  const resetSession = () => {
    setCurrentStreak(0);
    setSessionBestStreak(0);
    setAnswered(false);
    setSelected(null);
    buildOrder();
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-100">
        <p className="text-stone-900">Загрузка…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-stone-100 p-4">
        <p className="text-red-600">{error}</p>
        <p className="text-center text-sm text-stone-700">
          Убедитесь, что запущен <code>python parser/parse_pdf.py</code>
        </p>
      </div>
    );
  }

  if (filteredQuestions.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-stone-100 p-4">
        <p className="text-stone-900">
          {mode === "errors"
            ? "Пока нет ошибочных ответов"
            : mode === "with_images"
              ? "Нет вопросов с изображениями"
              : "Нет вопросов"}
        </p>
        <button
          onClick={() => setMode("all")}
          className="rounded bg-stone-700 px-4 py-2 text-white"
        >
          Все вопросы
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-100 p-4">
      <div className="mx-auto max-w-2xl">
        {/* Статистика */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 rounded-lg bg-white p-4 shadow-sm text-stone-900">
          <div className="flex flex-wrap gap-6 text-sm">
            <span>Серия: <strong>{currentStreak}</strong></span>
            <span>Лучшая: <strong>{storage.bestStreak}</strong></span>
            <span>Сессия: <strong>{sessionBestStreak}</strong></span>
            <span>Правильно: <strong>{storage.totalCorrect} / {storage.totalAnswered}</strong></span>
          </div>
          <div className="flex gap-2">
            <button
              onClick={resetSession}
              className="rounded border border-stone-300 px-3 py-1 text-sm text-stone-900 hover:bg-stone-50"
            >
              Сбросить сессию
            </button>
          </div>
        </div>

        {/* Режимы */}
        <div className="mb-4 flex flex-wrap gap-2">
          {(["all", "with_images", "errors", "exam"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`rounded px-3 py-1 text-sm ${
                mode === m
                  ? "bg-stone-800 text-white"
                  : "bg-white text-stone-900 hover:bg-stone-200"
              }`}
            >
              {m === "all" && "Все"}
              {m === "with_images" && "С картинками"}
              {m === "errors" && "Ошибки"}
              {m === "exam" && "Экзамен"}
            </button>
          ))}
        </div>

        {/* Вопрос */}
        <div className="rounded-lg bg-white p-6 shadow-sm text-stone-900">
          <div className="mb-4">
            <span className="text-sm text-stone-600">
              {index + 1} / {order.length} (вопрос #{current?.id})
            </span>
          </div>

          {current?.image && (
            <div className="relative mb-4 aspect-video w-full overflow-hidden rounded bg-stone-100">
              <Image
                src={current.image}
                alt=""
                fill
                className="object-contain"
                unoptimized
              />
            </div>
          )}

          <p className="mb-6 text-lg leading-relaxed text-stone-900">
            {lang === "ru" && current?.question_ru
              ? current.question_ru
              : current?.question_original}
          </p>

          <div className="flex flex-col gap-2">
            {["A", "B", "C"].map((letter) => {
              if (!current) return null;
              const text =
                lang === "ru" && current.answers_ru?.[letter]
                  ? current.answers_ru[letter]
                  : current.answers_original[letter];
              const isCorrect = current.correct_answer === letter;
              const isSelected = selected === letter;
              const showResult = answered && (isCorrect || isSelected);
              const bg =
                showResult
                  ? isCorrect
                    ? "bg-green-100 border-green-500"
                    : isSelected
                      ? "bg-red-100 border-red-500"
                      : "bg-white border-stone-200"
                  : "bg-white border-stone-200 hover:bg-stone-50";

              return (
                <button
                  key={letter}
                  onClick={() => handleAnswer(letter)}
                  disabled={answered}
                  className={`w-full rounded-lg border-2 px-4 py-3 text-left text-stone-900 transition ${bg} disabled:cursor-default`}
                >
                  <span className="font-medium">{letter}.</span> {text}
                </button>
              );
            })}
          </div>

          {answered && (
            <button
              onClick={handleNext}
              className="mt-6 w-full rounded-lg bg-stone-800 py-3 text-white hover:bg-stone-700"
            >
              {index < order.length - 1 ? "Следующий" : "Начать заново"}
            </button>
          )}

          {/* Переключатель языка — таб с анимированным фоном */}
          <div className="mt-6 border-t border-stone-200 pt-4">
            <div className="relative mx-auto flex w-fit rounded-xl bg-stone-200/60 p-1">
              <div
                className="absolute top-1 h-[calc(100%-8px)] rounded-lg bg-stone-800 shadow-md transition-all duration-300 ease-out"
                style={{
                  width: "calc(50% - 4px)",
                  left: lang === "ru" ? "4px" : "calc(50% + 0px)",
                }}
              />
              <button
                onClick={() => setLang("ru")}
                className={`relative z-10 w-24 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors duration-200 ${
                  lang === "ru" ? "text-white" : "text-stone-700"
                }`}
              >
                Русский
              </button>
              <button
                onClick={() => setLang("es")}
                className={`relative z-10 w-24 rounded-lg px-4 py-2.5 text-sm font-medium transition-colors duration-200 ${
                  lang === "es" ? "text-white" : "text-stone-700"
                }`}
              >
                Español
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
