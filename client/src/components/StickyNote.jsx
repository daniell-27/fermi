import React, { useState } from "react";

// A little sticky-note icon that pops the model's justification for an estimate.
export default function StickyNote({ note }) {
  const [open, setOpen] = useState(false);
  if (!note) return null;
  return (
    <span className="sticky-wrap">
      <button
        type="button"
        className="sticky-icon"
        title="Why this estimate?"
        onClick={() => setOpen((o) => !o)}
      >
        🗒
      </button>
      {open && (
        <span className="sticky-note" onClick={() => setOpen(false)}>
          {note}
        </span>
      )}
    </span>
  );
}
