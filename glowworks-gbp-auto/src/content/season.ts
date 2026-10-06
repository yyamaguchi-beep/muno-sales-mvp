import { weekdayJa, zonedParts } from "../utils/date.js";

export interface SeasonContext {
  date: string;
  month: number;
  weekday: string;
  season: "春" | "夏" | "秋" | "冬";
  /** 季節感として使ってよい一般的な話題 (イベント・キャンペーンは含めない) */
  notes: string[];
  imageHint: string;
}

const MONTH_NOTES: Record<number, { notes: string[]; image: string }> = {
  1: { notes: ["寒さで朝起きるのがつらい時期", "年の始まりに生活リズムを見直す人が多い時期"], image: "winter clothes like wool coats and knit scarves" },
  2: { notes: ["寒暖差で体調を崩しやすい時期", "春からの過ごし方を考え始める時期"], image: "winter knitwear, late winter soft light" },
  3: { notes: ["年度の変わり目で環境が変わりやすい時期", "春物の衣類が増える時期"], image: "light spring jackets, soft spring light" },
  4: { notes: ["新年度で新しいことを始めたい人が多い時期", "環境の変化で疲れが出やすい時期"], image: "spring light, fresh green plants" },
  5: { notes: ["連休明けに生活リズムが乱れやすい時期", "気温差が大きい時期"], image: "early summer shirts, bright fresh green" },
  6: { notes: ["梅雨で気分や体調が揺らぎやすい時期", "湿気が多く外出がおっくうになりやすい時期"], image: "rainy season, soft diffused light, an umbrella by the entrance" },
  7: { notes: ["暑さで体力を消耗しやすい時期", "水分補給や休憩が大切な時期"], image: "summer cotton shirts, bright summer light" },
  8: { notes: ["猛暑で外出が大変な時期", "生活リズムが崩れやすい時期"], image: "bright summer light, linen clothes" },
  9: { notes: ["夏の疲れが出やすい時期", "残暑と朝晩の涼しさが混ざる時期"], image: "late summer to early autumn clothes" },
  10: { notes: ["朝晩の寒暖差が大きくなる時期", "日が短くなり始める時期", "秋冬物の衣類が増える時期"], image: "autumn knitwear and corduroy, warm autumn light" },
  11: { notes: ["空気が乾燥し始める時期", "日照時間が短くなり気分が沈みやすい時期"], image: "autumn coats and knit, warm low sunlight" },
  12: { notes: ["寒さが本格的になる時期", "年末で生活リズムが変わりやすい時期"], image: "winter coats and knitwear, crisp winter light" },
};

function seasonOf(month: number): SeasonContext["season"] {
  if (month >= 3 && month <= 5) return "春";
  if (month >= 6 && month <= 8) return "夏";
  if (month >= 9 && month <= 11) return "秋";
  return "冬";
}

export function seasonContext(now: Date, timeZone: string, dateStr: string): SeasonContext {
  const p = zonedParts(now, timeZone);
  const m = MONTH_NOTES[p.month]!;
  return {
    date: dateStr,
    month: p.month,
    weekday: weekdayJa(p.weekday),
    season: seasonOf(p.month),
    notes: m.notes,
    imageHint: m.image,
  };
}
