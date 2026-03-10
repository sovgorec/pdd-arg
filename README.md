# ПДД Аргентина — приложение для изучения

Минималистичное веб-приложение для изучения экзаменационных вопросов ПДД Аргентины на основе PDF.

## Установка

### 1. Python (парсер и перевод)

```bash
pip install -r requirements.txt
```

### 2. Парсинг PDF

Положите PDF с вопросами в корень проекта и запустите:

```bash
python parser/parse_pdf.py
```

Скрипт найдёт PDF в корне, извлечёт вопросы и сохранит в `data/questions.json`, изображения — в `images/`.

### 3. Перевод на русский (опционально)

Создайте `.env` (см. `.env.example`) с ключом OpenAI:

```
OPENAI_API_KEY=sk-...
```

Запустите перевод:

```bash
./translate.sh
```

или:

```bash
python parser/translate.py
```

### 4. Веб-приложение

```bash
cd web && npm install && npm run dev
```

Откройте http://localhost:3000

## Деплой на GitHub и Vercel

```bash
git init
git add .
git commit -m "Initial commit"
git branch -M main
git remote add origin https://github.com/sovgorec/pdd-arg.git
git push -u origin main
```

Затем на [Vercel](https://vercel.com): Import → укажите **Root Directory** `web` → Deploy. Данные (`data/`, `images/`) копируются в `public/` при сборке.

## Возможности

- **Случайная выдача** — вопросы без повторов до полного прохода
- **Streak** — серия без ошибок, лучшая серия, статистика (LocalStorage)
- **Переключатель языка** — ES / RU
- **Режимы:** все вопросы, только с картинками, только ошибки, экзамен (20 вопросов)
