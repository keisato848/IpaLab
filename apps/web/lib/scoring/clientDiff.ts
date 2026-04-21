/**
 * クライアント側フォールバック diff
 *
 * バックエンド (#176) が ModelAnswerDiff を未提供の場合に、
 * ユーザー解答と模範解答から軽量な文字 N-gram ベースの diff を生成する。
 *
 * - アルゴリズム: 文字単位 LCS（最長共通部分列）
 * - 出力: shared の `ModelAnswerDiff` 構造（additions / deletions / rephrasing）
 *   rephrasing はヒューリスティック（隣接する add/del を対応付け）で算出
 *
 * 注意: 本実装は UI のフォールバックであり、本来は backend kuromoji + LLM で
 * 精度の高い diff を返すべき（#179 設計書 §3 参照）。
 */

import type { Scoring } from '@ipa-lab/shared';
type ModelAnswerDiff = Scoring.ModelAnswerDiff;

export interface DiffSegment {
  type: 'match' | 'addition' | 'deletion';
  text: string;
}

/**
 * 文字単位 LCS による diff セグメント列を返す。
 *
 * @param user   ユーザー解答
 * @param model  模範解答
 * @returns セグメント列（user 視点と model 視点の両方を再構築可能）
 */
export function computeCharDiff(
  user: string,
  model: string,
): { userSegments: DiffSegment[]; modelSegments: DiffSegment[] } {
  const u = Array.from(user);
  const m = Array.from(model);
  const n = u.length;
  const k = m.length;

  const dp: number[][] = Array.from({ length: n + 1 }, () => new Array(k + 1).fill(0));
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= k; j++) {
      if (u[i - 1] === m[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
      else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
    }
  }

  const userSegments: DiffSegment[] = [];
  const modelSegments: DiffSegment[] = [];
  let i = n;
  let j = k;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && u[i - 1] === m[j - 1]) {
      userSegments.push({ type: 'match', text: u[i - 1] });
      modelSegments.push({ type: 'match', text: m[j - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      modelSegments.push({ type: 'addition', text: m[j - 1] });
      j--;
    } else if (i > 0) {
      userSegments.push({ type: 'deletion', text: u[i - 1] });
      i--;
    }
  }
  userSegments.reverse();
  modelSegments.reverse();

  return {
    userSegments: mergeAdjacent(userSegments),
    modelSegments: mergeAdjacent(modelSegments),
  };
}

function mergeAdjacent(segs: DiffSegment[]): DiffSegment[] {
  const out: DiffSegment[] = [];
  for (const s of segs) {
    const last = out[out.length - 1];
    if (last && last.type === s.type) last.text += s.text;
    else out.push({ ...s });
  }
  return out;
}

/**
 * セグメント列から ModelAnswerDiff 構造へ集約する。
 *
 * - additions = model 側に連続する addition セグメントのテキスト配列
 * - deletions = user  側に連続する deletion  セグメントのテキスト配列
 * - rephrasing = 「過不足が2文字以上の対応」を単純対応でペア化（先頭から貪欲）
 */
export function toModelAnswerDiff(
  userSegments: DiffSegment[],
  modelSegments: DiffSegment[],
  options: { rephrasingMinLen?: number } = {},
): ModelAnswerDiff {
  const minLen = options.rephrasingMinLen ?? 2;
  const additions = modelSegments.filter((s) => s.type === 'addition').map((s) => s.text);
  const deletions = userSegments.filter((s) => s.type === 'deletion').map((s) => s.text);

  const rephrasing: { user: string; model: string }[] = [];
  const remainAdd = [...additions];
  const remainDel = [...deletions];
  for (let i = remainDel.length - 1; i >= 0; i--) {
    if (remainDel[i].length >= minLen) {
      const aIdx = remainAdd.findIndex((a) => a.length >= minLen);
      if (aIdx >= 0) {
        rephrasing.push({ user: remainDel[i], model: remainAdd[aIdx] });
        remainAdd.splice(aIdx, 1);
        remainDel.splice(i, 1);
      }
    }
  }

  return {
    additions: remainAdd,
    deletions: remainDel,
    rephrasing,
  };
}

/**
 * ショートカット: user/model 文字列から直接 ModelAnswerDiff を生成する。
 */
export function buildClientDiff(user: string, model: string): ModelAnswerDiff {
  const { userSegments, modelSegments } = computeCharDiff(user, model);
  return toModelAnswerDiff(userSegments, modelSegments);
}
