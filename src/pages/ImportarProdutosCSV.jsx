import React, { useState, useRef, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Upload, FileSpreadsheet, ChevronRight, CheckCircle2, Loader2, AlertCircle, X, ClipboardPaste } from 'lucide-react';

// ── System fields available for mapping ──────────────────────────────────────
const SYSTEM_FIELDS = [
  { value: '_ignorar', label: '— Ignorar —' },
  { value: 'sku', label: 'SKU / Código' },
  { value: 'nome', label: 'Nome / Descrição' },
  { value: 'descricao', label: 'Descrição Detalhada' },
  { value: 'ean', label: 'EAN / GTIN' },
  { value: 'marca', label: 'Marca' },
  { value: 'categoria', label: 'Categoria' },
  { value: 'ncm', label: 'NCM' },
  { value: 'cest', label: 'CEST' },
  { value: 'unidade_medida', label: 'Unidade de Medida' },
  { value: 'preco_venda', label: 'Preço de Venda' },
  { value: 'preco_custo', label: 'Preço de Custo' },
  { value: 'margem_padrao', label: 'Margem Padrão (%)' },
  { value: 'estoque_atual', label: 'Estoque Atual' },
  { value: 'estoque_minimo', label: 'Estoque Mínimo' },
  { value: 'estoque_maximo', label: 'Estoque Máximo' },
  { value: 'peso_liquido_kg', label: 'Peso Líquido (kg)' },
  { value: 'peso_bruto_kg', label: 'Peso Bruto (kg)' },
  { value: 'largura_cm', label: 'Largura (cm)' },
  { value: 'altura_cm', label: 'Altura (cm)' },
  { value: 'comprimento_cm', label: 'Comprimento/Profundidade (cm)' },
  { value: 'variacoes_atributos', label: 'Variações / Atributos' },
];

// Auto-detect column → field based on common names
const AUTO_MAP = {
  'código': 'sku', 'codigo': 'sku', 'sku': 'sku', 'cod': 'sku', 'código pai': '_ignorar',
  'descrição': 'nome', 'descricao': 'nome', 'nome': 'nome', 'produto': 'nome',
  'descrição complementar': 'descricao', 'descrição do produto no fornecedor': 'descricao', 'descrição curta': 'descricao',
  'gtin/ean': 'ean', 'ean': 'ean', 'gtin': 'ean',
  'marca': 'marca',
  'categoria do produto': 'categoria', 'categoria': 'categoria', 'grupo de produtos': 'categoria',
  'ncm': 'ncm',
  'cest': 'cest',
  'unidade': 'unidade_medida', 'unidade de medida': 'unidade_medida',
  'preço': 'preco_venda', 'preco': 'preco_venda', 'preço de venda': 'preco_venda',
  'preço de custo': 'preco_custo', 'preco de custo': 'preco_custo', 'preço de compra': 'preco_custo',
  'estoque': 'estoque_atual',
  'estoque minimo': 'estoque_minimo', 'estoque mínimo': 'estoque_minimo',
  'estoque maximo': 'estoque_maximo', 'estoque máximo': 'estoque_maximo',
  'peso líquido (kg)': 'peso_liquido_kg', 'peso liquido': 'peso_liquido_kg',
  'peso bruto (kg)': 'peso_bruto_kg', 'peso bruto': 'peso_bruto_kg',
  'largura do produto': 'largura_cm', 'largura': 'largura_cm',
  'altura do produto': 'altura_cm', 'altura': 'altura_cm',
  'profundidade do produto': 'comprimento_cm', 'profundidade': 'comprimento_cm', 'comprimento': 'comprimento_cm',
  'produto variação': 'variacoes_atributos',
};

// ── CSV parser ───────────────────────────────────────────────────────────────
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { headers: [], rows: [] };

  // Detect delimiter: comma or semicolon or tab
  const firstLine = lines[0];
  const delimiter = firstLine.includes('\t') ? '\t' : firstLine.includes(';') ? ';' : ',';

  function splitLine(line) {
    const result = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (ch === '"') {
        inQuotes = !inQuotes;
      } else if (ch === delimiter && !inQuotes) {
        result.push(cur.trim());
        cur = '';
      } else {
        cur += ch;
      }
    }
    result.push(cur.trim());
    return result;
  }

  const headers = splitLine(lines[0]);
  const rows = lines.slice(1).filter(l => l.trim()).map(l => {
    const vals = splitLine(l);
    const obj = {};
    headers.forEach((h, i) => { obj[h] = vals[i] || ''; });
    return obj;
  });

  return { headers, rows };
}

// ── Step indicator ────────────────────────────────────────────────────────────
function Steps({ current }) {
  const steps = ['Carregar Arquivo', 'Mapear Colunas', 'Importar'];
  return (
    <div className="flex items-center gap-2 mb-6">
      {steps.map((s, i) => (
        <React.Fragment key={i}>
          <div className={`flex items-center gap-2 text-sm font-medium ${i <= current ? 'text-primary' : 'text-muted-foreground'}`}>
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold border-2 transition-colors
              ${i < current ? 'bg-primary border-primary text-white' : i === current ? 'border-primary text-primary' : 'border-border text-muted-foreground'}`}>
              {i < current ? <CheckCircle2 className="w-3.5 h-3.5" /> : i + 1}
            </div>
            <span className="hidden sm:inline">{s}</span>
          </div>
          {i < steps.length - 1 && <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />}
        </React.Fragment>
      ))}
    </div>
  );
}

// ── Step 1: Upload / Paste ────────────────────────────────────────────────────
function Step1({ onNext }) {
  const [dragOver, setDragOver] = useState(false);
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const fileRef = useRef();

  const processText = (text) => {
    const { headers, rows } = parseCSV(text);
    if (headers.length === 0) { toast.error('Arquivo inválido ou vazio.'); return; }
    onNext(headers, rows, text);
  };

  const handleFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => processText(e.target.result);
    reader.readAsText(file, 'UTF-8');
  };

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    handleFile(file);
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <FileSpreadsheet className="w-4 h-4" /> Carregar Arquivo CSV
        </CardTitle>
        <p className="text-sm text-muted-foreground">Faça upload do arquivo CSV ou cole os dados da planilha diretamente.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Toggle */}
        <div className="flex gap-2">
          <Button size="sm" variant={!pasteMode ? 'default' : 'outline'} onClick={() => setPasteMode(false)} className="gap-2">
            <Upload className="w-3.5 h-3.5" /> Upload de arquivo
          </Button>
          <Button size="sm" variant={pasteMode ? 'default' : 'outline'} onClick={() => setPasteMode(true)} className="gap-2">
            <ClipboardPaste className="w-3.5 h-3.5" /> Colar planilha
          </Button>
        </div>

        {!pasteMode ? (
          <div
            className={`border-2 border-dashed rounded-xl p-12 text-center transition-colors cursor-pointer ${dragOver ? 'border-primary bg-primary/5' : 'border-border hover:border-primary/50 hover:bg-muted/30'}`}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
            <p className="font-medium">Arraste o arquivo CSV aqui</p>
            <p className="text-sm text-muted-foreground mt-1">ou clique para selecionar</p>
            <p className="text-xs text-muted-foreground mt-2">Suporta CSV com separadores vírgula, ponto-e-vírgula ou tabulação</p>
            <input ref={fileRef} type="file" accept=".csv,.txt,.tsv" className="hidden" onChange={e => handleFile(e.target.files[0])} />
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">Cole os dados copiados do Excel, Google Sheets, ou outro editor de planilha:</p>
            <textarea
              className="w-full h-48 text-xs font-mono border border-input rounded-md p-3 bg-transparent focus:outline-none focus:ring-1 focus:ring-ring resize-none"
              placeholder={"Código\tDescrição\tPreço\nSKU001\tProduto A\t29,90\n..."}
              value={pasteText}
              onChange={e => setPasteText(e.target.value)}
            />
            <Button onClick={() => processText(pasteText)} disabled={!pasteText.trim()}>
              Processar dados <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Step 2: Map Columns ───────────────────────────────────────────────────────
function Step2({ headers, rows, onNext, onBack }) {
  const [mapping, setMapping] = useState(() => {
    const m = {};
    headers.forEach(h => {
      const key = h.toLowerCase().trim();
      m[h] = AUTO_MAP[key] || '_ignorar';
    });
    return m;
  });

  const preview = rows.slice(0, 3);
  const mappedCount = Object.values(mapping).filter(v => v !== '_ignorar').length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Mapear Colunas</CardTitle>
        <p className="text-sm text-muted-foreground">
          {headers.length} colunas detectadas · {rows.length} linhas · Mapeie cada coluna ao campo correspondente no sistema.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border overflow-hidden">
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-muted">
                <th className="border border-border px-3 py-2 text-left font-semibold text-muted-foreground w-1/3">Coluna no arquivo</th>
                <th className="border border-border px-3 py-2 text-left font-semibold text-muted-foreground w-1/3">Campo no sistema</th>
                <th className="border border-border px-3 py-2 text-left font-semibold text-muted-foreground">Prévia (3 linhas)</th>
              </tr>
            </thead>
            <tbody className="bg-card">
              {headers.map(h => (
                <tr key={h} className={`hover:bg-accent/20 ${mapping[h] === '_ignorar' ? 'opacity-50' : ''}`}>
                  <td className="border border-border px-3 py-1.5 font-medium">{h}</td>
                  <td className="border border-border px-3 py-1.5">
                    <Select value={mapping[h]} onValueChange={v => setMapping(p => ({ ...p, [h]: v }))}>
                      <SelectTrigger className="h-7 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SYSTEM_FIELDS.map(sf => (
                          <SelectItem key={sf.value} value={sf.value} className="text-xs">{sf.label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </td>
                  <td className="border border-border px-3 py-1.5 text-muted-foreground">
                    {preview.map((r, i) => (
                      <span key={i} className="inline-block mr-2 text-[10px] bg-muted px-1 rounded">
                        {r[h] || '—'}
                      </span>
                    ))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-between items-center pt-2 border-t">
          <p className="text-xs text-muted-foreground">{mappedCount} campos mapeados</p>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onBack}>Voltar</Button>
            <Button onClick={() => onNext(mapping)} disabled={mappedCount === 0}>
              Continuar <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Step 3: Preview & Import ──────────────────────────────────────────────────
function Step3({ rows, mapping, onBack, companyId }) {
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [errors, setErrors] = useState([]);
  const [done, setDone] = useState(false);

  // Transform a row using the mapping
  const transformRow = (row) => {
    const product = { tipo: 'simples', origem: 'importacao', ativo: true };
    if (companyId) product.company_id = companyId;

    Object.entries(mapping).forEach(([col, field]) => {
      if (field === '_ignorar') return;
      let val = row[col] || '';
      // Normalize numeric fields
      const numFields = ['preco_venda', 'preco_custo', 'margem_padrao', 'estoque_atual', 'estoque_minimo', 'estoque_maximo', 'peso_liquido_kg', 'peso_bruto_kg', 'largura_cm', 'altura_cm', 'comprimento_cm'];
      if (numFields.includes(field)) {
        val = parseFloat(val.replace(',', '.')) || 0;
      }
      if (val !== '' && val !== undefined) product[field] = val;
    });

    return product;
  };

  const previewData = rows.slice(0, 5).map(transformRow);

  const handleImport = async () => {
    setImporting(true);
    setErrors([]);
    let errList = [];
    for (let i = 0; i < rows.length; i++) {
      const product = transformRow(rows[i]);
      if (!product.nome && !product.sku) {
        errList.push({ row: i + 2, msg: 'Sem nome ou SKU' });
        continue;
      }
      // If no SKU, generate from nome
      if (!product.sku && product.nome) {
        product.sku = product.nome.substring(0, 20).replace(/\s+/g, '_').toUpperCase() + '_' + (i + 1);
      }
      try {
        await base44.entities.Product.create(product);
      } catch (e) {
        errList.push({ row: i + 2, msg: e.message });
      }
      setProgress(Math.round(((i + 1) / rows.length) * 100));
    }
    setErrors(errList);
    setImporting(false);
    setDone(true);
    const ok = rows.length - errList.length;
    toast.success(`${ok} produtos importados com sucesso!${errList.length > 0 ? ` (${errList.length} erros)` : ''}`);
  };

  if (done) {
    return (
      <Card>
        <CardContent className="py-16 text-center space-y-4">
          <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto" />
          <h2 className="text-xl font-bold">Importação Concluída!</h2>
          <p className="text-muted-foreground">{rows.length - errors.length} de {rows.length} produtos importados.</p>
          {errors.length > 0 && (
            <div className="text-left max-w-md mx-auto bg-destructive/10 border border-destructive/20 rounded-lg p-3 space-y-1">
              <p className="text-xs font-semibold text-destructive flex items-center gap-1"><AlertCircle className="w-3.5 h-3.5" /> {errors.length} erros:</p>
              {errors.map((e, i) => (
                <p key={i} className="text-xs text-muted-foreground">Linha {e.row}: {e.msg}</p>
              ))}
            </div>
          )}
          <Button onClick={() => window.location.href = '/produtos'}>Ver Produtos</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Prévia e Importação</CardTitle>
        <p className="text-sm text-muted-foreground">{rows.length} produtos serão importados. Veja uma prévia abaixo.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="rounded-lg border overflow-x-auto">
          <table className="w-full text-xs border-collapse min-w-[500px]">
            <thead>
              <tr className="bg-muted">
                {Object.entries(mapping).filter(([, v]) => v !== '_ignorar').map(([col]) => (
                  <th key={col} className="border border-border px-3 py-2 text-left font-semibold text-muted-foreground whitespace-nowrap">
                    {SYSTEM_FIELDS.find(sf => sf.value === mapping[col])?.label || col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-card">
              {previewData.map((p, i) => (
                <tr key={i} className="hover:bg-accent/20">
                  {Object.entries(mapping).filter(([, v]) => v !== '_ignorar').map(([col]) => (
                    <td key={col} className="border border-border px-3 py-1.5 max-w-[150px] truncate">
                      {String(p[mapping[col]] ?? '—')}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {rows.length > 5 && (
          <p className="text-xs text-muted-foreground">...e mais {rows.length - 5} linhas.</p>
        )}

        {importing && (
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Importando...</span><span>{progress}%</span>
            </div>
            <div className="w-full bg-muted rounded-full h-2">
              <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>
        )}

        <div className="flex justify-between pt-2 border-t">
          <Button variant="outline" onClick={onBack} disabled={importing}>Voltar</Button>
          <Button onClick={handleImport} disabled={importing} className="gap-2">
            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {importing ? 'Importando...' : `Importar ${rows.length} produtos`}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ImportarProdutosCSV() {
  const { selectedCompany } = useOutletContext();
  const [step, setStep] = useState(0);
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [mapping, setMapping] = useState({});

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <FileSpreadsheet className="w-6 h-6" /> Importar Produtos por CSV
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Importe produtos em massa a partir de uma planilha CSV ou dados copiados.
        </p>
      </div>

      <Steps current={step} />

      {step === 0 && (
        <Step1 onNext={(h, r) => { setHeaders(h); setRows(r); setStep(1); }} />
      )}
      {step === 1 && (
        <Step2
          headers={headers}
          rows={rows}
          onNext={(m) => { setMapping(m); setStep(2); }}
          onBack={() => setStep(0)}
        />
      )}
      {step === 2 && (
        <Step3
          rows={rows}
          mapping={mapping}
          onBack={() => setStep(1)}
          companyId={selectedCompany !== 'all' ? selectedCompany : undefined}
        />
      )}
    </div>
  );
}