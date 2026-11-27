export function Hero() {
  return (
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
  );
}
