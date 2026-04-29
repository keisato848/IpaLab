import { describe, it, expect } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { PerspectiveCard } from "@/components/features/scoring/PerspectiveCard";

describe("PerspectiveCard", () => {
  it("短答式: スコアと観点名を描画", () => {
    render(
      <PerspectiveCard
        variant="short_answer"
        data={{
          id: "keyword_coverage",
          name: "キーワード網羅",
          score: 78,
          weight: 0.3,
          rationale: "T1 が 1 件不足",
          matchedKeywords: ["多要素認証"],
          missingKeywords: ["権限昇格"],
        }}
      />,
    );
    expect(screen.getByText("キーワード網羅")).toBeTruthy();
    expect(screen.getByText("78")).toBeTruthy();
    expect(screen.getByText("多要素認証")).toBeTruthy();
    expect(screen.getByText("権限昇格")).toBeTruthy();
  });

  it("論述式: subQuestion と evidence を表示", () => {
    render(
      <PerspectiveCard
        variant="essay"
        data={{
          id: "concreteness_experience",
          name: "具体性・実体験性",
          score: 65,
          rationale: "OK",
          subQuestion: "イ",
          evidenceQuotes: ["当社A事業部のPMとして"],
        }}
      />,
    );
    expect(screen.getByText(/設問イ/)).toBeTruthy();
    expect(screen.getByText(/当社A事業部のPMとして/)).toBeTruthy();
  });

  it("error 表示", () => {
    render(
      <PerspectiveCard
        data={{ id: "x", name: "X", score: 0 }}
        error="LLM timeout"
      />,
    );
    expect(screen.getByText(/採点エラー: LLM timeout/)).toBeTruthy();
    expect(screen.queryByText("要改善")).toBeNull();
  });

  it("60点未満の観点は要改善バッジを表示", () => {
    render(
      <PerspectiveCard
        data={{
          id: "logical_composition",
          name: "論理構成",
          score: 59,
          rationale: "弱点あり",
        }}
      />,
    );
    expect(screen.getByText("要改善")).toBeTruthy();
  });

  it("defaultExpanded=false の場合は詳細を閉じて開始し、クリックで展開する", () => {
    render(
      <PerspectiveCard
        data={{
          id: "x",
          name: "折りたたみ確認",
          score: 80,
          rationale: "詳細コメント",
        }}
        defaultExpanded={false}
      />,
    );

    const toggle = screen.getByRole("button", {
      name: "折りたたみ確認の詳細を開く",
    });
    expect(toggle.getAttribute("aria-expanded")).toBe("false");
    expect(screen.queryByText("詳細コメント")).toBeNull();

    fireEvent.click(toggle);

    expect(toggle.getAttribute("aria-expanded")).toBe("true");
    expect(screen.getByText("詳細コメント")).toBeTruthy();
  });
});
