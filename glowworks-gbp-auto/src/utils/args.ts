/** 最小限の CLI 引数パーサ: --key value / --flag */
export function parseArgs(argv = process.argv.slice(2)): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i]!;
    if (!a.startsWith("--")) continue;
    const [k, inline] = a.slice(2).split("=", 2) as [string, string | undefined];
    if (inline !== undefined) out[k] = inline;
    else if (argv[i + 1] && !argv[i + 1]!.startsWith("--")) out[k] = argv[++i]!;
    else out[k] = true;
  }
  return out;
}
