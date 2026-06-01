export default function TermosPage() {
  const year = new Date().getFullYear();

  return (
    <div className="page-body">
      <header
        style={{
          background: "linear-gradient(135deg, var(--blue-main) 0%, var(--blue-mid) 100%)",
          padding: "1rem",
          color: "#fff",
          marginBottom: "1rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <span style={{ fontSize: "0.95rem", fontWeight: 700 }}>Mercado Ilha</span>
            <span style={{ fontSize: "0.82rem", color: "rgba(255,255,255,0.85)" }}>
              Termos e Condições de Uso
            </span>
          </div>
        </div>
      </header>

      <main style={{ background: "#fff", borderRadius: 18, boxShadow: "0 12px 30px rgba(15, 23, 42, 0.08)", padding: "1.5rem", marginBottom: "2rem" }}>
        <p style={{ marginBottom: "1rem", fontSize: "0.95rem", color: "#334155" }}>
          TERMOS E CONDIÇÕES DE USO — MERCADO ILHA
        </p>

        <p style={{ marginBottom: "1rem", color: "#475569", lineHeight: 1.7 }}>
          Última atualização: {year}
        </p>

        <p style={{ marginBottom: "1rem", color: "#475569", lineHeight: 1.7 }}>
          Ao se cadastrar no Mercado Ilha, você declara que leu, compreendeu e concorda integralmente com estes Termos e Condições de Uso.
        </p>

        <section style={{ marginBottom: "1rem" }}>
          <h2 style={{ marginBottom: "0.75rem", fontSize: "1rem", fontWeight: 700, color: "#0f172a" }}>
            1. NATUREZA DO SERVIÇO
          </h2>
          <p style={{ color: "#475569", lineHeight: 1.7 }}>
            O Mercado Ilha é uma plataforma de intermediação de anúncios que conecta compradores e vendedores da ilha de Tinharé e região. O Mercado Ilha NÃO é parte em nenhuma negociação realizada entre usuários, não compra, não vende, não presta os serviços anunciados e não atua como intermediário financeiro em qualquer transação.
          </p>
        </section>

        <section style={{ marginBottom: "1rem" }}>
          <h2 style={{ marginBottom: "0.75rem", fontSize: "1rem", fontWeight: 700, color: "#0f172a" }}>
            2. ISENÇÃO DE RESPONSABILIDADE
          </h2>
          <p style={{ color: "#475569", lineHeight: 1.7 }}>
            O Mercado Ilha não se responsabiliza por: (a) a veracidade, qualidade, segurança ou legalidade dos anúncios publicados; (b) a capacidade dos vendedores de concluir a transação; (c) a capacidade dos compradores de efetuar pagamentos; (d) eventuais danos, perdas, prejuízos ou conflitos decorrentes de negociações realizadas entre usuários; (e) o conteúdo de conversas realizadas fora da plataforma, incluindo via WhatsApp ou qualquer outro canal de comunicação. Toda transação é de exclusiva responsabilidade dos usuários envolvidos.
          </p>
        </section>

        <section style={{ marginBottom: "1rem" }}>
          <h2 style={{ marginBottom: "0.75rem", fontSize: "1rem", fontWeight: 700, color: "#0f172a" }}>
            3. COMUNICAÇÕES DA PLATAFORMA
          </h2>
          <p style={{ color: "#475569", lineHeight: 1.7 }}>
            Ao se cadastrar, o usuário concorda em receber: (a) notificações relacionadas à sua conta e aos seus anúncios; (b) comunicados de atualização da plataforma; (c) mensagens de contato de outros usuários que acessem seus dados de WhatsApp a partir de anúncios publicados voluntariamente pelo próprio usuário.
          </p>
        </section>

        <section style={{ marginBottom: "1rem" }}>
          <h2 style={{ marginBottom: "0.75rem", fontSize: "1rem", fontWeight: 700, color: "#0f172a" }}>
            4. OBRIGAÇÕES DO USUÁRIO
          </h2>
          <p style={{ color: "#475569", lineHeight: 1.7 }}>
            O usuário se compromete a: (a) fornecer informações verdadeiras no cadastro; (b) publicar apenas anúncios de itens ou serviços que esteja autorizado a oferecer; (c) não publicar conteúdo ilegal, enganoso, ofensivo ou que viole direitos de terceiros; (d) conduzir negociações com boa-fé e respeito; (e) não utilizar a plataforma para práticas de spam, golpes ou qualquer atividade fraudulenta.
          </p>
        </section>

        <section style={{ marginBottom: "1rem" }}>
          <h2 style={{ marginBottom: "0.75rem", fontSize: "1rem", fontWeight: 700, color: "#0f172a" }}>
            5. MODERAÇÃO E REMOÇÃO DE CONTEÚDO
          </h2>
          <p style={{ color: "#475569", lineHeight: 1.7 }}>
            O Mercado Ilha reserva-se o direito de remover, ocultar ou bloquear qualquer anúncio ou usuário que viole estes Termos, sem aviso prévio e sem obrigação de justificativa. O usuário pode denunciar anúncios suspeitos diretamente na plataforma.
          </p>
        </section>

        <section style={{ marginBottom: "1rem" }}>
          <h2 style={{ marginBottom: "0.75rem", fontSize: "1rem", fontWeight: 700, color: "#0f172a" }}>
            6. PRIVACIDADE E DADOS
          </h2>
          <p style={{ color: "#475569", lineHeight: 1.7 }}>
            Os dados fornecidos no cadastro (nome, e-mail, número de WhatsApp) são utilizados exclusivamente para o funcionamento da plataforma. O número de WhatsApp do usuário é exibido publicamente apenas nos anúncios que ele mesmo publicar, sendo de sua exclusiva responsabilidade a decisão de publicar. O Mercado Ilha não compartilha dados pessoais com terceiros, exceto quando exigido por lei.
          </p>
        </section>

        <section style={{ marginBottom: "1rem" }}>
          <h2 style={{ marginBottom: "0.75rem", fontSize: "1rem", fontWeight: 700, color: "#0f172a" }}>
            7. PROPRIEDADE INTELECTUAL
          </h2>
          <p style={{ color: "#475569", lineHeight: 1.7 }}>
            O usuário declara ser o legítimo titular ou ter autorização para publicar as imagens e informações incluídas em seus anúncios, isentando o Mercado Ilha de qualquer responsabilidade por violação de direitos autorais ou de imagem.
          </p>
        </section>

        <section style={{ marginBottom: "1rem" }}>
          <h2 style={{ marginBottom: "0.75rem", fontSize: "1rem", fontWeight: 700, color: "#0f172a" }}>
            8. LIMITAÇÃO DE RESPONSABILIDADE
          </h2>
          <p style={{ color: "#475569", lineHeight: 1.7 }}>
            Em nenhuma hipótese o Mercado Ilha será responsável por danos diretos, indiretos, incidentais ou consequentes resultantes do uso ou da impossibilidade de uso da plataforma.
          </p>
        </section>

        <section style={{ marginBottom: "1rem" }}>
          <h2 style={{ marginBottom: "0.75rem", fontSize: "1rem", fontWeight: 700, color: "#0f172a" }}>
            9. ALTERAÇÕES NOS TERMOS
          </h2>
          <p style={{ color: "#475569", lineHeight: 1.7 }}>
            O Mercado Ilha pode modificar estes Termos a qualquer momento. As alterações entram em vigor imediatamente após a publicação na plataforma. O uso continuado da plataforma após alterações implica aceitação dos novos Termos.
          </p>
        </section>

        <section>
          <h2 style={{ marginBottom: "0.75rem", fontSize: "1rem", fontWeight: 700, color: "#0f172a" }}>
            10. FORO
          </h2>
          <p style={{ color: "#475569", lineHeight: 1.7 }}>
            Fica eleito o foro da comarca de Cairu, estado da Bahia, Brasil, para dirimir qualquer controvérsia decorrente destes Termos.
          </p>
        </section>
      </main>
    </div>
  );
}
