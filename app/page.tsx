import Link from "next/link";

const mobileActions = [
  {
    title: "手機借書",
    subtitle: "輸入會員編號與館藏條碼，先把流通流程跑通。",
    href: "/mobile/loan",
  },
  {
    title: "手機還書",
    subtitle: "現場掃一本到位，之後再接相機掃碼。",
    href: "/mobile/return",
  },
  {
    title: "行動首頁",
    subtitle: "把館員常用動作集中在單手可操作的入口。",
    href: "/mobile",
  },
];

const adminModules = ["書籍管理", "會員管理", "借閱紀錄", "盤點報表", "Excel 匯入匯出"];

export default function HomePage() {
  return (
    <main className="landing-shell">
      <section className="landing-frame">
        <div className="landing-hero">
          <p className="eyebrow">Mobile-first Library MVP</p>
          <h1>先把手機借還書做成真正能上手的 PWA</h1>
          <p>
            現在這個版本把首頁重心收斂到手機端現場流程。館員打開手機後，應該能在幾秒內進入借書或還書，不需要先理解整套後台。
          </p>
        </div>

        <div className="landing-grid">
          {mobileActions.map((action) => (
            <Link key={action.title} href={action.href} className="landing-card">
              <p className="eyebrow">行動入口</p>
              <h2>{action.title}</h2>
              <p>{action.subtitle}</p>
            </Link>
          ))}
        </div>

        <section className="landing-duo">
          <div className="landing-card">
            <p className="eyebrow">Current build</p>
            <h2>已接好的本機測試資料</h2>
            <p>會員 `M0001`，書籍 `B0001`，操作員 `1`。現在可以直接用手機頁面打通借書與還書 API。</p>
          </div>

          <div className="landing-dark-card">
            <p className="eyebrow">Admin scope</p>
            <h2>後台仍保留在桌機端</h2>
            <ul>
              {adminModules.map((module) => (
                <li key={module}>{module}</li>
              ))}
            </ul>
          </div>
        </section>
      </section>
    </main>
  );
}
