import { useEffect, useState } from "react";

type Drink = {
  id: string;
  name: string;
  description: string;
  price: number;
};

const icons: Record<string, string> = {
  espresso: "☕",
  latte: "🥛",
  "cold-brew": "🧊",
  cappuccino: "☕",
};

export default function App() {
  const [menu, setMenu] = useState<Drink[]>([]);
  const [loadingMenu, setLoadingMenu] = useState(true);
  const [menuError, setMenuError] = useState("");
  const [ordering, setOrdering] = useState<string | null>(null);
  const [notice, setNotice] = useState("");

  useEffect(() => {
    const controller = new AbortController();

    fetch("/api/menu", { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error("The menu is unavailable right now.");
        return response.json() as Promise<Drink[]>;
      })
      .then(setMenu)
      .catch((error: unknown) => {
        if (error instanceof Error && error.name !== "AbortError") {
          setMenuError(error.message);
        }
      })
      .finally(() => setLoadingMenu(false));

    return () => controller.abort();
  }, []);

  async function orderDrink(drink: Drink) {
    setOrdering(drink.id);
    setNotice("");
    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ itemId: drink.id }),
      });
      const result = (await response.json()) as { message?: string };
      if (!response.ok)
        throw new Error(result.message ?? "Could not place your order.");
      setNotice(result.message ?? "Order placed!");
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Could not place your order.",
      );
    } finally {
      setOrdering(null);
    }
  }

  return (
    <main>
      <header className="topbar">
        <a className="brand" href="/" aria-label="Coffee Corner home">
          <span className="brand-icon">CC</span>
          <span>coffee corner</span>
        </a>
        <span className="open-label">
          <span className="open-dot" /> FRESHLY BREWED DAILY
        </span>
      </header>

      <section className="hero">
        <div className="hero-copy">
          <p className="eyebrow">YOUR NEIGHBORHOOD COFFEE STOP</p>
          <h1>
            A little cup
            <br />
            of <em>happy.</em>
          </h1>
          <p className="hero-description">
            Good beans, good people, and a really good reason to take a break.
          </p>
          <a className="menu-link" href="#menu">
            Explore the menu <span aria-hidden="true">↓</span>
          </a>
        </div>
        <div
          className="hero-art"
          aria-label="Illustration of a cup of coffee"
          role="img"
        >
          <div className="sun" />
          <div className="steam steam-one" />
          <div className="steam steam-two" />
          <div className="cup">
            <span>CC</span>
          </div>
          <div className="cup-handle" />
          <div className="saucer" />
          <div className="art-caption">POURED WITH LOVE</div>
        </div>
      </section>

      <section className="menu-section" id="menu">
        <div className="section-heading">
          <div>
            <p className="eyebrow">MADE JUST FOR YOU</p>
            <h2>The good stuff.</h2>
          </div>
          <p className="menu-note">
            Simple ingredients. Seriously good coffee.
          </p>
        </div>

        {loadingMenu && <p className="feedback">Brewing up the menu…</p>}
        {menuError && (
          <p className="feedback error" role="alert">
            {menuError}
          </p>
        )}
        {notice && (
          <p className="feedback success" role="status">
            {notice}
          </p>
        )}

        {!loadingMenu && !menuError && (
          <div className="drink-grid">
            {menu.map((drink, index) => (
              <article className="drink-card" key={drink.id}>
                <div className={`drink-art drink-art-${index % 4}`}>
                  <span>{icons[drink.id] ?? "☕"}</span>
                  <span className="drink-number">0{index + 1}</span>
                </div>
                <div className="drink-info">
                  <div className="drink-title">
                    <h3>{drink.name}</h3>
                    <span>${drink.price.toFixed(2)}</span>
                  </div>
                  <p>{drink.description}</p>
                  <button
                    type="button"
                    onClick={() => void orderDrink(drink)}
                    disabled={ordering !== null}
                  >
                    {ordering === drink.id ? "Adding…" : "Order this"}{" "}
                    <span aria-hidden="true">↗</span>
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <footer>
        <span>Made for slow mornings & good company.</span>
        <span>COFFEE CORNER · ALWAYS A GOOD IDEA</span>
      </footer>
    </main>
  );
}
