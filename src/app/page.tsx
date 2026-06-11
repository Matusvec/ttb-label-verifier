"use client";

import { useRef, useState } from "react";
import BatchCheck from "@/components/BatchCheck";
import SingleCheck from "@/components/SingleCheck";

type Mode = "single" | "batch";
const MODES: Mode[] = ["single", "batch"];

export default function Home() {
  const [mode, setMode] = useState<Mode>("single");
  const tabRefs = useRef<Record<Mode, HTMLButtonElement | null>>({ single: null, batch: null });

  function onTablistKeyDown(e: React.KeyboardEvent) {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const next = MODES[(MODES.indexOf(mode) + 1) % MODES.length];
    setMode(next);
    tabRefs.current[next]?.focus();
  }

  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8 sm:px-6">
      <header className="mb-8 border-b-2 border-ink/80 pb-6">
        <p className="field-label">Alcohol and Tobacco Tax and Trade Bureau · Prototype</p>
        <h1 className="font-display mt-1 text-4xl font-bold tracking-tight">Label Check</h1>
        <p className="mt-2 max-w-2xl text-ink-soft">
          Upload a label and the matching application details. Label Check reads the label and
          sorts it into one of three piles: <strong className="text-approve">Approved</strong>,{" "}
          <strong className="text-reject">Rejected</strong>, or{" "}
          <strong className="text-review">Needs Review</strong> by an agent.
        </p>
      </header>

      <div role="tablist" aria-label="Mode" className="mb-8 flex gap-2" onKeyDown={onTablistKeyDown}>
        <Tab
          id="tab-single"
          controls="panel-single"
          active={mode === "single"}
          onClick={() => setMode("single")}
          buttonRef={(el) => (tabRefs.current.single = el)}
        >
          Check one label
        </Tab>
        <Tab
          id="tab-batch"
          controls="panel-batch"
          active={mode === "batch"}
          onClick={() => setMode("batch")}
          buttonRef={(el) => (tabRefs.current.batch = el)}
        >
          Check a batch
        </Tab>
      </div>

      {/* Both panels stay mounted so switching tabs never destroys typed
          form data, uploaded images, or batch results mid-run. */}
      <div id="panel-single" role="tabpanel" aria-labelledby="tab-single" hidden={mode !== "single"}>
        <SingleCheck />
      </div>
      <div id="panel-batch" role="tabpanel" aria-labelledby="tab-batch" hidden={mode !== "batch"}>
        <BatchCheck />
      </div>

      <footer className="mt-16 border-t border-rule pt-6 text-sm text-ink-soft">
        <p>
          Prototype for demonstration only — results are AI-assisted and final determinations
          rest with the reviewing agent. No uploaded data is stored.
        </p>
      </footer>
    </main>
  );
}

function Tab({
  id,
  controls,
  active,
  onClick,
  buttonRef,
  children,
}: {
  id: string;
  controls: string;
  active: boolean;
  onClick: () => void;
  buttonRef: (el: HTMLButtonElement | null) => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      id={id}
      ref={buttonRef}
      aria-selected={active}
      aria-controls={controls}
      tabIndex={active ? 0 : -1}
      onClick={onClick}
      className={`rounded-md px-5 py-2.5 text-lg font-semibold transition-colors cursor-pointer ${
        active
          ? "bg-ink text-paper-raised shadow"
          : "bg-paper-raised border border-rule text-ink-soft hover:text-ink"
      }`}
    >
      {children}
    </button>
  );
}
