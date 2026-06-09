import { NextResponse } from "next/server";
import * as cheerio from "cheerio";
import { unstable_cache } from "next/cache";

export interface Tide {
  time: string;
  height: string;
  type: "alta" | "baixa";
}

export interface MaresData {
  tides: Tide[];
  date: string;
}

const fetchTides = unstable_cache(
  async (): Promise<MaresData> => {
    const res = await fetch(
      "https://tabuademares.com/br/bahia/morro-de-sao-paulo",
      {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (compatible; MercadoIlha/1.0; tide-widget)",
        },
        next: { revalidate: 21600 },
      }
    );

    if (!res.ok) throw new Error("fetch failed");

    const html = await res.text();
    const $ = cheerio.load(html);

    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, "0");
    const day = today.getDate();
    const dateStr = today.toISOString().slice(0, 10);

    // tabuademares.com format: onclick="Day('2026-06-9')" (no leading zero on day)
    const selector = `tr[onclick*="Day('${year}-${month}-${day}')"]`;
    const $row = $(selector).first();

    const tides: Tide[] = [];

    $row.find("td.tabla_mareas_marea").each((_, cell) => {
      const $cell = $(cell);
      const time = $cell.find(".tabla_mareas_marea_hora").text().trim();
      const height = $cell
        .find(".tabla_mareas_marea_altura_numero")
        .text()
        .trim()
        .replace(",", ".");
      const isLow = $cell.find(".tabla_mareas_marea_bajamar").length > 0;

      if (time && height) {
        tides.push({ time, height, type: isLow ? "baixa" : "alta" });
      }
    });

    return { tides, date: dateStr };
  },
  ["mares-hoje"],
  { revalidate: 21600 }
);

export async function GET() {
  try {
    const data = await fetchTides();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ tides: [], date: "", error: true });
  }
}
