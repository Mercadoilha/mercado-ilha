"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import AvatarCropModal from "./AvatarCropModal";

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
  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [msg, setMsg] = useState<{ text: string; ok: boolean } | null>(null);

  const initials = getInitials(fullName || "U");

  // Revoke objectURL on unmount to avoid memory leaks
  useEffect(() => {
    return () => {
      if (cropSrc) URL.revokeObjectURL(cropSrc);
    };
  }, [cropSrc]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setMsg({ text: "Formato não suportado. Use JPG, PNG ou WEBP.", ok: false });
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setMsg({ text: "Arquivo muito grande. Máximo 10 MB.", ok: false });
      return;
    }

    setMsg(null);
    setCropSrc(URL.createObjectURL(file));
  };

  const handleCropConfirm = async (blob: Blob) => {
    // Revoke objectURL — image is now in the blob, no longer needed
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
    setUploading(true);
    setMsg(null);

    try {
      const token = await getAccessToken();
      if (!token) throw new Error("Sessão expirada");

      // Upload cropped JPEG to R2
      const file = new File([blob], "avatar.jpg", { type: "image/jpeg" });
      const form = new FormData();
      form.append("file", file);
      form.append("folder", "profiles");

      const uploadRes = await fetch("/api/upload", { method: "POST", body: form });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok || !uploadData.url) throw new Error(uploadData.error ?? "Erro no upload");

      const newUrl: string = uploadData.url;

      // Delete previous avatar from R2 (API skips non-R2 URLs gracefully)
      if (currentAvatarUrl) {
        fetch("/api/delete-file", {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ url: currentAvatarUrl }),
        }).catch(() => {});
      }

      // Persist new URL in profiles table
      const { error: dbErr } = await supabase
        .from("profiles")
        .update({ avatar_url: newUrl })
        .eq("id", userId);
      if (dbErr) throw new Error(dbErr.message);

      onUpdate(newUrl);
      setMsg({ text: "Foto atualizada!", ok: true });
    } catch (err: unknown) {
      setMsg({ text: err instanceof Error ? err.message : "Erro inesperado", ok: false });
    } finally {
      setUploading(false);
    }
  };

  const handleCropCancel = () => {
    if (cropSrc) URL.revokeObjectURL(cropSrc);
    setCropSrc(null);
  };

  return (
    <>
      {cropSrc && (
        <AvatarCropModal
          imageSrc={cropSrc}
          onConfirm={handleCropConfirm}
          onCancel={handleCropCancel}
        />
      )}

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10, marginBottom: 4 }}>
        {/* Avatar circle */}
        <div
          style={{
            width: 80,
            height: 80,
            borderRadius: "50%",
            background: currentAvatarUrl ? "transparent" : "var(--blue-light)",
            border: "3px solid var(--blue-main)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            fontSize: "1.6rem",
            fontWeight: 800,
            color: "var(--blue-main)",
            flexShrink: 0,
          }}
        >
          {currentAvatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={currentAvatarUrl} alt={fullName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          ) : (
            <span>{initials}</span>
          )}
        </div>

        {/* Button or uploading indicator */}
        {uploading ? (
          <p style={{ fontSize: "0.78rem", color: "var(--blue-main)", margin: 0, fontWeight: 600 }}>
            Salvando...
          </p>
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
          <p style={{ fontSize: "0.78rem", color: msg.ok ? "#059669" : "#dc2626", margin: 0 }}>
            {msg.text}
          </p>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
      </div>
    </>
  );
}
