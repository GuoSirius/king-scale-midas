"""采集器 → /api/ingest 的 HTTP 客户端（HMAC-SHA256 签名）。"""
from __future__ import annotations

import hashlib
import hmac
import json

import requests


def sign(secret: str, body: str) -> str:
    return hmac.new(secret.encode('utf-8'), body.encode('utf-8'), hashlib.sha256).hexdigest()


def ingest(url: str, secret: str, payload: dict, timeout: int = 90) -> dict:
    body = json.dumps(payload, ensure_ascii=False)
    headers = {
        'Content-Type': 'application/json; charset=utf-8',
        'X-Signature': sign(secret, body),
    }
    resp = requests.post(url, data=body.encode('utf-8'), headers=headers, timeout=timeout)
    resp.raise_for_status()
    return resp.json()
