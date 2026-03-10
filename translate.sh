#!/bin/bash
# Перевод вопросов на русский через OpenAI API
# Требуется: .env с OPENAI_API_KEY

cd "$(dirname "$0")"
VENV=".venv"
if [ ! -d "$VENV" ]; then
  python3 -m venv "$VENV"
fi
source "$VENV/bin/activate"
pip install -q python-dotenv openai
python parser/translate.py
