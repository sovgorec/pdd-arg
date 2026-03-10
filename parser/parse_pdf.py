#!/usr/bin/env python3
"""
Парсер PDF с вопросами ПДД Аргентины.
Извлекает: номер, текст вопроса, варианты A/B/C, правильный ответ (жирный), изображения.
"""

import json
import os
import re
import sys
from pathlib import Path

import fitz

# Корень проекта (родитель папки parser)
PROJECT_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_PDF = None  # будет найден автоматически
OUTPUT_JSON = PROJECT_ROOT / "data" / "questions.json"
IMAGES_DIR = PROJECT_ROOT / "images"

# Минимальная высота изображения (отсекаем мелкие элементы типа логотипов в шапке)
MIN_IMAGE_HEIGHT = 40
# Максимальная ширина для "левого" контентного изображения (не шапка справа)
MAX_IMAGE_X_FOR_CONTENT = 150


def find_pdf() -> Path:
    """Найти PDF в корне проекта."""
    pdfs = list(PROJECT_ROOT.glob("*.pdf"))
    if not pdfs:
        raise FileNotFoundError(f"PDF не найден в {PROJECT_ROOT}")
    return pdfs[0]


def is_bold(span: dict) -> bool:
    """Проверка жирного шрифта: flags или название шрифта."""
    flags = span.get("flags", 0)
    if (flags & 16) != 0:  # 2**4 = bold
        return True
    font = span.get("font", "") or ""
    return "Bold" in font or "bold" in font.lower()


def collect_spans_from_page(page: fitz.Page) -> list[dict]:
    """Собрать все span'ы с координатами и флагами."""
    blocks = page.get_text("dict", flags=fitz.TEXT_PRESERVE_WHITESPACE)
    spans = []
    for block in blocks.get("blocks", []):
        bbox = block.get("bbox", (0, 0, 0, 0))
        for line in block.get("lines", []):
            for span in line.get("spans", []):
                text = (span.get("text") or "").strip()
                if not text:
                    continue
                spans.append({
                    "text": text,
                    "bbox": span.get("bbox", bbox),
                    "bold": is_bold(span),
                })
    return spans


def parse_question_number(text: str) -> int | None:
    """Извлечь номер вопроса из '1. ' или '292.'."""
    m = re.match(r"^(\d+)\s*[\.)]\s*", text.strip())
    return int(m.group(1)) if m else None


def parse_answer_option(text: str) -> str | None:
    """Проверить, является ли строка вариантом A/B/C. Возвращает 'A','B','C' или None."""
    t = text.strip()
    if re.match(r"^[aA]\s*[\.\)]\s*", t):
        return "A"
    if re.match(r"^[bB]\s*[\.\)]\s*", t):
        return "B"
    if re.match(r"^[cC]\s*[\.\)]\s*", t):
        return "C"
    return None


def extract_option_text(full: str, option: str) -> str:
    """Убрать префикс 'A. ' из текста варианта."""
    return re.sub(rf"^[aA]\s*[\.\)]\s*", "", full, count=1) if option == "A" else \
           re.sub(rf"^[bB]\s*[\.\)]\s*", "", full, count=1) if option == "B" else \
           re.sub(rf"^[cC]\s*[\.\)]\s*", "", full, count=1)


def extract_questions_from_spans(spans: list[dict]) -> list[dict]:
    """
    Извлечь вопросы из списка span'ов.
    Возвращает список вопросов с полями: id, question_text, answers, correct_answer.
    """
    questions = []
    i = 0
    while i < len(spans):
        s = spans[i]
        num = parse_question_number(s["text"])
        if num is not None and s["bold"]:
            # Начало вопроса
            q_text_parts = []
            # Текст может идти до варианта A
            rest = re.sub(r"^\d+\s*[\.)]\s*", "", s["text"], count=1).strip()
            if rest and not parse_answer_option(rest):
                q_text_parts.append(rest)
            i += 1
            while i < len(spans):
                ns = spans[i]
                opt = parse_answer_option(ns["text"])
                if opt:
                    break
                if ns["bold"] and not re.match(r"^\d+\s*[\.)]", ns["text"]):
                    q_text_parts.append(ns["text"])
                i += 1

            question_text = " ".join(q_text_parts).strip()

            # Собираем варианты A, B, C
            # Правильный ответ = вариант, у которого ТЕКСТ ответа (не метка A./B./C.) жирный
            answers = {}
            correct_answer = None
            expected = ["A", "B", "C"]
            found_options = 0

            while i < len(spans) and found_options < 3:
                ns = spans[i]
                opt = parse_answer_option(ns["text"])
                if opt and opt in expected and opt not in answers:
                    ans_text = extract_option_text(ns["text"], opt)
                    # Если span только "A." без текста — текст ответа в следующем span
                    content_bold = ns["bold"]
                    if len(ans_text.strip()) < 2 and i + 1 < len(spans):
                        next_span = spans[i + 1]
                        if parse_answer_option(next_span["text"]) is None:
                            ans_text = (ans_text + " " + next_span["text"]).strip()
                            content_bold = next_span["bold"]
                            i += 1
                    answers[opt] = ans_text.strip()
                    if content_bold:
                        correct_answer = opt
                    found_options += 1
                    i += 1
                elif opt and opt in expected:
                    break
                elif parse_question_number(ns["text"]) is not None and ns["bold"]:
                    break
                else:
                    if answers:
                        last_key = list(answers.keys())[-1]
                        answers[last_key] = (answers[last_key] + " " + ns["text"]).strip()
                    i += 1

            if len(answers) == 3 and correct_answer:
                questions.append({
                    "id": num,
                    "question_original": question_text,
                    "answers_original": answers,
                    "correct_answer": correct_answer,
                    "image": None,  # заполним позже
                })
            continue
        i += 1
    return questions


def extract_images_from_page(doc: fitz.Document, page: fitz.Page, page_num: int) -> list[tuple[int, bytes, tuple]]:
    """
    Извлечь изображения со страницы. Возвращает список (xref, image_bytes, bbox).
    Отфильтровываем мелкие картинки (логотипы).
    """
    result = []
    for img in page.get_images():
        xref = img[0]
        try:
            base = doc.extract_image(xref)
            img_bytes = base["image"]
            ext = base.get("ext", "png")
            if ext.lower() == "jpg":
                ext = "jpeg"
            # Получить bbox для этого изображения
            rects = page.get_image_rects(xref)
            if not rects:
                continue
            rect = rects[0]
            bbox = (rect.x0, rect.y0, rect.x1, rect.y1)
            h = bbox[3] - bbox[1]
            x0 = bbox[0]
            # Пропускаем мелкие и справа (шапка)
            if h >= MIN_IMAGE_HEIGHT and x0 <= MAX_IMAGE_X_FOR_CONTENT:
                result.append((xref, img_bytes, bbox, ext))
        except Exception:
            pass
    return result


def associate_images_with_questions(
    page_questions: list[dict],
    page_images: list[tuple[int, bytes, tuple, str]],
    question_bboxes: list[tuple],
) -> dict[int, tuple[bytes, str]]:
    """
    Привязать изображения к вопросам по вертикали.
    question_bboxes: (y0, y1) для каждого вопроса.
    Возвращает {question_id: (image_bytes, ext)}.
    """
    mapping = {}
    # Сортируем изображения по y
    imgs_sorted = sorted(page_images, key=lambda x: (x[2][1] + x[2][3]) / 2)
    q_sorted = sorted(
        enumerate(page_questions),
        key=lambda x: (question_bboxes[x[0]][0] + question_bboxes[x[0]][1]) / 2
    )
    # Простое сопоставление: по порядку или по ближайшему по вертикали
    for q_idx, q in q_sorted:
        q_id = q["id"]
        if q_idx < len(imgs_sorted):
            xref, ib, bbox, ext = imgs_sorted[q_idx]
            mapping[q_id] = (ib, ext)
    return mapping


def get_question_bboxes(spans: list[dict], questions: list[dict]) -> list[tuple]:
    """Оценка bbox для каждого вопроса по spans."""
    bboxes = []
    # Упрощённо: используем позицию номера вопроса
    i = 0
    for q in questions:
        qid = q["id"]
        while i < len(spans):
            num = parse_question_number(spans[i]["text"])
            if num == qid:
                bbox = spans[i]["bbox"]
                y0, y1 = bbox[1], bbox[3]
                # Примерная высота блока вопроса
                j = i + 1
                while j < len(spans):
                    if parse_question_number(spans[j]["text"]) is not None and spans[j]["bold"] and j > i:
                        break
                    if parse_answer_option(spans[j]["text"]):
                        y1 = max(y1, spans[j]["bbox"][3])
                    j += 1
                    if j - i > 20:
                        break
                bboxes.append((y0, y1))
                break
            i += 1
    return bboxes


def run_parser(pdf_path: Path | None = None) -> list[dict]:
    """Основной запуск парсера."""
    pdf_path = pdf_path or find_pdf()
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)

    doc = fitz.open(pdf_path)
    all_questions = []
    all_images_to_save: dict[int, tuple[bytes, str]] = {}

    # Пропускаем обложку и оглавление (стр 1–2)
    start_page = 2
    for page_num in range(start_page, len(doc)):
        page = doc[page_num]
        spans = collect_spans_from_page(page)
        questions = extract_questions_from_spans(spans)

        # Извлекаем изображения
        page_imgs = extract_images_from_page(doc, page, page_num)
        if not page_imgs:
            for q in questions:
                q["image"] = None
            all_questions.extend(questions)
            continue

        # Bbox вопросов (упрощённо — по первому span номера)
        bboxes = []
        for q in questions:
            for s in spans:
                num = parse_question_number(s["text"])
                if num == q["id"]:
                    bboxes.append((s["bbox"][1], s["bbox"][3] + 150))
                    break
            else:
                bboxes.append((0, 200))

        # Сопоставление: по порядку (1 img на 1 вопрос если поровну, иначе по вертикали)
        q_centers = [(b[0] + b[1]) / 2 for b in bboxes]
        img_centers = [(x[2][1] + x[2][3]) / 2 for x in page_imgs]

        used_imgs = set()
        for qi, q in enumerate(questions):
            best_img = None
            best_dist = float("inf")
            for ji, (xref, ib, bbox, ext) in enumerate(page_imgs):
                if ji in used_imgs:
                    continue
                cy = (bbox[1] + bbox[3]) / 2
                dist = abs(cy - q_centers[qi])
                if dist < best_dist:
                    best_dist = dist
                    best_img = (ji, ib, ext)
            if best_img:
                ji, ib, ext = best_img
                used_imgs.add(ji)
                all_images_to_save[q["id"]] = (ib, ext)

        for q in questions:
            if q["id"] in all_images_to_save:
                ext = all_images_to_save[q["id"]][1]
                ext = "png" if ext in ("png", "jpeg", "jpg") else "png"
                rel_path = f"/images/q_{q['id']}.{ext}"
                q["image"] = rel_path
            else:
                q["image"] = None
            all_questions.extend([q])

    # Убираем дубликаты по id (оставляем первое вхождение)
    seen = set()
    unique = []
    for q in all_questions:
        if q["id"] not in seen:
            seen.add(q["id"])
            unique.append(q)

    # Добавляем question_ru, answers_ru как пустые (заполнит translate.py)
    for q in unique:
        q.setdefault("question_ru", "")
        q.setdefault("answers_ru", {})

    # Сохраняем изображения
    for qid, (img_bytes, ext) in all_images_to_save.items():
        ext = "png" if ext in ("png", "jpeg", "jpg") else "png"
        path = IMAGES_DIR / f"q_{qid}.{ext}"
        with open(path, "wb") as f:
            f.write(img_bytes)

    doc.close()

    return unique


def main():
    pdf = os.environ.get("PDF_PATH") or None
    pdf_path = Path(pdf) if pdf else None
    questions = run_parser(pdf_path)

    OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(questions, f, ensure_ascii=False, indent=2)

    print(f"Сохранено {len(questions)} вопросов в {OUTPUT_JSON}")

    # Запуск валидации
    sys.path.insert(0, str(PROJECT_ROOT))
    from parser.validate import validate_and_log
    validate_and_log(questions)


if __name__ == "__main__":
    main()
