// Categorias de produtos com dados fiscais aproximados (IBPT/legislação brasileira)
// Alíquotas aproximadas incluem impostos federais + estaduais médios

export const CATEGORIAS = [
  { value: 'eletronicos',       label: 'Eletrônicos',          aliquota: 0.3621 },
  { value: 'informatica',       label: 'Informática',          aliquota: 0.3214 },
  { value: 'eletrodomesticos',  label: 'Eletrodomésticos',     aliquota: 0.3105 },
  { value: 'vestuario',         label: 'Vestuário',            aliquota: 0.4256 },
  { value: 'calcados',          label: 'Calçados',             aliquota: 0.3980 },
  { value: 'acessorios_moda',   label: 'Acessórios de Moda',   aliquota: 0.3750 },
  { value: 'moveis',            label: 'Móveis',               aliquota: 0.2980 },
  { value: 'cama_mesa_banho',   label: 'Cama, Mesa e Banho',   aliquota: 0.3340 },
  { value: 'brinquedos',        label: 'Brinquedos',           aliquota: 0.3560 },
  { value: 'esportes',          label: 'Esportes e Lazer',     aliquota: 0.3410 },
  { value: 'beleza_saude',      label: 'Beleza e Saúde',       aliquota: 0.3870 },
  { value: 'alimentos_bebidas', label: 'Alimentos e Bebidas',  aliquota: 0.1940 },
  { value: 'automotivo',        label: 'Automotivo',           aliquota: 0.3290 },
  { value: 'ferramentas',       label: 'Ferramentas',          aliquota: 0.2810 },
  { value: 'livros_midia',      label: 'Livros e Mídia',       aliquota: 0.0680 },
  { value: 'joias_relogios',    label: 'Joias e Relógios',     aliquota: 0.4120 },
  { value: 'pet_shop',          label: 'Pet Shop',             aliquota: 0.3150 },
  { value: 'outros',            label: 'Outros',               aliquota: 0.3200 },
];

export const CATEGORIA_MAP = Object.fromEntries(CATEGORIAS.map(c => [c.value, c]));

export function getAliquota(categoria) {
  return CATEGORIA_MAP[categoria]?.aliquota || 0.32;
}

export function calcTributos(preco, categoria) {
  if (!preco || preco <= 0) return 0;
  return parseFloat((preco * getAliquota(categoria)).toFixed(2));
}

export function formatBRL(value) {
  if (value === null || value === undefined || value === '') return '-';
  const num = parseFloat(value);
  if (isNaN(num)) return '-';
  return num.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatNum(value, decimals = 2) {
  if (value === null || value === undefined || value === '') return '-';
  const num = parseFloat(value);
  if (isNaN(num)) return '-';
  return num.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

// ─── Mapeamento automático de categoria pelo nome (Bling) ─────────────────────
// Cada entrada define:
//   match: regex contra o nome da categoria ou do produto (case insensitive)
//   categoria: valor interno da categoria
//   atributos: campos extras que fazem sentido para essa categoria

export const CATEGORY_AUTO_MAP = [
  {
    match: /cal[çc]ado|t[êe]nis|sandal|chinelo|bota|sapatilha|sapatenis|espadrille|alpargata|moc[ao]|crocs|slipper/i,
    categoria: 'calcados',
    atributos: ['Tamanho', 'Cor', 'Material', 'Gênero'],
  },
  {
    match: /roupa|vest[uú]|camiseta|camisa|calça|jeans|moletom|jaqueta|blazer|vestido|saia|shorts|bermuda|regata|blusa|body|macacão|pijama/i,
    categoria: 'vestuario',
    atributos: ['Tamanho', 'Cor', 'Material', 'Gênero'],
  },
  {
    match: /acess[oó]rio.*moda|cinto|carteira|bolsa|mochila|[oó]culos|cap[ée]u|bon[ée]|gravata|len[çc]o|bijuteria|pulseira|colar|anel/i,
    categoria: 'acessorios_moda',
    atributos: ['Cor', 'Material', 'Tamanho'],
  },
  {
    match: /l[âa]mpada|led|l[uú]minaria|spot|refletor|fita.*led|bulbo|l[uú]z/i,
    categoria: 'eletronicos',
    atributos: ['Potência (W)', 'Voltagem', 'Temperatura de Cor (K)', 'Base'],
  },
  {
    match: /eletr[ôo]nico|smartphone|celular|tablet|tv|tela|monitor|fone|headphone|caixa.*som|speaker|smartwatch|console/i,
    categoria: 'eletronicos',
    atributos: ['Voltagem', 'Cor', 'Capacidade', 'Modelo'],
  },
  {
    match: /notebook|computador|pc|teclado|mouse|impressora|webcam|roteador|hd|ssd|memoria|ram|placa/i,
    categoria: 'informatica',
    atributos: ['Voltagem', 'Capacidade', 'Cor', 'Modelo'],
  },
  {
    match: /eletrodom[eé]stico|geladeira|fogão|forno|microondas|liquidificador|batedeira|cafeteira|airfryer|ventilador|ar.*condicionado|lavadora|secadora|aspirador/i,
    categoria: 'eletrodomesticos',
    atributos: ['Voltagem', 'Cor', 'Capacidade', 'Potência (W)'],
  },
  {
    match: /m[oó]vel|sof[aá]|cadeira|mesa|armário|estante|prateleira|cama|colchão|guarda.*roupa|criado.*mudo|escrivaninha/i,
    categoria: 'moveis',
    atributos: ['Cor', 'Material', 'Tamanho', 'Dimensões'],
  },
  {
    match: /cama.*mesa.*banho|toalha|lençol|fronha|edredom|cobertor|almofada|travesseiro|jogo.*cama/i,
    categoria: 'cama_mesa_banho',
    atributos: ['Cor', 'Tamanho', 'Material'],
  },
  {
    match: /brinquedo|boneca|carrinho|jogo.*mesa|lego|quebra.*cabeça|pelucia|fantasia.*infantil/i,
    categoria: 'brinquedos',
    atributos: ['Faixa Etária', 'Cor', 'Material'],
  },
  {
    match: /esporte|fitness|academia|bicicleta|patins|skate|bola|raquete|haltere|prancha|natação|camping|trilha/i,
    categoria: 'esportes',
    atributos: ['Tamanho', 'Cor', 'Material', 'Gênero'],
  },
  {
    match: /beleza|cosmético|perfume|maquiagem|skincare|hidratante|shampoo|condicionador|creme|serum|protetor.*solar/i,
    categoria: 'beleza_saude',
    atributos: ['Volume (ml)', 'Tipo de Pele', 'Cor/Tom'],
  },
  {
    match: /alimento|bebida|suco|água|vinho|cerveja|whisky|caf[eé]|ch[aá]|biscoito|snack|suplemento|whey|proteína/i,
    categoria: 'alimentos_bebidas',
    atributos: ['Sabor', 'Peso/Volume', 'Unidades por caixa'],
  },
  {
    match: /automotivo|carro|moto|pneu|óleo.*motor|filtro.*ar|l[âa]mpada.*carro|acessório.*veículo|air.*bag|amortecedor/i,
    categoria: 'automotivo',
    atributos: ['Voltagem', 'Modelo do Veículo', 'Ano'],
  },
  {
    match: /ferramenta|furadeira|parafusadeira|serra|martelo|chave.*fenda|alicate|esmerilhadeira|compressor|nível/i,
    categoria: 'ferramentas',
    atributos: ['Voltagem', 'Potência (W)', 'Cor'],
  },
  {
    match: /livro|revista|dvd|blu.*ray|cd|game|jogo.*digital|curso/i,
    categoria: 'livros_midia',
    atributos: ['Idioma', 'Formato'],
  },
  {
    match: /joia|rel[oó]gio|anel.*ouro|pulseira.*prata|colar.*ouro|brinco.*ouro/i,
    categoria: 'joias_relogios',
    atributos: ['Material', 'Tamanho', 'Cor'],
  },
  {
    match: /pet|cachorro|gato|ração|coleira|aquário|peixe|hamster|coelho/i,
    categoria: 'pet_shop',
    atributos: ['Sabor', 'Peso', 'Espécie', 'Porte'],
  },
];

/**
 * Detecta automaticamente a categoria e os atributos relevantes
 * a partir do nome do produto e/ou nome da categoria do Bling.
 */
export function detectCategoryAndAttributes(nomeProduto = '', nomeCategoriaBling = '') {
  const text = `${nomeProduto} ${nomeCategoriaBling}`.toLowerCase();
  for (const rule of CATEGORY_AUTO_MAP) {
    if (rule.match.test(text)) {
      return { categoria: rule.categoria, atributos: rule.atributos };
    }
  }
  return { categoria: 'outros', atributos: [] };
}