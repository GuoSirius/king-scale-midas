"""
A股涨跌停数据采集（尽力而为）。

数据源：
- 涨停/跌停池：akshare（东方财富接口，免费、稳定、及时）
- 涨停原因：pywencai（同花顺问财，非官方，可能需 Cookie，失败则留空由用户补全）

设计：采集器与 Web 应用解耦，仅通过 /api/ingest 写入；本文件只负责「取数 + 清洗」。
"""
from __future__ import annotations

import re
from typing import Optional

import akshare as ak
import pandas as pd

try:
    import pywencai
except Exception:  # pywencai 为可选依赖
    pywencai = None


def _code_to_board(code: str) -> tuple[str, bool]:
    """根据代码前缀判定板块与是否 ST。"""
    c = str(code).strip()
    is_st = 'ST' in c.upper() or False
    if c.startswith(('60',)):
        return 'main', is_st
    if c.startswith(('000', '001', '002', '003')):
        return 'main', is_st
    if c.startswith('30'):
        return 'cyb', is_st
    if c.startswith('68'):
        return 'star', is_st
    if c.startswith(('8', '4', '92')):
        return 'bse', is_st
    return 'main', is_st


def _clean_time(val) -> Optional[str]:
    if val is None or (isinstance(val, float) and pd.isna(val)):
        return None
    s = str(val).strip()
    if not s or s in ('0', '00:00:00', 'None'):
        return None
    # 统一为 HH:MM:SS
    parts = re.split(r'[:：]', s)
    if len(parts) >= 2:
        h, m = parts[0].zfill(2), parts[1].zfill(2)
        return f'{h}:{m}:00'
    return None


def _safe(v, cast=float):
    if v is None:
        return None
    try:
        if isinstance(v, str) and v.strip() == '':
            return None
        return cast(v)
    except Exception:
        return None


def _normalize_pool_row(row: pd.Series, limit_type: str) -> dict:
    code = str(row.get('代码', '')).strip()
    board, is_st = _code_to_board(code)
    rec = {
        'stock_code': code,
        'stock_name': str(row.get('名称', '')).strip(),
        'board': board,
        'limit_type': limit_type,
        'price': _safe(row.get('最新价')),
        'pct': _safe(row.get('涨跌幅')),
        'first_limit_time': _clean_time(row.get('首次封板时间')),
        'last_limit_time': _clean_time(row.get('最后封板时间')),
        'open_times': _safe(row.get('炸板次数'), int) or 0,
        'turnover': _safe(row.get('成交额')),
        'volume': None,
        'circ_market_cap': _safe(row.get('流通市值')),
        'total_market_cap': _safe(row.get('总市值')),
        'zt_count': _safe(row.get('连板数'), int) or 1,
        'reason_raw': None,
        'tags': [],
    }
    industry = row.get('所属行业')
    if industry and str(industry).strip():
        rec['tags'].append({'type': 'sector', 'id': str(industry).strip()})
    return rec


def fetch_zt_pool(date: str) -> list[dict]:
    """涨停池（date: YYYYMMDD）"""
    df = ak.stock_zt_pool_em(date=date)
    return [_normalize_pool_row(r, 'up') for _, r in df.iterrows()]


def fetch_dt_pool(date: str) -> list[dict]:
    """跌停池（date: YYYYMMDD）"""
    df = ak.stock_dt_pool_em(date=date)
    return [_normalize_pool_row(r, 'down') for _, r in df.iterrows()]


def fetch_reasons(date: str) -> dict[str, str]:
    """
    尽力获取涨停原因。返回 {stock_code: reason_text}。
    依赖 pywencai（非官方），失败返回空 dict，由用户在前端补全。
    """
    if pywencai is None:
        return {}
    try:
        # 问财问句示例；不同版本 API 可能变化，这里做宽松解析
        resp = pywencai.get(query=f'{date} 涨停原因', question=f'{date}涨停原因')
        rows = resp.get('data', []) if isinstance(resp, dict) else resp
        out: dict[str, str] = {}
        for r in rows:
            code = str(r.get('代码') or r.get('stock_code') or '').strip()
            reason = r.get('涨停原因') or r.get('原因') or ''
            if code and reason:
                out[code] = str(reason)
        return out
    except Exception as e:
        print(f'[warn] 涨停原因获取失败（将留空，用户可前端补全）: {e}')
        return {}
