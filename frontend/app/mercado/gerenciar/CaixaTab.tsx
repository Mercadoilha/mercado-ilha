"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { supabase } from "../../../lib/supabaseClient";
import { formatBRL } from "../../../lib/mercadoCart";
import { DOW_LABELS, PERIODS, periodRange, shortDate, type PeriodKey } from "./periodo";
import type { CostCategory } from "./LancamentoSheet";

const LancamentoSheet = dynamic(() => import("./LancamentoSheet"), { ssr: false });

type Dashboard = {
  pedidos_total: number; pedidos_count: number; ticket_medio: number;
  vendas_total: number; vendas_count: number;
  custos_total: number; custos_count: number;
  receita_total: number;
  // Entradas menos custos operacionais: não depende do custo de nenhum produto.
  resultado_caixa: number;
  // Só vêm preenchidos quando não falta nenhum custo do período.
  lucro_liquido: number | null;
  margem_pct: number | null;
  margem_ok: boolean;
  cmv_total: number;
  itens_sem_custo: number;
  itens_fora_catalogo: number;
  vendas_sem_custo: number;
  catalogo_sem_custo: number;
  catalogo_total: number;
  produtos_sem_custo: string[];
  por_secao: {
    id: number; nome: string; emoji: string | null;
    receita: number; cmv: number; sem_custo: number;
    margem_ok: boolean; lucro_bruto: number | null; margem_pct: number | null;
  }[];
  custos_por_categoria: { nome: string; total: number }[];
  por_dia: { dia: string; pedidos: number; pedidos_total: number; vendas_total: number }[];
  por_hora: { hora: number; pedidos: number }[];
  por_dia_semana: { dow: number; pedidos: number }[];
  top_produtos: { nome: string; qtd: number; total: number }[];
};

type Sale = { id: number; sold_on: string; amount: number; note: string | null };
type Cost = { id: number; spent_on: string; amount: number; description: string; category_id: number | null };

// O caixa da feira: o que entrou pelo app, o que se vendeu no balcão, o que se
// gastou e o que sobrou. Tudo do período escolhido, numa consulta só.
export default function CaixaTab({ vendorId, onGoToCatalogo }: { vendorId: number; onGoToCatalogo: () => void }) {
  const [period, setPeriod] = useState<PeriodKey>("mes");
  const range = useMemo(() => periodRange(period), [period]);

  const [data, setData] = useState<Dashboard | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);
  const [costs, setCosts] = useState<Cost[]>([]);
  const [categories, setCategories] = useState<CostCategory[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [sheet, setSheet] = useState<"venda" | "custo" | null>(null);
  const [filling, setFilling] = useState(false);
  const [fillMsg, setFillMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [dash, salesRes, costsRes, catsRes] = await Promise.all([
      supabase.rpc("get_market_dashboard", { p_vendor_id: vendorId, p_from: range.from, p_to: range.to }),
      supabase.from("market_sales").select("id,sold_on,amount,note")
        .eq("vendor_id", vendorId).gte("sold_on", range.from).lte("sold_on", range.to)
        .order("sold_on", { ascending: false }).limit(200),
      supabase.from("market_costs").select("id,spent_on,amount,description,category_id")
        .eq("vendor_id", vendorId).gte("spent_on", range.from).lte("spent_on", range.to)
        .order("spent_on", { ascending: false }).limit(200),
      supabase.from("market_cost_categories").select("id,name")
        .eq("vendor_id", vendorId).eq("is_active", true).order("name"),
    ]);
    if (dash.error) { setError("Não foi possível carregar os números."); return; }
    setError(null);
    setData(dash.data as Dashboard);
    setSales((salesRes.data ?? []) as Sale[]);
    setCosts((costsRes.data ?? []) as Cost[]);
    setCategories((catsRes.data ?? []) as CostCategory[]);
  }, [vendorId, range.from, range.to]);

  useEffect(() => { void load(); }, [load]);

  // Vendas feitas antes de a feira preencher os custos ficam sem custo para
  // sempre — o custo é congelado no pedido de propósito. Isto preenche só esses
  // buracos, com o custo que está hoje no catálogo, sem tocar no que já tem.
  const fillCosts = async () => {
    setFilling(true); setFillMsg(null);
    const { data, error: err } = await supabase.rpc("fill_missing_costs", {
      p_vendor_id: vendorId, p_from: range.from, p_to: range.to,
    });
    setFilling(false);
    if (err) { setFillMsg("Não foi possível aplicar agora."); return; }
    const res = data as { preenchidos: number; ainda_sem_custo: number };
    setFillMsg(
      res.ainda_sem_custo > 0
        ? `${res.preenchidos} itens completados. Faltam ${res.ainda_sem_custo}: são opções que ainda não têm custo no catálogo.`
        : `${res.preenchidos} itens completados.`,
    );
    await load();
  };

  const removeSale = async (id: number) => {
    await supabase.from("market_sales").delete().eq("id", id);
    await load();
  };
  const removeCost = async (id: number) => {
    await supabase.from("market_costs").delete().eq("id", id);
    await load();
  };

  if (!data) {
    return <div style={{ textAlign: "center", padding: "3rem 0" }}><div className="spinner" /></div>;
  }

  const maxDia = Math.max(1, ...data.por_dia.map((d) => Number(d.pedidos_total) + Number(d.vendas_total)));
  const maxHora = Math.max(1, ...data.por_hora.map((h) => h.pedidos));
  const maxDow = Math.max(1, ...data.por_dia_semana.map((d) => d.pedidos));

  return (
    <div style={{ paddingBottom: 28 }}>
      {/* Período */}
      <div style={{ display: "flex", gap: 6, padding: "0.6rem 1rem", background: "#fff", borderBottom: "1px solid var(--border)", overflowX: "auto" }}>
        {PERIODS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => setPeriod(p.key)}
            style={{
              flexShrink: 0, border: `1.5px solid ${period === p.key ? "var(--green-dark)" : "var(--border)"}`,
              background: period === p.key ? "var(--green-dark)" : "#fff",
              color: period === p.key ? "#fff" : "#475569",
              borderRadius: 999, padding: "0.3rem 0.7rem", fontSize: "0.76rem", fontWeight: 700,
              fontFamily: "inherit", cursor: "pointer",
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      {error && <p className="text-error" style={{ margin: "1rem", fontSize: "0.82rem" }}>{error}</p>}

      {/* Resultado do período */}
      <div style={{ padding: "0.9rem 1rem", background: "#F7FBF9", borderBottom: "1px solid var(--border)" }}>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <Stat label="Pedidos do app" value={formatBRL(Number(data.pedidos_total))} sub={`${data.pedidos_count} ${data.pedidos_count === 1 ? "pedido" : "pedidos"}`} />
          <Stat label="Vendas na feira" value={formatBRL(Number(data.vendas_total))} sub={`${data.vendas_count} ${data.vendas_count === 1 ? "lançamento" : "lançamentos"}`} />
          <Stat label="Custos" value={formatBRL(Number(data.custos_total))} sub={`${data.custos_count} ${data.custos_count === 1 ? "lançamento" : "lançamentos"}`} negative />
          <Stat label="Resultado de caixa" value={formatBRL(Number(data.resultado_caixa ?? 0))} sub={`ticket médio ${formatBRL(Number(data.ticket_medio))}`} highlight />
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button type="button" onClick={() => setSheet("venda")} className="btn" style={{ flex: 1, background: "var(--green-dark)", color: "#fff", fontSize: "0.82rem", fontWeight: 800 }}>
            + Venda na feira
          </button>
          <button type="button" onClick={() => setSheet("custo")} className="btn btn-outline" style={{ flex: 1, fontSize: "0.82rem", fontWeight: 800, borderColor: "var(--green-dark)", color: "var(--green-dark)" }}>
            + Custo
          </button>
        </div>
      </div>

      {/* Lucro: só sai quando a informação está completa. */}
      {data.margem_ok ? (
        <Block title="Lucro do período">
          <Line label="Receita (app + feira)" value={formatBRL(Number(data.receita_total))} />
          <Line label="Custo dos produtos vendidos" value={`− ${formatBRL(Number(data.cmv_total))}`} negative />
          <Line label="Custos operacionais" value={`− ${formatBRL(Number(data.custos_total))}`} negative />
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 8, paddingTop: 8, borderTop: "1.5px solid var(--border)" }}>
            <span style={{ fontSize: "0.86rem", fontWeight: 800, color: "#334155" }}>Lucro líquido</span>
            <span style={{ fontSize: "1.15rem", fontWeight: 800, color: Number(data.lucro_liquido) >= 0 ? "var(--green-dark)" : "#b91c1c" }}>
              {formatBRL(Number(data.lucro_liquido))}
              {data.margem_pct !== null && (
                <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--text-muted)" }}> · {Number(data.margem_pct)}%</span>
              )}
            </span>
          </div>
          {Number(data.itens_fora_catalogo ?? 0) > 0 && (
            <p style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: 8, lineHeight: 1.4 }}>
              {data.itens_fora_catalogo} {data.itens_fora_catalogo === 1 ? "item foi acrescentado" : "itens foram acrescentados"} fora do
              catálogo na retirada: entram na receita, mas sem custo próprio.
            </p>
          )}
        </Block>
      ) : (
        <div style={{ background: "#FFFBEB", borderBottom: "1px solid #FCD34D", padding: "0.9rem 1rem" }}>
          <div style={{ fontSize: "0.85rem", fontWeight: 800, color: "#92400E" }}>🔒 Lucro ainda não disponível</div>
          <p style={{ fontSize: "0.76rem", color: "#92400E", lineHeight: 1.5, marginTop: 4 }}>
            Para calcular o lucro é preciso saber quanto custou o que foi vendido. Enquanto faltar
            algum custo, o painel prefere não mostrar um número pela metade — ele pareceria certo e
            levaria a decisões erradas.
          </p>

          <div style={{ marginTop: 10, background: "#fff", border: "1px solid #FCD34D", borderRadius: 10, padding: "0.6rem 0.7rem" }}>
            <div style={{ fontSize: "0.74rem", fontWeight: 800, color: "#92400E", marginBottom: 4 }}>O que falta</div>
            {Number(data.itens_sem_custo ?? 0) > 0 && (
              <div style={{ fontSize: "0.76rem", color: "#78350F" }}>
                • {data.itens_sem_custo} {data.itens_sem_custo === 1 ? "item vendido" : "itens vendidos"} sem custo informado
                {(data.produtos_sem_custo ?? []).length > 0 && (
                  <span style={{ color: "var(--text-muted)" }}> ({(data.produtos_sem_custo ?? []).slice(0, 4).join(", ")}{(data.produtos_sem_custo ?? []).length > 4 ? "…" : ""})</span>
                )}
              </div>
            )}
            {Number(data.vendas_sem_custo ?? 0) > 0 && (
              <div style={{ fontSize: "0.76rem", color: "#78350F" }}>
                • {data.vendas_sem_custo} {data.vendas_sem_custo === 1 ? "venda na feira" : "vendas na feira"} sem o custo dos produtos
              </div>
            )}
            {Number(data.itens_sem_custo ?? 0) === 0 && Number(data.vendas_sem_custo ?? 0) === 0 && (
              <div style={{ fontSize: "0.76rem", color: "#78350F" }}>• Nenhuma venda registrada neste período</div>
            )}
          </div>

          {Number(data.catalogo_sem_custo ?? 0) > 0 && (
            <button
              type="button"
              onClick={onGoToCatalogo}
              className="btn btn-block"
              style={{ marginTop: 10, background: "#92400E", color: "#fff", fontSize: "0.82rem", fontWeight: 800 }}
            >
              Preencher custos no catálogo ({data.catalogo_sem_custo} de {data.catalogo_total})
            </button>
          )}

          {/* Depois de preencher o catálogo, as vendas antigas seguem sem custo:
              elas guardaram o custo do momento, e naquele momento não havia. */}
          {Number(data.itens_sem_custo ?? 0) > 0 && (
            <>
              <button
                type="button"
                onClick={fillCosts}
                disabled={filling}
                className="btn btn-outline btn-block"
                style={{ marginTop: 8, fontSize: "0.8rem", fontWeight: 800, borderColor: "#92400E", color: "#92400E" }}
              >
                {filling ? "Aplicando…" : "Aplicar os custos de hoje às vendas deste período"}
              </button>
              <p style={{ fontSize: "0.7rem", color: "#92400E", marginTop: 6, lineHeight: 1.4 }}>
                Use isto para vendas feitas antes de você preencher os custos. Preenche só o que está
                vazio, com o custo que está hoje no catálogo — nenhuma venda que já tem custo é alterada.
              </p>
              {fillMsg && (
                <p style={{ fontSize: "0.74rem", color: "#78350F", fontWeight: 700, marginTop: 6 }}>{fillMsg}</p>
              )}
            </>
          )}

          <p style={{ fontSize: "0.72rem", color: "#92400E", marginTop: 8, lineHeight: 1.4 }}>
            Enquanto isso, o <strong>resultado de caixa</strong> acima segue funcionando (é o que entrou
            menos os custos operacionais), e cada <strong>seção que já estiver completa</strong> mostra a
            margem dela logo abaixo — não é preciso terminar tudo para começar a enxergar.
          </p>
        </div>
      )}

      {/* Margem por seção: cada seção completa já entrega o seu resultado, mesmo
          que outra ainda esteja pendente. */}
      {(data.por_secao ?? []).length > 0 && (
        <Block title="Margem por seção" hint="Receita menos o custo dos produtos, antes dos custos operacionais">
          {(data.por_secao ?? []).map((sec) => (
            <div
              key={sec.id}
              style={{
                display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10,
                padding: "0.4rem 0", borderBottom: "1px solid #f1f5f9",
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#334155" }}>
                  {sec.emoji ? `${sec.emoji} ` : ""}{sec.nome}
                </div>
                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                  receita {formatBRL(Number(sec.receita))}
                </div>
              </div>
              {sec.margem_ok ? (
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: "0.88rem", fontWeight: 800, color: Number(sec.lucro_bruto) >= 0 ? "var(--green-dark)" : "#b91c1c" }}>
                    {formatBRL(Number(sec.lucro_bruto))}
                  </div>
                  {sec.margem_pct !== null && (
                    <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>margem {Number(sec.margem_pct)}%</div>
                  )}
                </div>
              ) : (
                <div style={{ textAlign: "right", flexShrink: 0 }}>
                  <div style={{ fontSize: "0.72rem", fontWeight: 800, color: "#B45309" }}>🔒 faltam custos</div>
                  <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                    {sec.sem_custo} {sec.sem_custo === 1 ? "item" : "itens"}
                  </div>
                </div>
              )}
            </div>
          ))}
        </Block>
      )}

      {/* Movimento dia a dia */}
      {data.por_dia.length > 0 && (
        <Block title="Movimento dia a dia">
          <div style={{ display: "flex", alignItems: "flex-end", gap: 4, height: 110, overflowX: "auto", paddingBottom: 4 }}>
            {data.por_dia.map((d) => {
              const soma = Number(d.pedidos_total) + Number(d.vendas_total);
              return (
                <div key={d.dia} style={{ flex: "0 0 26px", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, height: "100%", justifyContent: "flex-end" }}>
                  <div
                    title={`${shortDate(d.dia)} · ${formatBRL(soma)}`}
                    style={{
                      width: "100%", height: `${Math.max(4, (soma / maxDia) * 82)}px`,
                      background: "var(--green-dark)", borderRadius: "5px 5px 0 0",
                    }}
                  />
                  <span style={{ fontSize: "0.58rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{shortDate(d.dia)}</span>
                </div>
              );
            })}
          </div>
        </Block>
      )}

      {/* Quando as pessoas pedem */}
      {data.por_hora.length > 0 && (
        <Block title="A que horas pedem" hint="Pedidos feitos pelo app">
          <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 80 }}>
            {Array.from({ length: 24 }, (_, h) => {
              const found = data.por_hora.find((x) => x.hora === h);
              const qtd = found?.pedidos ?? 0;
              return (
                <div key={h} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2, height: "100%", justifyContent: "flex-end" }}>
                  <div
                    title={`${h}h · ${qtd}`}
                    style={{ width: "100%", height: `${Math.max(2, (qtd / maxHora) * 56)}px`, background: qtd ? "var(--green-sea)" : "#e2e8f0", borderRadius: "3px 3px 0 0" }}
                  />
                  {h % 6 === 0 && <span style={{ fontSize: "0.55rem", color: "var(--text-muted)" }}>{h}h</span>}
                </div>
              );
            })}
          </div>
        </Block>
      )}

      {data.por_dia_semana.length > 0 && (
        <Block title="Em que dias pedem">
          <div style={{ display: "flex", gap: 6 }}>
            {[1, 2, 3, 4, 5, 6, 7].map((dow) => {
              const qtd = data.por_dia_semana.find((x) => x.dow === dow)?.pedidos ?? 0;
              return (
                <div key={dow} style={{ flex: 1, textAlign: "center" }}>
                  <div style={{ height: 54, display: "flex", alignItems: "flex-end" }}>
                    <div style={{ width: "100%", height: `${Math.max(3, (qtd / maxDow) * 54)}px`, background: "var(--green-dark)", borderRadius: "4px 4px 0 0" }} />
                  </div>
                  <div style={{ fontSize: "0.6rem", color: "var(--text-muted)", marginTop: 3 }}>{DOW_LABELS[dow]}</div>
                  <div style={{ fontSize: "0.68rem", fontWeight: 800, color: "#334155" }}>{qtd}</div>
                </div>
              );
            })}
          </div>
        </Block>
      )}

      {data.top_produtos.length > 0 && (
        <Block title="O que mais sai">
          {data.top_produtos.map((p) => (
            <div key={p.nome} style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: "0.8rem", padding: "0.25rem 0", color: "#475569" }}>
              <span style={{ minWidth: 0 }}>{p.nome}</span>
              <span style={{ flexShrink: 0 }}>
                <span style={{ color: "var(--text-muted)" }}>{Number(p.qtd)} · </span>
                <strong>{formatBRL(Number(p.total))}</strong>
              </span>
            </div>
          ))}
        </Block>
      )}

      {data.custos_por_categoria.length > 0 && (
        <Block title="Custos por categoria">
          {data.custos_por_categoria.map((c) => (
            <div key={c.nome} style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", padding: "0.25rem 0", color: "#475569" }}>
              <span>{c.nome}</span>
              <strong>{formatBRL(Number(c.total))}</strong>
            </div>
          ))}
        </Block>
      )}

      {/* Lançamentos do período */}
      {(sales.length > 0 || costs.length > 0) && (
        <Block title="Lançamentos do período">
          {sales.map((s) => (
            <Movement
              key={`s-${s.id}`}
              date={shortDate(s.sold_on)}
              text={s.note || "Venda na feira"}
              value={`+ ${formatBRL(Number(s.amount))}`}
              color="var(--green-dark)"
              onRemove={() => removeSale(s.id)}
            />
          ))}
          {costs.map((c) => (
            <Movement
              key={`c-${c.id}`}
              date={shortDate(c.spent_on)}
              text={c.description}
              value={`− ${formatBRL(Number(c.amount))}`}
              color="#b91c1c"
              onRemove={() => removeCost(c.id)}
            />
          ))}
        </Block>
      )}

      {sheet && (
        <LancamentoSheet
          kind={sheet}
          vendorId={vendorId}
          categories={categories}
          defaultDate={range.to}
          onClose={() => setSheet(null)}
          onDone={async () => { setSheet(null); await load(); }}
        />
      )}
    </div>
  );
}

function Line({ label, value, negative }: { label: string; value: string; negative?: boolean }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", padding: "0.2rem 0", color: "#475569" }}>
      <span>{label}</span>
      <strong style={{ color: negative ? "#b91c1c" : "#334155" }}>{value}</strong>
    </div>
  );
}

function Stat({ label, value, sub, highlight, negative }: { label: string; value: string; sub: string; highlight?: boolean; negative?: boolean }) {
  return (
    <div style={{ background: highlight ? "var(--green-dark)" : "#fff", border: "1px solid #E3F1EA", borderRadius: 12, padding: "0.6rem 0.7rem" }}>
      <div style={{ fontSize: "0.66rem", fontWeight: 700, color: highlight ? "rgba(255,255,255,0.85)" : "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em" }}>{label}</div>
      <div style={{ fontSize: "1.02rem", fontWeight: 800, marginTop: 2, color: highlight ? "#fff" : negative ? "#b91c1c" : "var(--green-dark)" }}>{value}</div>
      <div style={{ fontSize: "0.68rem", color: highlight ? "rgba(255,255,255,0.8)" : "var(--text-muted)" }}>{sub}</div>
    </div>
  );
}

function Block({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "#fff", borderBottom: "1px solid var(--border)", padding: "0.8rem 1rem" }}>
      <div style={{ fontSize: "0.78rem", fontWeight: 800, color: "#334155" }}>{title}</div>
      {hint && <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginBottom: 6 }}>{hint}</div>}
      <div style={{ marginTop: hint ? 0 : 8 }}>{children}</div>
    </div>
  );
}

function Movement({ date, text, value, color, onRemove }: { date: string; text: string; value: string; color: string; onRemove: () => void }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.8rem", padding: "0.3rem 0", borderBottom: "1px solid #f1f5f9" }}>
      <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", flexShrink: 0, width: 38 }}>{date}</span>
      <span style={{ flex: 1, minWidth: 0, color: "#475569" }}>{text}</span>
      <strong style={{ color, flexShrink: 0 }}>{value}</strong>
      <button
        type="button"
        onClick={onRemove}
        aria-label="Apagar lançamento"
        style={{ border: "none", background: "transparent", color: "var(--text-muted)", cursor: "pointer", fontSize: "0.85rem", flexShrink: 0 }}
      >
        ✕
      </button>
    </div>
  );
}
