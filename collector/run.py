#!/usr/bin/env python3
"""
金鳞·点石 采集器入口

用法：
  # 默认采集今天（交易日下午运行）
  python collector/run.py

  # 指定日期（akshare 格式 YYYYMMDD）
  python collector/run.py --date 20260801

环境变量：
  INGEST_URL     目标接口，默认 http://localhost:3000/api/ingest
  INGEST_SECRET  与服务器 NUXT_INGEST_SECRET 一致的 HMAC 密钥

B主：GitHub Actions 定时（交易日下午 15:30 北京时间）自动运行
A备：本机 `python collector/run.py` 手动补跑 / 重跑
"""
from __future__ import annotations

import argparse
import datetime
import os
import sys

try:
    from dotenv import load_dotenv
    load_dotenv()
except Exception:
    pass

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src.fetchers import fetch_zt_pool, fetch_dt_pool, fetch_reasons
from src.client import ingest


def to_iso_date(d: str) -> str:
    """YYYYMMDD -> YYYY-MM-DD"""
    d = str(d).strip()
    if len(d) == 8 and d.isdigit():
        return f'{d[:4]}-{d[4:6]}-{d[6:8]}'
    return d


def main() -> int:
    parser = argparse.ArgumentParser(description='A股涨跌停采集器')
    parser.add_argument('--date', default='', help='交易日期 YYYYMMDD，默认今天')
    args = parser.parse_args()

    raw_date = args.date or datetime.date.today().strftime('%Y%m%d')
    iso_date = to_iso_date(raw_date)

    secret = os.environ.get('INGEST_SECRET')
    url = os.environ.get('INGEST_URL', 'http://localhost:3000/api/ingest')
    if not secret:
        print('[error] 缺少环境变量 INGEST_SECRET', file=sys.stderr)
        return 2

    print(f'[info] 采集日期={iso_date} 目标={url}')

    zt, dt = [], []
    try:
        zt = fetch_zt_pool(raw_date)
        print(f'[info] 涨停池获取 {len(zt)} 条')
    except Exception as e:
        print(f'[warn] 涨停池获取失败: {e}', file=sys.stderr)

    try:
        dt = fetch_dt_pool(raw_date)
        print(f'[info] 跌停池获取 {len(dt)} 条')
    except Exception as e:
        print(f'[warn] 跌停池获取失败: {e}', file=sys.stderr)

    # 尽力获取涨停原因并回填
    try:
        reasons = fetch_reasons(raw_date)
        for r in zt:
            if r['stock_code'] in reasons:
                r['reason_raw'] = reasons[r['stock_code']]
        print(f'[info] 涨停原因补齐 {len(reasons)} 条')
    except Exception as e:
        print(f'[warn] 涨停原因获取异常: {e}', file=sys.stderr)

    records = zt + dt
    if not records:
        print('[info] 无数据，跳过提交（可能非交易日）')
        return 0

    payload = {'trade_date': iso_date, 'source': 'akshare', 'records': records}
    try:
        result = ingest(url, secret, payload)
        print(f'[ok] 提交成功: {result}')
        return 0
    except Exception as e:
        print(f'[error] 提交失败: {e}', file=sys.stderr)
        return 1


if __name__ == '__main__':
    raise SystemExit(main())
