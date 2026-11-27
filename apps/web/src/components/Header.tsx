export function Header() {
  return (
    <header className="topbar">
      <a className="brand" href="/" aria-label="Coffee Corner home">
        <span className="brand-icon">CC</span>
        <span>coffee corner</span>
      </a>
      <span className="open-label">
        <span className="open-dot" /> FRESHLY BREWED DAILY
      </span>
    </header>
  );
}
