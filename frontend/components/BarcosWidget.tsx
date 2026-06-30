const LANCHA_RAPIDA = [
  "07:00", "08:00", "09:00", "10:00", "11:00", "12:00",
  "13:00", "14:00", "15:00", "16:00", "17:00", "18:00",
];

const BARCO_CONVENCIONAL = [
  "05:10", "05:40", "06:10", "06:40", "07:00", "07:30",
  "08:00", "09:00", "09:30", "10:00", "10:30", "11:00",
  "11:30", "12:30", "13:00", "14:00", "14:30", "15:00",
  "15:30", "16:00", "16:30", "17:00", "17:30", "18:00",
];

function TimeChip({ time }: { time: string }) {
  return (
    <span
      style={{
        fontSize: 11,
        color: "#185FA5",
        background: "#fff",
        border: "1px solid #B5D4F4",
        borderRadius: 6,
        padding: "2px 6px",
        fontVariantNumeric: "tabular-nums",
      }}
    >
      {time}
    </span>
  );
}

export default function BarcosWidget() {
  return (
    <div
      style={{
        margin: "8px 0 0",
        padding: "10px 14px",
        background: "#E6F1FB",
        borderRadius: 10,
        border: "1px solid #B5D4F4",
      }}
    >
      <p
        style={{
          margin: "0 0 2px",
          fontSize: 15,
          fontWeight: 700,
          color: "#185FA5",
        }}
      >
        ⛴ Horários de Barcos
      </p>
      <p
        style={{
          margin: "0 0 8px",
          fontSize: 11,
          color: "#5a7ea8",
        }}
      >
        Morro de São Paulo → Valença
      </p>

      <p
        style={{
          margin: "0 0 4px",
          fontSize: 11,
          fontWeight: 600,
          color: "#0F6E56",
        }}
      >
        Lancha rápida
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
        {LANCHA_RAPIDA.map((t) => (
          <TimeChip key={t} time={t} />
        ))}
      </div>

      <p
        style={{
          margin: "0 0 4px",
          fontSize: 11,
          fontWeight: 600,
          color: "#0F6E56",
        }}
      >
        Barco convencional
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {BARCO_CONVENCIONAL.map((t) => (
          <TimeChip key={t} time={t} />
        ))}
      </div>

      <p
        style={{
          margin: "8px 0 0",
          fontSize: 9,
          color: "#8aabcc",
        }}
      >
        Aos domingos e feriados os horários são reduzidos, favor consultar no local.
      </p>
    </div>
  );
}
