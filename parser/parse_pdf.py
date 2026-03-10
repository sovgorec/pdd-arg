#!/usr/bin/env python3
"""
Парсер PDF с вопросами ПДД Аргентины.
Извлекает: номер, страница, категории, текст вопроса, варианты A/B/C, правильный ответ, изображения.
"""

import json
import math
import os
import re
import sys
from pathlib import Path

import fitz

PROJECT_ROOT = Path(__file__).resolve().parent.parent
OUTPUT_JSON = PROJECT_ROOT / "data" / "questions.json"
IMAGES_DIR = PROJECT_ROOT / "images"

MIN_IMAGE_HEIGHT = 40
MAX_IMAGE_X_FOR_CONTENT = 200  # левее — контентное изображение
DEBUG_IMAGE_BINDING = os.environ.get("DEBUG_IMAGES") == "1"  # id, page, image path

# Категории по номерам страниц PDF (1-based)
# Base: 1–52, A: 53–76, B: 77–94, C/G/E: 95–106, D: 107+
def get_categories_for_page(pdf_page_1based: int) -> list[str]:
    """Вернуть категории по номеру страницы PDF (1-based)."""
    p = pdf_page_1based
    if 1 <= p <= 52:
        return ["base"]
    if 53 <= p <= 76:
        return ["A"]
    if 77 <= p <= 94:
        return ["B"]
    if 95 <= p <= 106:
        return ["C", "G", "E"]
    if p >= 107:
        return ["D"]
    return ["base"]


def find_pdf() -> Path:
    pdfs = list(PROJECT_ROOT.glob("*.pdf"))
    if not pdfs:
        raise FileNotFoundError(f"PDF не найден в {PROJECT_ROOT}")
    return pdfs[0]


def is_bold(span: dict) -> bool:
    flags = span.get("flags", 0)
    if (flags & 16) != 0:
        return True
    font = span.get("font", "") or ""
    return "Bold" in font or "bold" in font.lower()


def collect_spans_from_page(page: fitz.Page) -> list[dict]:
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
    m = re.match(r"^(\d+)\s*[\.)]\s*", text.strip())
    return int(m.group(1)) if m else None


def parse_answer_option(text: str) -> str | None:
    t = text.strip()
    if re.match(r"^[aA]\s*[\.\)]\s*", t):
        return "A"
    if re.match(r"^[bB]\s*[\.\)]\s*", t):
        return "B"
    if re.match(r"^[cC]\s*[\.\)]\s*", t):
        return "C"
    return None


def extract_option_text(full: str, option: str) -> str:
    return re.sub(rf"^[aA]\s*[\.\)]\s*", "", full, count=1) if option == "A" else \
           re.sub(rf"^[bB]\s*[\.\)]\s*", "", full, count=1) if option == "B" else \
           re.sub(rf"^[cC]\s*[\.\)]\s*", "", full, count=1)


def get_question_answer_bboxes(spans: list[dict], q: dict) -> tuple[tuple, tuple | None]:
    """Получить bbox текста вопроса и вариантов по spans."""
    q_bbox = None
    ans_bbox = None
    for i, s in enumerate(spans):
        if parse_question_number(s["text"]) == q["id"]:
            q_bbox = s["bbox"]
            j = i + 1
            while j < len(spans):
                opt = parse_answer_option(spans[j]["text"])
                if opt == "A":
                    ans_bbox = list(spans[j]["bbox"])
                    k = j + 1
                    while k < len(spans) and parse_answer_option(spans[k]["text"]) in (None, "B", "C"):
                        if parse_answer_option(spans[k]["text"]) in ("A", "B", "C"):
                            b = spans[k]["bbox"]
                            ans_bbox[1] = min(ans_bbox[1], b[1])
                            ans_bbox[3] = max(ans_bbox[3], b[3])
                        k += 1
                    ans_bbox = tuple(ans_bbox)
                    break
                j += 1
            break
    return q_bbox or (0, 0, 0, 0), ans_bbox


def extract_questions_with_bboxes(spans: list[dict]) -> list[dict]:
    """Извлечь вопросы + question_bbox и answers_bbox."""
    questions = []
    i = 0
    while i < len(spans):
        s = spans[i]
        num = parse_question_number(s["text"])
        if num is not None and s["bold"]:
            q_text_parts = []
            q_bbox = list(s["bbox"])
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
                    b = ns["bbox"]
                    q_bbox[1] = min(q_bbox[1], b[1])
                    q_bbox[3] = max(q_bbox[3], b[3])
                    q_bbox[0] = min(q_bbox[0], b[0])
                    q_bbox[2] = max(q_bbox[2], b[2])
                i += 1

            question_text = " ".join(q_text_parts).strip()
            answers = {}
            correct_answer = None
            found_options = 0
            answers_bbox = [float("inf"), float("inf"), -float("inf"), -float("inf")]

            while i < len(spans) and found_options < 3:
                ns = spans[i]
                opt = parse_answer_option(ns["text"])
                if opt and opt not in answers:
                    ans_text = extract_option_text(ns["text"], opt)
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
                    b = ns["bbox"]
                    answers_bbox[0] = min(answers_bbox[0], b[0])
                    answers_bbox[1] = min(answers_bbox[1], b[1])
                    answers_bbox[2] = max(answers_bbox[2], b[2])
                    answers_bbox[3] = max(answers_bbox[3], b[3])
                    found_options += 1
                    i += 1
                elif opt:
                    break
                elif parse_question_number(ns["text"]) is not None and ns["bold"]:
                    break
                else:
                    if answers:
                        last_key = list(answers.keys())[-1]
                        answers[last_key] = (answers[last_key] + " " + ns["text"]).strip()
                        b = ns["bbox"]
                        answers_bbox[3] = max(answers_bbox[3], b[3])
                    i += 1

            if len(answers) == 3 and correct_answer:
                ab = tuple(answers_bbox) if answers_bbox[0] != float("inf") else None
                questions.append({
                    "id": num,
                    "question_original": question_text,
                    "answers_original": answers,
                    "correct_answer": correct_answer,
                    "image": None,
                    "_q_bbox": tuple(q_bbox),
                    "_ans_bbox": ab,
                })
            continue
        i += 1
    return questions


def extract_images_from_page(doc: fitz.Document, page: fitz.Page) -> list[tuple[int, bytes, tuple, str]]:
    result = []
    for img in page.get_images():
        xref = img[0]
        try:
            base = doc.extract_image(xref)
            img_bytes = base["image"]
            ext = base.get("ext", "png")
            if ext.lower() == "jpg":
                ext = "jpeg"
            rects = page.get_image_rects(xref)
            if not rects:
                continue
            rect = rects[0]
            bbox = (rect.x0, rect.y0, rect.x1, rect.y1)
            h = bbox[3] - bbox[1]
            x0 = bbox[0]
            if h >= MIN_IMAGE_HEIGHT and x0 <= MAX_IMAGE_X_FOR_CONTENT:
                result.append((xref, img_bytes, bbox, ext))
        except Exception:
            pass
    return result


def _image_belongs_to_question(
    img_bbox: tuple,
    question_top: float,
    answers_bottom: float,
    question_x0: float,
) -> bool:
    """
    Изображение принадлежит вопросу если:
    - image.y >= question_top - 80 AND image.y <= answers_bottom + 80
    - image.x < question_block.x (изображение слева от текста)
    """
    ix0, iy0, ix1, iy1 = img_bbox
    img_cy = (iy0 + iy1) / 2
    if img_cy < question_top - 80:
        return False
    if img_cy > answers_bottom + 80:
        return False
    if ix1 >= question_x0:
        return False
    return True


def associate_image_to_question(
    questions: list[dict],
    page_imgs: list[tuple],
    spans: list[dict],
) -> tuple[dict[int, tuple[bytes, str]], set[int]]:
    """
    Привязка по вертикальному диапазону.
    Возвращает (mapping: qid -> (bytes, ext), used_img_indices).
    """
    mapping: dict[int, tuple[bytes, str]] = {}
    used_imgs: set[int] = set()
    for q in questions:
        q_bbox, ans_bbox = get_question_answer_bboxes(spans, q)
        question_top = q_bbox[1]
        answers_bottom = ans_bbox[3] if ans_bbox else q_bbox[3]
        block_center_y = (question_top + answers_bottom) / 2
        question_x0 = q_bbox[0]

        candidates: list[tuple[int, float, tuple[bytes, str]]] = []
        for ji, (xref, ib, bbox, ext) in enumerate(page_imgs):
            if ji in used_imgs:
                continue
            if not _image_belongs_to_question(
                bbox, question_top, answers_bottom, question_x0
            ):
                continue
            img_cy = (bbox[1] + bbox[3]) / 2
            dist_y = abs(img_cy - block_center_y)
            candidates.append((ji, dist_y, (ib, ext)))

        if candidates:
            best_ji, _, best = min(candidates, key=lambda x: x[1])
            mapping[q["id"]] = best
            used_imgs.add(best_ji)
    return mapping, used_imgs


def run_parser(pdf_path: Path | None = None) -> tuple[list[dict], dict]:
    """
    Возвращает (questions, stats) где stats:
      questions_with_images, questions_without_images, images_without_question
    """
    pdf_path = pdf_path or find_pdf()
    IMAGES_DIR.mkdir(parents=True, exist_ok=True)

    doc = fitz.open(pdf_path)
    all_questions = []
    all_images_to_save: dict[int, tuple[bytes, str]] = {}
    total_page_imgs = 0
    total_used_imgs = 0
    debug_rows: list[tuple[int, int, str | None]] = []  # id, page, image_path

    start_page = 2  # пропуск обложки и оглавления
    for page_num in range(start_page, len(doc)):
        page = doc[page_num]
        spans = collect_spans_from_page(page)
        questions = extract_questions_with_bboxes(spans)

        pdf_page = page_num + 1  # 1-based номер страницы PDF
        for q in questions:
            q["page"] = pdf_page
            q["categories"] = get_categories_for_page(pdf_page)

        page_imgs = extract_images_from_page(doc, page)
        total_page_imgs += len(page_imgs)
        if page_imgs:
            img_map, used_imgs = associate_image_to_question(
                questions,
                page_imgs,
                spans,
            )
            total_used_imgs += len(used_imgs)
            for qid, (ib, ext) in img_map.items():
                all_images_to_save[qid] = (ib, ext)

            for q in questions:
                qid = q["id"]
                q.pop("_q_bbox", None)
                q.pop("_ans_bbox", None)
                if qid in all_images_to_save:
                    ext = all_images_to_save[qid][1]
                    ext = "png" if ext in ("png", "jpeg", "jpg") else "png"
                    path = f"/images/q_{qid}.{ext}"
                    q["image"] = path
                    if DEBUG_IMAGE_BINDING:
                        debug_rows.append((qid, pdf_page, path))
                else:
                    q["image"] = None
                    if DEBUG_IMAGE_BINDING:
                        debug_rows.append((qid, pdf_page, None))
        else:
            for q in questions:
                q["image"] = None
                q.pop("_q_bbox", None)
                q.pop("_ans_bbox", None)
                if DEBUG_IMAGE_BINDING:
                    debug_rows.append((q["id"], pdf_page, None))

        all_questions.extend(questions)

    seen = set()
    unique = []
    for q in all_questions:
        if q["id"] not in seen:
            seen.add(q["id"])
            unique.append(q)

    for q in unique:
        q.setdefault("question_ru", "")
        q.setdefault("answers_ru", {})

    for qid, (img_bytes, ext) in all_images_to_save.items():
        ext = "png" if ext in ("png", "jpeg", "jpg") else "png"
        p = IMAGES_DIR / f"q_{qid}.{ext}"
        with open(p, "wb") as f:
            f.write(img_bytes)

    doc.close()

    questions_with_images = sum(1 for q in unique if q.get("image"))
    questions_without_images = len(unique) - questions_with_images
    images_without_question = total_page_imgs - total_used_imgs
    stats = {
        "questions_with_images": questions_with_images,
        "questions_without_images": questions_without_images,
        "images_without_question": images_without_question,
    }

    if DEBUG_IMAGE_BINDING and debug_rows:
        print("\n--- DEBUG: question id | page | image path ---")
        for qid, p, img in debug_rows:
            print(f"  {qid} | {p} | {img or '-'}")
        print("--------------------------------------------\n")

    return unique, stats


def _load_existing_translations() -> dict[int, dict]:
    """Загрузить question_ru и answers_ru из существующего JSON, чтобы не затирать переводы."""
    out = {}
    if not OUTPUT_JSON.exists():
        return out
    try:
        data = json.loads(OUTPUT_JSON.read_text(encoding="utf-8"))
        for q in data:
            if isinstance(q, dict) and "id" in q:
                ru = q.get("question_ru") or ""
                ar = q.get("answers_ru") or {}
                if ru or (ar and len(ar) >= 3):
                    out[q["id"]] = {"question_ru": ru, "answers_ru": ar}
    except Exception:
        pass
    return out


def main():
    pdf = os.environ.get("PDF_PATH") or None
    pdf_path = Path(pdf) if pdf else None
    questions, stats = run_parser(pdf_path)

    print("\n--- Привязка изображений ---")
    print(f"questions_with_images: {stats['questions_with_images']}")
    print(f"questions_without_images: {stats['questions_without_images']}")
    print(f"images_without_question: {stats['images_without_question']}")
    print("-----------------------------\n")

    existing = _load_existing_translations()
    for q in questions:
        if q["id"] in existing:
            q["question_ru"] = existing[q["id"]]["question_ru"]
            q["answers_ru"] = existing[q["id"]]["answers_ru"]

    OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(questions, f, ensure_ascii=False, indent=2)

    print(f"Сохранено {len(questions)} вопросов в {OUTPUT_JSON}")

    sys.path.insert(0, str(PROJECT_ROOT))
    from parser.validate import validate_and_log
    validate_and_log(questions)


if __name__ == "__main__":
    main()
