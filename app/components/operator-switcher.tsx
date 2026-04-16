"use client";

import { useEffect, useMemo, useState } from "react";

import { apiRequest } from "../lib/api";
import { getStoredOperator, setStoredOperator, type Operator } from "../lib/auth";

type UsersResponse = {
  items: Operator[];
};

export function OperatorSwitcher() {
  const [operators, setOperators] = useState<Operator[]>([]);
  const [selectedId, setSelectedId] = useState<number>(getStoredOperator().id);

  useEffect(() => {
    let active = true;

    async function loadUsers() {
      try {
        const data = await apiRequest<UsersResponse>("/api/users");

        if (!active) {
          return;
        }

        setOperators(data.items);
        const stored = getStoredOperator();
        const nextOperator = data.items.find((item) => item.id === stored.id) ?? data.items[0];

        if (nextOperator) {
          setSelectedId(nextOperator.id);
          setStoredOperator(nextOperator);
        }
      } catch {
        if (!active) {
          return;
        }

        const fallback = getStoredOperator();
        setOperators([fallback]);
        setSelectedId(fallback.id);
      }
    }

    void loadUsers();

    return () => {
      active = false;
    };
  }, []);

  const selectedOperator = useMemo(
    () => operators.find((item) => item.id === selectedId) ?? getStoredOperator(),
    [operators, selectedId],
  );

  function handleChange(value: string) {
    const nextId = Number(value);
    setSelectedId(nextId);
    const nextOperator = operators.find((item) => item.id === nextId);

    if (nextOperator) {
      setStoredOperator(nextOperator);
      window.location.reload();
    }
  }

  return (
    <div className="operator-switcher">
      <label className="operator-switcher-label" htmlFor="operator-select">
        目前操作者
      </label>
      <select
        id="operator-select"
        className="operator-switcher-select"
        value={selectedId}
        onChange={(event) => handleChange(event.target.value)}
      >
        {operators.map((operator) => (
          <option key={operator.id} value={operator.id}>
            {operator.name} ({operator.role})
          </option>
        ))}
      </select>
      <p className="operator-switcher-meta">
        {selectedOperator.role === "admin" ? "可執行匯入匯出與盤點完成" : "可借還、建檔、掃碼"}
      </p>
    </div>
  );
}
