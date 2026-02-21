import fs from "fs";

export type CliFormat = "json" | "md";

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, 2));
}

export function printMarkdown(title: string, lines: string[]): void {
  console.log(`# ${title}`);
  console.log("");
  for (const line of lines) {
    console.log(line);
  }
}

export function printResult(value: unknown, format: CliFormat = "json", title = "Result"): void {
  if (format === "md") {
    printMarkdown(title, ["```json", JSON.stringify(value, null, 2), "```"]);
    return;
  }
  printJson(value);
}

export function readBody(body?: string, bodyFile?: string): string {
  if (body) return body;
  if (!bodyFile) {
    throw new Error("--body または --body-file が必要です");
  }
  return fs.readFileSync(bodyFile, "utf-8");
}

export function markdownToHtml(markdown: string): string {
  const trimmed = markdown.trim();
  if (!trimmed) return "";

  const blocks = trimmed.split(/\n{2,}/);
  return blocks
    .map((block) => {
      const h3 = block.match(/^### (.*)$/);
      if (h3) return `<h3>${escapeHtml(h3[1])}</h3>`;

      const h2 = block.match(/^## (.*)$/);
      if (h2) return `<h2>${escapeHtml(h2[1])}</h2>`;

      const h1 = block.match(/^# (.*)$/);
      if (h1) return `<h1>${escapeHtml(h1[1])}</h1>`;

      return `<p>${escapeHtml(block).replace(/\n/g, "<br>")}</p>`;
    })
    .join("");
}
