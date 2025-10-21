#!/usr/bin/env python3
"""
P2PQuake WebSocket Receiver
WebSocketからJSONデータを受信して保存するスクリプト
"""

import argparse
import asyncio
import json
import os
import subprocess
import sys
from datetime import datetime

import websockets


class P2PQuakeReceiver:
    # maxScale値からWAVファイル名へのマッピング
    # 10=1, 20=2, 30=3, 40=4, 45=5弱, 50=5強, 55=6弱, 60=6強, 70=7
    SCALE_TO_WAV = {
        10: "1",  # 震度1 -> 1.wav
        20: "2",  # 震度2 -> 2.wav
        30: "3",  # 震度3 -> 3.wav
        40: "4",  # 震度4 -> 4.wav
        45: "5-",  # 震度5弱 -> 5-.wav
        50: "5+",  # 震度5強 -> 5+.wav
        55: "6-",  # 震度6弱 -> 6-.wav
        60: "6+",  # 震度6強 -> 6+.wav
        70: "7",  # 震度7 -> 7.wav
    }

    # WAVファイル名からmaxScale値への逆マッピング
    WAV_TO_SCALE = {
        "1": 10,
        "2": 20,
        "3": 30,
        "4": 40,
        "5-": 45,
        "5+": 50,
        "6-": 55,
        "6+": 60,
        "7": 70,
    }

    def __init__(self, output_dir="data", ignore_scale=None, env=None):
        """
        Args:
            output_dir: JSON保存先ディレクトリ
            ignore_scale: この震度以下を音声再生しない（例: "4", "5-"）。Noneの場合は全て再生
            env: 接続環境。"prod"で本番環境、Noneでサンドボックス環境
        """
        # 環境に応じてURIを設定
        if env == "prod":
            self.uri = "wss://api.p2pquake.net/v2/ws"
            self.env_name = "Production"
        else:
            self.uri = "wss://api-realtime-sandbox.p2pquake.net/v2/ws"
            self.env_name = "Sandbox"

        self.output_dir = output_dir
        self.wav_dir = "wav"
        self.ignore_scale = ignore_scale
        self.ensure_output_dir()

    def ensure_output_dir(self):
        """出力ディレクトリが存在することを確認"""
        if not os.path.exists(self.output_dir):
            os.makedirs(self.output_dir)
            print(f"Created output directory: {self.output_dir}")

    def play_sound(self, sound_type, wav_filename):
        """
        音声ファイルを再生

        Args:
            sound_type: "info", "eew", "scale" のいずれか
            wav_filename: WAVファイル名（拡張子なし）(例: "1", "5-", "6+", "7")
        """
        wav_file = f"{self.wav_dir}/{sound_type}/{wav_filename}.wav"

        if not os.path.exists(wav_file):
            print(f"Warning: WAV file not found: {wav_file}", file=sys.stderr)
            return False

        try:
            # aplay で音声再生（非同期、バックグラウンドで実行）
            subprocess.Popen(
                ["aplay", wav_file],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            print(f"Playing: {wav_file}")
            return True
        except Exception as e:
            print(f"Error playing sound: {e}", file=sys.stderr)
            return False

    def process_data(self, data):
        """
        受信したデータを処理（音声再生、保存）

        Args:
            data: 受信したJSONデータ
        """
        code = data.get("code")

        # 音声再生処理（551/556のみ）
        if code in [551, 556]:
            # 震度を取得
            max_scale = None
            if code == 551:
                # code 551: earthquake.maxScale を使用
                max_scale = data.get("earthquake", {}).get("maxScale")
            elif code == 556:
                # code 556: areas[0].scaleTo を使用（99の場合はscaleFrom）
                areas = data.get("areas", [])
                if areas and len(areas) > 0:
                    scale_to = areas[0].get("scaleTo")
                    if scale_to == 99:
                        # scaleTo が 99（不明）の場合は scaleFrom を使用
                        max_scale = areas[0].get("scaleFrom")
                    else:
                        max_scale = scale_to

            if max_scale is None:
                print(f"Warning: maxScale not found for code {code}", file=sys.stderr)
            else:
                # maxScale から WAVファイル名を取得
                wav_filename = self.SCALE_TO_WAV.get(max_scale)
                if wav_filename is None:
                    print(
                        f"Warning: Unknown maxScale value: {max_scale}",
                        file=sys.stderr,
                    )
                else:
                    # ignore_scale以下の震度の場合は音声再生をスキップ
                    should_play_sound = True
                    if self.ignore_scale is not None:
                        ignore_max_scale = self.WAV_TO_SCALE.get(self.ignore_scale)
                        if (
                            ignore_max_scale is not None
                            and max_scale <= ignore_max_scale
                        ):
                            print(
                                f"Skipped sound playback: maxScale {max_scale} (ignore: <= {self.ignore_scale})"
                            )
                            should_play_sound = False

                    if should_play_sound:
                        # code 551: 地震情報 -> info
                        if code == 551:
                            self.play_sound("info", wav_filename)

                        # code 556: 緊急地震速報
                        elif code == 556:
                            issue = data.get("issue", {})
                            serial_str = issue.get("serial")

                            # serial は文字列の可能性があるため int に変換
                            try:
                                serial = int(serial_str) if serial_str else None
                            except (ValueError, TypeError):
                                serial = None

                            if serial is None:
                                print(
                                    "Warning: issue.serial not found", file=sys.stderr
                                )
                            elif serial == 1:
                                # 第1報 -> eew
                                self.play_sound("eew", wav_filename)
                            else:
                                # 第2報以降 -> scale
                                self.play_sound("scale", wav_filename)

        # ファイルに保存（全コード対象: 551, 552, 554, 555, 556, 561, 9611）
        if code in [551, 552, 554, 555, 556, 561, 9611]:
            self.save_json(data)
        else:
            print(f"Skipped save: code {code} (not in target codes)")

    def save_json(self, data):
        """
        受信したJSONデータをファイルに保存
        保存パス: data/yyyyMMdd/code/yyyyMMddhhmmssfff.json
        """
        code = data.get("code")
        time_str = data.get("time")

        if not time_str:
            print("Error: time field not found", file=sys.stderr)
            return None

        try:
            # time フィールドをパース: "2025/10/20 23:47:39.183"
            # フォーマット: "yyyy/MM/dd HH:mm:ss.fff"
            dt = datetime.strptime(time_str, "%Y/%m/%d %H:%M:%S.%f")

            # 日付部分: yyyyMMdd
            date_dir = dt.strftime("%Y%m%d")

            # ファイル名: yyyyMMddhhmmssfff (ミリ秒3桁)
            # %f は6桁なので最初の3桁だけ使う
            datetime_filename = dt.strftime("%Y%m%d%H%M%S%f")[:17]

            # ディレクトリ作成: data/yyyyMMdd/code/
            target_dir = f"{self.output_dir}/{date_dir}/{code}"
            if not os.path.exists(target_dir):
                os.makedirs(target_dir, exist_ok=True)
                print(f"Created directory: {target_dir}")

            # ファイル名: yyyyMMddhhmmssfff.json
            filename = f"{target_dir}/{datetime_filename}.json"

            # JSON保存
            with open(filename, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)
            print(f"Saved: {filename}")
            return filename

        except ValueError as e:
            print(f"Error parsing time field '{time_str}': {e}", file=sys.stderr)
            return None
        except Exception as e:
            print(f"Error saving file: {e}", file=sys.stderr)
            return None

    async def receive_messages(self):
        """WebSocketに接続してメッセージを受信"""
        print("-" * 50)
        print(f"Environment: {self.env_name}")
        print(f"Connecting to {self.uri}...")
        connection_start = datetime.now()

        try:
            async with websockets.connect(self.uri) as websocket:
                print(
                    f"Connected successfully at {connection_start.strftime('%Y-%m-%d %H:%M:%S')}!"
                )
                print("Receiving messages... (Press Ctrl+C to stop)")
                print("-" * 50)

                while True:
                    try:
                        # メッセージを受信
                        message = await websocket.recv()

                        # JSONとしてパース
                        data = json.loads(message)

                        # コンソールに表示
                        print(
                            f"[{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}] Received message:"
                        )
                        print(json.dumps(data, ensure_ascii=False, indent=2))

                        # データ処理（音声再生・ファイル保存）
                        self.process_data(data)
                        print("-" * 50)

                    except json.JSONDecodeError as e:
                        print(f"JSON decode error: {e}", file=sys.stderr)
                        print(f"Raw message: {message}", file=sys.stderr)
                    except websockets.exceptions.ConnectionClosed as e:
                        # 接続が閉じられた
                        connection_end = datetime.now()
                        duration = (connection_end - connection_start).total_seconds()
                        print(
                            f"[{connection_end.strftime('%Y-%m-%d %H:%M:%S')}] Connection closed after {duration:.1f} seconds"
                        )
                        print(f"Close code: {e.code}, Reason: {e.reason or 'N/A'}")
                        return

        except websockets.exceptions.WebSocketException as e:
            connection_end = datetime.now()
            duration = (connection_end - connection_start).total_seconds()
            print(f"WebSocket error after {duration:.1f} seconds: {e}", file=sys.stderr)
        except KeyboardInterrupt:
            print("Stopping receiver...")
        except Exception as e:
            print(f"Unexpected error: {e}", file=sys.stderr)


async def main():
    parser = argparse.ArgumentParser(
        description="P2PQuake WebSocket Receiver - 地震情報を受信して音声再生・JSON保存"
    )
    parser.add_argument(
        "--output-dir",
        default="data",
        help="JSON保存先ディレクトリ (デフォルト: data)",
    )
    parser.add_argument(
        "--ignore",
        type=str,
        choices=["1", "2", "3", "4", "5-", "5+", "6-", "6+", "7"],
        help="この震度以下を音声再生しない (例: 4, 5-) デフォルト: 全て再生",
    )
    parser.add_argument(
        "--env",
        type=str,
        choices=["prod"],
        help="接続環境 (prod: 本番環境, 未指定: サンドボックス環境)",
    )

    args = parser.parse_args()

    receiver = P2PQuakeReceiver(
        output_dir=args.output_dir,
        ignore_scale=args.ignore,
        env=args.env,
    )
    await receiver.receive_messages()


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("Program terminated.")
