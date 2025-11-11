import { useEffect, useMemo, useRef, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE?.replace(/\/$/, "") || "";
const SR = (window.SpeechRecognition || window.webkitSpeechRecognition);

export default function App() {
  const [q, setQ] = useState("");
  const [stream, setStream] = useState([
    { role: "system", text: "Voice RAG Agent (POC)" },
  ]);
  const [loading, setLoading] = useState(false);
  const [sources, setSources] = useState([]);
  const [lastAnswer, setLastAnswer] = useState("");
  const [speakEnabled, setSpeakEnabled] = useState(true);
  const [sttActive, setSttActive] = useState(false);

  const recRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);

  useEffect(() => {
    if (SR) {
      const r = new SR();
      r.lang = "en-US";
      r.interimResults = false;
      r.maxAlternatives = 1;
      r.onresult = (e) => {
        const text = e.results?.[0]?.[0]?.transcript?.trim() || "";
        if (text) {
          setQ(text);
          handleAsk(text);
        }
      };
      r.onerror = () => setSttActive(false);
      r.onend = () => setSttActive(false);
      recRef.current = r;
    }
  }, []);

  const say = (text) => {
    try {
      if (!speakEnabled) return;
      if (!text) return;
      // Stop any ongoing utterances
      if (synthRef.current?.speaking) synthRef.current.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.rate = 1;
      u.pitch = 1;
      synthRef.current?.speak(u);
    } catch (_) {}
  };

  const stopSpeaking = () => {
    try {
      synthRef.current?.cancel();
    } catch (_) {}
  };

  const toggleMic = () => {
    if (!recRef.current) return;
    if (sttActive) {
      recRef.current.stop();
      setSttActive(false);
    } else {
      stopSpeaking(); // avoid TTS overlapping with mic
      setSttActive(true);
      recRef.current.start();
    }
  };

  const apiAsk = async (question) => {
    const url = `${API_BASE}/api/ask`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: question }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${text || res.statusText}`);
    }
    return res.json();
  };

  const handleAsk = async (text) => {
    if (!text?.trim()) return;
    setLoading(true);
    setSources([]);
    setLastAnswer("");

    setStream((s) => [...s, { role: "user", text }]);
    try {
      const data = await apiAsk(text);

      const answer = data?.answer || "Here are the top matches I found.";
      const srcs = Array.isArray(data?.sources) ? data.sources : [];
      setSources(srcs);
      setLastAnswer(answer);
      setStream((s) => [...s, { role: "agent", text: answer }]);
      say(answer);
    } catch (e) {
      const msg = `Something went wrong. ${String(e?.message || e)}`;
      setStream((s) => [...s, { role: "agent", text: msg }]);
    } finally {
      setLoading(false);
      setQ("");
    }
  };

  const contextPanel = useMemo(() => {
    if (!sources?.length) return null;
    const top = sources[0];

    return (
      <div className="context-card">
        <div className="row">
          <div className="file">{top.file}</div>
          {top.sas_url && (
            <a className="btn" href={top.sas_url} target="_blank" rel="noreferrer">
              Open PDF
            </a>
          )}
        </div>

        {/* Render highlight HTML with spans so <em> gets styled */}
        {top.highlight_html && (
          <div
            className="highlight"
            dangerouslySetInnerHTML={{ __html: top.highlight_html }}
          />
        )}

        {/* Page 1 preview if present */}
        {top.page_image_url && (
          <div style={{ marginTop: ".6rem" }}>
            <div className="muted" style={{ fontSize: ".8rem", marginBottom: ".25rem" }}>
              Page {top.page_number || 1}
            </div>
            <img
              src={top.page_image_url}
              alt="Page preview"
              style={{
                display: "block",
                width: "100%",
                maxHeight: 420,
                objectFit: "contain",
                borderRadius: ".4rem",
                border: "1px solid #2a2f4e",
                background: "#000",
              }}
            />
          </div>
        )}
      </div>
    );
  }, [sources]);

  return (
    <div style={{ padding: "1rem", maxWidth: 1100, margin: "0 auto" }}>
      <h2 style={{ marginTop: 0 }}>Voice RAG Agent (POC)</h2>

      <div className="stack">
        <div className="card">
          <div className="card-header">Chat</div>
          <div className="card-body scroll">
            {stream.map((m, i) => (
              <div className={`bubble ${m.role === "user" ? "user" : ""}`} key={i}>
                <div className="bubble-role">{m.role}</div>
                <div>{m.text}</div>
              </div>
            ))}
          </div>
          <div className="card-footer">
            <input
              className="input"
              placeholder="Type your question…"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAsk(q);
              }}
            />
            <button className="btn" onClick={() => handleAsk(q)} disabled={loading}>
              {loading ? "Asking…" : "Ask"}
            </button>

            {/* Mic button */}
            <button
              className={`btn ${sttActive ? "danger" : ""}`}
              onClick={toggleMic}
              title={SR ? "Use your microphone" : "Speech recognition not supported"}
              disabled={!SR}
            >
              {sttActive ? "Stop Mic" : "🎙️ Speak"}
            </button>

            {/* Speak toggle */}
            <button
              className="btn"
              onClick={() => {
                const next = !speakEnabled;
                setSpeakEnabled(next);
                if (!next) stopSpeaking();
              }}
              title="Toggle text-to-speech for answers"
            >
              {speakEnabled ? "🔈 On" : "🔇 Off"}
            </button>
          </div>
        </div>

        {/* Context / Sources */}
        <div className="card">
          <div className="card-header">Context (latest answer)</div>
          <div className="card-body">
            {!sources?.length ? (
              <div className="muted">Ask something to see sources…</div>
            ) : (
              <>
                {contextPanel}
                <div className="sources">
                  <div className="sources-title">Sources</div>
                  {sources.map((s, idx) => (
                    <div className="source-card" key={idx}>
                      <div className="source-head">
                        <div className="file">{s.file}</div>
                        <div>
                          {s.page_number && <span className="muted">Page {s.page_number}</span>}
                          {s.sas_url && (
                            <a
                              style={{ marginLeft: ".6rem" }}
                              href={s.sas_url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Open PDF
                            </a>
                          )}
                        </div>
                      </div>

                      {s.highlight_html && (
                        <div
                          className="highlight"
                          dangerouslySetInnerHTML={{ __html: s.highlight_html }}
                        />
                      )}

                      {s.page_image_url && (
                        <div style={{ marginTop: ".5rem" }}>
                          <img
                            src={s.page_image_url}
                            alt="Page preview"
                            style={{
                              display: "block",
                              width: "100%",
                              maxHeight: 240,
                              objectFit: "contain",
                              borderRadius: ".4rem",
                              border: "1px solid #2a2f4e",
                              background: "#000",
                            }}
                          />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        </div>

        <footer className="muted">
          API: {API_BASE || "not set"}
        </footer>
      </div>
    </div>
  );
}
