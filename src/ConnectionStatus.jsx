import { useEffect, useState } from 'react';
export default function ConnectionStatus() {
  const [online,setOnline]=useState(()=>navigator.onLine);
  useEffect(()=>{const change=()=>setOnline(navigator.onLine);window.addEventListener('online',change);window.addEventListener('offline',change);return()=>{window.removeEventListener('online',change);window.removeEventListener('offline',change);};},[]);
  return online?null:<div className="connectionStatus" role="status">You’re offline. Keep this page open to preserve your work. Reconnect and retry saves or uploads; server confirmation is required.</div>;
}
