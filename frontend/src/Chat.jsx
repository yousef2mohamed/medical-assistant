import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { supabase } from "./supabase";
import { toWav } from "./audio";
import ThemeToggle from "./ThemeToggle";
import Icon from "./Icons";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:8000/chat";
const API_BASE = API_URL.replace(/\/chat\/?$/, "");
// value لازم يفضل زي ما هو (الباك إند بيعتمد عليه)، والباقي للعرض بس
const MODE_META = [
  { value: "💬 سؤال طبي", label: "سؤال طبي", icon: "chat", desc: "اسأل أي استفسار صحي بلغة بسيطة", placeholder: "اكتب سؤالك الطبي هنا..." },
  { value: "💊 علبة دوا", label: "علبة دوا", icon: "pill", desc: "ارفع صورة العلبة واعرف الاستخدام والتحذيرات", placeholder: "اسأل عن الدوا (ارفع صورة العلبة)..." },
  { value: "📝 روشتة", label: "روشتة", icon: "rx", desc: "افهم الأدوية المكتوبة في الروشتة", placeholder: "اكتب سؤالك عن الروشتة (ارفع صورتها)..." },
  { value: "🧪 تحاليل", label: "تحاليل", icon: "flask", desc: "تبسيط نتائج التحاليل والقيم الطبيعية", placeholder: "اكتب سؤالك عن التحليل (ارفع النتيجة)..." },
  { value: "🩻 أشعة", label: "أشعة", icon: "xray", desc: "شرح تقارير وصور الأشعة بشكل مبسط", placeholder: "اكتب سؤالك عن الأشعة (ارفع الصورة أو التقرير)..." },
];
const MODES = MODE_META.map((x) => x.value);
const MAX_FILES = 5;
const WELCOME = {
  role: "bot",
  text: "أهلًا! اختار نوع الطلب واكتب سؤالك أو ارفع صور/ملفات (لحد 5)، أو سجّل صوتك.",
};

function errText(data) {
  return typeof data?.detail === "string" ? data.detail : "حصل خطأ";
}

// صورة مصغّرة للملف المختار قبل الإرسال
function FileThumb({ file, onRemove }) {
  const [url, setUrl] = useState(null);
  useEffect(() => {
    if (!file.type.startsWith("image/")) return;
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [file]);
  return (
    <div className="thumb" title={file.name}>
      {url ? <img src={url} alt={file.name} /> : <Icon name="file" size={26} />}
      <button className="x" onClick={onRemove} title="إزالة"><Icon name="close" size={12} /></button>
    </div>
  );
}

export default function Chat({ guest = false, onLogin }) {
  const [conversations, setConversations] = useState([]);
  const [currentId, setCurrentId] = useState(null);
  const [messages, setMessages] = useState([WELCOME]);
  const [mode, setMode] = useState(MODES[0]);
  const [files, setFiles] = useState([]);
  const [question, setQuestion] = useState("");
  const [loading, setLoading] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const [recording, setRecording] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [editIndex, setEditIndex] = useState(null);

  const endRef = useRef(null);
  const fileRef = useRef(null);
  const inputRef = useRef(null);
  const recRef = useRef(null);
  const chunksRef = useRef([]);

  useEffect(() => {
    // شاشة الترحيب لوحدها: ابدأ من فوق، غير كده انزل لآخر رسالة
    if (messages.length === 1 && messages[0] === WELCOME && !loading) return;
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  // المستخدم المسجّل: تحميل المحادثات وفتح آخر واحدة
  useEffect(() => {
    if (guest) return;
    (async () => {
      const { data } = await supabase
        .from("conversations")
        .select("id, title")
        .order("created_at", { ascending: false });
      const list = data || [];
      setConversations(list);
      if (list.length) openConversation(list[0].id, true);
    })();
    // eslint-disable-next-line
  }, []);

  // ---------- الملفات ----------
  function addFiles(e) {
    const picked = Array.from(e.target.files || []);
    setFiles((prev) => [...prev, ...picked].slice(0, MAX_FILES));
    if (fileRef.current) fileRef.current.value = "";
  }
  function removeFile(i) {
    setFiles((prev) => prev.filter((_, idx) => idx !== i));
  }
  function resetFiles() {
    setFiles([]);
    if (fileRef.current) fileRef.current.value = "";
  }

  // ---------- المحادثات ----------
  async function openConversation(id, force = false) {
    if (loading && !force) return;
    setCurrentId(id);
    setDrawer(false);
    setEditIndex(null);
    const { data } = await supabase
      .from("messages")
      .select("role, text")
      .eq("conversation_id", id)
      .order("id", { ascending: true });
    setMessages([WELCOME, ...(data || [])]);
  }

  function newChat() {
    if (loading) return;
    setCurrentId(null);
    setMessages([WELCOME]);
    setDrawer(false);
    setQuestion("");
    setEditIndex(null);
    resetFiles();
  }

  async function deleteConversation(id) {
    if (loading) return;
    if (!confirm("مسح المحادثة دي؟")) return;
    await supabase.from("conversations").delete().eq("id", id);
    setConversations((c) => c.filter((x) => x.id !== id));
    if (id === currentId) newChat();
  }

  async function clearAll() {
    if (loading) return;
    if (!confirm("متأكد؟ كل المحادثات هتتمسح.")) return;
    await supabase
      .from("conversations")
      .delete()
      .neq("id", "00000000-0000-0000-0000-000000000000");
    setConversations([]);
    newChat();
  }

  async function save(cid, role, text) {
    if (guest) return;
    await supabase
      .from("messages")
      .insert({ conversation_id: cid, role, text, mode });
  }

  async function authHeaders() {
    if (guest) return {};
    const { data } = await supabase.auth.getSession();
    return { Authorization: `Bearer ${data.session?.access_token}` };
  }

  // ---------- تعديل سؤال قديم ----------
  function startEdit(i) {
    if (loading) return;
    const m = messages[i];
    setEditIndex(i);
    setQuestion(m.text);
    if (m.mode) setMode(m.mode);
    setFiles(m.files || []);
    setTimeout(() => inputRef.current?.focus(), 0);
  }
  function cancelEdit() {
    setEditIndex(null);
    setQuestion("");
    resetFiles();
  }

  // ---------- الإرسال ----------
  async function send() {
    const q = question.trim();
    if (!q || loading || recording || transcribing) return;
    if (mode !== MODES[0] && files.length === 0) {
      setMessages((m) => [...m, { role: "bot", text: "ارفع صورة أو ملف الأول من فضلك.", local: true }]);
      return;
    }

    const sentFiles = files;
    const previews = sentFiles.map((f) => ({
      name: f.name,
      url: f.type.startsWith("image/") ? URL.createObjectURL(f) : null,
    }));
    const userMsg = { role: "user", text: q, previews, files: sentFiles, mode };

    // لو بنعدّل سؤال: الرسائل من السؤال ده وبعده بتتشال
    const editing = editIndex;
    const base = editing !== null ? messages.slice(0, editing) : messages;

    // آخر 10 رسائل كنص عشان الموديل يفتكر المحادثة
    const history = base
      .filter((m) => m !== WELCOME && !m.isError && !m.local)
      .slice(-10)
      .map((m) => ({
        role: m.role,
        text: m.text + (m.previews?.length ? ` [مرفق: ${m.previews.length} ملف]` : ""),
      }));

    setMessages([...base, userMsg]);
    setQuestion("");
    resetFiles();
    setEditIndex(null);
    setLoading(true);

    let cid = currentId;
    if (!guest) {
      if (editing !== null && cid) {
        const kept = base
          .filter((m) => m !== WELCOME)
          .map((m) => ({
            conversation_id: cid,
            role: m.role,
            text: m.text,
            mode: m.mode || mode,
          }));
        await supabase.from("messages").delete().eq("conversation_id", cid);
        if (kept.length) await supabase.from("messages").insert(kept);
      }
      if (!cid) {
        const { data } = await supabase
          .from("conversations")
          .insert({ title: q.slice(0, 40) })
          .select("id, title")
          .single();
        if (data) {
          cid = data.id;
          setCurrentId(cid);
          setConversations((c) => [data, ...c]);
        }
      }
      await save(cid, "user", q);
    }

    const form = new FormData();
    form.append("mode", mode);
    form.append("question", q);
    form.append("history", JSON.stringify(history));
    sentFiles.forEach((f) => form.append("files", f));

    let reply;
    let ok = false;
    try {
      const res = await fetch(API_URL, {
        method: "POST",
        headers: await authHeaders(),
        body: form,
      });
      const data = await res.json();
      ok = res.ok;
      reply = res.ok ? data.answer : errText(data);
    } catch {
      reply = "مقدرتش أتصل بالسيرفر. اتأكد إنه شغال.";
    }
    setMessages((m) => [...m, { role: "bot", text: reply, isError: !ok }]);
    if (ok) save(cid, "bot", reply);
    setLoading(false);
  }

  // ---------- تسجيل الصوت ----------
  async function startRec() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mr = new MediaRecorder(stream);
      chunksRef.current = [];
      mr.ondataavailable = (e) => e.data.size && chunksRef.current.push(e.data);
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(chunksRef.current, { type: mr.mimeType });
        await transcribe(blob);
      };
      mr.start();
      recRef.current = mr;
      setRecording(true);
    } catch {
      alert("مقدرتش أوصل للمايك. اسمح للمتصفح باستخدام الميكروفون.");
    }
  }

  function stopRec() {
    recRef.current?.stop();
    setRecording(false);
  }

  async function transcribe(blob) {
    setTranscribing(true);
    try {
      const wav = await toWav(blob);
      const form = new FormData();
      form.append("file", new File([wav], "voice.wav", { type: "audio/wav" }));
      const res = await fetch(`${API_BASE}/transcribe`, {
        method: "POST",
        headers: await authHeaders(),
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        alert(errText(data));
      } else if (!data.text) {
        alert("مسمعتش كلام واضح، جرّب تسجّل تاني.");
      } else {
        setQuestion((q) => (q ? q + " " : "") + data.text);
      }
    } catch {
      alert("مقدرتش أحوّل الصوت لنص. اتأكد إن السيرفر شغال.");
    }
    setTranscribing(false);
  }

  const onlyWelcome = messages.length === 1 && messages[0] === WELCOME;
  const activeMode = MODE_META.find((x) => x.value === mode) || MODE_META[0];

  function autoGrow(el) {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 180) + "px";
  }
  useEffect(() => { autoGrow(inputRef.current); }, [question]);

  function pickMode(v) {
    setMode(v);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  return (
    <div className="shell" dir="rtl">
      {!guest && (
        <>
          {drawer && <div className="backdrop" onClick={() => setDrawer(false)} />}
          <aside className={`sidebar ${drawer ? "open" : ""}`}>
            <div className="side-head">
              <div className="brand">
                <span className="brand-logo"><Icon name="logo" size={22} /></span>
                <span className="brand-name">المساعد الطبي</span>
              </div>
              <button className="ghost only-mobile" onClick={() => setDrawer(false)} aria-label="إغلاق">
                <Icon name="close" size={18} />
              </button>
            </div>
            <button className="primary block" onClick={newChat} disabled={loading}>
              <Icon name="plus" size={18} /> محادثة جديدة
            </button>
            <div className="side-label">محادثاتي</div>
            <div className="convs">
              {conversations.length === 0 && (
                <p className="empty">لسه مفيش محادثات محفوظة.</p>
              )}
              {conversations.map((c) => (
                <div key={c.id} className={`conv ${c.id === currentId ? "active" : ""}`}>
                  <button className="conv-title" onClick={() => openConversation(c.id)} disabled={loading}>
                    <Icon name="chat" size={16} />
                    <span>{c.title || "محادثة"}</span>
                  </button>
                  <button className="conv-del" onClick={() => deleteConversation(c.id)} disabled={loading} title="مسح" aria-label="مسح المحادثة">
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              ))}
            </div>
            <div className="side-foot">
              <button className="ghost wide" onClick={clearAll} disabled={loading}>
                <Icon name="trash" size={17} /> مسح كل المحادثات
              </button>
              <ThemeToggle labeled />
              <button className="ghost wide" onClick={() => supabase.auth.signOut()}>
                <Icon name="logout" size={17} /> تسجيل خروج
              </button>
            </div>
          </aside>
        </>
      )}

      <main className="main">
        <header className="topbar">
          <div className="top-start">
            {!guest && (
              <button className="ghost only-mobile" onClick={() => setDrawer(true)} aria-label="القائمة">
                <Icon name="menu" size={22} />
              </button>
            )}
            {guest && (
              <div className="brand">
                <span className="brand-logo"><Icon name="logo" size={22} /></span>
                <span className="brand-name">المساعد الطبي الذكي</span>
              </div>
            )}
            {!guest && <h1 className="top-title">المساعد الطبي الذكي</h1>}
          </div>
          <div className="top-end">
            {guest && (
              <>
                <button className="ghost" onClick={newChat} disabled={loading}>
                  <Icon name="plus" size={18} /><span className="hide-sm">محادثة جديدة</span>
                </button>
                <ThemeToggle />
                <button className="primary sm" onClick={onLogin}>
                  <Icon name="login" size={16} /> <span><span className="hide-sm">تسجيل </span>دخول</span>
                </button>
              </>
            )}
            {!guest && (
              <button className="ghost only-mobile" onClick={newChat} disabled={loading} aria-label="محادثة جديدة">
                <Icon name="plus" size={20} />
              </button>
            )}
          </div>
        </header>

        {guest && (
          <div className="guestbar">
            <Icon name="user" size={15} /> أنت داخل كزائر: المحادثات مش بتتسجل وبتتمسح لما تقفل الصفحة.
          </div>
        )}

        <div className="chat">
          <div className="chat-inner">
            {onlyWelcome ? (
              <div className="welcome">
                <span className="welcome-logo"><Icon name="logo" size={34} /></span>
                <h2>أهلًا بيك، أقدر أساعدك في إيه؟</h2>
                <p>اختار نوع الطلب، واكتب سؤالك أو ارفع صور/ملفات (لحد {MAX_FILES})، أو سجّل صوتك.</p>
                <div className="cards">
                  {MODE_META.map((x) => (
                    <button key={x.value} className={`card ${mode === x.value ? "on" : ""}`} onClick={() => pickMode(x.value)}>
                      <span className="card-ic"><Icon name={x.icon} size={22} /></span>
                      <b>{x.label}</b>
                      <small>{x.desc}</small>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m, i) => {
                if (m === WELCOME) return null;
                return (
                  <div key={i} className={`item ${m.role}`}>
                    {m.role === "bot" && <span className="avatar"><Icon name="logo" size={18} /></span>}
                    <div className="item-col">
                      <div className={`msg ${m.role} ${m.isError ? "err" : ""}`}>
                        {m.role === "bot" ? (
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>{m.text}</ReactMarkdown>
                        ) : (
                          <>
                            {m.previews?.length > 0 && (
                              <div className="previews">
                                {m.previews.map((p, k) =>
                                  p.url ? (
                                    <img key={k} className="preview" src={p.url} alt={p.name} />
                                  ) : (
                                    <div key={k} className="chip"><Icon name="file" size={14} /> {p.name}</div>
                                  )
                                )}
                              </div>
                            )}
                            <div>{m.text}</div>
                          </>
                        )}
                      </div>
                      {m.role === "user" && !loading && (
                        <button className="edit" onClick={() => startEdit(i)} title="تعديل السؤال">
                          <Icon name="edit" size={14} /> تعديل
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            {loading && (
              <div className="item bot">
                <span className="avatar"><Icon name="logo" size={18} /></span>
                <div className="item-col"><div className="msg bot typing"><i /><i /><i /><span className="sr">بفكر...</span></div></div>
              </div>
            )}
            <div ref={endRef} />
          </div>
        </div>

        <div className="controls">
          <div className="controls-inner">
            {editIndex !== null && (
              <div className="editbar">
                <span><Icon name="edit" size={15} /> بتعدّل سؤالك. الردود اللي بعده هتتمسح.</span>
                <button className="ghost sm" onClick={cancelEdit}>إلغاء</button>
              </div>
            )}

            <div className="modes" role="tablist" aria-label="نوع الطلب">
              {MODE_META.map((x) => (
                <button key={x.value} role="tab" aria-selected={mode === x.value}
                  className={`mode ${mode === x.value ? "on" : ""}`}
                  onClick={() => setMode(x.value)}>
                  <Icon name={x.icon} size={16} /> {x.label}
                </button>
              ))}
            </div>

            <div className="composer">
              {files.length > 0 && (
                <div className="thumbs">
                  {files.map((f, i) => (
                    <FileThumb key={`${f.name}-${f.size}-${i}`} file={f} onRemove={() => removeFile(i)} />
                  ))}
                </div>
              )}
              <textarea ref={inputRef} rows={1} value={question}
                placeholder={activeMode.placeholder}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    send();
                  }
                }} />
              <div className="composer-bar">
                <label className={`icon-btn attach ${files.length >= MAX_FILES ? "disabled" : ""}`} title="إرفاق صور/ملفات">
                  <Icon name="clip" size={20} />
                  {files.length > 0 && <em>{files.length}/{MAX_FILES}</em>}
                  <input ref={fileRef} type="file" multiple hidden
                    accept=".png,.jpg,.jpeg,.webp,.pdf"
                    disabled={files.length >= MAX_FILES}
                    onChange={addFiles} />
                </label>
                <span className="grow" />
                <button
                  className={`icon-btn mic ${recording ? "rec" : ""}`}
                  onClick={recording ? stopRec : startRec}
                  disabled={loading || transcribing}
                  title={recording ? "إيقاف التسجيل" : "تسجيل صوتي"}
                  aria-label={recording ? "إيقاف التسجيل" : "تسجيل صوتي"}
                >
                  <Icon name={recording ? "stop" : "mic"} size={20} />
                </button>
                <button className="send" onClick={send}
                  disabled={loading || recording || transcribing || !question.trim()}>
                  <span>{editIndex !== null ? "إرسال التعديل" : "إرسال"}</span>
                  <Icon name="send" size={18} className="flip" />
                </button>
              </div>
            </div>
            {recording && <div className="status rec-s">● بسجّل... اضغط إيقاف لما تخلص</div>}
            {transcribing && <div className="status">بحوّل الصوت لنص...</div>}
            <div className="emergency">
              <Icon name="warn" size={14} /> للتوعية فقط ومش بديل عن الدكتور • للطوارئ اتصل بالإسعاف فورًا
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
