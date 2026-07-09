import React from "react";
import { evaluateFormula, inputVariableIds, formulaToText, formatNumber } from "../lib/evaluate.js";
import StickyNote from "./StickyNote.jsx";

export default function OutputView({ model, baseValues, setBaseValues, result, setResult, onBack }) {
  const inputIds = inputVariableIds(model.formula);
  const nameFor = (id) => model.blocks.find((b) => b.id === id)?.name ?? "?";
  const outName = model.formula.output ? nameFor(model.formula.output) : "Result";

  const baseOut = evaluateFormula(model.formula, baseValues);

  function editBase(blockId, v) {
    setBaseValues({ ...baseValues, [blockId]: v });
  }
  function editScenario(idx, blockId, v) {
    const scenarios = result.scenarios.map((s, i) =>
      i === idx ? { ...s, values: { ...s.values, [blockId]: v } } : s
    );
    setResult({ ...result, scenarios });
  }

  // Numeric range of the scenario outputs, for the summary line.
  const outs = [baseOut.value, ...result.scenarios.map((s) => evaluateFormula(model.formula, s.values).value)].filter(
    (v) => v !== null && v !== undefined && !Number.isNaN(v)
  );
  const low = outs.length ? Math.min(...outs) : null;
  const high = outs.length ? Math.max(...outs) : null;

  return (
    <div className="output-view">
      <div className="output-head">
        <button className="btn" onClick={onBack}>← Back to inputs</button>
        <div className="formula-readout">{formulaToText(model.formula, model.blocks)}</div>
      </div>

      {low !== null && (
        <div className="range-banner">
          Valuation range across {outs.length} scenarios:&nbsp;
          <strong>{formatNumber(low)}</strong> — <strong>{formatNumber(high)}</strong>
        </div>
      )}

      <div className="grid-scroll">
        <table className="grid">
          <thead>
            <tr>
              <th className="col-scenario">Scenario</th>
              <th className="col-output">{outName}</th>
              <th className="col-eq"></th>
              {inputIds.map((id) => (
                <th key={id} className="col-var">{nameFor(id)}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {/* Median / base case */}
            <tr className="row-median">
              <td className="col-scenario"><span className="badge badge-median">Median</span> your estimate</td>
              <td className="col-output">
                <span className="output-value">{formatNumber(baseOut.value)}</span>
              </td>
              <td className="col-eq">=</td>
              {inputIds.map((id) => (
                <td key={id} className="col-var">
                  <input
                    className="cell-input"
                    value={baseValues[id] ?? ""}
                    onChange={(e) => editBase(id, e.target.value)}
                  />
                </td>
              ))}
            </tr>

            {/* One row per alternative scenario */}
            {result.scenarios.map((s, idx) => {
              const out = evaluateFormula(model.formula, s.values);
              return (
                <tr key={idx}>
                  <td className="col-scenario">{s.name}</td>
                  <td className="col-output">
                    <span className="output-value">{formatNumber(out.value)}</span>
                  </td>
                  <td className="col-eq">=</td>
                  {inputIds.map((id) => (
                    <td key={id} className="col-var">
                      <div className="cell-wrap">
                        <input
                          className="cell-input"
                          value={s.values[id] ?? ""}
                          onChange={(e) => editScenario(idx, id, e.target.value)}
                        />
                        <StickyNote note={s.notes?.[id]} />
                      </div>
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="hint">Edit any estimate to see its scenario's output recalculate. 🗒 opens the model's reasoning.</div>
    </div>
  );
}
