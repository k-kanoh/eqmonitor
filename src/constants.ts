export const CODE_NAMES: Record<number, string> = {
  551: "JMAQuake",
  552: "JMATsunami",
  554: "EEWDetection",
  555: "Areapeers",
  556: "EEW",
  561: "Userquake",
  9611: "UserquakeEvaluation",
};

export const SCALE_TO_SIGN: Record<number, string> = {
  10: "1",
  20: "2",
  30: "3",
  40: "4",
  45: "5-",
  50: "5+",
  55: "6-",
  60: "6+",
  70: "7",
};

export const SIGN_TO_SCALE: Record<string, number> = {
  "1": 10,
  "2": 20,
  "3": 30,
  "4": 40,
  "5-": 45,
  "5+": 50,
  "6-": 55,
  "6+": 60,
  "7": 70,
};

export const KANA_MAP: Record<number, [string, string]> = {
  10: ["シンド'イチ", "シ'ンド/イチ'"],
  20: ["シンド'ニ", "シ'ンド/ニ'"],
  30: ["シンド'サン", "シ'ンド/サ'ン"],
  40: ["シンドヨ'ン", "シ'ンド/ヨ'ン"],
  45: ["シンドゴジャ'ク", "シ'ンド/ゴ'/ジャ'ク"],
  50: ["シンドゴキョ'オ", "シ'ンド/ゴ'/キョ'オ"],
  55: ["シンドロクジャ'ク", "シ'ンド/ロク'/ジャ'ク"],
  60: ["シンドロ_クキョ'オ", "シ'ンド/ロク'/キョ'オ"],
  70: ["シンド'ナナ", "シ'ンド/ナ'ナ"],
};
