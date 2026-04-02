type CsvRecord = Record<string, string>;

function normalizeHeader(value: string) {
  return value.trim();
}

// Lightweight CSV parser for the MVP import contract.
export function parseCsvRecords(text: string): CsvRecord[] {
  const rows: string[][] = [];
  const source = text.replace(/^\uFEFF/, "");
  let currentCell = "";
  let currentRow: string[] = [];
  let inQuotes = false;

  for (let index = 0; index < source.length; index += 1) {
    const char = source[index];
    const nextChar = source[index + 1];

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentCell += '"';
        index += 1;
        continue;
      }

      if (char === '"') {
        inQuotes = false;
        continue;
      }

      currentCell += char;
      continue;
    }

    if (char === '"') {
      inQuotes = true;
      continue;
    }

    if (char === ",") {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if (char === "\r") {
      continue;
    }

    if (char === "\n") {
      currentRow.push(currentCell);
      currentCell = "";

      if (currentRow.some((value) => value.trim() !== "")) {
        rows.push(currentRow);
      }

      currentRow = [];
      continue;
    }

    currentCell += char;
  }

  currentRow.push(currentCell);

  if (currentRow.some((value) => value.trim() !== "")) {
    rows.push(currentRow);
  }

  if (rows.length === 0) {
    return [];
  }

  const headers = rows[0].map(normalizeHeader);
  const duplicateHeader = headers.find(
    (header, index) => header.length === 0 || headers.indexOf(header) !== index
  );

  if (duplicateHeader) {
    throw new Error(`CSV headers are invalid. Problem header: "${duplicateHeader || "(empty)"}".`);
  }

  return rows.slice(1).map((row, rowIndex) => {
    if (row.length > headers.length) {
      throw new Error(`CSV row ${rowIndex + 2} has more columns than the header row.`);
    }

    return headers.reduce<CsvRecord>((record, header, headerIndex) => {
      record[header] = row[headerIndex] ?? "";
      return record;
    }, {});
  });
}
