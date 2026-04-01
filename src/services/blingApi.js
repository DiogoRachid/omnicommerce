import { getValidAccessToken } from './blingAuth';

const API_BASE = 'https://www.bling.com.br/Api/v3';

async function blingRequest(path, options = {}) {
  const accessToken = await getValidAccessToken();
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Accept': 'application/json',
      'Content-Type': 'application/json',
      'enable-jwt': '1',
      ...(options.headers || {}),
    },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.error?.description || data?.error?.message || JSON.stringify(data));
  }
  return data;
}

export async function listarProdutos(pagina = 1, limite = 100) {
  return blingRequest(`/produtos?pagina=${pagina}&limite=${limite}&criterio=5&tipo=T`);
}

export async function buscarProdutoPorId(id) {
  return blingRequest(`/produtos/${id}`);
}

export async function cadastrarProduto(produto) {
  return blingRequest('/produtos', {
    method: 'POST',
    body: JSON.stringify(produto),
  });
}

export async function atualizarEstoque(idDeposito, itens) {
  // itens: [{ produto: { id }, operacao: 'B', preco: 0, custo: 0, quantidade: 0 }]
  return blingRequest(`/estoques`, {
    method: 'POST',
    body: JSON.stringify({ deposito: { id: idDeposito }, itens }),
  });
}

export async function listarPedidos(pagina = 1, limite = 100) {
  return blingRequest(`/pedidos/vendas?pagina=${pagina}&limite=${limite}`);
}

export async function buscarPedidoPorId(id) {
  return blingRequest(`/pedidos/vendas/${id}`);
}