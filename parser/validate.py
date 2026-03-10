"""Валидация результатов парсинга."""

from collections import Counter
from typing import Any


def validate_and_log(questions: list[dict[str, Any]]) -> bool:
    total = len(questions)
    with_images = sum(1 for q in questions if q.get("image"))
    without_images = total - with_images

    cat_counts: dict[str, int] = Counter()
    for q in questions:
        for c in q.get("categories", []):
            cat_counts[c] += 1

    print("\n--- Валидация парсинга ---")
    print(f"Total questions: {total}")
    print(f"Questions with images: {with_images}")
    print(f"Questions without images: {without_images}")
    print("Questions per category:")
    for cat in ["base", "A", "B", "C", "D", "E", "G"]:
        if cat in cat_counts:
            print(f"  {cat}: {cat_counts[cat]}")

    ids = [q["id"] for q in questions]
    min_id = min(ids) if ids else 0
    max_id = max(ids) if ids else 0
    expected = set(range(min_id, max_id + 1))
    missing = expected - set(ids)
    if missing:
        print(f"ПРОПУЩЕНЫ номера: {sorted(missing)[:20]}...")
    no_correct = [q["id"] for q in questions if not q.get("correct_answer")]
    if no_correct:
        print(f"Без correct_answer: {no_correct[:10]}...")
    no_three = [q["id"] for q in questions if len(q.get("answers_original", {})) != 3]
    if no_three:
        print(f"Без 3 вариантов: {no_three[:10]}...")
    print("----------------------------\n")
    return not (missing or no_correct or no_three)
