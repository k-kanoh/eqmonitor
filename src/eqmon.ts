#!/home/kkano/.nvm/versions/node/v24.11.0/bin/node

import "dotenv/config";
import "./date-extensions.js";
import { spawn } from "child_process";
import { join } from "path";
import { setTimeout as sleep } from "timers/promises";
import { program } from "commander";
import { formatDuration, intervalToDuration } from "date-fns";
import WebSocket from "ws";
import { CODE_NAMES, SCALE_TO_SIGN, SIGN_TO_SCALE } from "./constants.js";
import * as db from "./db.js";
import { generateEewFollowupVoice, generateEewVoice, generateJMAQuakeVoice } from "./voice.js";
import type { EEW, EventData, JMAQuake, UserquakeEvaluation } from "./types.js";

const PROJECT_ROOT = join(import.meta.dirname, "..");

interface ReceiverOptions {
  env?: string;
  silent?: string;
  quiet: boolean;
}

class P2PQuakeReceiver {
  private url: string;
  private envName: string;
  private silent?: string;
  private quiet: boolean;
  private detectAreas: string[];
  private lastDetectStartedAt?: string;

  constructor(options: ReceiverOptions) {
    this.detectAreas = process.env.DETECT_AREA ? process.env.DETECT_AREA.split(",") : [];

    switch (options.env) {
      case "prod":
        this.url = "wss://api.p2pquake.net/v2/ws";
        this.envName = "Production";
        break;
      default:
        this.url = "wss://api-realtime-sandbox.p2pquake.net/v2/ws";
        this.envName = "Sandbox";
        break;
    }

    this.silent = options.silent;
    this.quiet = options.quiet;
  }

  async connect(): Promise<void> {
    console.log("-".repeat(50));
    console.log(`Environment: ${this.envName}`);
    console.log(`Connecting to ${this.url}...`);

    const start = new Date();
    const ws = new WebSocket(this.url);

    ws.on("open", () => {
      console.log(`Connected successfully at ${start}!`);
      console.log("Receiving messages... (Press Ctrl+C to stop)");
      console.log("-".repeat(50));
      this.playSound(join(PROJECT_ROOT, "wav/tada.wav"));
    });

    ws.on("message", (msg: WebSocket.Data) => {
      try {
        const data = JSON.parse(msg.toString()) as EventData;

        console.log(`[${new Date()}] Received "${CODE_NAMES[data.code]}" message`);

        if (!this.quiet) {
          console.log(JSON.stringify(data, null, 2));
          console.log("-".repeat(50));
        }

        db.insert(data).catch((err) => {
          console.error(`DB insert failed: ${err.message}`);
        });

        this.playJingleAndGenerateVoice(data).catch((err) => {
          console.error(err.message);
        });
      } catch (error) {
        const err = error as Error;
        console.error(err.message);
        console.error(msg);
      }
    });

    ws.on("close", (code: number, reason: Buffer) => {
      const end = new Date();
      const duration = intervalToDuration({ start: 0, end: end.getTime() - start.getTime() });
      console.log(`[${end}] Connection closed after ${formatDuration(duration)}`);
      console.log(`Close code: ${code}, Reason: ${reason.toString() || "N/A"}`);
      this.playSound(join(PROJECT_ROOT, "wav/chimes.wav"));
    });

    ws.on("error", (error: Error) => {
      console.error(`WebSocket error: ${error.message}`);
    });

    const handleShutdown = () => {
      console.log("\nStopping receiver...");
      ws.close();
    };

    process.on("SIGINT", handleShutdown);
    process.on("SIGTERM", handleShutdown);
  }

  async playJingleAndGenerateVoice(data: EventData): Promise<void> {
    switch (data.code) {
      case 551: {
        const jmaQuake = data as JMAQuake;

        if (!jmaQuake.points.length) {
          return;
        }

        const pref = jmaQuake.points[0].pref;
        const scale = jmaQuake.points[0].scale;
        const scaleSign = SCALE_TO_SIGN[scale];

        if (this.silent && scale <= SIGN_TO_SCALE[this.silent]) {
          console.log(`Skipped sound playback: ${scaleSign} (silent: <= ${this.silent})`);
          return;
        }

        this.playSound(join(PROJECT_ROOT, "wav/info.wav"));
        const [voicePath] = await Promise.all([generateJMAQuakeVoice(pref, scale), sleep(800)]);
        this.playSound(voicePath);

        break;
      }
      case 556: {
        const eew = data as EEW;
        const area = eew.areas[0].name;
        const serial = parseInt(eew.issue.serial);
        const scale = eew.areas[0].scaleTo === 99 ? eew.areas[0].scaleFrom : eew.areas[0].scaleTo;
        const scaleSign = SCALE_TO_SIGN[scale];

        if (this.silent && scale <= SIGN_TO_SCALE[this.silent]) {
          console.log(`Skipped sound playback: ${scaleSign} (silent: <= ${this.silent})`);
          return;
        }

        if (serial > 1) {
          this.playSound(join(PROJECT_ROOT, "wav/eew2.wav"));
          const [voicePath] = await Promise.all([generateEewFollowupVoice(scale), sleep(200)]);
          this.playSound(voicePath);
        } else {
          this.playSound(join(PROJECT_ROOT, "wav/eew1.wav"));
          const [voicePath] = await Promise.all([generateEewVoice(area, scale), sleep(1000)]);
          this.playSound(voicePath);
        }

        break;
      }
      case 9611: {
        if (!this.detectAreas.length) {
          return;
        }

        const uqe = data as UserquakeEvaluation;

        if (this.lastDetectStartedAt === uqe.started_at) {
          return;
        }

        for (const area of this.detectAreas) {
          const areaConf = uqe.area_confidences[area];
          if (areaConf && areaConf.confidence >= 0.2) {
            this.playSound(join(PROJECT_ROOT, "wav/detect.wav"));
            this.lastDetectStartedAt = uqe.started_at;
            return;
          }
        }

        break;
      }
    }
  }

  private playSound(wav: string): void {
    try {
      const proc = spawn("aplay", [wav], { stdio: "ignore", detached: true });
      proc.unref();
      console.log(`Playing: ${wav}`);
    } catch (error) {
      const err = error as Error;
      console.error(`Error playing sound: ${err.message}`);
    }
  }
}

program
  .name("eqmon")
  .option("--env <type>", "prod:本番環境, 未指定:サンドボックス")
  .option("--silent <scale>", "震度<scale>以下は音声再生しない (例: 4, 5-)", (value) => {
    if (!SIGN_TO_SCALE[value]) {
      throw new Error("Invalid arguments.");
    }
    return value;
  })
  .option("--quiet", "受信したJSONをログに表示しない", false)
  .action(async (options: ReceiverOptions) => {
    await new P2PQuakeReceiver(options).connect();
  })
  .parse();
