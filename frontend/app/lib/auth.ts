export type OperatorRole = "admin" | "staff";

export type Operator = {
  id: number;
  username?: string;
  name: string;
  role: OperatorRole;
};

const STORAGE_KEY = "library-system-operator";

const defaultOperator: Operator = {
  id: 1,
  name: "Admin",
  role: "admin",
};

export function getStoredOperator(): Operator {
  if (typeof window === "undefined") {
    return defaultOperator;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);

    if (!raw) {
      return defaultOperator;
    }

    const parsed = JSON.parse(raw) as Partial<Operator>;

    if (
      typeof parsed.id === "number" &&
      typeof parsed.name === "string" &&
      (parsed.role === "admin" || parsed.role === "staff")
    ) {
      return {
        id: parsed.id,
        username: parsed.username,
        name: parsed.name,
        role: parsed.role,
      };
    }
  } catch {
    return defaultOperator;
  }

  return defaultOperator;
}

export function setStoredOperator(operator: Operator) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(operator));
}

export function getCurrentOperatorId() {
  return getStoredOperator().id;
}

export function isAdminOperator() {
  return getStoredOperator().role === "admin";
}

export function getOperatorRequestHeaders() {
  return {
    "x-user-id": String(getCurrentOperatorId()),
  };
}
