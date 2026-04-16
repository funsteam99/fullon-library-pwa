"use client";

import { type ChangeEvent, type FormEvent, useEffect, useState, useTransition } from "react";

import { apiRequest } from "../../lib/api";
import { getCurrentOperatorId, isAdminOperator } from "../../lib/auth";

type OperatorItem = {
  id: number;
  username: string;
  name: string;
  role: "admin" | "staff";
  status: "active" | "inactive";
};

type OperatorsResponse = {
  items: OperatorItem[];
};

export default function MobileOperatorsPage() {
  const canManageOperators = isAdminOperator();
  const currentOperatorId = getCurrentOperatorId();
  const [items, setItems] = useState<OperatorItem[]>([]);
  const [username, setUsername] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<"admin" | "staff">("staff");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  async function loadOperators() {
    const data = await apiRequest<OperatorsResponse>("/api/users/manage");
    setItems(data.items);
  }

  useEffect(() => {
    let active = true;

    async function boot() {
      if (!canManageOperators) {
        setLoading(false);
        return;
      }

      try {
        await loadOperators();
        if (active) {
          setError(null);
        }
      } catch (loadError) {
        if (active) {
          setError(loadError instanceof Error ? loadError.message : "讀取操作者資料失敗");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void boot();

    return () => {
      active = false;
    };
  }, [canManageOperators]);

  function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    startTransition(async () => {
      try {
        const payload = await apiRequest<{ item: OperatorItem }>("/api/users", {
          method: "POST",
          body: JSON.stringify({
            username,
            name,
            role,
            status: "active",
          }),
        });

        setUsername("");
        setName("");
        setRole("staff");
        await loadOperators();
        setMessage(`已新增操作者：${payload.item.name}`);
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "新增操作者失敗");
      }
    });
  }

  function handleToggleStatus(item: OperatorItem) {
    if (item.id === currentOperatorId && item.status === "active") {
      setError("不能停用目前正在使用的操作者。");
      return;
    }

    setError(null);
    setMessage(null);

    startTransition(async () => {
      try {
        const nextStatus = item.status === "active" ? "inactive" : "active";
        const payload = await apiRequest<{ item: OperatorItem }>(`/api/users/${item.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            status: nextStatus,
          }),
        });

        await loadOperators();
        setMessage(`已更新 ${payload.item.name} 的狀態為 ${payload.item.status}`);
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "更新操作者狀態失敗");
      }
    });
  }

  function handleFieldUpdate(
    item: OperatorItem,
    field: "name" | "role",
    value: string,
  ) {
    setError(null);
    setMessage(null);

    startTransition(async () => {
      try {
        const payload = await apiRequest<{ item: OperatorItem }>(`/api/users/${item.id}`, {
          method: "PATCH",
          body: JSON.stringify({
            [field]: value,
          }),
        });

        await loadOperators();
        setMessage(`已更新 ${payload.item.username} 的${field === "name" ? "名稱" : "角色"}`);
      } catch (submitError) {
        setError(submitError instanceof Error ? submitError.message : "更新操作者資料失敗");
      }
    });
  }

  if (!canManageOperators) {
    return (
      <section className="mobile-stack">
        <article className="hero-card compact">
          <p className="eyebrow">Operators</p>
          <h2>操作者管理</h2>
          <p>只有 admin 可以查看與管理操作者。</p>
        </article>
      </section>
    );
  }

  return (
    <section className="mobile-stack">
      <article className="hero-card compact">
        <p className="eyebrow">Operators</p>
        <h2>操作者管理</h2>
        <p>在這裡新增、查看與停用操作者帳號，並設定 `admin / staff` 角色。</p>
      </article>

      <form className="mobile-form" onSubmit={handleCreate}>
        <label className="field">
          <span>帳號</span>
          <input value={username} onChange={(event) => setUsername(event.target.value)} placeholder="例如 staff02" required />
        </label>

        <label className="field">
          <span>名稱</span>
          <input value={name} onChange={(event) => setName(event.target.value)} placeholder="例如 館員二號" required />
        </label>

        <label className="field">
          <span>角色</span>
          <select value={role} onChange={(event) => setRole(event.target.value as "admin" | "staff")} className="field-select">
            <option value="staff">staff</option>
            <option value="admin">admin</option>
          </select>
        </label>

        <button type="submit" className="primary-button" disabled={isPending}>
          {isPending ? "建立中..." : "新增操作者"}
        </button>
      </form>

      {loading ? <div className="feedback">讀取操作者資料中...</div> : null}
      {message ? <div className="feedback success">{message}</div> : null}
      {error ? <div className="feedback error">{error}</div> : null}

      <section className="books-list">
        {items.map((item) => (
          <article key={item.id} className="book-row">
            <div className="book-row-main">
              <h3>{item.name}{item.id === currentOperatorId ? "（目前使用）" : ""}</h3>
              <p>帳號：{item.username}</p>
              <label className="field">
                <span>名稱</span>
                <input
                  value={item.name}
                  onChange={(event: ChangeEvent<HTMLInputElement>) => {
                    const nextName = event.target.value;
                    setItems((current) =>
                      current.map((operator) =>
                        operator.id === item.id ? { ...operator, name: nextName } : operator,
                      ),
                    );
                  }}
                  onBlur={(event) => {
                    if (event.target.value.trim() && event.target.value.trim() !== item.name) {
                      void handleFieldUpdate(item, "name", event.target.value.trim());
                    }
                  }}
                />
              </label>
              <label className="field">
                <span>角色</span>
                <select
                  value={item.role}
                  className="field-select"
                  onChange={(event) => {
                    const nextRole = event.target.value as "admin" | "staff";
                    setItems((current) =>
                      current.map((operator) =>
                        operator.id === item.id ? { ...operator, role: nextRole } : operator,
                      ),
                    );
                    void handleFieldUpdate(item, "role", nextRole);
                  }}
                >
                  <option value="staff">staff</option>
                  <option value="admin">admin</option>
                </select>
              </label>
            </div>
            <div className="book-row-side">
              <span className={item.status === "active" ? "status-pill status-pill-returned" : "status-pill status-pill-overdue-returned"}>
                {item.status}
              </span>
              <button type="button" className="inline-link" onClick={() => handleToggleStatus(item)}>
                {item.status === "active" ? "停用" : "啟用"}
              </button>
            </div>
          </article>
        ))}
      </section>
    </section>
  );
}
