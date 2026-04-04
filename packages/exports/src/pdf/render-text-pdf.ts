function escapePdfText(value: string) {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)")
    .replace(/[^\x20-\x7E]/g, "?");
}

function wrapLine(line: string, maxChars: number) {
  if (line.length <= maxChars) {
    return [line];
  }

  const words = line.split(/\s+/).filter(Boolean);
  const wrapped: string[] = [];
  let current = "";

  for (const word of words) {
    if (!current) {
      current = word;
      continue;
    }

    if (`${current} ${word}`.length <= maxChars) {
      current = `${current} ${word}`;
      continue;
    }

    wrapped.push(current);
    current = word;
  }

  if (current) {
    wrapped.push(current);
  }

  return wrapped.length > 0 ? wrapped : [line.slice(0, maxChars)];
}

function paginateLines(lines: string[], linesPerPage: number, maxChars: number) {
  const wrappedLines = lines.flatMap((line) => {
    if (!line.trim()) {
      return [""];
    }

    return wrapLine(line, maxChars);
  });

  const pages: string[][] = [];

  for (let index = 0; index < wrappedLines.length; index += linesPerPage) {
    pages.push(wrappedLines.slice(index, index + linesPerPage));
  }

  return pages.length > 0 ? pages : [[""]];
}

export function renderTextPdf(lines: string[]) {
  const pageWidth = 612;
  const pageHeight = 792;
  const marginLeft = 48;
  const marginTop = 744;
  const fontSize = 10;
  const lineHeight = 14;
  const linesPerPage = 48;
  const maxChars = 92;
  const pages = paginateLines(lines, linesPerPage, maxChars);

  const objects: string[] = [];
  const pageRefs: string[] = [];

  objects.push("<< /Type /Catalog /Pages 2 0 R >>");
  objects.push("<< /Type /Pages /Kids [] /Count 0 >>");
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");

  for (const pageLines of pages) {
    const content = [
      "BT",
      `/F1 ${fontSize} Tf`,
      `${marginLeft} ${marginTop} Td`,
      `${lineHeight} TL`,
      ...pageLines.map((line, index) =>
        index === 0 ? `(${escapePdfText(line)}) Tj` : `T* (${escapePdfText(line)}) Tj`
      ),
      "ET"
    ].join("\n");

    const pageObjectIndex = objects.length + 1;
    const contentObjectIndex = objects.length + 2;
    pageRefs.push(`${pageObjectIndex} 0 R`);

    objects.push(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 3 0 R >> >> /Contents ${contentObjectIndex} 0 R >>`
    );
    objects.push(`<< /Length ${content.length} >>\nstream\n${content}\nendstream`);
  }

  objects[1] = `<< /Type /Pages /Kids [${pageRefs.join(" ")}] /Count ${pageRefs.length} >>`;

  let pdf = "%PDF-1.4\n";
  const offsets: number[] = [0];

  for (let index = 0; index < objects.length; index += 1) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += `${index + 1} 0 obj\n${objects[index]}\nendobj\n`;
  }

  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";

  for (let index = 1; index < offsets.length; index += 1) {
    pdf += `${offsets[index].toString().padStart(10, "0")} 00000 n \n`;
  }

  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

  return Buffer.from(pdf, "utf8");
}
