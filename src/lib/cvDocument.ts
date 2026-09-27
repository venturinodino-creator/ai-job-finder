import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
import type { TailoredCvDocument } from "@/agents/cvTailor";

/** Renders a tailored CV to a Word document (.docx) buffer. */
export async function renderCvDocx(doc: TailoredCvDocument): Promise<Buffer> {
  const children: Paragraph[] = [];
  const heading = (text: string) => children.push(new Paragraph({ text, heading: HeadingLevel.HEADING_2 }));
  const bullet = (text: string) => children.push(new Paragraph({ text, bullet: { level: 0 } }));

  children.push(new Paragraph({ text: doc.name, heading: HeadingLevel.TITLE }));
  children.push(new Paragraph({ children: [new TextRun({ text: doc.headline, bold: true })] }));
  if (doc.contact) children.push(new Paragraph({ text: doc.contact }));

  heading("Summary");
  children.push(new Paragraph({ text: doc.summary }));

  if (doc.experience.length > 0) {
    heading("Experience");
    for (const role of doc.experience) {
      children.push(
        new Paragraph({
          children: [
            new TextRun({ text: `${role.title} — ${role.company}`, bold: true }),
            ...(role.dates ? [new TextRun({ text: `   ${role.dates}`, color: "666666" })] : []),
          ],
        }),
      );
      for (const line of role.bullets) bullet(line);
    }
  }

  if (doc.skills.length > 0) {
    heading("Skills");
    children.push(new Paragraph({ text: doc.skills.join(" · ") }));
  }
  if (doc.education.length > 0) {
    heading("Education");
    for (const line of doc.education) bullet(line);
  }
  if (doc.languages.length > 0) {
    heading("Languages");
    children.push(new Paragraph({ text: doc.languages.join(", ") }));
  }
  if (doc.other.length > 0) {
    heading("Awards & certifications");
    for (const line of doc.other) bullet(line);
  }

  const file = new Document({
    creator: "AI Job Finder",
    title: `${doc.name} — CV`,
    sections: [{ children }],
  });
  return Packer.toBuffer(file);
}

/** Plain-text rendering of the same document, for pasting into web forms. */
export function renderCvText(doc: TailoredCvDocument): string {
  const lines: string[] = [doc.name, doc.headline];
  if (doc.contact) lines.push(doc.contact);
  lines.push("", "SUMMARY", doc.summary);

  if (doc.experience.length > 0) {
    lines.push("", "EXPERIENCE");
    for (const role of doc.experience) {
      lines.push(`${role.title} — ${role.company}${role.dates ? ` (${role.dates})` : ""}`);
      for (const line of role.bullets) lines.push(`- ${line}`);
      lines.push("");
    }
  }
  if (doc.skills.length > 0) lines.push("SKILLS", doc.skills.join(" · "), "");
  if (doc.education.length > 0) lines.push("EDUCATION", ...doc.education.map((e) => `- ${e}`), "");
  if (doc.languages.length > 0) lines.push("LANGUAGES", doc.languages.join(", "), "");
  if (doc.other.length > 0) lines.push("AWARDS & CERTIFICATIONS", ...doc.other.map((o) => `- ${o}`), "");

  return lines.join("\n").trimEnd() + "\n";
}
