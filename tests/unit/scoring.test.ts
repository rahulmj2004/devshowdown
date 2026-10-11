import { describe, expect, it } from "vitest";
import { formatCompletionTime, formatScore, rankEntries } from "@/lib/scoring";
import type { RankingRule, ResultEntry } from "@/types";

const rule: RankingRule = {
  scoreLabel: "Score",
  scoreOrder: "desc",
  timeTiebreak: true,
  showTime: true,
};

const entry = (
  id: string,
  score: number,
  completionTimeMs: number | null = null,
): ResultEntry => ({
  id,
  eventSlug: "speed-typing",
  displayName: id,
  score,
  completionTimeMs,
});

const summary = (entries: ResultEntry[], r = rule) =>
  rankEntries(entries, r).map((row) => `${row.rank}:${row.id}`);

describe("rankEntries", () => {
  it("ranks higher scores first by default", () => {
    expect(summary([entry("a", 10), entry("b", 30), entry("c", 20)])).toEqual([
      "1:b",
      "2:c",
      "3:a",
    ]);
  });

  it("supports events where a lower score wins", () => {
    expect(
      summary([entry("a", 10), entry("b", 30)], { ...rule, scoreOrder: "asc" }),
    ).toEqual(["1:a", "2:b"]);
  });

  it("breaks score ties with the faster completion time", () => {
    expect(summary([entry("slow", 50, 9000), entry("fast", 50, 4000)])).toEqual(
      ["1:fast", "2:slow"],
    );
  });

  it("ranks a recorded time ahead of a missing one", () => {
    expect(summary([entry("none", 50), entry("timed", 50, 9000)])).toEqual([
      "1:timed",
      "2:none",
    ]);
  });

  it("gives genuine ties the same rank and skips the next one", () => {
    expect(
      summary([
        entry("a", 50, 1000),
        entry("b", 40, 2000),
        entry("c", 40, 2000),
        entry("d", 10, 500),
      ]),
    ).toEqual(["1:a", "2:b", "2:c", "4:d"]);
  });

  it("ignores time when the event does not use it as a tiebreak", () => {
    expect(
      summary([entry("a", 40, 9000), entry("b", 40, 1000)], {
        ...rule,
        timeTiebreak: false,
      }),
    ).toEqual(["1:a", "1:b"]);
  });

  it("does not mutate its input", () => {
    const input = [entry("a", 1), entry("b", 2)];
    rankEntries(input, rule);
    expect(input.map((row) => row.id)).toEqual(["a", "b"]);
  });
});

describe("formatting", () => {
  it("formats completion times", () => {
    expect(formatCompletionTime(61_240)).toBe("1:01.240");
    expect(formatCompletionTime(3_723_000)).toBe("1:02:03");
    expect(formatCompletionTime(null)).toBe("—");
  });

  it("formats scores without trailing noise", () => {
    expect(formatScore(96)).toBe("96");
    expect(formatScore(96.456)).toBe("96.46");
  });
});
