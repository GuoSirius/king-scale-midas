# 采集器（B主 + A备）

- **B主（主）**：GitHub Actions 定时任务，交易日下午 15:30（北京时间）自动拉取并写入。
- **A备（备）**：本机 `python collector/run.py` 手动补跑 / 重跑（拉取代码后即可用）。

## 本地运行
```bash
cd king-scale-midas
pip install -r collector/requirements.txt
export INGEST_URL=https://your-domain/api/ingest
export INGEST_SECRET=你的密钥
python collector/run.py                # 今天
python collector/run.py --date 20260801 # 指定日
```

## 数据流
akshare（涨停/跌停池）→ 清洗 → pywencai（尽力补涨停原因）→ HMAC 签名 → `POST /api/ingest`

采集器与 Web 应用完全解耦：换数据源不影响前端，采集挂了不影响站点。
