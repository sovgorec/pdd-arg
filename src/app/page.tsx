"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import type { Question } from "@/types";
import { CATEGORY_LABELS } from "@/types";
import { useStorage } from "@/hooks/useStorage";
import { shuffle } from "@/lib/fisherYates";

type Lang = "es" | "ru";
const CATEGORIES = ["generales", "A", "B", "C", "D", "E"] as const;

export default function Home() {
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<number[]>([]);
  const [index, setIndex] = useState(0);
  const [lang, setLang] = useState<Lang>("ru");
  const [currentStreak, setCurrentStreak] = useState(0);
  const [sessionBestStreak, setSessionBestStreak] = useState(0);
  const [answered, setAnswered] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [filterOpen, setFilterOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [copiedField, setCopiedField] = useState<"alias" | "id" | null>(null);
  const [selectedCats, setSelectedCats] = useState<Set<string>>(new Set(["generales"]));
  const [onlyWithImages, setOnlyWithImages] = useState(false);
  const [onlyErrors, setOnlyErrors] = useState(false);
  const [examMode, setExamMode] = useState(false);

  const storage = useStorage();

  const toggleCat = (cat: string) => {
    setSelectedCats((prev) => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  const filteredQuestions = questions.filter((q) => {
    if (selectedCats.size > 0) {
      const cats = q.categories || [];
      if (!cats.some((cat) => selectedCats.has(cat))) return false;
    }
    if (onlyWithImages && !q.image) return false;
    if (onlyErrors && !storage.wrongIds.includes(q.id)) return false;
    return true;
  });

  const buildOrder = useCallback(() => {
    let ids = filteredQuestions.map((q) => q.id);
    ids = shuffle(ids);
    if (examMode) ids = ids.slice(0, 20);
    setOrder(ids);
    setIndex(0);
    setAnswered(false);
    setSelected(null);
  }, [filteredQuestions, examMode]);

  useEffect(() => {
    let sid = "srv";
    if (typeof window !== "undefined") {
      let v = localStorage.getItem("pdd_session");
      if (!v) {
        v = crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
        localStorage.setItem("pdd_session", v);
      }
      sid = v;
    }
    fetch("/api/track", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ sessionId: sid }) }).catch(() => {});
  }, []);

  useEffect(() => {
    fetch("/api/questions")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("Не удалось загрузить вопросы"))))
      .then((data: Question[]) => {
        const mapped = data.map((q) => ({ ...q, categories: q.categories || [] }));
        const withoutRu = mapped.filter((q) => !q.question_ru || Object.keys(q.answers_ru || {}).length < 3);
        if (withoutRu.length > 0) {
          console.warn(`[PDD] ${withoutRu.length} вопросов без перевода (question_ru/answers_ru). Запустите ./translate.sh`);
        }
        setQuestions(mapped);
        setError(null);
      })
      .catch((e) => setError(e?.message || "Ошибка"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (questions.length > 0 && filteredQuestions.length > 0) {
      buildOrder();
    }
  }, [selectedCats, onlyWithImages, onlyErrors, examMode, questions.length, filteredQuestions.length]);

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
      if (nextStreak > storage.bestStreak) storage.setBestStreak(nextStreak);
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

  const copyToClipboard = useCallback(async (text: string, field: "alias" | "id") => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedField(field);
      setTimeout(() => setCopiedField(null), 1500);
    } catch {
      // ignore
    }
  }, []);

  const catLabel = (q: Question) => {
    const cats = q.categories || [];
    if (cats.includes("generales") && cats.length === 1) return "Generales";
    const main = cats.find((c) => c !== "C" && c !== "E") || cats[0];
    return CATEGORY_LABELS[main] || main;
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
      </div>
    );
  }

  if (filteredQuestions.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-stone-100 p-4">
        <p className="text-stone-900">Нет вопросов по выбранным фильтрам</p>
        <button
          onClick={() => setFilterOpen(true)}
          className="rounded bg-stone-700 px-4 py-2 text-white"
        >
          Фильтр
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col overflow-hidden bg-stone-100">
      {/* Верх: статистика + фильтр — фиксирован */}
      <div className="sticky top-0 z-10 flex-shrink-0 border-b border-stone-200 bg-white px-4 py-3">
        <div className="mx-auto flex max-w-2xl items-center justify-between">
          <div className="flex items-center gap-4 text-sm text-stone-900">
            <span>Серия: <strong>{currentStreak}</strong></span>
            <span>Лучшая серия: <strong>{storage.bestStreak}</strong></span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={resetSession}
              className="rounded p-1.5 text-stone-600 hover:bg-stone-100"
              title="Сбросить"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                <path d="M3 3v5h5" />
              </svg>
            </button>
            <button
              onClick={() => setFilterOpen(true)}
              className={`rounded p-1.5 ${selectedCats.size > 0 ? "text-stone-900" : "text-stone-400"}`}
              title="Фильтр"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
              </svg>
            </button>
            <button
              onClick={() => setProfileOpen(true)}
              className="rounded-full p-2 bg-black text-white hover:bg-stone-800"
              title="Профиль"
              aria-label="Профиль"
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            </button>
          </div>
        </div>
      </div>

      {/* Скроллируемый контент — отступ снизу под фиксированную панель */}
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden pb-[320px]">
        <div className="mx-auto max-w-2xl p-4">
          <div className="rounded-lg bg-white p-6 shadow-sm text-stone-900">
            <div className="mb-4">
              <span className="text-sm text-stone-600">
                Вопрос {current?.id}
              </span>
              {current && (
                <span className="ml-2 rounded bg-stone-200 px-2 py-0.5 text-xs">
                  {catLabel(current)}
                </span>
              )}
              <span className="ml-2 text-sm text-stone-500">
                {index + 1} / {order.length}
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
              {lang === "ru" ? (current?.question_ru || current?.question_original || "") : (current?.question_original || "")}
            </p>
          </div>
        </div>
      </div>

      {/* Фиксированная нижняя зона — закреплена снизу, не тянется */}
      <div className="fixed bottom-0 left-0 right-0 z-10 border-t border-stone-200 bg-white p-4">
        <div className="mx-auto max-w-2xl">
          {/* Варианты ответов — большая зона клика */}
          <div className="flex flex-col gap-2">
            {["A", "B", "C"].map((letter) => {
              if (!current) return null;
              const text =
                lang === "ru"
                  ? (current.answers_ru?.[letter] || current.answers_original[letter] || "")
                  : (current.answers_original[letter] || "");
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
                  : "bg-white border-stone-200 hover:bg-stone-50 active:bg-stone-100";

              return (
                <button
                  key={letter}
                  onClick={() => handleAnswer(letter)}
                  disabled={answered}
                  className={`flex min-h-[52px] w-full cursor-pointer items-center rounded-lg border-2 px-4 py-3 text-left text-stone-900 transition ${bg} disabled:cursor-default`}
                >
                  <span className="mr-3 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border-2 border-stone-400 text-sm font-medium">
                    {letter}
                  </span>
                  <span className="flex-1">{text}</span>
                </button>
              );
            })}
          </div>

          {answered && (
            <button
              onClick={handleNext}
              className="mt-4 w-full rounded-lg bg-stone-800 py-3 text-white hover:bg-stone-700"
            >
              {index < order.length - 1 ? "Следующий" : "Начать заново"}
            </button>
          )}

          {/* Переключатель языка — вся кнопка кликабельна, toggle */}
          <div className="mt-4 flex justify-center">
            <button
              type="button"
              onClick={() => setLang((l) => (l === "ru" ? "es" : "ru"))}
              className="relative flex w-full max-w-[208px] cursor-pointer rounded-xl bg-stone-200/60 p-1"
              aria-label="Переключить язык"
            >
              <div
                className="absolute top-1 h-[calc(100%-8px)] rounded-lg bg-stone-800 shadow-md transition-all duration-300 ease-out"
                style={{ width: "calc(50% - 4px)", left: lang === "ru" ? "4px" : "calc(50% + 0px)" }}
              />
              <span
                className={`relative z-10 flex-1 rounded-lg px-4 py-2.5 text-center text-sm font-medium ${lang === "ru" ? "text-white" : "text-stone-700"}`}
              >
                Русский
              </span>
              <span
                className={`relative z-10 flex-1 rounded-lg px-4 py-2.5 text-center text-sm font-medium ${lang === "es" ? "text-white" : "text-stone-700"}`}
              >
                Español
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Bottom sheet фильтр */}
      {filterOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => setFilterOpen(false)}
            aria-hidden
          />
          <div className="fixed bottom-0 left-0 right-0 z-50 max-h-[80vh] overflow-y-auto rounded-t-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-stone-900">Фильтр</h3>
              <button
                onClick={() => setFilterOpen(false)}
                className="rounded p-1 text-stone-500 hover:bg-stone-100"
              >
                ✕
              </button>
            </div>
            <p className="mb-3 text-sm text-stone-600">Категории</p>
            <div className="mb-6 flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <label
                  key={cat}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-stone-200 px-4 py-2 hover:bg-stone-50"
                >
                  <input
                    type="checkbox"
                    checked={selectedCats.has(cat)}
                    onChange={() => toggleCat(cat)}
                    className="h-4 w-4"
                  />
                  <span>{CATEGORY_LABELS[cat] || cat}</span>
                </label>
              ))}
            </div>
            <p className="mb-3 text-sm text-stone-600">Дополнительно</p>
            <div className="flex flex-col gap-2">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={onlyWithImages}
                  onChange={(e) => setOnlyWithImages(e.target.checked)}
                />
                <span>Только с картинками</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={onlyErrors}
                  onChange={(e) => setOnlyErrors(e.target.checked)}
                />
                <span>Только ошибки</span>
              </label>
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={examMode}
                  onChange={(e) => setExamMode(e.target.checked)}
                />
                <span>Экзамен (20 вопросов)</span>
              </label>
            </div>
            <button
              onClick={() => setFilterOpen(false)}
              className="mt-6 w-full rounded-lg bg-stone-800 py-3 text-white"
            >
              Готово
            </button>
          </div>
        </>
      )}

      {/* Профиль: шторка снизу */}
      {profileOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/40"
            onClick={() => setProfileOpen(false)}
            aria-hidden
          />
          <div className="fixed bottom-0 left-0 right-0 z-50 max-h-[85vh] overflow-y-auto rounded-t-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-semibold text-stone-900">Профиль</h3>
              <button
                onClick={() => setProfileOpen(false)}
                className="rounded p-1 text-stone-500 hover:bg-stone-100"
              >
                ✕
              </button>
            </div>

            <section className="mb-6">
              <h4 className="mb-2 text-sm font-medium text-stone-700">Как установить приложение</h4>
              <p className="mb-2 text-sm text-stone-600">
                <strong>iPhone (Safari):</strong> нажмите кнопку «Поделиться» внизу экрана → «На экран „Домой“».
              </p>
              <p className="text-sm text-stone-600">
                <strong>Android (Chrome):</strong> меню (три точки) → «Установить приложение» или «Добавить на главный экран».
              </p>
            </section>

            <section className="mb-4">
              <p className="mb-2 text-sm text-stone-600">Мой алиас</p>
              <button
                type="button"
                onClick={() => copyToClipboard("sovgorec", "alias")}
                className={`flex w-full cursor-pointer items-center gap-2 rounded-lg border-2 px-3 py-2 text-left transition-colors ${
                  copiedField === "alias" ? "border-green-500 bg-green-50" : "border-stone-200 bg-stone-50 active:bg-stone-100"
                }`}
              >
                <span className="min-w-0 flex-1 truncate text-stone-900">sovgorec</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-stone-500">
                  <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                  <path d="M4 16V4a2 2 0 0 1 2-2h12" />
                </svg>
              </button>
            </section>

            <section className="mb-6">
              <p className="mb-2 text-sm text-stone-600">Мой Bybit UID</p>
              <button
                type="button"
                onClick={() => copyToClipboard("107944611", "id")}
                className={`flex w-full cursor-pointer items-center gap-2 rounded-lg border-2 px-3 py-2 text-left transition-colors ${
                  copiedField === "id" ? "border-green-500 bg-green-50" : "border-stone-200 bg-stone-50 active:bg-stone-100"
                }`}
              >
                <span className="min-w-0 flex-1 truncate font-mono text-sm text-stone-900">107944611</span>
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0 text-stone-500">
                  <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                  <path d="M4 16V4a2 2 0 0 1 2-2h12" />
                </svg>
              </button>
            </section>

            {copiedField && (
              <p className="mb-4 rounded-lg bg-green-100 py-2 text-center text-sm font-medium text-green-800">
                Скопировано
              </p>
            )}

            <p className="text-center text-sm text-stone-500">
              Возможны ошибки, которые я найду и поправлю, если кто-то пришлет пожертвование
            </p>
          </div>
        </>
      )}
    </div>
  );
}
