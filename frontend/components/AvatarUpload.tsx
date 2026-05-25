"use client";

import { useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { compressImage } from "../lib/imageUtils";

interface Props {
  userId: string;
  currentAvatarUrl: string | null;
  fullName: string;
  onUpdate: (newUrl: string) => void;
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

async function getAccessToken(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token ?? null;
}

export default function AvatarUpload({ userId, currentAvatarUrl, fullName, onUpdate }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const displayUrl = preview ?? currentAvatarUrl;
  const initials = getInitials(fullName || "U");

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setMsg({ text: "Formato não suportado. Use JPG, PNG ou WEBP.", ok: false });
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setMsg({ text: "Arquivo muito grande. Máximo 5 MB.", ok: false });
      return;
    }

    const compressed = await compressImage(file);
    setPendingFile(compressed);

    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(compressed);
    setMsg(null);
  };

  const handleUpload = async () => {
    if (!pendingFile) return;
    setUploading(true);
    setMsg(null);

    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Sessão expirada");

      // Upload to R2
      const form = new FormData();
      form.append("file", pendingFile);
      form.append("folder", "profiles");

      const uploadRes = await fetch("/api/upload", { method: "POST", body: form });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok || !uploadData.url) throw new Error(uploadData.error ?? "Erro no upload");

      const newUrl: string = uploadData.url;

      // Delete old avatar from R2 if it exists (API skips non-R2 URLs gracefully)
      if (currentAvatarUrl) {
        await fetch("/api/delete-file", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ url: currentAvatarUrl }),
        }).catch(() => {}); // non-blocking
      }

      // Save to profiles table
      const { error: dbErr } = await supabase
        .from("profiles")
        .update({ avatar_url: newUrl })
        .eq("id", userId);
      if (dbErr) throw new Error(dbErr.message);

      onUpdate(newUrl);
      setPreview(null);
      setPendingFile(null);
      setMsg({ text: "Foto atualizada!", ok: true });
    } catch (err: unknown) {
      setMsg({ text: err instanceof Error ? err.message : "Erro inesperado", ok: false });
    } finally {
      setUploading(false);
    }
  };

  const handleCancel = () => {
    setPreview(null);
    setPendingFile(null);
    setMsg(null);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginBottom: 4 }}>
      {/* Avatar circle */}
      <div
        style={{
          width: 80,
          height: 80,
          borderRadius: "50%",
          background: displayUrl ? "transparent" : "var(--blue-light)",
          border: "3px solid var(--blue-main)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "hidden",
          fontSize: "1.6rem",
          fontWeight: 800,
          color: "var(--blue-main)",
          flexShrink: 0,
          position: "relative",
        }}
      >
        {displayUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={displayUrl} alt={fullName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <span>{initials}</span>
        )}
      </div>

      {/* Actions */}
      {pendingFile ? (
        <div style={{ display: "flex", gap: 8 }}>
          <button
            type="button"
            onClick={handleUpload}
            disabled={uploading}
            style={{
              background: "var(--blue-main)",
              color: "#fff",
              border: "none",
              borderRadius: 999,
              padding: "0.4rem 1rem",
              fontSize: "0.8rem",
              fontWeight: 700,
              cursor: uploading ? "not-allowed" : "pointer",
              opacity: uploading ? 0.7 : 1,
            }}
          >
            {uploading ? "Enviando..." : "Salvar foto"}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={uploading}
            style={{
              background: "transparent",
              color: "#64748b",
              border: "1px solid var(--border)",
              borderRadius: 999,
              padding: "0.4rem 0.9rem",
              fontSize: "0.8rem",
              cursor: "pointer",
            }}
          >
            Cancelar
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          style={{
            background: "transparent",
            color: "var(--blue-main)",
            border: "1px solid var(--blue-main)",
            borderRadius: 999,
            padding: "0.35rem 1rem",
            fontSize: "0.78rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          {currentAvatarUrl ? "Trocar foto" : "Adicionar foto"}
        </button>
      )}

      {msg && (
        <p style={{ fontSize: "0.78rem", color: msg.ok ? "#059669" : "#dc2626", margin: 0 }}>{msg.text}</p>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        style={{ display: "none" }}
        onChange={handleFileChange}
      />
    </div>
  );
}
