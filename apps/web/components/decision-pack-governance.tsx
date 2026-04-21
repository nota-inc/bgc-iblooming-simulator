"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { getDecisionGovernanceStatusLabel } from "@/lib/common-language";

type DecisionLogGovernanceControlProps = {
  runId: string;
  decisionKey: string;
  initialStatus: "draft" | "proposed" | "accepted" | "rejected" | "deferred" | null;
  initialOwner: string;
  initialResolutionNote: string | null;
  canWrite: boolean;
};

type RecommendedBaselineControlsProps = {
  scenarioId: string;
  runId: string;
  isAdoptedBaseline: boolean;
  canWrite: boolean;
};

const governanceStatuses = [
  "draft",
  "proposed",
  "accepted",
  "rejected",
  "deferred"
] as const;

export function DecisionLogGovernanceControl({
  runId,
  decisionKey,
  initialStatus,
  initialOwner,
  initialResolutionNote,
  canWrite
}: DecisionLogGovernanceControlProps) {
  const router = useRouter();
  const [status, setStatus] = useState<(typeof governanceStatuses)[number]>(initialStatus ?? "draft");
  const [owner, setOwner] = useState(initialOwner);
  const [resolutionNote, setResolutionNote] = useState(initialResolutionNote ?? "");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function saveResolution() {
    setMessage(null);

    const response = await fetch(`/api/runs/${runId}/decision-log`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        decisionKey,
        status,
        owner: owner.trim() || undefined,
        resolutionNote: resolutionNote.trim() || null
      })
    });

    const payload = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      setMessage(
        payload?.error === "decision_log_item_not_found"
          ? "Decision item no longer exists."
          : "Could not update decision governance state."
      );
      return;
    }

    setMessage("Saved.");
    router.refresh();
  }

  return (
    <div className="decision-governance-control">
      <div className="decision-governance-control__row">
        <select
          disabled={!canWrite || isPending}
          onChange={(event) => setStatus(event.target.value as (typeof governanceStatuses)[number])}
          value={status}
        >
          {governanceStatuses.map((item) => (
            <option key={item} value={item}>
              {getDecisionGovernanceStatusLabel(item)}
            </option>
          ))}
        </select>
        <input
          disabled={!canWrite || isPending}
          onChange={(event) => setOwner(event.target.value)}
          placeholder="Owner"
          value={owner}
        />
      </div>
      <div className="decision-governance-control__row">
        <input
          disabled={!canWrite || isPending}
          onChange={(event) => setResolutionNote(event.target.value)}
          placeholder="Resolution note (optional)"
          value={resolutionNote}
        />
        <button
          className="ghost-button"
          disabled={!canWrite || isPending}
          onClick={() => startTransition(saveResolution)}
          type="button"
        >
          {isPending ? "Saving..." : "Save"}
        </button>
      </div>
      {message ? <small className="muted">{message}</small> : null}
    </div>
  );
}

export function RecommendedBaselineControls({
  scenarioId,
  runId,
  isAdoptedBaseline,
  canWrite
}: RecommendedBaselineControlsProps) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function adoptBaseline() {
    setMessage(null);
    const response = await fetch(`/api/scenarios/${scenarioId}/adopt-baseline`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        runId,
        note: note.trim() || null
      })
    });
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      setMessage(
        payload?.error === "recommended_setup_not_found"
          ? "This run does not have a structured recommended setup yet."
          : "Could not adopt this run as the current pilot baseline."
      );
      return;
    }

    setMessage("Current pilot baseline updated.");
    router.refresh();
  }

  async function clearBaseline() {
    setMessage(null);
    const response = await fetch(`/api/scenarios/${scenarioId}/adopt-baseline`, {
      method: "DELETE"
    });
    const payload = (await response.json().catch(() => null)) as { error?: string } | null;

    if (!response.ok) {
      setMessage(payload?.error ? "Could not clear the current pilot baseline." : "Could not clear the current pilot baseline.");
      return;
    }

    setMessage("Current pilot baseline cleared.");
    router.refresh();
  }

  return (
    <div className="decision-governance-control">
      <div className="decision-governance-control__row">
        <input
          disabled={!canWrite || isPending || isAdoptedBaseline}
          onChange={(event) => setNote(event.target.value)}
          placeholder="Adoption note (optional)"
          value={note}
        />
        {isAdoptedBaseline ? (
          <button
            className="ghost-button"
            disabled={!canWrite || isPending}
            onClick={() => startTransition(clearBaseline)}
            type="button"
          >
            {isPending ? "Clearing..." : "Clear Baseline"}
          </button>
        ) : (
          <button
            className="ghost-button"
            disabled={!canWrite || isPending}
            onClick={() => startTransition(adoptBaseline)}
            type="button"
          >
            {isPending ? "Adopting..." : "Adopt as Current Pilot Baseline"}
          </button>
        )}
      </div>
      {message ? <small className="muted">{message}</small> : null}
    </div>
  );
}
