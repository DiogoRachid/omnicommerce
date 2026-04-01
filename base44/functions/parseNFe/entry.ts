import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import { DOMParser } from 'npm:@xmldom/xmldom@0.8.10';

function getNodeText(parent, tagName) {
  if (!parent) return null;
  const nodes = parent.getElementsByTagName(tagName);
  return nodes && nodes.length > 0 ? nodes[0].textContent : null;
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

    // Encontra o namespace correto
    const nfeElements = doc.getElementsByTagName('infNFe');
    if (!nfeElements || nfeElements.length === 0) {
      return Response.json({ error: 'Documento não é uma NF-e válida' }, { status: 400 });
    }

    const infNFe = nfeElements[0];
    const ide = infNFe.getElementsByTagName('ide')[0];
    const emit = infNFe.getElementsByTagName('emit')[0];
    const dest = infNFe.getElementsByTagName('dest')[0];
    const totalNode = infNFe.getElementsByTagName('total')[0];

    if (!ide || !emit || !dest) {
      return Response.json({ error: 'Estrutura XML inválida' }, { status: 400 });
    }

    // Dados básicos da NF
    const nNF = getNodeText(ide, 'nNF');
    const serie = getNodeText(ide, 'serie');
    const dhEmi = getNodeText(ide, 'dhEmi');
    const natOp = getNodeText(ide, 'natOp');

    // Emitente
    const emitCNPJ = getNodeText(emit, 'CNPJ');
    const emitNome = getNodeText(emit, 'xNome');

    // Destinatário
    const destCNPJ = getNodeText(dest, 'CNPJ');
    const destNome = getNodeText(dest, 'xNome');

    // Totais
    const vProd = getNodeText(totalNode, 'vProd');
    const vDesc = getNodeText(totalNode, 'vDesc');
    const vNF = getNodeText(totalNode, 'vNF');

    // Itens
    const items = [];
    const detNodes = infNFe.getElementsByTagName('det');
    if (detNodes && detNodes.length > 0) {
      for (let i = 0; i < detNodes.length; i++) {
        const det = detNodes[i];
        const prod = det.getElementsByTagName('prod')[0];
        
        if (prod) {
          const cProd = getNodeText(prod, 'cProd');
          const xProd = getNodeText(prod, 'xProd');
          const cEAN = getNodeText(prod, 'cEAN');
          const qCom = getNodeText(prod, 'qCom');
          const vUnCom = getNodeText(prod, 'vUnCom');
          const vProdItem = getNodeText(prod, 'vProd');
          const vDesc_ = getNodeText(prod, 'vDesc');

          items.push({
            codigo: cProd,
            ean: cEAN,
            descricao: xProd,
            quantidade: parseFloat(qCom || 0),
            valor_unitario: parseFloat(vUnCom || 0),
            valor_total: parseFloat(vProdItem || 0),
            desconto: parseFloat(vDesc_ || 0)
          });
        }
      }
    }

    // Pagamento
    const pagNode = infNFe.getElementsByTagName('pag')[0];
    let tPag = '01';
    if (pagNode) {
      const detPag = pagNode.getElementsByTagName('detPag')[0];
      if (detPag) {
        const tPagNode = detPag.getElementsByTagName('tPag')[0];
        if (tPagNode) tPag = tPagNode.textContent;
      }
    }

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

    // Duplicatas
    const duplicatas = [];
    const cobrNode = infNFe.getElementsByTagName('cobr')[0];
    if (cobrNode) {
      const dupNodes = cobrNode.getElementsByTagName('dup');
      if (dupNodes && dupNodes.length > 0) {
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
      }
    }

    return Response.json({
      success: true,
      nf: {
        numero: nNF,
        serie: serie,
        data_emissao: dhEmi ? dhEmi.split('T')[0] : null,
        natureza_operacao: natOp,
        modelo: '55',
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
    console.error('Erro ao processar XML:', e.message);
    return Response.json({ error: e.message }, { status: 400 });
  }
});