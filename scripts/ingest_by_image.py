#!/usr/bin/env python3
"""
AI 智慧輸入法：用 Google AI Studio (OpenAI 相容端點) 從書/雜誌圖片抽欄位。

Usage:
  GEMINI_API_KEY=... python3 scripts/ingest_by_image.py img1.jpg [img2.jpg ...]
  python3 scripts/ingest_by_image.py --api-key $GEMINI_API_KEY --model gemini-3-flash-preview cover.jpg copyright.jpg

Output:
  JSON to stdout
"""

from __future__ import annotations

import argparse
import base64
import json
import mimetypes
import os
import re
import sys
from typing import Any, Dict, List

try:
    from openai import OpenAI
except Exception:
    print("請先安裝: pip install openai", file=sys.stderr)
    raise

BASE_URL = "https://generativelanguage.googleapis.com/v1beta/openai/"
DEFAULT_MODEL = os.getenv("GEMINI_MODEL", "gemini-3-flash-preview")

SCHEMA: Dict[str, Any] = {
    "material_type": "book|magazine",
    "title": "",
    "subtitle": "",
    "authors": [],
    "publisher": "",
    "pub_year": "",
    "isbn": "",
    "issn": "",
    "volume": "",
    "issue": "",
    "publish_date": "",
    "language": "",
    "confidence": 0.0,
    "notes": "",
}

SYSTEM_PROMPT = """你是圖書館建檔助手，任務是從圖片辨識並輸出書目欄位。
嚴格規則：
1) 只能輸出 JSON，且鍵值必須包含：material_type,title,subtitle,authors,publisher,pub_year,isbn,issn,volume,issue,publish_date,language,confidence,notes
2) 不可臆測，不確定就填空字串或空陣列。
3) material_type 只能是 book 或 magazine。
4) 雜誌優先抽取 ISSN/volume/issue/publish_date；圖書優先抽取 ISBN。
5) confidence 為 0~1 的小數。
6) publish_date 盡量輸出 YYYY-MM-DD，若只知道年月可用 YYYY-MM。
"""


def _guess_mime(path: str) -> str:
    mt, _ = mimetypes.guess_type(path)
    return mt or "image/jpeg"


def image_to_data_url(path: str) -> str:
    with open(path, "rb") as f:
        b64 = base64.b64encode(f.read()).decode("ascii")
    return f"data:{_guess_mime(path)};base64,{b64}"


def coerce_payload(obj: Dict[str, Any]) -> Dict[str, Any]:
    out = dict(SCHEMA)
    for k in out.keys():
        if k in obj:
            out[k] = obj[k]

    if out["material_type"] not in ("book", "magazine"):
        out["material_type"] = ""

    if not isinstance(out["authors"], list):
        out["authors"] = []

    # normalize
    out["isbn"] = str(out["isbn"]).replace("-", "").strip()
    out["issn"] = str(out["issn"]).upper().replace(" ", "")
    out["pub_year"] = str(out["pub_year"]).strip()
    out["publish_date"] = str(out["publish_date"]).strip()

    try:
        out["confidence"] = float(out["confidence"])
    except Exception:
        out["confidence"] = 0.0
    out["confidence"] = max(0.0, min(1.0, out["confidence"]))

    # soft checks
    notes = []
    if out["isbn"] and not re.fullmatch(r"\d{10}|\d{13}", out["isbn"]):
        notes.append("isbn格式疑似不正確")
    if out["issn"] and not re.fullmatch(r"\d{4}-?\d{3}[\dX]", out["issn"]):
        notes.append("issn格式疑似不正確")

    if notes:
        out["notes"] = (str(out.get("notes") or "") + ("；" if out.get("notes") else "") + "；".join(notes)).strip("；")

    return out


def extract_json(text: str) -> Dict[str, Any]:
    text = text.strip()
    # remove markdown fences
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)

    try:
        return json.loads(text)
    except Exception:
        pass

    # best-effort extract first json object
    m = re.search(r"\{[\s\S]*\}", text)
    if not m:
        raise ValueError("模型回應不是 JSON")
    return json.loads(m.group(0))


def run(api_key: str, model: str, image_paths: List[str]) -> Dict[str, Any]:
    client = OpenAI(api_key=api_key, base_url=BASE_URL)

    content: List[Dict[str, Any]] = [
        {"type": "text", "text": "請從這些圖片抽取欄位，僅輸出 JSON。"}
    ]
    for p in image_paths:
        content.append({
            "type": "image_url",
            "image_url": {"url": image_to_data_url(p)}
        })

    resp = client.chat.completions.create(
        model=model,
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": content},
        ],
        temperature=0.1,
    )

    text = resp.choices[0].message.content or "{}"
    raw = extract_json(text)
    parsed = coerce_payload(raw)
    parsed["_meta"] = {
        "model": model,
        "image_count": len(image_paths),
        "source": "google-ai-studio-openai-compatible",
    }
    return parsed


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("images", nargs="+", help="image file paths")
    ap.add_argument("--api-key", default=os.getenv("GEMINI_API_KEY", ""))
    ap.add_argument("--model", default=DEFAULT_MODEL)
    args = ap.parse_args()

    if not args.api_key:
        print("缺少 API key，請設 GEMINI_API_KEY 或 --api-key", file=sys.stderr)
        return 2

    for p in args.images:
        if not os.path.exists(p):
            print(f"找不到檔案: {p}", file=sys.stderr)
            return 2

    try:
        out = run(args.api_key, args.model, args.images)
        print(json.dumps(out, ensure_ascii=False, indent=2))
        return 0
    except Exception as e:
        print(f"執行失敗: {e}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
