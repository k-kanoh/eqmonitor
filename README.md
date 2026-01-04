# eqmonitor
P2P地震速報APIからリアルタイムで地震情報を受信し、音声で通知するアプリケーションです。

## 概要
P2P地震速報のWebSocket APIに接続し、以下の情報を受信・通知します。

- 緊急地震速報 (EEW)
- 地震情報 (震度速報)
- ユーザー地震検知評価

受信したデータはPostgreSQLデータベースに保存され、VOICEVOXを使用して音声で通知されます。

## 必要な環境
- Node.js v24以上
- Docker & Docker Compose
- Linux環境(音声再生に `aplay` を使用)

## インストール
```bash
npm i
```

## セットアップ
### 1. 環境変数の設定
`.env_example` を `.env` にコピーし、必要に応じて編集してください。
```bash
cp .env_example .env
```

`.env` の内容
```
DATABASE_URL=postgresql://admin:passw0rd@localhost:5814/eqmon
DETECT_AREA=460,465
```
- `DATABASE_URL`: PostgreSQLの接続文字列(compose.ymlに合わせる)
- `DETECT_AREA`: 地震検知通知を受け取る地域コード(カンマ区切り)
  - 地域コードは[epsp-area.csv](https://github.com/p2pquake/epsp-specifications/blob/master/epsp-area.csv)を参照

### 2. データベースとVOICEVOXの起動
```bash
mkdir db # 重要
docker compose up -d
```

### 3. ビルドとデータベース初期化
```bash
npm run build
npm run db:push
```

## 使用方法
### 地震監視の起動
```bash
# サンドボックス環境で起動
node dist/eqmon.js

# 本番環境で起動
node dist/eqmon.js --env prod

# 震度4以下を音声通知しない
node dist/eqmon.js --env prod --silent 4

# 震度5弱以下を音声通知しない
node dist/eqmon.js --env prod --silent 5-

# 受信したJSONをログに表示しない
node dist/eqmon.js --env prod --quiet
```

### Crontabで定期実行
```bash
crontab -e
```

毎時0分に実行(前のプロセスが生きていればスキップ)
```
0 * * * * /home/kkano/eqmon/run-once.sh dist/eqmon.js --env prod --silent 3 --quiet
```

### データのインポート
```bash
node dist/import.js data/
```

`data/` ディレクトリ内のすべてのJSONファイルをデータベースにインポートします。

### データのエクスポート
```bash
# 2025年12月のデータをエクスポート
node dist/export.js 202512

# 2025年12月1日のデータをエクスポート
node dist/export.js 20251201

# 複数月をエクスポート
node dist/export.js 202511 202512
```

## データの削除方法
```bash
# 1. データのエクスポート(必要に応じて)
node dist/export.js 202512

# 2. Dockerコンテナの停止
docker compose down

# 3. データベースとビルドファイルの削除
rm -rf db/ dist/
```

## オプション
### eqmon.js
- `--env <type>`: 環境の指定
  - `prod`: 本番環境 (wss://api.p2pquake.net/v2/ws)
  - 未指定: サンドボックス環境 (wss://api-realtime-sandbox.p2pquake.net/v2/ws)
- `--silent <scale>`: 指定震度以下は音声再生しない(例: `4`, `5-`, `5+`, `6-`, `6+`, `7`)
- `--quiet`: 受信したJSONをログに表示しない

## 音声ファイルについて
`wav/` ディレクトリ内の音声ファイルは[魔王魂](https://maou.audio/)から提供されており、[クリエイティブ・コモンズ 表示 4.0 国際 ライセンス](https://creativecommons.org/licenses/by/4.0/deed.ja)の下で利用しています。

| ファイル | 用途 | 出典 |
|---------|------|------|
| eew1.wav | 緊急地震速報(初報) | [魔王魂 ジングル04](https://maou.audio/se_jingle04/) |
| eew2.wav | 緊急地震速報(続報) | [魔王魂 システム27](https://maou.audio/se_system27/) |
| info.wav | 地震情報 | [魔王魂 システム29](https://maou.audio/se_system29/) |
| detect.wav | 地震検知 | [魔王魂 ワンポイント28](https://maou.audio/se_onepoint28/) |

## 依存ソフトウェアのライセンス
### PostgreSQL
PostgreSQL License(BSD/MITに類似した寛容なライセンス)で提供されています。

- ライセンス情報: https://www.postgresql.org/about/licence/
- 商用・非商用問わず自由に使用可能
- ライセンス料は無料

参考
- [PostgreSQL License](https://www.postgresql.org/about/licence/)
- [The PostgreSQL License – Open Source Initiative](https://opensource.org/license/postgresql)

### VOICEVOX
VOICEVOX Engine は LGPL(GNU Lesser General Public License)でライセンスされています。

- ソフトウェア自体: LGPL
- 生成された音声: 使用するキャラクターごとに利用規約が異なります
  - 商用利用の場合は、適切なクレジット表記が必要です
  - 詳細は各キャラクターの利用規約を確認してください

参考
- [VOICEVOX EULA](https://www.virvoxproject.com/en/voicevoxの利用規約)
- [voicevox_engine License](https://github.com/VOICEVOX/voicevox_engine/blob/master/LGPL_LICENSE)
