import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

export const revalidate = 300;

export async function generateStaticParams() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
  const { data } = await supabase.from("categories").select("slug").eq("is_active", true);
  return (data ?? []).map(({ slug }: { slug: string }) => ({ slug }));
}

export default async function CategoryPage({ params }: { params: { slug: string } }) {
  const { slug } = params;
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: catWithSubs } = await supabase
    .from("categories")
    .select("id, name, slug, icon, description, subcategories(id, name, icon, is_active, sort_order)")
    .eq("slug", slug)
    .eq("is_active", true)
    .maybeSingle();

  if (!catWithSubs) {
    redirect(`/listings?category=${slug}`);
  }

  const subs = ((catWithSubs as any).subcategories ?? [])
    .filter((s: any) => s.is_active)
    .sort((a: any, b: any) => (a.sort_order ?? 0) - (b.sort_order ?? 0));

  if (subs.length === 0) {
    redirect(`/listings?category=${slug}`);
  }

  return (
    <div className="page-body">
      <header className="page-header">
        <Link href="/categorias" style={{ color: "#fff", textDecoration: "none", fontSize: "1.2rem" }}>←</Link>
        <h1>{catWithSubs.name ?? slug}</h1>
      </header>

      {(catWithSubs as any).description && (
        <p style={{ padding: "0.75rem 1rem 0", fontSize: "0.875rem", color: "var(--text-muted)" }}>
          {(catWithSubs as any).description}
        </p>
      )}

      <div style={{ padding: "0.875rem 1rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>

        <Link
          href={`/listings?category=${slug}`}
          style={{
            display: "flex", alignItems: "center", gap: 14,
            padding: "0.875rem 1rem", background: "var(--blue-main)", borderRadius: 12,
            textDecoration: "none", color: "#fff",
          }}
        >
          <span style={{ fontSize: "1.4rem", lineHeight: 1, flexShrink: 0 }}>🔍</span>
          <span style={{ fontWeight: 700, fontSize: "0.95rem", flex: 1 }}>Todas as publicações</span>
          <span style={{ fontSize: "1rem", opacity: 0.7 }}>›</span>
        </Link>

        {subs.map((sub: any) => (
          <Link
            key={sub.id}
            href={`/listings?category=${slug}&subcategory_id=${sub.id}`}
            style={{
              display: "flex", alignItems: "center", gap: 14,
              padding: "0.875rem 1rem", background: "#fff", borderRadius: 12,
              border: "1px solid var(--border)", textDecoration: "none", color: "#1e293b",
            }}
          >
            <span style={{ fontSize: "1.4rem", lineHeight: 1, flexShrink: 0, color: "#185FA5" }}>•</span>
            <span style={{ fontWeight: 600, fontSize: "0.9rem", flex: 1 }}>{sub.name}</span>
            <span style={{ fontSize: "1rem", color: "#cbd5e1" }}>›</span>
          </Link>
        ))}

      </div>
    </div>
  );
}
