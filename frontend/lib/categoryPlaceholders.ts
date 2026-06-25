// Placeholders (textos-guía) por categoría para la pantalla de publicar/editar anuncio.
// Hardcodeado por slug. Los slugs deben coincidir con la columna `slug` de la tabla
// `categories` en Supabase. Si se crea una categoría nueva en el admin, agregar acá su
// entrada; mientras tanto usa DEFAULT_PLACEHOLDERS como fallback.

export type CategoryPlaceholders = {
  title: string;
  description: string;
  priceText: string;
};

export const DEFAULT_PLACEHOLDERS: CategoryPlaceholders = {
  title: "Ex: nome do produto ou serviço",
  description:
    "Descreva os detalhes importantes: o que está anunciando, modalidade de entrega ou atendimento, valor do frete se houver, disponibilidade e formas de pagamento.",
  priceText: 'Ex: "A combinar", "Sob consulta"',
};

export const CATEGORY_PLACEHOLDERS: Record<string, CategoryPlaceholders> = {
  produtos: {
    title: "Ex: Geladeira Brastemp 300L, branca",
    description:
      "Descreva o produto: detalhe a condição, marca/modelo e características. Informe a modalidade de entrega — retirada no local ou à domicílio —, o valor do frete e as formas de pagamento. Não faz entrega? O comprador pode contratar um frete na categoria Transporte de mercadoria.",
    priceText: 'Ex: "A combinar", "Aceito troca"',
  },
  "servicios-do-lar": {
    title: "Ex: Marido de aluguel / diarista",
    description:
      "Descreva o serviço: o que está incluído, sua experiência e as zonas que atende. Informe valor por hora/diária ou se é sob orçamento, dias e horários disponíveis e as formas de pagamento.",
    priceText: 'Ex: "R$ 120 a diária", "Sob orçamento"',
  },
  "transporte-de-mercaderia": {
    title: "Ex: Carregador ou frete com trator",
    description:
      "Descreva o serviço de transporte: zonas e trajetos que atende, tipo e tamanho de carga e prazos. Informe valores ou orçamento sob consulta, disponibilidade e formas de pagamento.",
    priceText: 'Ex: "A partir de R$ 30", "Sob orçamento"',
  },
  encomendas: {
    title: "Ex: Trago suas compras de Valença para o Morro",
    description:
      "Descreva o serviço de encomendas: de onde traz os produtos, o que pode encomendar, prazos e zonas de entrega. Informe a taxa do serviço e as formas de pagamento.",
    priceText: 'Ex: "Taxa R$ 20 + compras", "A combinar"',
  },
  delivery: {
    title: "Ex: Marmita caseira do dia",
    description:
      "Descreva o prato ou cardápio: ingredientes, porções e opções. Informe a área de delivery e o valor da entrega, horários de funcionamento e as formas de pagamento.",
    priceText: 'Ex: "R$ 25 a marmita", "A partir de R$ 18"',
  },
  gas: {
    title: "Ex: Botijão de gás",
    description:
      "Descreva o produto e a área de entrega. Informe o valor, horários de atendimento e formas de pagamento.",
    priceText: 'Ex: "A combinar"',
  },
  "mobilidade-e-transportes": {
    title: 'Ex: Mototáxi "seu nome"',
    description:
      "Descreva o transporte de pessoas: trajetos, tipo de veículo/embarcação e capacidade de passageiros e bagagem. Informe valores ou orçamento, horários e disponibilidade e formas de pagamento.",
    priceText: 'Ex: "R$ 50 por pessoa", "Sob orçamento"',
  },
  alugueis: {
    title: "Ex: Casa 2 quartos para temporada",
    description:
      "Descreva o imóvel: tamanho, quartos e banheiros, mobília e o que inclui (água, luz, internet). Informe o valor (diária/mensal), período mínimo, depósito/garantia e as condições.",
    priceText: 'Ex: "R$ 1.500/mês", "R$ 200 a diária"',
  },
  educacao: {
    title: "Ex: Aulas de inglês",
    description:
      "Descreva o curso ou aula: conteúdo, nível, modalidade (presencial ou online) e duração. Informe valores ou pacotes, dias e horários disponíveis e formas de pagamento.",
    priceText: 'Ex: "R$ 60 a aula", "Pacote mensal R$ 200"',
  },
  babas: {
    title: "Ex: Babá com experiência, meio período",
    description:
      "Descreva o cuidado infantil: faixa etária que atende, sua experiência e referências, e onde atende. Informe disponibilidade (dias e horários), valor por hora/diária e formas de pagamento.",
    priceText: 'Ex: "R$ 20/hora", "Sob orçamento"',
  },
  esportes: {
    title: "Ex: Personal trainer na praia",
    description:
      "Descreva a atividade ou serviço: modalidade, nível (iniciante/avançado), o que inclui e onde acontece. Informe valores ou pacotes, dias e horários e formas de pagamento.",
    priceText: 'Ex: "R$ 50 a aula", "Mensal R$ 240"',
  },
  "arte-e-cultura": {
    title: "Ex: Oficina de cerâmica para iniciantes",
    description:
      "Descreva a oficina, curso ou evento: o que vão aprender/vivenciar, materiais inclusos, duração e local. Informe valores ou inscrição, datas e horários e formas de pagamento.",
    priceText: 'Ex: "R$ 80 por pessoa", "Entrada gratuita"',
  },
  "beleza-e-bem-estar": {
    title: "Ex: Manicure e pedicure à domicílio",
    description:
      "Descreva o serviço: o que inclui, técnicas/produtos utilizados e sua experiência. Informe se atende no local ou à domicílio e as zonas, valores, dias e horários e formas de pagamento.",
    priceText: 'Ex: "R$ 40", "A partir de R$ 50"',
  },
  supermercados: {
    title: "Ex: Cesta básica completa",
    description:
      "Descreva o produto ou oferta: itens incluídos, marca, quantidade e validade quando aplicável. Informe se há entrega e o valor, horários de funcionamento e formas de pagamento.",
    priceText: 'Ex: "R$ 89,90", "Oferta da semana"',
  },
  "restaurantes-e-bares": {
    title: "Ex: Rodízio de frutos do mar",
    description:
      "Descreva o restaurante, prato ou promoção: tipo de cozinha, pratos em destaque e ambiente. Informe horários de funcionamento, se tem reserva ou delivery e formas de pagamento.",
    priceText: 'Ex: "R$ 70 por pessoa"',
  },
  terrenos: {
    title: "Ex: Terreno 500m² em Gamboa",
    description:
      "Descreva o terreno: tamanho (m²), localização e características (acesso, água, luz, documentação/escritura). Informe o valor ou se é sob consulta e as condições de pagamento.",
    priceText: 'Ex: "R$ 70.000", "Sob consulta"',
  },
  casas: {
    title: "Ex: Casa 3 quartos perto da praia",
    description:
      "Descreva o imóvel: tamanho, quartos e banheiros, estado de conservação e o que inclui (quintal, garagem, mobília). Informe localização, valor ou se é sob consulta e condições de pagamento.",
    priceText: 'Ex: "R$ 350.000", "Sob consulta"',
  },
  consertos: {
    title: "Ex: Conserto de celulares e eletrônicos",
    description:
      "Descreva o conserto: o que você arruma, prazo médio, garantia e se atende no local ou retira o objeto. Informe valores ou orçamento sob consulta, disponibilidade e formas de pagamento.",
    priceText: 'Ex: "Orçamento grátis", "A partir de R$ 50"',
  },
  veiculos: {
    title: "Ex: Moto Honda Biz 2020, 15.000 km",
    description:
      "Descreva o veículo: marca, modelo, ano, quilometragem, estado e documentação. Informe se aceita troca, o valor ou se é sob consulta e as formas de pagamento.",
    priceText: 'Ex: "R$ 9.500", "Aceito troca"',
  },
  "construcao-e-reformas": {
    title: "Ex: Pedreiro e serviços de reforma",
    description:
      "Descreva o serviço de construção/reforma: tipo de trabalho, se os materiais estão inclusos ou por conta do cliente, sua experiência e zonas que atende. Informe prazo, disponibilidade e como faz o orçamento.",
    priceText: 'Ex: "Orçamento sob consulta", "R$ por m²"',
  },
  bioconstrucao: {
    title: "Ex: Projeto de bioconstrução sustentável",
    description:
      "Descreva o serviço ou projeto: técnicas (bambu, adobe, taipa), o que inclui, sua experiência e exemplos de trabalhos. Informe prazos, disponibilidade e como faz o orçamento.",
    priceText: 'Ex: "Orçamento sob consulta", "A combinar"',
  },
  saude: {
    title: "Ex: Fisioterapeuta à domicílio",
    description:
      "Descreva o serviço de saúde: especialidade, o que inclui, sua formação/registro profissional e se atende no local ou à domicílio. Informe valores ou convênios, dias e horários e formas de pagamento.",
    priceText: 'Ex: "R$ 120 a consulta", "Sob consulta"',
  },
  doacoes: {
    title: "Ex: Doação de roupas infantis",
    description:
      "Descreva o que está doando: tipo de item, estado e quantidade. Informe como combinar a retirada (local e horários). Itens de doação são gratuitos.",
    priceText: 'Ex: "Gratuito", "Doação"',
  },
  "empregos-e-bicos": {
    title: "Ex: Vaga para garçom em pousada",
    description:
      "Descreva a vaga ou bico: função, responsabilidades, requisitos e carga horária. Informe se é fixo ou temporário, a remuneração ou se é a combinar e como se candidatar.",
    priceText: 'Ex: "R$ 2.000/mês", "Diária a combinar"',
  },
  "servicos-profissionais": {
    title: "Ex: Contador / assessoria contábil",
    description:
      "Descreva o serviço profissional: área de atuação, o que inclui, sua experiência e se atende presencial ou online. Informe valores ou pacotes, disponibilidade e formas de pagamento.",
    priceText: 'Ex: "Sob orçamento", "A partir de R$ 200"',
  },
  "experiencias-turisticas": {
    title: "Ex: Passeio de barco às piscinas naturais",
    description:
      "Descreva a experiência: roteiro, duração, o que inclui (transporte, guia, alimentação), ponto de saída e número de pessoas. Informe valores por pessoa, datas/horários e formas de pagamento.",
    priceText: 'Ex: "R$ 300 por pessoa", "Crianças grátis"',
  },
  internet: {
    title: "Ex: Instalação de internet e Wi-Fi",
    description:
      "Descreva o serviço: tipo de conexão oferecida, velocidade, equipamentos incluídos e área de cobertura. Informe planos, mensalidade ou taxa de instalação, disponibilidade e formas de pagamento.",
    priceText: 'Ex: "R$ 120/mês", "Taxa de instalação R$ 80"',
  },
  "agua-para-beber": {
    title: "Ex: Entrega de galão de água mineral",
    description:
      "Descreva o produto: marca, tamanho (galão 20L, garrafão 5L, etc.) e área de entrega. Informe o valor por unidade, disponibilidade, horários de entrega e formas de pagamento.",
    priceText: 'Ex: "R$ 12 o galão", "A combinar"',
  },
  beleza: {
    title: "Ex: Corte, escova e tintura a domicílio",
    description:
      "Descreva o serviço: o que inclui, produtos utilizados, sua experiência e se atende no local ou a domicílio. Informe valores por procedimento, disponibilidade e formas de pagamento.",
    priceText: 'Ex: "R$ 50 o corte", "A partir de R$ 80"',
  },
  lojas: {
    title: "Ex: Loja de roupas e acessórios",
    description:
      "Descreva a loja ou produto: o que vende, marcas disponíveis, formas de atendimento (loja física, delivery ou encomenda). Informe horários de funcionamento, localização e formas de pagamento.",
    priceText: 'Ex: "A partir de R$ 30", "Consulte disponibilidade"',
  },
  mercados: {
    title: "Ex: Mercadinho com produtos frescos",
    description:
      "Descreva o estabelecimento ou produto: o que comercializa, se tem delivery ou retirada no local, horários de funcionamento e localização. Informe valores ou formas de consulta de preços.",
    priceText: 'Ex: "Preços variados", "Consulte disponibilidade"',
  },
};

export function getCategoryPlaceholders(slug?: string | null): CategoryPlaceholders {
  return (slug && CATEGORY_PLACEHOLDERS[slug]) || DEFAULT_PLACEHOLDERS;
}
