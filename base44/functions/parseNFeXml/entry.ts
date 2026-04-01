import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { DOMParser } from 'npm:@xmldom/xmldom@0.8.10';

function getNodeText(parent, tagName) {
  const nodes = parent.getElementsByTagName(tagName);
  return nodes.length > 0 ? nodes[0].textContent : null;
}

function getNodeTextNS(parent, tagName) {
  const nodes = parent.getElementsByTagName(tagName);
  for (let node of nodes) {
    if (node.textContent) return node.textContent;
  }
  return null;
}

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);
  const user = await base44.auth.me();
  if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

  let body = {};
  try { body = await req.json(); } catch { }
  const { xml_content } = body;
  if (!xml_content) return Response.json({ error: 'xml_content obrigatório' }, { status: 400 });

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(xml_content, 'text/xml');

    // Extrai dados da nota
    const ide = doc.getElementsByTagName('ide')[0];
    const emit = doc.getElementsByTagName('emit')[0];
    const dest = doc.getElementsByTagName('dest')[0];
    const totalNode = doc.getElementsByTagName('total')[0];
    const cobr = doc.getElementsByTagName('cobr')[0];

    const nNF = getNodeText(ide, 'nNF');
    const serie = getNodeText(ide, 'serie');
    const dhEmi = getNodeText(ide, 'dhEmi');
    const natOp = getNodeText(ide, 'natOp');

    // Emitente (fornecedor)
    const emitCNPJ = getNodeText(emit, 'CNPJ');
    const emitNome = getNodeText(emit, 'xNome');

    // Destinatário (cliente/nossa empresa)
    const destCNPJ = getNodeText(dest, 'CNPJ');
    const destNome = getNodeText(dest, 'xNome');

    // Total
    const vProd = getNodeText(totalNode, 'vProd');
    const vDesc = getNodeText(totalNode, 'vDesc');
    const vNF = getNodeText(totalNode, 'vNF');

    // Itens
    const items = [];
    const detNodes = doc.getElementsByTagName('det');
    for (let i = 0; i < detNodes.length; i++) {
      const det = detNodes[i];
      const prod = det.getElementsByTagName('prod')[0];
      const imposto = det.getElementsByTagName('imposto')[0];

      const cProd = getNodeText(prod, 'cProd');
      const xProd = getNodeText(prod, 'xProd');
      const cEAN = getNodeText(prod, 'cEAN');
      const qCom = getNodeText(prod, 'qCom');
      const vUnCom = getNodeText(prod, 'vUnCom');
      const vProdItem = getNodeText(prod, 'vProd');
      const vDesc_ = getNodeText(prod, 'vDesc');

      const vICMS = getNodeTextNS(imposto, 'vICMS');
      const vIPI = getNodeTextNS(imposto, 'vIPI');
      const vPIS = getNodeTextNS(imposto, 'vPIS');
      const vCOFINS = getNodeTextNS(imposto, 'vCOFINS');

      items.push({
        codigo: cProd,
        ean: cEAN,
        descricao: xProd,
        quantidade: parseFloat(qCom || 0),
        valor_unitario: parseFloat(vUnCom || 0),
        valor_total: parseFloat(vProdItem || 0),
        desconto: parseFloat(vDesc_ || 0),
        icms: parseFloat(vICMS || 0),
        ipi: parseFloat(vIPI || 0),
        pis: parseFloat(vPIS || 0),
        cofins: parseFloat(vCOFINS || 0)
      });
    }

    // Pagamento
    const pagNode = doc.getElementsByTagName('pag')[0];
    const detPag = pagNode?.getElementsByTagName('detPag')[0];
    const tPag = getNodeText(detPag, 'tPag');

    // Mapeamento de formas de pagamento NF-e
    const tpPagMap = {
      '01': 'dinheiro',
      '02': 'cheque',
      '03': 'cartao_credito',
      '04': 'cartao_debito',
      '05': 'credito_loja',
      '10': 'boleto',
      '15': 'transferencia',
      '16': 'pix',
      '90': 'outro'
    };
    const forma_pagamento = tpPagMap[tPag] || 'outro';

    // Duplicatas (prazos)
    const duplicatas = [];
    const dupNodes = cobr?.getElementsByTagName('dup') || [];
    for (let i = 0; i < dupNodes.length; i++) {
      const dup = dupNodes[i];
      const nDup = getNodeText(dup, 'nDup');
      const dVenc = getNodeText(dup, 'dVenc');
      const vDup = getNodeText(dup, 'vDup');
      duplicatas.push({
        numero: nDup,
        vencimento: dVenc,
        valor: parseFloat(vDup || 0)
      });
    }

    return Response.json({
      success: true,
      nf: {
        numero: nNF,
        serie: serie,
        data_emissao: dhEmi,
        natureza_operacao: natOp,
        tipo_documento: 'entrada',
        modelo: '55',
        chave_acesso: getNodeText(ide, 'cDV'),
        items: items
      },
      fornecedor: {
        cnpj: emitCNPJ,
        nome: emitNome
      },
      destinatario: {
        cnpj: destCNPJ,
        nome: destNome
      },
      totais: {
        produtos: parseFloat(vProd || 0),
        desconto: parseFloat(vDesc || 0),
        nf: parseFloat(vNF || 0)
      },
      forma_pagamento,
      duplicatas: duplicatas
    });
  } catch (e) {
    return Response.json({ error: e.message }, { status: 400 });
  }
});