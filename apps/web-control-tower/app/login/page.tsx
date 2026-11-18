'use client';
import { useState, type FormEvent } from 'react';
import { api, ApiError } from '@/lib/api';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await api('/auth/login', { body: { email, password } });
      const next = new URLSearchParams(window.location.search).get('next');
      window.location.assign(next && next.startsWith('/') && !next.startsWith('//') ? next : '/');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'No fue posible iniciar sesión.');
      setBusy(false);
    }
  };

  return (
    <div className="login-wrap">
      <form className="glass raised login-card stack" onSubmit={submit} aria-labelledby="login-title" style={{ gap: 14 }}>
        <div className="row" style={{ gap: 12 }}>
          <div className="ai-orb" aria-hidden style={{ width: 44, height: 44, fontWeight: 800 }}>N</div>
          <div>
            <h1 id="login-title" style={{ fontSize: 20 }}>NEXUS LOGISTICS OS</h1>
            <div className="small muted">Plataforma Integral de Operaciones Logísticas</div>
          </div>
        </div>
        <label className="field">Correo
          <input className="input" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </label>
        <label className="field">Contraseña
          <input className="input" type="password" autoComplete="current-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
        </label>
        {error && <div className="alert error" role="alert">{error}</div>}
        <button className="btn btn-primary" disabled={busy} type="submit">{busy ? 'Verificando…' : 'Iniciar sesión'}</button>
        <p className="tiny soft" style={{ margin: 0 }}>
          Entorno de demostración: las credenciales se generan al ejecutar el seed y quedan en <span className="mono">.demo-credentials.local</span>.
        </p>
      </form>
    </div>
  );
}
