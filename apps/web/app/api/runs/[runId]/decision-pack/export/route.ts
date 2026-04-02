import { NextResponse } from "next/server";

import { renderDecisionPackMarkdown, renderPdfPlaceholder, renderSummaryCsv } from "@bgc-alpha/exports";
import { getLatestDecisionPackForRun, getRunById } from "@bgc-alpha/db";
import type { DecisionPack } from "@bgc-alpha/schemas";

import { authorizeApiRequest } from "@/lib/auth-session";

function buildFilename(source: string) {
  return source.toLowerCase().replace(/[^a-z0-9]+/g, "-");
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ runId: string }> }
) {
  const authResult = await authorizeApiRequest(["decision-pack.export"]);

  if ("response" in authResult) {
    return authResult.response;
  }

  const { runId } = await params;
  const [run, packRecord] = await Promise.all([getRunById(runId), getLatestDecisionPackForRun(runId)]);

  if (!run) {
    return NextResponse.json(
      {
        error: "run_not_found"
      },
      {
        status: 404
      }
    );
  }

  if (!packRecord) {
    return NextResponse.json(
      {
        error: "decision_pack_not_ready"
      },
      {
        status: 409
      }
    );
  }

  const decisionPack = packRecord.recommendationJson as DecisionPack;
  const format = new URL(request.url).searchParams.get("format") ?? "markdown";
  const safeBase = buildFilename(run.scenario.name);

  if (format === "csv") {
    const summary = Object.fromEntries(
      run.summaryMetrics.map((metric) => [metric.metricKey, metric.metricValue])
    );

    return new NextResponse(renderSummaryCsv(summary), {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeBase}-summary.csv"`
      }
    });
  }

  if (format === "pdf") {
    return new NextResponse(renderPdfPlaceholder(decisionPack.title), {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${safeBase}-decision-pack.txt"`
      }
    });
  }

  return new NextResponse(renderDecisionPackMarkdown(decisionPack), {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${safeBase}-decision-pack.md"`
    }
  });
}
