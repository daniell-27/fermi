// One formula evaluator, used for the analyst's median case AND every scenario.
// Because the exact same code path runs for all of them, the output block is
// computed in the identical "format" for every column — which is the whole point.

const PRECEDENCE = { "+": 1, "-": 1, "*": 2, "/": 2 };

// Turn the right-hand-side token list into a human-readable string, e.g.
// "Free Cash Flow × Future Multiple ÷ Future Share Count".
export function formulaToText(formula, blocks) {
  const nameFor = (id) => blocks.find((b) => b.id === id)?.name ?? "?";
  const sym = { "*": "×", "/": "÷", "+": "+", "-": "−", "(": "(", ")": ")" };
  const rhs = (formula.rhs || [])
    .map((t) => (t.type === "variable" ? nameFor(t.blockId) : sym[t.op] || t.op))
    .join(" ");
  const out = formula.output ? nameFor(formula.output) : "Result";
  return `${out} = ${rhs || "…"}`;
}

// The distinct variable blocks used on the right-hand side (these are the inputs).
export function inputVariableIds(formula) {
  const ids = [];
  for (const t of formula.rhs || []) {
    if (t.type === "variable" && !ids.includes(t.blockId)) ids.push(t.blockId);
  }
  return ids;
}

// Shunting-yard: token list -> RPN. Returns null if the expression is malformed.
function toRPN(tokens) {
  const output = [];
  const ops = [];
  for (const t of tokens) {
    if (t.type === "variable") {
      output.push(t);
    } else if (t.op === "(") {
      ops.push(t);
    } else if (t.op === ")") {
      let found = false;
      while (ops.length) {
        const top = ops.pop();
        if (top.op === "(") {
          found = true;
          break;
        }
        output.push(top);
      }
      if (!found) return null; // unbalanced parenthesis
    } else {
      while (
        ops.length &&
        ops[ops.length - 1].op !== "(" &&
        PRECEDENCE[ops[ops.length - 1].op] >= PRECEDENCE[t.op]
      ) {
        output.push(ops.pop());
      }
      ops.push(t);
    }
  }
  while (ops.length) {
    const top = ops.pop();
    if (top.op === "(") return null; // unbalanced parenthesis
    output.push(top);
  }
  return output;
}

// Evaluate the formula's right-hand side given a map of blockId -> number.
// Returns { value, error }. value is null when it can't be computed yet.
export function evaluateFormula(formula, values) {
  const tokens = formula.rhs || [];
  if (tokens.length === 0) return { value: null, error: "Empty formula" };

  const rpn = toRPN(tokens);
  if (!rpn) return { value: null, error: "Unbalanced parentheses" };

  const stack = [];
  for (const t of rpn) {
    if (t.type === "variable") {
      const raw = values[t.blockId];
      const n = typeof raw === "number" ? raw : parseFloat(raw);
      if (raw === undefined || raw === null || raw === "" || Number.isNaN(n)) {
        return { value: null, error: "Missing input" };
      }
      stack.push(n);
    } else {
      const b = stack.pop();
      const a = stack.pop();
      if (a === undefined || b === undefined) return { value: null, error: "Malformed formula" };
      switch (t.op) {
        case "+": stack.push(a + b); break;
        case "-": stack.push(a - b); break;
        case "*": stack.push(a * b); break;
        case "/":
          if (b === 0) return { value: null, error: "Division by zero" };
          stack.push(a / b);
          break;
        default: return { value: null, error: "Unknown operator" };
      }
    }
  }
  if (stack.length !== 1) return { value: null, error: "Malformed formula" };
  return { value: stack[0], error: null };
}

// Compact human formatting for the output block (e.g. 12300000000 -> "12.3B").
export function formatNumber(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1e12) return `${sign}${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9) return `${sign}${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6) return `${sign}${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3) return `${sign}${(abs / 1e3).toFixed(2)}K`;
  if (abs >= 1) return `${sign}${abs.toFixed(2)}`;
  return `${sign}${abs.toPrecision(3)}`;
}
