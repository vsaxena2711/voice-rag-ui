import { useEffect, useRef, useState } from "react";

const API_BASE = import.meta.env.VITE_API_BASE;

function useSTT() {
  const [listening, setListening] = useState(false);
  const [lastResult, setLastResult] = useState("");
  const recRef = useRef(null);

  useEffect(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.interimResults = true;
    rec.continuous = false;
    rec.lang = "en-US";
    rec.onresult = (e) => {
      const text = Array.from(e.results)
        .map(r => r[0].transcript)
        .join(" ");
      setLastResult(text);
    };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec;
  }, []);

  const start = () => {
    if (!recRef.current) return;
    setListening(true);
    recRef.current.start();
  };

  const stop = () => {
    if (!recRef.current) return;
    recRef.current.stop();
    setListening(false);
  };

  return { listening, lastResult, start, stop, supported: !!(window.SpeechRecognition || window.webkitSpeechRecognition) };
}

function speak(text) {
  if (!("speechSynthesis" in window)) return;
  const u = new SpeechSynthesisUtterance(text);
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(u);
}

export default function App() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState([]); // {role:'user'|'assistant', text:string, sources?:[]}
  const [loading, setLoading] = useState(false);
  const { listening, lastResult, start, stop, supported } = useSTT();

  useEffect(() => {
    if (listening && lastResult) setInput(lastResult);
  }, [lastResult, listening]);

  async function ask(q) {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/ask`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ q })
      });
      const data = await res.json();
      const answer = typeof data.answer === "string" ? data.answer : JSON.stringify(data);
      setMessages(m => [...m, { role: "user", text: q }, { role: "assistant", text: answer, sources: data.sources || [] }]);
      speak(answer);
    } catch (e) {
      setMessages(m => [...m, { role: "assistant", text: "Oops—request failed." }]);
    } finally {
      setLoading(false);
    }
  }

  function onSubmit(e) {
    e.preventDefault();
    const q = input.trim();
    if (!q) return;
    ask(q);
    setInput("");
  }

  return (
    <div className="min-h-screen flex flex-col gap-4 p-4 max-w-6xl mx-auto font-sans">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Voice RAG Agent (POC)</h1>
        <div className="flex items-center gap-2">
          {supported ? (
            listening ? (
              <button className="btn danger" onClick={stop}>■ Stop</button>
            ) : (
              <button className="btn" onClick={start}>🎙️ Speak</button>
            )
          ) : (
            <span className="text-sm opacity-70">Mic (Web Speech) not supported</span>
          )}
        </div>
      </header>

      <main className="grid md:grid-cols-2 gap-4">
        {/* Chat column */}
        <section className="card">
          <div className="card-header">Chat</div>
          <div className="card-body scroll">
            {messages.length === 0 && (
              <div className="muted">Ask me anything from your docs. Try: “Where do I find troubleshooting steps?”</div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={`bubble ${m.role}`}>
                <div className="bubble-role">{m.role === "user" ? "You" : "Agent"}</div>
                <div className="bubble-text">{m.text}</div>
                {m.sources?.length > 0 && (
                  <div className="sources">
                    <div className="sources-title">Sources</div>
                    {m.sources.map((s, j) => (
                      <SourceCard key={j} source={s} />
                    ))}
                  </div>
                )}
              </div>
            ))}
            {loading && <div className="muted">Searching & reasoning…</div>}
          </div>
          <form className="card-footer" onSubmit={onSubmit}>
            <input
              className="input"
              placeholder="Type your question…"
              value={input}
              onChange={(e) => setInput(e.target.value)}
            />
            <button className="btn primary" type="submit" disabled={loading}>Ask</button>
          </form>
        </section>

        {/* Context column */}
        <section className="card">
          <div className="card-header">Context (latest answer)</div>
          <div className="card-body scroll">
            <ContextPane lastAssistantMsg={messages.filter(m => m.role === "assistant").slice(-1)[0]} />
          </div>
        </section>
      </main>

      <footer className="center muted text-sm">
        API: {API_BASE}
      </footer>
    </div>
  );
}

function SourceCard({ source }) {
  // source: {file, highlight_html, sas_url}
  return (
    <div className="source-card">
      <div className="source-head">
        <div className="file">{source.file}</div>
        {source.sas_url && (
          <a href={source.sas_url} target="_blank" rel="noreferrer" className="link">Open PDF</a>
        )}
      </div>
      {source.highlight_html && (
        <div
          className="highlight"
          dangerouslySetInnerHTML={{ __html: source.highlight_html }}
        />
      )}
    </div>
  );
}

function ContextPane({ lastAssistantMsg }) {
  if (!lastAssistantMsg?.sources?.length) {
    return <div className="muted">Answer context will appear here with highlights and PDF links.</div>;
  }
  return (
    <div className="stack">
      {lastAssistantMsg.sources.map((s, i) => (
        <div key={i} className="context-card">
          <div className="row">
            <div className="file">{s.file}</div>
            {s.sas_url && <a className="link" target="_blank" rel="noreferrer" href={s.sas_url}>Open PDF</a>}
          </div>
          <div
            className="highlight"
            dangerouslySetInnerHTML={{ __html: s.highlight_html || "" }}
          />
          {s.sas_url && (
            <iframe className="pdf" src={s.sas_url} title={`pdf-${i}`} />
          )}
        </div>
      ))}
    </div>
  );
}