import './styles.css'

export function App() {
  return (
    <main className="app-shell">
      <section className="hero" aria-labelledby="streetquest-title">
        <p className="eyebrow">Aprende tu municipio, calle a calle</p>
        <h1 id="streetquest-title">StreetQuest</h1>
        <p className="hero-copy">
          Descarga un municipio una vez y estudia después su mapa vectorial, incluso sin conexión.
        </p>
        <button type="button">Explorar Colmenarejo</button>
        <p className="attribution">© OpenStreetMap contributors</p>
      </section>
    </main>
  )
}
