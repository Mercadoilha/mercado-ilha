"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "../../../lib/supabaseClient";

export default function CategoryPage() {
  const params = useParams();
  const router = useRouter();
  const slug = typeof params.slug === "string" ? params.slug : Array.isArray(params.slug) ? params.slug[0] : "";

  const [category, setCategory] = useState<any>(null);
  const [subcategories, setSubcategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!slug) return;
    async function load() {
      const { data: cat, error } = await supabase
        .from("categories")
        .select("id,name,slug,icon,description")
        .eq("slug", slug)
        .single();
      if (error || !cat) { router.replace("/"); return; }
      setCategory(cat);

      const { data: subs } = await supabase
        .from("subcategories")
        .select("id,name,icon")
        .eq("category_id", cat.id)
        .eq("is_active", true)
        .order("sort_order");
      setSubcategories(subs ?? []);
      setLoading(false);
    }
    load();
  }, [slug, router]);

  if (loading) {
    return (
      <div className="page-body" style={{ display: "flex", justifyContent: "center", paddingTop: "4rem" }}>
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="page-body">
      <header className="page-header">
        <Link href="/" style={{ color: "#fff", textDecoration: "none", fontSize: "1.2rem" }}>←</Link>
        <h1>{category?.icon ? `${category.icon} ` : ""}{category?.name ?? slug}</h1>
      </header>

      {category?.description && (
        <p style={{ padding: "0.75rem 1rem 0", fontSize: "0.875rem", color: "var(--text-muted)" }}>
          {category.description}
        </p>
      )}

      <div style={{ padding: "0.875rem 1rem" }}>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(3, 1fr)",
            gap: "0.625rem",
          }}
        >
          {/* Todas as publicações — siempre primero */}
          <Link
            href={`/listings?category=${slug}`}
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 6,
              padding: "0.75rem 0.5rem",
              background: "var(--blue-main)",
              borderRadius: 12,
              textDecoration: "none",
              color: "#fff",
            }}
          >
            <span style={{ fontSize: "1.6rem", lineHeight: 1 }}>🔍</span>
            <span style={{ fontSize: "0.72rem", fontWeight: 600, textAlign: "center", lineHeight: 1.2 }}>
              Todas as publicações
            </span>
          </Link>

          {subcategories.map((sub) => (
            <Link
              key={sub.id}
              href={`/listings?category=${slug}&subcategory_id=${sub.id}`}
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
                padding: "0.75rem 0.5rem",
                background: "#fff",
                borderRadius: 12,
                border: "1px solid var(--border)",
                textDecoration: "none",
                color: "#1e293b",
              }}
            >
              <span style={{ fontSize: "1.6rem", lineHeight: 1 }}>{sub.icon || "•"}</span>
              <span style={{ fontSize: "0.72rem", fontWeight: 600, textAlign: "center", lineHeight: 1.2 }}>
                {sub.name}
              </span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
