// Minimal Markdown reader for the research note: headings, bullets and paragraphs.
export type Block = { t: "h" | "h3" | "p" | "li"; x: string };

export function mdBlocks(s: string): Block[] {
  const out: Block[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) out.push({ t: "p", x: para.join(" ") });
    para = [];
  };
  for (const raw of s.split("\n")) {
    const l = raw.trim();
    let m: RegExpMatchArray | null;
    if (!l) flush();
    else if ((m = l.match(/^#{1,2}\s+(.*)/))) { flush(); out.push({ t: "h", x: m[1].replace(/\*\*/g, "") }); }
    else if ((m = l.match(/^#{3,6}\s+(.*)/))) { flush(); out.push({ t: "h3", x: m[1].replace(/\*\*/g, "") }); }
    else if ((m = l.match(/^[-*•]\s+(.*)/)) || (m = l.match(/^\d+[.)]\s+(.*)/))) { flush(); out.push({ t: "li", x: m[1] }); }
    else if (/^[-_*]{3,}$/.test(l)) flush();
    else para.push(l);
  }
  flush();
  return out;
}
