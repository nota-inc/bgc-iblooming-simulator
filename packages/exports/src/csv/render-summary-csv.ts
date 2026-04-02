export function renderSummaryCsv(summary: Record<string, number>) {
  const header = "metric,value";
  const rows = Object.entries(summary).map(([metric, value]) => `${metric},${value}`);
  return [header, ...rows].join("\n");
}

