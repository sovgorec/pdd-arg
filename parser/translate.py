#!/usr/bin/env python3
"""
Перевод вопросов и ответов на русский через OpenAI API.
Пропускает уже переведённые, батчами, с retry.
"""

import json
import logging
import os
import time
from pathlib import Path

from dotenv import load_dotenv
from openai import OpenAI

load_dotenv(Path(__file__).resolve().parent.parent / ".env")

PROJECT_ROOT = Path(__file__).resolve().parent.parent
QUESTIONS_JSON = PROJECT_ROOT / "data" / "questions.json"
BATCH_SIZE = 5
MAX_RETRIES = 3
BASE_DELAY = 1.0

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)


def get_client() -> OpenAI:
    api_key = os.environ.get("OPENROUTER_API_KEY") or os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise ValueError(
            "OPENROUTER_API_KEY или OPENAI_API_KEY не задан. Создайте .env"
        )
    return OpenAI(
        api_key=api_key,
        base_url="https://openrouter.ai/api/v1",
    )


def needs_translation(q: dict) -> bool:
    """Нужен ли перевод (question_ru пустой или answers_ru пустой)."""
    qr = q.get("question_ru")
    ar = q.get("answers_ru") or {}
    return not (qr and len(ar) >= 3)


def translate_batch(
    client: OpenAI, batch: list[dict]
) -> list[tuple[str, dict]]:
    """
    Перевести батч. Возвращает список (question_id, {question_ru, answers_ru}).
    """
    items = []
    for q in batch:
        items.append({
            "id": q["id"],
            "question": q["question_original"],
            "answers": q["answers_original"],
        })

    prompt = """Traduce al ruso las siguientes preguntas y respuestas de un examen de tráfico argentino.
Devuelve un JSON con el formato exacto: {"translations": [{"id": N, "question_ru": "...", "answers_ru": {"A": "...", "B": "...", "C": "..."}}]}
Solo el JSON, sin markdown ni texto adicional.

Preguntas:
"""
    for it in items:
        prompt += f"\nID {it['id']}: {it['question']}\n"
        for k, v in it["answers"].items():
            prompt += f"  {k}: {v}\n"

    for attempt in range(MAX_RETRIES):
        try:
            resp = client.chat.completions.create(
                model="openai/gpt-4o-mini",
                messages=[{"role": "user", "content": prompt}],
            )
            text = resp.choices[0].message.content.strip()
            if text.startswith("```"):
                text = text.split("```")[1]
                if text.startswith("json"):
                    text = text[4:]
            data = json.loads(text)
            trans = data.get("translations", data) if isinstance(data, dict) else data
            if not isinstance(trans, list):
                trans = [trans]
            result = []
            for t in trans:
                qid = t.get("id")
                qr = t.get("question_ru", "")
                ar = t.get("answers_ru", {})
                if isinstance(ar, dict) and qid is not None:
                    result.append((qid, {"question_ru": qr, "answers_ru": ar}))
            return result
        except json.JSONDecodeError as e:
            logger.warning("Intent %d: JSON inválido: %s", attempt + 1, e)
        except Exception as e:
            logger.warning("Intent %d: %s", attempt + 1, e)
        delay = BASE_DELAY * (2**attempt)
        time.sleep(delay)
    return []


def main():
    with open(QUESTIONS_JSON, "r", encoding="utf-8") as f:
        questions = json.load(f)

    to_translate = [q for q in questions if needs_translation(q)]
    if not to_translate:
        logger.info("Todos los preguntas ya están traducidas.")
        return

    logger.info("Quedan %d preguntas por traducir", len(to_translate))
    client = get_client()
    id_to_idx = {q["id"]: i for i, q in enumerate(questions)}

    for i in range(0, len(to_translate), BATCH_SIZE):
        batch = to_translate[i : i + BATCH_SIZE]
        logger.info("Traduciendo %d-%d...", i + 1, min(i + BATCH_SIZE, len(to_translate)))
        results = translate_batch(client, batch)
        for qid, trans in results:
            idx = id_to_idx.get(qid)
            if idx is not None:
                questions[idx]["question_ru"] = trans.get("question_ru", "")
                questions[idx]["answers_ru"] = trans.get("answers_ru", {})
        with open(QUESTIONS_JSON, "w", encoding="utf-8") as f:
            json.dump(questions, f, ensure_ascii=False, indent=2)
        time.sleep(0.5)

    logger.info("Traducción terminada.")


if __name__ == "__main__":
    main()
