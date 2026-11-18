// أيقونات SVG خفيفة (بدل الإيموجي) لمظهر أنضج
const P = {
  logo: <><path d="M12 21s-7-4.4-9.2-9A5.3 5.3 0 0 1 12 6a5.3 5.3 0 0 1 9.2 6C19 16.6 12 21 12 21Z"/><path d="M7 12h3l1.5-2.5L13 14l1.2-2H17"/></>,
  chat: <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z"/>,
  pill: <><rect x="3" y="9" width="18" height="6" rx="3" transform="rotate(-45 12 12)"/><path d="m9.2 9.2 5.6 5.6"/></>,
  rx: <><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 12h6M9 16h6"/></>,
  flask: <><path d="M9 3h6M10 3v6l-5.5 9.5A1.5 1.5 0 0 0 5.8 21h12.4a1.5 1.5 0 0 0 1.3-2.5L14 9V3"/><path d="M7.5 15h9"/></>,
  xray: <><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M12 7v10M9 9h6M9.5 12h5M10 15h4"/></>,
  menu: <path d="M4 6h16M4 12h16M4 18h16"/>,
  plus: <path d="M12 5v14M5 12h14"/>,
  close: <path d="M6 6l12 12M18 6 6 18"/>,
  clip: <path d="m21 11-8.5 8.5a5 5 0 0 1-7-7L14 4a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-3-3L15 7"/>,
  mic: <><rect x="9" y="3" width="6" height="12" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></>,
  stop: <rect x="6" y="6" width="12" height="12" rx="2"/>,
  send: <path d="M4 12 20 4l-4 16-3.5-6.5zM12.5 13.5 20 4"/>,
  edit: <path d="M4 20h4L19 9l-4-4L4 16zM13 7l4 4"/>,
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5"/></>,
  moon: <path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z"/>,
  user: <><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></>,
  logout: <path d="M10 4H5v16h5M15 8l4 4-4 4M19 12H9"/>,
  login: <path d="M14 4h5v16h-5M9 8l-4 4 4 4M5 12h10"/>,
  warn: <path d="M12 3 2 20h20zM12 10v4M12 17.5v.01"/>,
  shield: <><path d="M12 3 4 6v6c0 4.5 3.2 8 8 9 4.8-1 8-4.5 8-9V6z"/><path d="m9 12 2 2 4-4"/></>,
  lock: <><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></>,
  bolt: <path d="M13 2 4 14h7l-1 8 9-12h-7z"/>,
  file: <><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/></>,
};

export default function Icon({ name, size = 20, ...rest }) {
  return (
    <svg
      width={size} height={size} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      aria-hidden="true" {...rest}
    >
      {P[name]}
    </svg>
  );
}
