import React, { useState, useEffect, useCallback } from 'react';
import { useOutletContext } from 'react-router-dom';
import { base44 } from '@/api/base44Client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from 'sonner';
import { Search, ChevronRight, Loader2, CheckCircle2, Download, ListFilter } from 'lucide-react';

// ── Step indicator ────────────────────────────────────────────────────────────
function Steps({ current }) {
  const steps = ['Selecionar Categorias', 'Revisar Atributos', 'Confirmar'];
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

// ── Step 1: Selecionar Categorias ─────────────────────────────────────────────
function Step1({ onNext }) { // onNext(ids, selectedCats)
  const [categorias, setCategorias] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState({});
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const LIMIT = 100;

  const fetchPage = useCallback(async (searchTerm, currentOffset, replace) => {
    replace ? setLoading(true) : setSearching(true);
    const r = await base44.functions.invoke('supabaseCategories', {
      action: 'listCategorias',
      payload: { nivel: 1, search: searchTerm, offset: currentOffset, limit: LIMIT },
    });
    const data = r.data?.data || [];
    setCategorias(prev => replace ? data : [...prev, ...data]);
    setOffset(currentOffset + data.length);
    setHasMore(data.length === LIMIT);
    setLoading(false);
    setSearching(false);
  }, []);

  useEffect(() => { fetchPage('', 0, true); }, []);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => { fetchPage(search, 0, true); }, 400);
    return () => clearTimeout(t);
  }, [search]);

  const toggle = (id) => setSelected(p => ({ ...p, [id]: !p[id] }));

  const toggleAll = () => {
    const allSelected = categorias.length > 0 && categorias.every(c => selected[c.id]);
    if (allSelected) {
      const next = { ...selected };
      categorias.forEach(c => { delete next[c.id]; });
      setSelected(next);
    } else {
      const next = { ...selected };
      categorias.forEach(c => { next[c.id] = true; });
      setSelected(next);
    }
  };

  const selectedIds = Object.entries(selected).filter(([, v]) => v).map(([k]) => k);
  const selectedCount = selectedIds.length;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ListFilter className="w-4 h-4" /> Selecionar Categorias
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          Exibe categorias nível 1. Use a busca para encontrar categorias específicas pelo nome.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="Buscar categoria por nome..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-10"
            />
          </div>
          {selectedCount > 0 && <Badge className="shrink-0">{selectedCount} selecionadas</Badge>}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 text-xs text-muted-foreground pb-1 border-b">
              <Checkbox
                checked={categorias.length > 0 && categorias.every(c => selected[c.id])}
                onCheckedChange={toggleAll}
              />
              <span>{categorias.length}{hasMore ? '+' : ''} categorias carregadas</span>
              {searching && <Loader2 className="w-3 h-3 animate-spin" />}
            </div>

            <div className="max-h-[50vh] overflow-y-auto space-y-0.5 pr-1">
              {categorias.map(c => (
                <label key={c.id} className="flex items-center gap-3 px-2 py-1.5 rounded-md hover:bg-accent/40 cursor-pointer">
                  <Checkbox checked={!!selected[c.id]} onCheckedChange={() => toggle(c.id)} />
                  <span className="text-sm flex-1">{c.nome}</span>
                  {c.nivel && <Badge variant="outline" className="text-[10px]">Nível {c.nivel}</Badge>}
                </label>
              ))}
              {hasMore && (
                <button
                  onClick={() => fetchPage(search, offset, false)}
                  disabled={searching}
                  className="w-full py-2 text-xs text-primary hover:underline flex items-center justify-center gap-1 disabled:opacity-50"
                >
                  {searching ? <Loader2 className="w-3 h-3 animate-spin" /> : <ChevronRight className="w-3 h-3" />}
                  Carregar mais
                </button>
              )}
            </div>
          </>
        )}

        <div className="flex justify-end pt-2 border-t">
          <Button onClick={() => onNext(selectedIds, categorias.filter(c => selected[c.id]))} disabled={selectedCount === 0}>
            Continuar <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Step 2: Revisar Atributos ─────────────────────────────────────────────────
function Step2({ selectedIds, categorias, onNext, onBack }) {
  const [atributosPorCategoria, setAtributosPorCategoria] = useState({});
  const [loadingId, setLoadingId] = useState(null);
  const [loadedIds, setLoadedIds] = useState(new Set());

  const loadAtributos = async (id) => {
    if (loadedIds.has(id)) return;
    setLoadingId(id);
    const r = await base44.functions.invoke('supabaseCategories', {
      action: 'getAtributos',
      payload: { categoria_id: id },
    });
    setAtributosPorCategoria(p => ({ ...p, [id]: r.data?.data || [] }));
    setLoadedIds(p => new Set([...p, id]));
    setLoadingId(null);
  };

  useEffect(() => {
    selectedIds.slice(0, 5).forEach(id => loadAtributos(id));
  }, []);

  const selectedCats = categorias.filter(c => selectedIds.includes(String(c.id)));

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Atributos das Categorias Selecionadas</CardTitle>
        <p className="text-sm text-muted-foreground">Clique em uma categoria para carregar seus atributos sob demanda.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="max-h-[60vh] overflow-y-auto space-y-3 pr-1">
          {selectedCats.map(cat => {
            const attrs = atributosPorCategoria[cat.id];
            const isLoading = loadingId === cat.id;
            const isLoaded = loadedIds.has(cat.id);
            return (
              <div key={cat.id} className="border rounded-lg overflow-hidden">
                <button
                  className="w-full flex items-center justify-between px-4 py-2.5 bg-muted/40 hover:bg-muted/70 transition-colors text-left"
                  onClick={() => loadAtributos(cat.id)}
                >
                  <span className="font-medium text-sm">{cat.nome}</span>
                  <div className="flex items-center gap-2">
                    {isLoaded && <Badge variant="secondary" className="text-xs">{attrs?.length || 0} atributos</Badge>}
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ChevronRight className="w-4 h-4" />}
                  </div>
                </button>
                {isLoaded && attrs?.length > 0 && (
                  <div className="p-3 grid grid-cols-1 gap-1.5 max-h-60 overflow-y-auto">
                    {attrs.map(a => (
                      <div key={a.id} className="flex items-start gap-2 text-xs p-1.5 rounded bg-background border">
                        <div className="flex-1 min-w-0">
                          <span className="font-medium">{a.nome_atributo}</span>
                          {a.valores_possiveis && (
                            <p className="text-muted-foreground mt-0.5 break-words whitespace-normal">
                              {typeof a.valores_possiveis === 'string' ? a.valores_possiveis : a.valores_possiveis.join(', ')}
                            </p>
                          )}
                        </div>
                        {a.obrigatorio && <Badge className="text-[9px] h-4 px-1 shrink-0">Obrig.</Badge>}
                      </div>
                    ))}
                  </div>
                )}
                {isLoaded && attrs?.length === 0 && (
                  <p className="text-xs text-muted-foreground px-4 py-2">Nenhum atributo encontrado.</p>
                )}
              </div>
            );
          })}
        </div>
        <div className="flex justify-between pt-2 border-t">
          <Button variant="outline" onClick={onBack}>Voltar</Button>
          <Button onClick={() => onNext(atributosPorCategoria)}>
            Continuar <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Step 3: Confirmar e Importar ──────────────────────────────────────────────
function Step3({ selectedIds, categorias, atributosPorCategoria, onBack, companyId }) {
  const [importing, setImporting] = useState(false);
  const [done, setDone] = useState(false);
  const [progress, setProgress] = useState(0);

  const selectedCats = categorias.filter(c => selectedIds.includes(String(c.id)));

  const handleImport = async () => {
    setImporting(true);
    let count = 0;
    for (const cat of selectedCats) {
      const atributos = atributosPorCategoria[cat.id] || [];
      await base44.functions.invoke('supabaseCategories', {
        action: 'importarCategoria',
        payload: { categoria: cat, atributos, company_id: companyId },
      });
      count++;
      setProgress(Math.round((count / selectedCats.length) * 100));
    }
    setImporting(false);
    setDone(true);
    toast.success(`${selectedCats.length} categorias importadas com sucesso!`);
  };

  if (done) {
    return (
      <Card>
        <CardContent className="py-16 text-center space-y-4">
          <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto" />
          <h2 className="text-xl font-bold">Importação Concluída!</h2>
          <p className="text-muted-foreground">{selectedCats.length} categorias importadas para o sistema.</p>
          <Button onClick={() => window.location.href = '/categorias'}>Ver Categorias</Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Confirmar Importação</CardTitle>
        <p className="text-sm text-muted-foreground">Resumo do que será importado para o sistema.</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-primary/5 border border-primary/20 rounded-lg p-3 text-center">
            <p className="text-2xl font-bold text-primary">{selectedCats.length}</p>
            <p className="text-xs text-muted-foreground">Categorias</p>
          </div>
          <div className="bg-muted/40 border rounded-lg p-3 text-center">
            <p className="text-2xl font-bold">
              {Object.values(atributosPorCategoria).reduce((s, a) => s + (a?.length || 0), 0)}
            </p>
            <p className="text-xs text-muted-foreground">Atributos carregados</p>
          </div>
        </div>

        <div className="max-h-[40vh] overflow-y-auto space-y-1">
          {selectedCats.map(c => (
            <div key={c.id} className="flex items-center justify-between text-sm px-3 py-1.5 rounded-md bg-muted/30">
              <span>{c.nome}</span>
              <Badge variant="outline" className="text-xs">
                {atributosPorCategoria[c.id]?.length ?? '—'} atributos
              </Badge>
            </div>
          ))}
        </div>

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
            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {importing ? 'Importando...' : 'Importar Agora'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ImportarCategorias() {
  const { selectedCompany } = useOutletContext();
  const [step, setStep] = useState(0);
  const [selectedIds, setSelectedIds] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [atributosPorCategoria, setAtributosPorCategoria] = useState({});

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Download className="w-6 h-6" /> Importar Categorias
        </h1>
        <p className="text-muted-foreground text-sm mt-0.5">
          Selecione e importe categorias do banco global para esta empresa.
        </p>
      </div>

      <Steps current={step} />

      {step === 0 && (
        <Step1
          onNext={(ids, cats) => {
            setSelectedIds(ids.map(String));
            setCategorias(cats);
            setStep(1);
          }}
        />
      )}
      {step === 1 && (
        <Step2
          selectedIds={selectedIds}
          categorias={categorias}
          onNext={(attrs) => { setAtributosPorCategoria(attrs); setStep(2); }}
          onBack={() => setStep(0)}
        />
      )}
      {step === 2 && (
        <Step3
          selectedIds={selectedIds}
          categorias={categorias}
          atributosPorCategoria={atributosPorCategoria}
          onBack={() => setStep(1)}
          companyId={selectedCompany !== 'all' ? selectedCompany : undefined}
        />
      )}
    </div>
  );
}