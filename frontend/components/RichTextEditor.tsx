"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { serializeEditorHtml, richToPlainText } from "../lib/richText";

type Props = {
  // HTML inicial ya saneado (ver lib/richText.initialEditorHtml).
  initialHtml: string;
  // Devuelve el formato (rich) y el texto plano en cada cambio.
  onChange: (rich: string, plain: string) => void;
  placeholder?: string;
  maxLength?: number;
  ariaLabel?: string;
};

type Cmd = "bold" | "italic" | "underline" | "insertUnorderedList";

// Editor liviano para la descripción del anuncio: barra con Negrito / Itálico /
// Sublinhado / Lista. Usa execCommand (ampliamente soportado) con salida basada en
// etiquetas (styleWithCSS=false) y serializa a HTML seguro de whitelist.
export default function RichTextEditor({ initialHtml, onChange, placeholder, maxLength = 1000, ariaLabel }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const [empty, setEmpty] = useState(true);
  const [active, setActive] = useState<Record<Cmd, boolean>>({ bold: false, italic: false, underline: false, insertUnorderedList: false });

  // Sembrar el HTML inicial una sola vez (no controlado: reescribir innerHTML en cada
  // render movería el cursor).
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.innerHTML = initialHtml || "";
    setEmpty((el.textContent || "").trim().length === 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const emit = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const rich = serializeEditorHtml(el);
    // Texto plano CON saltos de línea (derivado del formato), no textContent —que los
    // aplasta— para que la vista previa y la búsqueda conserven la estructura.
    const plain = richToPlainText(rich) || (el.textContent || "");
    onChange(rich, plain);
    setEmpty((el.textContent || "").trim().length === 0);
  }, [onChange]);

  const refreshActive = useCallback(() => {
    if (typeof document === "undefined" || !document.queryCommandState) return;
    try {
      setActive({
        bold: document.queryCommandState("bold"),
        italic: document.queryCommandState("italic"),
        underline: document.queryCommandState("underline"),
        insertUnorderedList: document.queryCommandState("insertUnorderedList"),
      });
    } catch {
      /* algunos navegadores lanzan si no hay selección dentro del editor */
    }
  }, []);

  const run = useCallback((cmd: Cmd) => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    try {
      // Salida basada en etiquetas (<b>/<i>/<u>) en vez de spans con estilo:
      // más consistente entre navegadores y fácil de serializar.
      document.execCommand("styleWithCSS", false, "false");
    } catch { /* no soportado: seguimos igual */ }
    document.execCommand(cmd);
    emit();
    refreshActive();
  }, [emit, refreshActive]);

  // Cortar el pegado enriquecido: insertamos solo texto plano (evita HTML externo).
  const onPaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault();
    const el = ref.current;
    const room = el ? maxLength - (el.textContent || "").length : 0;
    if (room <= 0) return;
    const text = e.clipboardData.getData("text/plain").slice(0, room);
    document.execCommand("insertText", false, text);
    emit();
  }, [emit, maxLength]);

  // Tope de caracteres sobre el texto plano (contenteditable no tiene maxLength).
  const onBeforeInput = useCallback((e: React.FormEvent) => {
    const el = ref.current;
    if (!el) return;
    const ne = e.nativeEvent as InputEvent;
    const inserting = ne.inputType?.startsWith("insert");
    if (inserting && (el.textContent || "").length >= maxLength) {
      e.preventDefault();
    }
  }, [maxLength]);

  const buttons: { cmd: Cmd; label: string; title: string; style?: React.CSSProperties }[] = [
    { cmd: "bold", label: "N", title: "Negrito", style: { fontWeight: 800 } },
    { cmd: "italic", label: "I", title: "Itálico", style: { fontStyle: "italic" } },
    { cmd: "underline", label: "S", title: "Sublinhado", style: { textDecoration: "underline" } },
    { cmd: "insertUnorderedList", label: "•—", title: "Lista", style: { letterSpacing: "-1px" } },
  ];

  return (
    <div className="rich-editor">
      <div className="rich-toolbar" role="toolbar" aria-label="Formatação do texto">
        {buttons.map((b) => (
          <button
            key={b.cmd}
            type="button"
            className={"rich-btn" + (active[b.cmd] ? " is-active" : "")}
            title={b.title}
            aria-label={b.title}
            aria-pressed={active[b.cmd]}
            // onMouseDown con preventDefault: no perder la selección del texto al tocar el botón.
            onMouseDown={(e) => { e.preventDefault(); run(b.cmd); }}
            style={b.style}
          >
            {b.label}
          </button>
        ))}
      </div>
      <div
        ref={ref}
        className="rich-content-edit"
        contentEditable
        role="textbox"
        aria-multiline="true"
        aria-label={ariaLabel}
        data-empty={empty ? "true" : "false"}
        data-placeholder={placeholder || ""}
        onInput={emit}
        onBeforeInput={onBeforeInput}
        onPaste={onPaste}
        onKeyUp={refreshActive}
        onMouseUp={refreshActive}
        onFocus={refreshActive}
        suppressContentEditableWarning
      />
    </div>
  );
}
