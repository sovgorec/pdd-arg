"use client";

import { useState, useEffect, useCallback } from "react";

const KEYS = {
  best_streak: "pdd_arg_best_streak",
  total_correct: "pdd_arg_total_correct",
  total_answered: "pdd_arg_total_answered",
  wrong_ids: "pdd_arg_wrong_ids",
} as const;

export function useStorage() {
  const [bestStreak, setBestStreakState] = useState(0);
  const [totalCorrect, setTotalCorrectState] = useState(0);
  const [totalAnswered, setTotalAnsweredState] = useState(0);
  const [wrongIds, setWrongIdsState] = useState<number[]>([]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setBestStreakState(parseInt(localStorage.getItem(KEYS.best_streak) || "0", 10));
    setTotalCorrectState(parseInt(localStorage.getItem(KEYS.total_correct) || "0", 10));
    setTotalAnsweredState(parseInt(localStorage.getItem(KEYS.total_answered) || "0", 10));
    try {
      const w = localStorage.getItem(KEYS.wrong_ids);
      setWrongIdsState(w ? JSON.parse(w) : []);
    } catch {
      setWrongIdsState([]);
    }
  }, []);

  const setBestStreak = useCallback((v: number) => {
    setBestStreakState(v);
    localStorage.setItem(KEYS.best_streak, String(v));
  }, []);

  const setTotalCorrect = useCallback((v: number) => {
    setTotalCorrectState(v);
    localStorage.setItem(KEYS.total_correct, String(v));
  }, []);

  const setTotalAnswered = useCallback((v: number) => {
    setTotalAnsweredState(v);
    localStorage.setItem(KEYS.total_answered, String(v));
  }, []);

  const addWrongId = useCallback((id: number) => {
    setWrongIdsState((prev) => {
      if (prev.includes(id)) return prev;
      const next = [...prev, id];
      localStorage.setItem(KEYS.wrong_ids, JSON.stringify(next));
      return next;
    });
  }, []);

  const clearWrongIds = useCallback(() => {
    setWrongIdsState([]);
    localStorage.setItem(KEYS.wrong_ids, "[]");
  }, []);

  return {
    bestStreak,
    totalCorrect,
    totalAnswered,
    wrongIds,
    setBestStreak,
    setTotalCorrect,
    setTotalAnswered,
    addWrongId,
    clearWrongIds,
  };
}
