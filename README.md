# P2PQuake WebSocket Receiver

P2PQuakeのリアルタイムAPIからWebSocket経由で地震情報を受信し、震度に応じた音声再生とJSONファイル保存を行うツールです。

## セットアップ

### 仮想環境の作成とアクティベート

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

### 音声ファイルの準備

このツールは音声再生機能を利用するため、以下のディレクトリ構造でWAVファイルを準備する必要があります。

**重要**: 音声ファイルは著作権上の理由でリポジトリには含まれていません。各自で用意してください。

```
wav/
├── info/           # 地震情報（code 551）用
│   ├── 1.wav      # 震度1
│   ├── 2.wav      # 震度2
│   ├── 3.wav      # 震度3
│   ├── 4.wav      # 震度4
│   ├── 5-.wav     # 震度5弱
│   ├── 5+.wav     # 震度5強
│   ├── 6-.wav     # 震度6弱
│   ├── 6+.wav     # 震度6強
│   └── 7.wav      # 震度7
├── eew/            # 緊急地震速報 第1報（code 556）用
│   └── (同上)
└── scale/          # 緊急地震速報 第2報以降（code 556）用
    └── (同上)
```

音声ファイルが存在しない場合、警告が表示されますが、プログラムは継続して動作します（データ保存は行われます）。

## 使い方

### 基本的な使い方

```bash
# デフォルト設定で実行（全ての震度で音声再生）
python mon.py

# ヘルプを表示
python mon.py --help
```

### オプション

```bash
# 本番環境に接続
python mon.py --env prod

# 震度4以下を音声再生しない
python mon.py --ignore 4

# 震度5弱以下を音声再生しない
python mon.py --ignore 5-

# 震度5強以下を音声再生しない
python mon.py --ignore 5+

# 保存先ディレクトリを変更
python mon.py --output-dir my_data

# オプション組み合わせ例
python mon.py --env prod --ignore 3 --output-dir ./earthquake_data
```

#### 利用可能なオプション

- `--env`: 接続環境（デフォルト: サンドボックス環境）
  - `prod`: 本番環境に接続
- `--output-dir`: JSON保存先ディレクトリ（デフォルト: `data`）
- `--ignore`: この震度以下を音声再生しない（デフォルト: なし＝全て再生）
  - 指定可能な値: `1`, `2`, `3`, `4`, `5-`, `5+`, `6-`, `6+`, `7`
  - 例: `--ignore 4` で震度4以下（震度1,2,3,4）の音声をスキップ
  - 例: `--ignore 5-` で震度5弱以下（震度1,2,3,4,5弱）の音声をスキップ

### 停止

`Ctrl+C` で停止します。

## 機能

### 対応する地震情報コード

**音声再生対象**:
- **code 551**: 地震情報
- **code 556**: 緊急地震速報

**データ保存対象**:
- **code 551**: 地震情報
- **code 552**: 津波予報
- **code 554**: 緊急地震速報 発表検出
- **code 555**: 各地域ピア数
- **code 556**: 緊急地震速報（警報）
- **code 561**: 地震感知情報
- **code 9611**: 地震感知情報 解析結果

上記以外のcodeは無視されます。

### 音声再生ルール

1. **震度フィルタリング**: デフォルトは全ての震度で音声再生。`--ignore` で指定震度以下をスキップ可能
2. **code 551（地震情報）**: `wav/info/{震度}.wav` を再生（例: `5-.wav`, `6+.wav`）
   - 震度は `earthquake.maxScale` から取得
3. **code 556（緊急地震速報）**:
   - 第1報（`issue.serial == 1`）: `wav/eew/{震度}.wav` を再生
   - 第2報以降: `wav/scale/{震度}.wav` を再生
   - 震度は `areas[0].scaleTo` から取得（99の場合は `scaleFrom` を使用）
   - `scaleTo=99` は震度不明を意味し、その場合は下限震度（`scaleFrom`）で判定

### データ保存

- 受信したJSONデータは震度に関わらず**すべて保存**されます（対象コードのみ）
- 保存場所: `data/yyyyMMdd/code/yyyyMMddhhmmssfff.json`
  - `yyyyMMdd`: 受信日（`time`フィールドから抽出）
  - `code`: 情報コード（551, 552, 554, 555, 556, 561, 9611）
  - `yyyyMMddhhmmssfff`: 受信日時（ミリ秒まで）
  - 例: `data/20251021/551/20251021003516420.json`
  - 例: `data/20251021/556/20251021003516420.json`

## ディレクトリ構成

```
eqmonitor/
├── mon.py                # メインスクリプト
├── requirements.txt      # Python依存関係
├── README.md            # このファイル
├── CLAUDE.md            # Claude Code用プロジェクト情報
├── data/                # JSON保存先（自動作成）
│   └── 20251021/       # 日付ごと
│       ├── 551/        # 地震情報
│       │   └── 20251021003516420.json
│       ├── 552/        # 津波予報
│       ├── 556/        # 緊急地震速報
│       └── ...         # その他対象コード
└── wav/                 # 音声ファイル（各自で準備、詳細は「音声ファイルの準備」を参照）
    ├── info/           # 地震情報用
    ├── eew/            # 緊急地震速報（第1報）用
    └── scale/          # 緊急地震速報（第2報以降）用
```

## 震度とWAVファイルのマッピング

| maxScale | 震度   | WAVファイル名 |
|----------|--------|---------------|
| 10       | 震度1  | 1.wav         |
| 20       | 震度2  | 2.wav         |
| 30       | 震度3  | 3.wav         |
| 40       | 震度4  | 4.wav         |
| 45       | 震度5弱| 5-.wav        |
| 50       | 震度5強| 5+.wav        |
| 55       | 震度6弱| 6-.wav        |
| 60       | 震度6強| 6+.wav        |
| 70       | 震度7  | 7.wav         |

## コードチェック（Ruff）

```bash
# フォーマット適用
ruff format .

# フォーマットチェック
ruff format --check .

# Lintチェック
ruff check .

# Lint自動修正
ruff check --fix .
```

## 接続先API

**サンドボックス環境（デフォルト）**:
- WebSocket URL: `wss://api-realtime-sandbox.p2pquake.net/v2/ws`
- 約10分で自動切断されます

**本番環境（`--env prod`指定時）**:
- WebSocket URL: `wss://api.p2pquake.net/v2/ws`
- 実際の地震情報を受信します

**API仕様**: https://github.com/p2pquake/epsp-specifications/blob/master/json-api-v2.yaml

## 動作環境

- Python 3.10以上
- Ubuntu Server（aplayコマンドが利用可能な環境）
