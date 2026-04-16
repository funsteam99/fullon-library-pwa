import Link from "next/link";

import { OperatorSwitcher } from "../components/operator-switcher";

const navItems = [
  { href: "/mobile", label: "首頁" },
  { href: "/mobile/loan", label: "借還" },
  { href: "/mobile/books", label: "書籍" },
  { href: "/mobile/members", label: "會員" },
  { href: "/mobile/loans", label: "紀錄" },
  { href: "/mobile/inventory", label: "盤點" },
];

export default function MobileLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <main className="mobile-shell">
      <div className="mobile-frame">
        <header className="mobile-header">
          <div>
            <p className="eyebrow">Library PWA</p>
            <h1 className="mobile-title">圖書館行動作業</h1>
          </div>
          <div className="mobile-header-actions">
            <OperatorSwitcher />
            <Link href="/" className="mini-link">
              返回首頁
            </Link>
          </div>
        </header>

        {children}

        <nav className="bottom-nav" aria-label="Mobile navigation">
          {navItems.map((item) => (
            <Link key={item.href} href={item.href} className="bottom-nav-link">
              {item.label}
            </Link>
          ))}
        </nav>
      </div>
    </main>
  );
}
