import { useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE || "";

export default function App() {
  const [q, setQ] = useState("");
  const [answer, setAnswer] = useState("");
  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  async function ask() {
    setLoading(true);
    setErrorMsg("");
    setAnswer("");
    setSources([]);

    try {
      const res = await fetch(`${API_BASE}/api/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q }),
      });
      if (!res.ok) {
        const t = await res.text();
        throw new Error(`HTTP ${res.status}: ${t}`);
      }
      const data = await res.json();
      setAnswer(data.answer || "");
      setSources(Array.isArray(data.sources) ? data.sources : []);
    } catch (e) {
      setErrorMsg(e.message || "Request failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ height: "100%", display: "grid", gridTemplateRows: "1fr auto", gap: "12px", padding: "16px" }}>
      {/* Main panel */}
      <div className="card scroll">
        <div className="card-header">Voice RAG Agent (POC)</div>
        <div className="card-body">
          {/* Chat bubbles */}
          {!!answer && (
            <div className="bubble">
              <div className="bubble-role">Agent</div>
              <div style={{ whiteSpace: "pre-wrap" }}>{answer}</div>

              {/* Sources */}
              <div className="sources">
                <div className="sources-title">Sources</div>
                <div>
                  {sources.map((s) => (
                    <div key={s.id} className="source-card">
                      <div className="source-head">
                        <div className="file">{s.file || "document"}</div>
                        {s.sas_url && (
                          <a className="btn" href={s.sas_url} target="_blank" rel="noreferrer">
                            Open PDF
                          </a>
                        )}
                      </div>

                      {/* a) Render highlight HTML (instead of plain text) */}
                      <div
                        className="highlight"
                        dangerouslySetInnerHTML={{ __html: s.highlight_html || "" }}
                      />

                      {/* b) Show the first page preview when available */}
                      {s.page_image_url && (
                        <div className="page-preview">
                          <img
                            src={s.page_image_url}
                            alt={`Page ${s.page_number || 1}`}
                            loading="lazy"
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Error */}
          {errorMsg && (
            <div className="bubble user" style={{ borderColor: "#a33" }}>
              <div className="bubble-role">Error</div>
              <div style={{ color: "#ff9b9b" }}>{errorMsg}</div>
            </div>
          )}
        </div>
      </div>

      {/* Footer input */}
      <div className="card-footer">
        <input
          className="input"
          placeholder="Type your question…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !loading && ask()}
        />
        <button className={`btn primary`} onClick={ask} disabled={loading || !q.trim()}>
          {loading ? "Asking..." : "Ask"}
        </button>
      </div>

      <footer className="center muted">
        API: {API_BASE || "(set VITE_API_BASE in .env)"}
      </footer>
    </div>
  );
}
