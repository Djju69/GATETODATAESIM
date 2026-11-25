"use client";

import { useState } from "react";

export default function AdminLogin() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/admin/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password }),
    });
    const body = await res.json();
    if (body.ok) {
      window.location.reload();
    } else {
      setError("Неверный пароль");
      setBusy(false);
    }
  }

  return (
    <div className="section flex min-h-[70vh] items-center justify-center">
      <form onSubmit={submit} className="card w-full max-w-sm p-8">
        <h1 className="h-display text-xl">GATETODATA · Админка</h1>
        <p className="mt-1 text-sm text-muted">Введите пароль администратора</p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input mt-5"
          placeholder="Пароль"
          autoFocus
        />
        {error && <p className="mt-2 text-sm text-danger">{error}</p>}
        <button disabled={busy} className="btn-primary mt-5 w-full">
          {busy ? "Проверяем…" : "Войти"}
        </button>
      </form>
    </div>
  );
}
