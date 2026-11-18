import { useState, useEffect } from "react";
import { supabase } from "./supabase";
import Auth from "./Auth";
import Chat from "./Chat";
import "./App.css";

export default function App() {
  const [session, setSession] = useState(undefined);
  const [guest, setGuest] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s);
      if (s) setGuest(false);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (session === undefined) return null;
  if (session) return <Chat key="user" />;
  if (guest) return <Chat key="guest" guest onLogin={() => setGuest(false)} />;
  return <Auth onGuest={() => setGuest(true)} />;
}
