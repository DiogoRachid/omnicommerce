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