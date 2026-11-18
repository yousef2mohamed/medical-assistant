import { useState } from "react";
import Icon from "./Icons";

export default function ThemeToggle({ labeled = false }) {
  const [theme, setTheme] = useState(
    document.documentElement.dataset.theme || "light"
  );

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try { localStorage.setItem("theme", next); } catch { /* ignore */ }
    setTheme(next);
  }

  const dark = theme === "dark";
  return (
    <button className="ghost" onClick={toggle} title="تبديل الوضع" aria-label="تبديل الوضع">
      <Icon name={dark ? "sun" : "moon"} size={18} />
      {labeled && <span>{dark ? "الوضع الفاتح" : "الوضع الداكن"}</span>}
    </button>
  );
}
