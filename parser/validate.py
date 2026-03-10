"""Валидация результатов парсинга."""

from typing import Any


def validate_and_log(questions: list[dict[str, Any]]) -> bool:
    """
    Валидация и вывод лога.
    Возвращает True, если всё в порядке.
    """
    total = len(questions)
    with_images = sum(1 for q in questions if q.get("image"))
    ids = [q["id"] for q in questions]
    ids_sorted = sorted(ids)
    all_ids = set(ids)

    # Пропуски
    min_id = min(ids) if ids else 0
    max_id = max(ids) if ids else 0
    expected = set(range(min_id, max_id + 1))
    missing = expected - all_ids

    # Дубликаты
    from collections import Counter
    counts = Counter(ids)
    duplicates = [i for i, c in counts.items() if c > 1]

    # Без correct_answer
    no_correct = [q["id"] for q in questions if not q.get("correct_answer")]

    # Без 3 вариантов
    no_three = [q["id"] for q in questions if len(q.get("answers_original", {})) != 3]

    print("\n--- Валидация парсинга ---")
    print(f"Всего вопросов: {total}")
    print(f"С изображениями: {with_images}")
    if missing:
        print(f"ПРОПУЩЕНЫ номера: {sorted(missing)[:20]}{'...' if len(missing) > 20 else ''}")
    if duplicates:
        print(f"ДУБЛИКАТЫ: {duplicates[:20]}{'...' if len(duplicates) > 20 else ''}")
    if no_correct:
        print(f"Без correct_answer: {no_correct[:20]}{'...' if len(no_correct) > 20 else ''}")
    if no_three:
        print(f"Без 3 вариантов: {no_three[:20]}{'...' if len(no_three) > 20 else ''}")
    if not (missing or duplicates or no_correct or no_three):
        print("OK: все проверки пройдены")
    print("----------------------------\n")

    return not (missing or duplicates or no_correct or no_three)
