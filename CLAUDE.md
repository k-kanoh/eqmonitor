# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

P2PQuake WebSocket Receiver - リアルタイムAPIからWebSocket経由で地震情報を受信し、震度に応じた音声再生とJSONファイル保存を行うツール。

WebSocket接続先:
- サンドボックス環境（デフォルト）: `wss://api-realtime-sandbox.p2pquake.net/v2/ws`
- 本番環境（--env prod）: `wss://api.p2pquake.net/v2/ws`

## Development Setup

```bash
# 仮想環境のセットアップ
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt

# 音声ファイルの準備（著作権上の理由でリポジトリには含まれていない）
# wav/info/, wav/eew/, wav/scale/ 各ディレクトリに以下のファイルを配置:
# 1.wav, 2.wav, 3.wav, 4.wav, 5-.wav, 5+.wav, 6-.wav, 6+.wav, 7.wav
```

**重要**: 音声ファイル（wav/）は著作権上の理由で.gitignoreに含まれており、リポジトリには保存されません。

## Common Commands

```bash
# プログラムの実行（デフォルト: サンドボックス環境、全ての震度で音声再生）
python mon.py

# オプション付きで実行
python mon.py --env prod      # 本番環境に接続
python mon.py --ignore 4      # 震度4以下を音声再生しない
python mon.py --ignore 5-     # 震度5弱以下を音声再生しない
python mon.py --output-dir my_data

# オプション組み合わせ例
python mon.py --env prod --ignore 3 --output-dir ./earthquake_data

# systemd使用時（本番環境、震度3以下を音声再生しない、JSON出力を抑制）
python mon.py --env prod --ignore 3 --quiet

# コードフォーマット（Ruff使用）
ruff format .
ruff format --check .

# Lintチェック
ruff check .
ruff check --fix .
```

## systemd Timer Setup（推奨）

systemdのユーザーモードとタイマーを使用してバックグラウンドで実行する方法：

**前提条件:**
- 管理者がユーザー作成時に `loginctl enable-linger kkano` を実行済み
- これにより、kkanoユーザーはログインなしでもユーザーサービスが起動可能

**セットアップ手順（sudo不要）:**

```bash
# ユーザー用ディレクトリ作成
mkdir -p ~/.config/systemd/user/

# ファイルをコピー
cp eqmonitor.service ~/.config/systemd/user/
cp eqmonitor.timer ~/.config/systemd/user/

# タイマーを有効化して起動
systemctl --user enable eqmonitor.timer
systemctl --user start eqmonitor.timer

# タイマーの状態確認
systemctl --user status eqmonitor.timer
systemctl --user list-timers

# サービスの状態確認
systemctl --user status eqmonitor

# タイマーを停止
systemctl --user stop eqmonitor.timer

# サービスを停止（手動停止）
systemctl --user stop eqmonitor
```

**systemdタイマーの動作:**
- 毎時0分にmon.pyの起動を試みる
- mon.pyが稼働中→ 何もしない（既存プロセス続行）
- mon.pyが停止中→ mon.pyを起動
- sudo不要（kkanoユーザーの権限で完結）
- reboot後もログインなしで自動起動（次の毎時0分に実行）

**設定内容:**
- 本番環境（`--env prod`）に接続
- 震度3以下は音声再生しない（`--ignore 3`）
- JSON詳細出力を抑制（`--quiet`）
- ログは `mon.log` に出力（stdout/stderrの両方）

## Architecture

単一クラス `P2PQuakeReceiver` で構成：

- **非同期処理**: `asyncio` と `websockets` を使用してWebSocket接続を維持
- **データフロー**: WebSocketメッセージ受信 → JSONパース → データ処理（音声再生 + ファイル保存）
- **ファイル保存**: `data/yyyyMMdd/code/yyyyMMddhhmmssfff.json` の形式で保存（対象コード: 551, 552, 554, 555, 556, 561, 9611）
- **音声再生**: aplayコマンドで非同期再生（code 551/556のみ、震度閾値でフィルタリング可能）

主要メソッド:
- `receive_messages()`: WebSocket接続の確立と無限ループでのメッセージ受信（切断時は正常終了）
- `process_data()`: 受信データの処理（震度判定、音声再生、ファイル保存の振り分け）
- `play_sound()`: aplayコマンドで音声ファイルを非同期再生
- `save_json()`: 受信データを time フィールドから抽出した日時をファイル名として保存

接続管理:
- サンドボックス環境は約10分で自動切断される
- `ConnectionClosed`例外を捕捉して、接続時間・切断コード・切断理由を表示
- 切断時は再接続せずにスクリプトを正常終了
- 接続開始時刻をログに記録

音声再生ロジック（code 551/556のみ）:
- code 551（地震情報）: `wav/info/{震度}.wav`（例: `5-.wav`, `6+.wav`）
  - 震度は `earthquake.maxScale` から取得
- code 556（緊急地震速報 第1報）: `wav/eew/{震度}.wav`
  - 震度は `areas[0].scaleTo` から取得（99の場合は `scaleFrom` を使用）
- code 556（緊急地震速報 第2報以降）: `wav/scale/{震度}.wav`
  - 震度は `areas[0].scaleTo` から取得（99の場合は `scaleFrom` を使用）
- デフォルト: 全ての震度で音声再生
- `--ignore` オプション: 指定震度以下の場合は音声再生をスキップ
- EEWの `scaleTo=99` は震度不明を意味し、その場合は `scaleFrom`（下限震度）で判定

震度マッピング:
- `SCALE_TO_WAV`: maxScale値（10,20,30,40,45,50,55,60,70）をWAVファイル名（"1","2","3","4","5-","5+","6-","6+","7"）に変換
- `WAV_TO_SCALE`: WAVファイル名からmaxScale値への逆マッピング（--ignoreオプションで使用）
- 震度5弱=5-.wav, 震度5強=5+.wav, 震度6弱=6-.wav, 震度6強=6+.wav

## Code Modifications

- WebSocket URLを変更する場合は `P2PQuakeReceiver.__init__()` の環境判定ロジックを編集
- 新しい環境を追加する場合は `--env` のchoicesと `__init__()` の条件分岐を追加
- 震度マッピングを変更する場合は `SCALE_TO_WAV` と `WAV_TO_SCALE` の両方を編集（対称性を保つこと）
- WAVファイルディレクトリは固定で `wav/` (変更する場合は `self.wav_dir` を編集)
- 保存対象のコードを変更する場合は `process_data()` メソッドの `if code in [551, 552, 554, 555, 556, 561, 9611]:` を編集
- 音声再生対象のコードを変更する場合は `process_data()` メソッドの `if code in [551, 556]:` を編集
- エラーハンドリングは既に実装済み（JSONパースエラー、WebSocket例外、KeyboardInterrupt、ConnectionClosed）
- 音声ファイルが存在しない場合は警告を出力して継続
- ファイル名は `time` フィールドから生成されるため、timeフォーマットが変わった場合は `save_json()` の `datetime.strptime()` を修正
