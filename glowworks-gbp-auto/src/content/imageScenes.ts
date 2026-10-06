/** 画像シーン・構図・人物のバリエーション定義 */

export interface Scene {
  id: string;
  label: string;
  subject: string;
  action: string;
  context: string;
  /** 人物が写らないシーン */
  noPeople?: boolean;
}

export const SCENES: Scene[] = [
  { id: "pc_work", label: "PCで作業している利用者", subject: "a person working on a laptop", action: "typing product details while glancing at a garment tag", context: "a bright shared work table in a small Japanese work-support office" },
  { id: "clothes_inspection", label: "古着を検品している様子", subject: "a person inspecting a second-hand garment", action: "checking a shirt collar and seams under natural light", context: "a tidy worktable with folded used clothing" },
  { id: "clothes_photo", label: "古着を撮影している様子", subject: "a person photographing a second-hand jacket", action: "taking a product photo of a garment on a hanger with a smartphone on a small tripod", context: "a simple white wall corner with a softbox-free natural light setup" },
  { id: "packing", label: "梱包作業", subject: "hands packing a folded garment", action: "placing a folded knit into a kraft paper mailer", context: "a clean packing station with kraft boxes and tape" },
  { id: "data_entry", label: "PC入力", subject: "a person entering item measurements into a spreadsheet", action: "reading a handwritten measurement note and typing", context: "a desk with a laptop, measuring tape and notebook" },
  { id: "staff_conversation", label: "スタッフと利用者の会話", subject: "a staff member and a participant talking calmly", action: "reviewing a simple work checklist together, seated side by side", context: "a table near a window with plants" },
  { id: "break_time", label: "休憩風景", subject: "a person taking a short break", action: "holding a mug and looking out of a window", context: "a small rest corner with a bench and potted plants" },
  { id: "workspace_interior", label: "作業スペース", subject: "an empty, organized work space", action: "morning sunlight falling across worktables", context: "a modest Japanese work-support office with wooden tables, beige walls and green plants", noPeople: true },
  { id: "consultation", label: "見学・相談の様子", subject: "a visitor and a staff member at a consultation table", action: "looking at a simple printed pamphlet together", context: "a quiet consultation table with a plant and two cups of tea" },
  { id: "daily_flow", label: "1日の流れ", subject: "a wall clock and a simple daily schedule board (no readable text)", action: "late morning light, tables being prepared for work", context: "a calm work room before work begins", noPeople: true },
  { id: "home_pc", label: "在宅PC作業", subject: "a person working on a laptop at home", action: "doing data entry at a small desk at home", context: "a modest Japanese apartment room with a low shelf and a plant" },
  { id: "lunch", label: "昼食", subject: "a simple Japanese lunch on a table", action: "a bento-style lunch set on a wooden table during a lunch break", context: "a shared dining table with natural light", noPeople: true },
  { id: "transport", label: "送迎", subject: "a white compact minivan parked on a quiet residential street", action: "morning, the sliding door open, ready for pick-up", context: "a quiet residential street in Osaka with low houses (no readable signs or license plates)", noPeople: true },
  { id: "clothes_rack", label: "古着ラック", subject: "a rack of second-hand clothes organized by color", action: "garments on wooden hangers with measurement tags", context: "a sunny storage corner of a small work-support office", noPeople: true },
  { id: "work_desk", label: "作業机", subject: "a focused person at an individual desk", action: "folding a garment neatly and checking a checklist", context: "a semi-partitioned desk with a plant, calm atmosphere" },
  { id: "staff", label: "スタッフ", subject: "a staff member preparing materials", action: "arranging work trays on a table", context: "a bright work room in the morning" },
  { id: "small_group", label: "少人数での作業", subject: "two or three people working at a shared table with comfortable distance", action: "each doing a different task: measuring, folding, typing", context: "a shared wooden table, relaxed and quiet" },
  { id: "seasonal", label: "季節感", subject: "seasonal still life in a work space", action: "seasonal clothing and a plant by the window reflecting the current season", context: "a window-side table in a small office", noPeople: true },
  { id: "first_day", label: "利用開始のイメージ", subject: "a person arriving at a work-support office for the first time", action: "being shown to a desk by a staff member, relaxed posture", context: "an entrance area with shoe shelves and plants" },
];

export const COMPOSITIONS = [
  { id: "wide", text: "wide-angle shot showing the whole space, eye level, 24mm" },
  { id: "close", text: "close-up shot, 85mm, subject fills most of the frame" },
  { id: "diagonal", text: "diagonal three-quarter angle, 35mm, leading lines across the table" },
  { id: "frontal", text: "straight-on frontal composition, 50mm, balanced and calm" },
  { id: "hands", text: "detail shot focusing on hands and objects, faces out of frame, 50mm macro feel" },
  { id: "person", text: "person-centered medium shot, waist up, 50mm" },
  { id: "space", text: "space-centered composition with the person small in the frame, lots of negative space" },
  { id: "dof", text: "shallow depth of field, f/1.8, soft bokeh background" },
  { id: "over_shoulder", text: "over-the-shoulder shot showing what the person is working on" },
  { id: "top_down", text: "top-down flat-lay view from directly above the table" },
] as const;

export const LIGHTINGS = [
  "soft morning sunlight through a window",
  "bright diffused daylight, airy and clean",
  "warm late-morning sunlight with gentle shadows",
  "soft overcast daylight, even and natural",
  "early afternoon sunlight with a warm tone",
] as const;

/** 人物像 — 毎回変える (日本人中心, 20〜50代, 性別を偏らせない) */
export const PEOPLE = [
  { id: "f20s", text: "a Japanese woman in her mid 20s with shoulder-length dark hair", clothing: "a beige knit sweater and wide trousers", gender: "f" },
  { id: "m20s", text: "a Japanese man in his late 20s with short black hair and glasses", clothing: "a plain olive overshirt over a white t-shirt", gender: "m" },
  { id: "f30s", text: "a Japanese woman in her 30s with hair tied back", clothing: "a light gray sweatshirt and an apron", gender: "f" },
  { id: "m30s", text: "a Japanese man in his 30s with a short beard", clothing: "a navy cardigan and chinos", gender: "m" },
  { id: "f40s", text: "a Japanese woman in her 40s with short hair", clothing: "a cream blouse and a dark green vest", gender: "f" },
  { id: "m40s", text: "a Japanese man in his 40s", clothing: "a simple dark sweater and work apron", gender: "m" },
  { id: "f50s", text: "a Japanese woman in her early 50s with glasses", clothing: "a soft brown cardigan", gender: "f" },
  { id: "m50s", text: "a Japanese man in his early 50s with graying hair", clothing: "a plain checked shirt", gender: "m" },
  { id: "nb20s", text: "a young Japanese adult in their 20s with a bob haircut", clothing: "an oversized vintage denim jacket", gender: "x" },
] as const;

export const EXPRESSIONS = [
  "calm and focused, neutral natural expression",
  "relaxed, a slight natural smile",
  "concentrated, looking at the work in hand",
  "thoughtful, attentive expression",
] as const;

export const NEGATIVE_CONSTRAINTS = [
  "no distorted fingers",
  "no malformed hands or extra fingers",
  "no duplicated people",
  "no unreadable or fake text, no letters on signs, screens or papers",
  "no logos or brand names",
  "no excessive smiling or posed stock-photo grins",
  "no hospital or clinical atmosphere",
  "no wheelchair unless the scene requires it",
  "no stereotypical or pitiful depiction of disability",
  "no western office, no luxury office, no skyscraper view",
  "no stock-photo feeling, no thumbs-up pose",
  "no surreal elements, no glowing effects",
  "no warped keyboard or laptop, keyboard keys must look regular",
  "no license plates",
];
