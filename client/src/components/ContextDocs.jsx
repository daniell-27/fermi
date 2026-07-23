import React, { useRef, useState } from "react";
import Icon from "./Icon.jsx";
import * as api from "../lib/api.js";
import { uid } from "../lib/util.js";

// A large drop/upload box for multiple PDFs. Each file uploads in its own row
// with a loading bar; the extracted text is attached as grounding for the run.
export default function ContextDocs({ context, docs, setDocs }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  function addFiles(fileList) {
    const files = Array.from(fileList || []).filter((f) => f.type === "application/pdf");
    for (const file of files) {
      const id = uid();
      setDocs((d) => [...d, { id, name: file.name, status: "reading", text: "" }]);
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = String(reader.result).split(",")[1];
        try {
          const r = await api.ingestContext({ dataBase64: base64, name: file.name, ...context });
          setDocs((d) => d.map((x) => (x.id === id ? { ...x, status: "done", text: r.text } : x)));
        } catch (e) {
          setDocs((d) => d.map((x) => (x.id === id ? { ...x, status: "error", error: e.message } : x)));
        }
      };
      reader.onerror = () => setDocs((d) => d.map((x) => (x.id === id ? { ...x, status: "error", error: "Could not read file" } : x)));
      reader.readAsDataURL(file);
    }
    if (inputRef.current) inputRef.current.value = "";
  }

  const removeDoc = (id) => setDocs((d) => d.filter((x) => x.id !== id));

  return (
    <div className="card">
      <div className="card-title">Context documents <span className="optional">(optional — PDFs fed to the model as extra grounding)</span></div>
      <div
        className={"upload-box" + (dragOver ? " drag-over" : "")}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
        onClick={() => inputRef.current?.click()}
        role="button"
        tabIndex={0}
      >
        <Icon name="upload" size={24} />
        <div className="upload-title">Drop PDFs here, or click to upload</div>
        <div className="upload-sub">Multiple files supported — each is read and added as context for your next run.</div>
        <input ref={inputRef} type="file" accept="application/pdf" multiple style={{ display: "none" }} onChange={(e) => addFiles(e.target.files)} />
      </div>

      {docs.length > 0 && (
        <div className="doc-rows">
          {docs.map((d) => (
            <div key={d.id} className={"doc-row doc-" + d.status}>
              <Icon name="note" size={16} />
              <div className="doc-main">
                <div className="doc-name">{d.name}</div>
                {d.status === "reading" && <div className="doc-bar"><div className="doc-bar-fill" /></div>}
                {d.status === "done" && <div className="doc-ok">Ready — added as context</div>}
                {d.status === "error" && <div className="doc-err">{d.error || "Failed to read"}</div>}
              </div>
              <button className="icon-btn" title="Remove" onClick={() => removeDoc(d.id)}><Icon name="close" size={12} /></button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
