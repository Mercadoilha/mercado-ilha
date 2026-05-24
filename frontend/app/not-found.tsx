import Link from "next/link";

export default function NotFound() {
  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "2rem 1.5rem",
        background: "#f4f6fa",
        textAlign: "center",
        maxWidth: 480,
        margin: "0 auto",
      }}
    >
      <div style={{ fontSize: "4rem", marginBottom: "0.75rem" }}>🏝️</div>
      <h1
        style={{
          fontSize: "1.5rem",
          fontWeight: 900,
          color: "var(--blue-main)",
          marginBottom: "0.5rem",
        }}
      >
        Página não encontrada
      </h1>
      <p
        style={{
          color: "var(--text-muted)",
          fontSize: "0.95rem",
          lineHeight: 1.6,
          marginBottom: "1.75rem",
          maxWidth: 320,
        }}
      >
        Parece que a maré levou essa página. Não se preocupe, tem muito mais para explorar!
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", width: "100%", maxWidth: 280 }}>
        <Link href="/" className="btn btn-primary btn-block" style={{ padding: "0.875rem" }}>
          🏠 Voltar ao início
        </Link>
        <Link href="/listings" className="btn btn-outline btn-block" style={{ padding: "0.875rem" }}>
          🔍 Ver anúncios
        </Link>
      </div>
    </div>
  );
}
