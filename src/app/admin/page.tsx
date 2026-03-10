"use client";

import { useEffect, useState } from "react";

type Stats = {
  total: number;
  uniqueTotal: number;
  today: { visits: number; unique: number };
  week: { visits: number; unique: number };
  month: { visits: number; unique: number };
} | null;

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [stats, setStats] = useState<Stats>(null);
  const [loading, setLoading] = useState(false);
  const [needsLogin, setNeedsLogin] = useState<boolean | null>(null);

  const login = async () => {
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        setNeedsLogin(false);
        loadStats();
      } else {
        setError("Неверный пароль");
      }
    } catch {
      setError("Ошибка");
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    const res = await fetch("/api/analytics");
    if (res.ok) {
      const data = await res.json();
      setStats(data);
      setNeedsLogin(false);
    } else {
      setNeedsLogin(true);
    }
  };

  useEffect(() => {
    loadStats();
  }, []);

  if (needsLogin) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-stone-100 p-4">
        <div className="w-full max-w-xs rounded-lg border border-stone-200 bg-white p-6 shadow-sm">
            <h1 className="mb-4 text-xl font-semibold text-stone-900">Вход в админку</h1>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Пароль"
              className="mb-3 w-full rounded-lg border border-stone-200 px-3 py-2 text-stone-900"
              onKeyDown={(e) => e.key === "Enter" && login()}
            />
            {error && <p className="mb-2 text-sm text-red-600">{error}</p>}
            <button
              onClick={login}
              disabled={loading}
              className="w-full rounded-lg bg-stone-800 py-2 text-white hover:bg-stone-700 disabled:opacity-50"
            >
              Войти
            </button>
        </div>
        <p className="mt-4 text-sm text-stone-500">Пароль по умолчанию: 1234</p>
      </div>
    );
  }

  if (stats === null) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-100">
        <p className="text-stone-600">Загрузка…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-stone-100 p-4">
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6 text-2xl font-bold text-stone-900">Статистика</h1>
        <div className="grid gap-4 sm:grid-cols-2">
          <Card title="Сегодня" visits={stats!.today.visits} unique={stats!.today.unique} />
          <Card title="За неделю" visits={stats!.week.visits} unique={stats!.week.unique} />
          <Card title="За месяц" visits={stats!.month.visits} unique={stats!.month.unique} />
          <Card title="Всего" visits={stats!.total} unique={stats!.uniqueTotal} />
        </div>
        <p className="mt-6 text-sm text-stone-500">
          Визиты = загрузки приложения. Уникальные = по sessionId (приближённо ≈ устройства/пользователи).
        </p>
      </div>
    </div>
  );
}

function Card({
  title,
  visits,
  unique,
}: {
  title: string;
  visits: number;
  unique: number;
}) {
  return (
    <div className="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
      <h2 className="mb-2 text-sm font-medium text-stone-600">{title}</h2>
      <p className="text-2xl font-bold text-stone-900">{visits}</p>
      <p className="text-sm text-stone-500">визитов</p>
      <p className="mt-1 text-lg font-semibold text-stone-800">{unique}</p>
      <p className="text-sm text-stone-500">уникальных</p>
    </div>
  );
}
