/**
 * P2PQuake API型定義
 * https://github.com/p2pquake/epsp-specifications/blob/master/json-api-v2.yaml
 */

export interface BasicData {
  _id: string;
  code: number;
  time: string;
}

export interface JMAQuake extends BasicData {
  code: 551;
  points: Array<{
    pref: string;
    scale: number;
  }>;
}

export interface EEW extends BasicData {
  code: 556;
  areas: Array<{
    name: string;
    scaleFrom: number;
    scaleTo: number;
  }>;
  issue: {
    serial: string;
  };
}

export interface UserquakeEvaluation extends BasicData {
  code: 9611;
  started_at: string;
  area_confidences: Record<
    string,
    {
      count: number;
      confidence: number;
    }
  >;
}

export type EventData = JMAQuake | EEW | UserquakeEvaluation;
