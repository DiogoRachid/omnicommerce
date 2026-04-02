import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';
import { Edit, Package, Layers } from 'lucide-react';
import { getCategoriaLabel, formatBRL, calcTributos } from '@/lib/productCategories';

const Field = ({ label, value }) => {
  if (!value && value !== 0) return null;
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value}</p>
    </div>
  );
};

export default function ProductDetailModal({ product, variacoes = [], onClose }) {
  if (!product) return null;
  const isPai = product.tipo === 'pai';
  const tributos = calcTributos(product.preco_venda, product.categoria);
  const catLabel = getCategoriaLabel(product.categoria);

  return (
    <Dialog open={!!product} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-start justify-between gap-3">
            <DialogTitle className="text-base leading-snug pr-8">{product.nome}</DialogTitle>
            <Link to={`/produtos/editar/${product.id}`}>
              <Button variant="outline" size="sm" className="shrink-0 gap-1.5">
                <Edit className="w-3.5 h-3.5" /> Editar
              </Button>
            </Link>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-1">
            <Badge variant={product.ativo ? 'default' : 'secondary'}>{product.ativo ? 'Ativo' : 'Inativo'}</Badge>
            {isPai && <Badge className="bg-orange-100 text-orange-700 border-0">Produto Pai</Badge>}
            {product.tipo === 'variacao' && <Badge variant="outline">Variação</Badge>}
            {catLabel !== '-' && <Badge variant="outline">{catLabel}</Badge>}
          </div>
        </DialogHeader>

        {/* Foto */}
        {product.fotos?.length > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {product.fotos.map((f, i) => (
              <img key={i} src={f} alt="" className="h-24 w-24 object-cover rounded-lg border shrink-0" />
            ))}
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
          <Field label="SKU" value={product.sku} />
          <Field label="EAN" value={product.ean} />
          <Field label="Marca" value={product.marca} />
          <Field label="NCM" value={product.ncm} />
          <Field label="CEST" value={product.cest} />
          <Field label="Unidade" value={product.unidade_medida} />
        </div>

        {product.descricao && (
          <div>
            <p className="text-xs text-muted-foreground mb-1">Descrição</p>
            <p className="text-sm text-foreground leading-relaxed">{product.descricao}</p>
          </div>
        )}

        <div className="grid grid-cols-3 gap-4 border-t pt-4">
          <Field label="Preço de Custo" value={product.preco_custo ? formatBRL(product.preco_custo) : null} />
          <Field label="Margem" value={product.margem_padrao ? `${product.margem_padrao}%` : null} />
          <Field label="Preço de Venda" value={product.preco_venda ? formatBRL(product.preco_venda) : null} />
        </div>

        {!isPai && (
          <div className="grid grid-cols-2 gap-4 border-t pt-4">
            <Field label="Estoque Atual" value={`${product.estoque_atual ?? 0} ${product.unidade_medida || 'UN'}`} />
            <Field label="Estoque Mínimo" value={`${product.estoque_minimo ?? 0} ${product.unidade_medida || 'UN'}`} />
            {product.preco_venda && product.categoria && (
              <Field label="Tributos Aprox." value={formatBRL(tributos)} />
            )}
          </div>
        )}

        <div className="grid grid-cols-3 gap-4 border-t pt-4">
          <Field label="Peso Bruto" value={product.peso_bruto_kg ? `${product.peso_bruto_kg} kg` : null} />
          <Field label="Peso Líq." value={product.peso_liquido_kg ? `${product.peso_liquido_kg} kg` : null} />
          <Field label="Altura" value={product.altura_cm ? `${product.altura_cm} cm` : null} />
          <Field label="Largura" value={product.largura_cm ? `${product.largura_cm} cm` : null} />
          <Field label="Comprimento" value={product.comprimento_cm ? `${product.comprimento_cm} cm` : null} />
        </div>

        {product.atributos_extras && Object.keys(product.atributos_extras).length > 0 && (
          <div className="border-t pt-4">
            <p className="text-xs text-muted-foreground mb-2">Atributos Extras</p>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(product.atributos_extras).map(([k, v]) => (
                <Field key={k} label={k} value={String(v)} />
              ))}
            </div>
          </div>
        )}

        {/* Variações do produto pai */}
        {isPai && variacoes.length > 0 && (
          <div className="border-t pt-4">
            <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5" /> {variacoes.length} variações
            </p>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {variacoes.map(v => (
                <div key={v.id} className="flex items-center justify-between px-3 py-2 rounded-lg bg-muted/50 text-xs">
                  <div>
                    <span className="font-medium">{v.variacoes_atributos || v.nome}</span>
                    <span className="text-muted-foreground ml-2">SKU: {v.sku}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {v.preco_venda ? <span>{formatBRL(v.preco_venda)}</span> : null}
                    <span className={v.estoque_atual <= (v.estoque_minimo || 0) ? 'text-destructive font-semibold' : ''}>
                      Est: {v.estoque_atual ?? 0}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}