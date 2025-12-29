import { createHash } from "crypto";
import { writeFile, access } from "fs/promises";
import { KANA_MAP, SCALE_TO_SIGN } from "./constants.js";

export async function generateJMAQuakeVoice(pref: string, scale: number): Promise<string> {
  const scaleText = SCALE_TO_SIGN[scale].replace("-", "弱").replace("+", "強");
  const voiceText = `${pref}で、震度${scaleText}の地震が発生しました`;
  return await generateVoice(voiceText, scale);
}

export async function generateEewVoice(area: string, scale: number): Promise<string> {
  const scaleText = SCALE_TO_SIGN[scale].replace("-", "弱").replace("+", "強");
  const voiceText = `震度${scaleText}、${area}`;
  return await generateVoice(voiceText, scale);
}

export async function generateEewFollowupVoice(scale: number): Promise<string> {
  const scaleText = SCALE_TO_SIGN[scale].replace("-", "弱").replace("+", "強");
  return await generateVoice(`震度${scaleText}`, scale);
}

async function generateVoice(text: string, scale: number): Promise<string> {
  const hash = createHash("sha1").update(text).digest("hex");
  const wavPath = `/tmp/${hash}.wav`;

  try {
    await access(wavPath);
    return wavPath;
  } catch {}

  const queryUrl = new URL("http://localhost:50021/audio_query");
  queryUrl.searchParams.set("speaker", "1");
  queryUrl.searchParams.set("text", text);

  const queryResponse = await fetch(queryUrl.toString(), { method: "POST" });
  if (!queryResponse.ok) {
    throw new Error(`Audio query failed: ${queryResponse.statusText}`);
  }
  const baseQuery: any = await queryResponse.json();

  const [from, to] = KANA_MAP[scale];
  const replacedKana = baseQuery.kana.replace(from, to);

  const phrasesUrl = new URL("http://localhost:50021/accent_phrases");
  phrasesUrl.searchParams.set("speaker", "1");
  phrasesUrl.searchParams.set("is_kana", "true");
  phrasesUrl.searchParams.set("text", replacedKana);

  const phrasesResponse = await fetch(phrasesUrl.toString(), { method: "POST" });
  if (!phrasesResponse.ok) {
    throw new Error(`Accent phrases failed: ${phrasesResponse.statusText}`);
  }
  const phrasesQuery: any = await phrasesResponse.json();

  const mergedQuery = {
    ...baseQuery,
    accent_phrases: phrasesQuery,
    speedScale: 1.4,
    volumeScale: 2,
  };

  const synthesisUrl = new URL("http://localhost:50021/synthesis");
  synthesisUrl.searchParams.set("speaker", "1");

  const synthesisResponse = await fetch(synthesisUrl.toString(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(mergedQuery),
  });

  if (!synthesisResponse.ok) {
    throw new Error(`Synthesis failed: ${synthesisResponse.statusText}`);
  }

  const wavBuffer = await synthesisResponse.arrayBuffer();
  await writeFile(wavPath, Buffer.from(wavBuffer));
  return wavPath;
}
