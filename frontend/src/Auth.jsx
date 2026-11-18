import { useState } from "react";
import { supabase } from "./supabase";
import ThemeToggle from "./ThemeToggle";
import Icon from "./Icons";

const FEATURES = [
  ["chat", "أسئلة طبية بلغة بسيطة", "إجابات واضحة ومنظمة على أي استفسار صحي."],
  ["pill", "قراءة علب الأدوية والروشتات", "ارفع صورة وهنشرحلك الاستخدام والتحذيرات."],
  ["flask", "تبسيط التحاليل والأشعة", "فهم النتائج بشكل مبسط قبل ما تزور دكتورك."],
];

export default function Auth({ onGuest }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSignup, setIsSignup] = useState(false);
  const [agree, setAgree] = useState(false);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setMsg("");
    if (isSignup && !agree) {
      setMsg("لازم توافق على الشروط وسياسة الخصوصية.");
      return;
    }
    setBusy(true);
    const { data, error } = isSignup
      ? await supabase.auth.signUp({ email, password })
      : await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) setMsg(error.message);
    else if (isSignup && !data.session)
      setMsg("تم إنشاء الحساب. لو طُلب تأكيد الإيميل، افتح الرسالة وأكّد ثم سجّل دخول.");
  }

  return (
    <div className="auth-page" dir="rtl">
      <section className="auth-hero">
        <div className="brand">
          <span className="brand-logo"><Icon name="logo" size={26} /></span>
          <span className="brand-name">المساعد الطبي الذكي</span>
        </div>
        <div className="hero-body">
          <h1>صحتك أوضح مع<br />مساعدك الطبي الذكي</h1>
          <p>اسأل، ارفع صورة دوا أو تحليل أو أشعة، واحصل على شرح مبسط في ثواني — على مدار الساعة.</p>
          <ul className="features">
            {FEATURES.map(([ic, t, d]) => (
              <li key={t}>
                <span className="f-ic"><Icon name={ic} size={20} /></span>
                <span><b>{t}</b><small>{d}</small></span>
              </li>
            ))}
          </ul>
        </div>
        <div className="hero-foot"><Icon name="shield" size={16} /> للتوعية فقط، وليس بديلًا عن الطبيب المختص.</div>
      </section>

      <section className="auth-side">
        <div className="auth-top"><ThemeToggle /></div>
        <form className="auth-card" onSubmit={submit}>
          <h2>{isSignup ? "إنشاء حساب جديد" : "أهلًا بعودتك"}</h2>
          <p className="sub">{isSignup ? "سجّل بياناتك لحفظ محادثاتك بأمان." : "سجّل دخولك لمتابعة محادثاتك المحفوظة."}</p>

          <label className="field">
            <span>الإيميل</span>
            <input type="email" placeholder="name@example.com" value={email}
              onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
          </label>
          <label className="field">
            <span>الباسورد</span>
            <input type="password" placeholder="6 حروف على الأقل"
              value={password} onChange={(e) => setPassword(e.target.value)}
              minLength={6} required autoComplete={isSignup ? "new-password" : "current-password"} />
          </label>

          {isSignup && (
            <label className="agree">
              <input type="checkbox" checked={agree}
                onChange={(e) => setAgree(e.target.checked)} />
              <span>أوافق على أن الخدمة للتوعية فقط وليست بديلًا عن الطبيب، وأن المحادثات
              (نص فقط) تُخزَّن وأن الأسئلة والملفات تُعالَج عبر Google Gemini.</span>
            </label>
          )}

          {msg && <p className="note">{msg}</p>}

          <button type="submit" className="primary block" disabled={busy}>
            {busy ? "لحظة..." : isSignup ? "إنشاء الحساب" : "تسجيل الدخول"}
          </button>

          <p className="switch">
            {isSignup ? "عندك حساب؟" : "مفيش عندك حساب؟"}{" "}
            <button type="button" className="link"
              onClick={() => { setIsSignup(!isSignup); setMsg(""); }}>
              {isSignup ? "سجّل دخول" : "أنشئ حساب جديد"}
            </button>
          </p>

          <div className="or"><span>أو</span></div>
          <button type="button" className="outline block" onClick={onGuest}>
            <Icon name="user" size={18} /> الدخول كزائر
          </button>
          <p className="hint">الزائر بيجرّب التطبيق من غير حساب، والمحادثات مش بتتسجل وبتتمسح لما يقفل الصفحة.</p>
        </form>
      </section>
    </div>
  );
}
