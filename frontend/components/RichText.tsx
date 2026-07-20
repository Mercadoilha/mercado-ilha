import { sanitizeRichHtml, richHasContent } from "../lib/richText";

type Props = {
  // Descripción con formato (negrita/cursiva/subrayado/listas). Se sanea siempre.
  rich?: string | null;
  // Texto plano (fallback para anuncios sin formato). Se preservan los saltos de línea.
  plain?: string | null;
  style?: React.CSSProperties;
  className?: string;
};

// Renderiza la descripción de un anuncio. Si hay formato, lo muestra (saneado). Si no,
// muestra el texto plano preservando los saltos de línea. Isomórfico: el saneado por
// whitelist corre igual en server y cliente, así que es seguro contra HTML manipulado.
export default function RichText({ rich, plain, style, className }: Props) {
  if (richHasContent(rich)) {
    return (
      <div
        className={"rich-content" + (className ? " " + className : "")}
        style={style}
        dangerouslySetInnerHTML={{ __html: sanitizeRichHtml(rich) }}
      />
    );
  }
  return (
    <p className={className} style={{ whiteSpace: "pre-wrap", ...style }}>
      {plain}
    </p>
  );
}
