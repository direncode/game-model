"use client";

import React, { useState } from "react";
import { Send } from "lucide-react";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";

const challengeTypes = [
  { value: "module_assignment", label: "Module Assignment" },
  { value: "connection_validity", label: "Connection Validity" },
  { value: "data_quality", label: "Data Quality" },
  { value: "interpretation", label: "Interpretation" },
];

export interface ChallengeFormData {
  type: string;
  title: string;
  reasoning: string;
  evidence?: string;
  proposed_resolution?: string;
  target_id?: string;
}

export interface ChallengeFormProps {
  targetType?: string;
  targetId?: string;
  onSubmit: (data: ChallengeFormData) => void;
  loading?: boolean;
}

export default function ChallengeForm({
  targetType,
  targetId,
  onSubmit,
  loading = false,
}: ChallengeFormProps) {
  const [type, setType] = useState(targetType ? "module_assignment" : "");
  const [title, setTitle] = useState("");
  const [reasoning, setReasoning] = useState("");
  const [evidence, setEvidence] = useState("");
  const [proposedResolution, setProposedResolution] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!type || !title || !reasoning) return;
    const data: ChallengeFormData = {
      type,
      title,
      reasoning,
      target_id: targetId,
    };
    if (evidence.trim()) data.evidence = evidence;
    if (proposedResolution.trim()) data.proposed_resolution = proposedResolution;
    onSubmit(data);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <Select
        label="Challenge Type"
        options={challengeTypes}
        value={type}
        onChange={setType}
        placeholder="Select challenge type..."
      />

      <Input
        label="Title"
        placeholder="Brief description of the challenge"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-li-text-secondary">
          Reasoning
        </label>
        <textarea
          value={reasoning}
          onChange={(e) => setReasoning(e.target.value)}
          placeholder="Explain why this result should be challenged..."
          rows={4}
          className="li-input w-full resize-none"
        />
      </div>

      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-li-text-secondary">
          Evidence <span className="text-li-text-muted">(optional)</span>
        </label>
        <textarea
          value={evidence}
          onChange={(e) => setEvidence(e.target.value)}
          placeholder="Links, references, or additional evidence..."
          rows={2}
          className="li-input w-full resize-none"
        />
      </div>

      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-li-text-secondary">
          Proposed Resolution <span className="text-li-text-muted">(optional)</span>
        </label>
        <textarea
          value={proposedResolution}
          onChange={(e) => setProposedResolution(e.target.value)}
          placeholder="Suggest how this should be resolved..."
          rows={2}
          className="li-input w-full resize-none"
        />
      </div>

      <Button
        type="submit"
        variant="primary"
        loading={loading}
        disabled={!type || !title || !reasoning}
        icon={<Send className="w-4 h-4" />}
      >
        Submit Challenge
      </Button>
    </form>
  );
}
