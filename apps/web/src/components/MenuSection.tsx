import { useMenu } from "../hooks/useMenu";
import { useOrder } from "../hooks/useOrder";
import { DrinkCard } from "./DrinkCard";

export function MenuSection() {
  const { menu, loading, error, reload } = useMenu();
  const { ordering, notice, order } = useOrder();

  return (
    <section className="menu-section" id="menu">
      <div className="section-heading">
        <div>
          <p className="eyebrow">MADE JUST FOR YOU</p>
          <h2>The good stuff.</h2>
        </div>
        <p className="menu-note">Simple ingredients. Seriously good coffee.</p>
      </div>

      {loading && <p className="feedback">Brewing up the menu…</p>}
      {error && (
        <p className="feedback error" role="alert">
          {error}{" "}
          <button type="button" className="retry-button" onClick={reload}>
            Try again
          </button>
        </p>
      )}
      {notice && (
        <p
          className={`feedback ${notice.kind}`}
          role={notice.kind === "error" ? "alert" : "status"}
        >
          {notice.text}
        </p>
      )}

      {!loading && !error && menu.length === 0 && (
        <p className="feedback">The menu is empty right now.</p>
      )}

      {!loading && !error && menu.length > 0 && (
        <div className="drink-grid">
          {menu.map((drink, index) => (
            <DrinkCard
              key={drink.id}
              drink={drink}
              index={index}
              isOrdering={ordering === drink.id}
              disabled={ordering !== null}
              onOrder={(selected) => void order(selected)}
            />
          ))}
        </div>
      )}
    </section>
  );
}
