import React, { useState } from "react";
import { OPERATORS } from "../lib/defaults.js";
import { uid } from "../lib/util.js";

const OP_SYMBOL = { "*": "×", "/": "÷", "+": "+", "-": "−", "(": "(", ")": ")" };

export default function FormulaBuilder({ model, setModel }) {
  const [dragOverRhs, setDragOverRhs] = useState(false);
  const [dragOverOut, setDragOverOut] = useState(false);
  const [newBlockName, setNewBlockName] = useState("");

  const blocks = model.blocks;
  const nameFor = (id) => blocks.find((b) => b.id === id)?.name ?? "?";

  function addBlock() {
    const name = newBlockName.trim();
    if (!name) return;
    setModel({ ...model, blocks: [...blocks, { id: uid(), name }] });
    setNewBlockName("");
  }

  function onDrop(e, target) {
    e.preventDefault();
    setDragOverRhs(false);
    setDragOverOut(false);
    let data;
    try {
      data = JSON.parse(e.dataTransfer.getData("text/plain"));
    } catch {
      return;
    }
    if (target === "output") {
      if (data.kind === "block") setModel({ ...model, formula: { ...model.formula, output: data.blockId } });
      return;
    }
    // target === "rhs"
    const rhs = model.formula.rhs || [];
    if (data.kind === "block") {
      setModel({ ...model, formula: { ...model.formula, rhs: [...rhs, { id: uid(), type: "variable", blockId: data.blockId }] } });
    } else if (data.kind === "op") {
      setModel({ ...model, formula: { ...model.formula, rhs: [...rhs, { id: uid(), type: "op", op: data.op }] } });
    }
  }

  function removeToken(id) {
    setModel({ ...model, formula: { ...model.formula, rhs: model.formula.rhs.filter((t) => t.id !== id) } });
  }

  function clearOutput() {
    setModel({ ...model, formula: { ...model.formula, output: null } });
  }

  const startDrag = (payload) => (e) => {
    e.dataTransfer.setData("text/plain", JSON.stringify(payload));
    e.dataTransfer.effectAllowed = "copy";
  };

  return (
    <div className="card">
      <div className="card-title">Blocks</div>
      <div className="palette">
        {blocks.map((b) => (
          <div key={b.id} className="block block-var" draggable onDragStart={startDrag({ kind: "block", blockId: b.id })}>
            {b.name}
          </div>
        ))}
        <div className="palette-ops">
          {OPERATORS.map((o) => (
            <div key={o.op} className="block block-op" draggable onDragStart={startDrag({ kind: "op", op: o.op })}>
              {o.label}
            </div>
          ))}
        </div>
        <div className="add-block">
          <input
            className="input input-sm"
            placeholder="New block name…"
            value={newBlockName}
            onChange={(e) => setNewBlockName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addBlock()}
          />
          <button className="btn btn-sm" onClick={addBlock}>+ Add block</button>
        </div>
      </div>

      <div className="card-title" style={{ marginTop: 18 }}>Formula</div>
      <div className="formula-bar">
        <div
          className={"drop-slot output-slot" + (dragOverOut ? " drag-over" : "")}
          onDragOver={(e) => { e.preventDefault(); setDragOverOut(true); }}
          onDragLeave={() => setDragOverOut(false)}
          onDrop={(e) => onDrop(e, "output")}
        >
          {model.formula.output ? (
            <span className="token token-var token-output" onClick={clearOutput} title="Click to clear">
              {nameFor(model.formula.output)}
            </span>
          ) : (
            <span className="slot-hint">drop output</span>
          )}
        </div>

        <div className="equals">=</div>

        <div
          className={"drop-slot rhs-slot" + (dragOverRhs ? " drag-over" : "")}
          onDragOver={(e) => { e.preventDefault(); setDragOverRhs(true); }}
          onDragLeave={() => setDragOverRhs(false)}
          onDrop={(e) => onDrop(e, "rhs")}
        >
          {(model.formula.rhs || []).length === 0 && <span className="slot-hint">drag blocks and operators here</span>}
          {(model.formula.rhs || []).map((t) => (
            <span
              key={t.id}
              className={"token " + (t.type === "variable" ? "token-var" : "token-op")}
              onClick={() => removeToken(t.id)}
              title="Click to remove"
            >
              {t.type === "variable" ? nameFor(t.blockId) : OP_SYMBOL[t.op] || t.op}
            </span>
          ))}
        </div>
      </div>
      <div className="hint">Drag from Blocks into the formula. Click a token to remove it.</div>
    </div>
  );
}
