import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '../services/supabase'

const SD_ID = 'b7360df7-24af-4372-a7fb-5919d7a55b3e'
const ABAS = [
  { nome: 'Matérias-primas', categoria: 'Matéria-prima', icone: 'materia' },
  { nome: 'Pigmentos', categoria: 'Pigmento', icone: 'pigmento' },
  { nome: 'Embalagens', categoria: 'Embalagem', icone: 'embalagem' },
]
const UNIDADES = ['kg', 'g', 'L', 'mL', 'un']
const CL_INPUT = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-100    '

function Icone({ nome, tamanho = 19, className = '' }) {
  const desenhos = {
    materia: <><circle cx="12" cy="5" r="3"/><circle cx="5" cy="17" r="3"/><circle cx="19" cy="17" r="3"/><path d="m10 7-3.5 7M14 7l3.5 7M8 17h8"/></>,
    pigmento: <><path d="m3 10 7-7h7l5 5v7l-7 7h-7l-5-5V10Z"/><circle cx="13" cy="12" r="2"/></>,
    embalagem: <><path d="m12 2 9 5-9 5-9-5 9-5ZM3 7v10l9 5 9-5V7M12 12v10"/></>,
    mais: <path d="M12 5v14M5 12h14"/>,
    buscar: <><circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/></>,
    editar: <><path d="m15 5 4 4M4 20l4-1 11-11a3 3 0 0 0-4-4L4 15v5Z"/></>,
    fechar: <path d="M5 5 19 19M19 5 5 19"/>,
    chevron: <path d="m6 9 6 6 6-6"/>,
  }
  return <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">{desenhos[nome] || desenhos.embalagem}</svg>
}

const novoCadastro = (categoria = 'Matéria-prima') => ({
  nome: '', categoria, unidade: categoria === 'Embalagem' ? 'un' : 'kg',
  custo_unitario: '', observacao: '',
})
function converterDecimal(valor) {
  const texto = String(valor ?? '').trim()
  if (!texto) return null
  const convertido = texto.includes(',') ? texto.replace(/\./g, '').replace(',', '.') : texto
  return /^\d+(?:\.\d+)?$/.test(convertido) ? convertido : null
}
function precoValido(valor) {
  const decimal = converterDecimal(valor)
  return decimal !== null && Number.isFinite(Number(decimal)) && Number(decimal) >= 0 &&
    (decimal.split('.')[1]?.length || 0) <= 6
}
function formatarPreco(valor) {
  if (valor === null || valor === undefined) return '—'
  return `R$ ${Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`
}
function formatarData(valor) {
  if (!valor) return '—'
  const date = new Date(valor)
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleDateString('pt-BR')
}
function Rotulo({ children, className = '' }) {
  return <span className={`mb-2 block text-xs font-semibold text-slate-700  ${className}`}>{children}</span>
}

export default function Insumos({ empresaAtiva }) {
  const acessoSD = empresaAtiva?.id === SD_ID
  const [itens, setItens] = useState([])
  const [aba, setAba] = useState('Matéria-prima')
  const [busca, setBusca] = useState('')
  const [carregando, setCarregando] = useState(true)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [editarItem, setEditarItem] = useState(null)
  const [modalAberto, setModalAberto] = useState(false)
  const [formulario, setFormulario] = useState(novoCadastro)

  const carregar = useCallback(async () => {
    if (!acessoSD) return
    setCarregando(true)
    setErro('')
    const { data, error } = await supabase
      .from('insumos')
      .select('id,empresa_id,nome,codigo,categoria,unidade,custo_unitario,estoque_minimo,observacao,ativo,criada_em,atualizada_em')
      .eq('empresa_id', SD_ID)
      .order('nome', { ascending: true })
    if (error) setErro(`Não foi possível carregar os insumos: ${error.message}`)
    else setItens(data || [])
    setCarregando(false)
  }, [acessoSD])

  // A consulta inicial ocorre no efeito; o recarregamento após salvar continua em carregar().
  // O retorno assíncrono e a limpeza evitam atualizações de consultas anteriores.
  useEffect(() => {
    if (!acessoSD) return undefined

    let ativo = true
    void Promise.resolve(
      supabase
        .from('insumos')
        .select('id,empresa_id,nome,codigo,categoria,unidade,custo_unitario,estoque_minimo,observacao,ativo,criada_em,atualizada_em')
        .eq('empresa_id', SD_ID)
        .order('nome', { ascending: true })
    ).then(({ data, error }) => {
      if (!ativo) return
      if (error) setErro(`Não foi possível carregar os insumos: ${error.message}`)
      else {
        setItens(data || [])
        setErro('')
      }
      setCarregando(false)
    }).catch((error) => {
      if (!ativo) return
      setErro(`Não foi possível carregar os insumos: ${error.message}`)
      setCarregando(false)
    })

    return () => { ativo = false }
  }, [acessoSD])

  const categoriasExistentes = useMemo(() => {
    const categoriasPadrao = ABAS.map(item => item.categoria)
    return [...categoriasPadrao, ...new Set(itens.map(item => item.categoria).filter(c => !categoriasPadrao.includes(c)))]
  }, [itens])
  const quantidades = useMemo(() => new Map(categoriasExistentes.map(cat => [cat, itens.filter(i => i.categoria === cat).length])), [itens, categoriasExistentes])
  const visiveis = useMemo(() => itens.filter(item => item.categoria === aba &&
    [item.nome, item.observacao, item.unidade].some(valor => String(valor || '').toLocaleLowerCase('pt-BR').includes(busca.trim().toLocaleLowerCase('pt-BR')))), [itens, aba, busca])
  const tituloAba = ABAS.find(item => item.categoria === aba)?.nome || aba

  function abrirNovo() {
    setEditarItem(null); setFormulario(novoCadastro(aba)); setErro(''); setModalAberto(true)
  }
  function abrirEdicao(item) {
    setEditarItem(item)
    setFormulario({ nome: item.nome, categoria: item.categoria, unidade: item.unidade,
      custo_unitario: String(item.custo_unitario ?? 0), observacao: item.observacao || '' })
    setErro(''); setModalAberto(true)
  }
  function fecharModal() { if (!salvando) { setModalAberto(false); setErro('') } }

  async function salvar(event) {
    event.preventDefault()
    if (!formulario.nome.trim() || !formulario.categoria.trim()) return setErro('Informe o nome e a categoria do material.')
    if (!precoValido(formulario.custo_unitario)) return setErro('Informe um preço válido, com até seis casas decimais.')
    setSalvando(true); setErro(''); setAviso('')
    try {
      const comuns = {
        p_nome: formulario.nome.trim(), p_categoria: formulario.categoria,
        p_unidade: formulario.unidade, p_custo_unitario: converterDecimal(formulario.custo_unitario),
        p_observacao: formulario.observacao.trim() || null,
      }
      // Os parâmetros ocultos permanecem intactos nas edições. Não há gestão de estoque nesta página.
      const parametros = editarItem ? {
        ...comuns, p_insumo_id: editarItem.id, p_codigo: editarItem.codigo,
        p_estoque_minimo: editarItem.estoque_minimo, p_ativo: editarItem.ativo,
      } : { ...comuns, p_codigo: null, p_estoque_minimo: 0 }
      const rpc = editarItem ? 'editar_insumo' : 'cadastrar_insumo'
      const { error } = await supabase.rpc(rpc, parametros)
      if (error) throw error
      setModalAberto(false)
      setAviso(editarItem ? 'Material atualizado com sucesso.' : 'Material cadastrado com sucesso.')
      setAba(formulario.categoria)
      await carregar()
    } catch (e) { setErro(`Não foi possível salvar: ${e.message}`) }
    finally { setSalvando(false) }
  }

  if (!acessoSD) return <section className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-700   ">Módulo disponível somente para a SD Plásticos.</section>

  return <div className="ef-insumos space-y-5 pb-8">
    {/* Os estilos escuros acompanham o botão de tema do Estoque Fácil (classe ef-dark),
        não a preferência de tema do navegador/sistema operacional. */}
    <style>{`
      .ef-dark .ef-insumos-card { background: #19263e !important; border-color: #2a3a55 !important; }
      .ef-dark .ef-insumos-card thead { background: #202e46 !important; }
      .ef-dark .ef-insumos-card tbody tr { border-color: #2a3a55 !important; }
      .ef-dark .ef-insumos input,
      .ef-dark .ef-insumos select,
      .ef-dark .ef-insumos textarea { background: #152238 !important; color: #f1f5ff !important; border-color: #3a4c69 !important; }
      .ef-dark .ef-insumos input::placeholder,
      .ef-dark .ef-insumos textarea::placeholder { color: #8396b6 !important; }
      .ef-dark .ef-insumos .ef-insumos-modal { background: #19263e !important; border: 1px solid #2a3a55 !important; }
      .ef-dark .ef-insumos .ef-insumos-icon { background: #22314d !important; color: #b2c0d9 !important; border-color: #344761 !important; }
      .ef-dark .ef-insumos .ef-insumos-tab-count { background: #263755 !important; color: #c0cdeb !important; }
      .ef-dark .ef-insumos .ef-insumos-active { background: #143e37 !important; color: #65e3be !important; }
      .ef-dark .ef-insumos .ef-insumos-inactive { background: #293650 !important; color: #b2c0d9 !important; }
    `}</style>

    <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
      <div><p className="text-[11px] font-bold uppercase tracking-[0.18em] text-blue-600 ">Controle de produção</p><h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900 ">Insumos</h1><p className="mt-2 text-sm text-slate-500 ">Materiais de fabricação, referências e preços cadastrados.</p></div>
      <button type="button" onClick={abrirNovo} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#315cf5] px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700"><Icone nome="mais" tamanho={18}/>Novo insumo</button>
    </header>

    {aviso && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700   ">{aviso}</div>}
    {!modalAberto && erro && <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700   ">{erro}</div>}

    <nav className="flex gap-1 overflow-x-auto border-b border-slate-200 " aria-label="Categorias de insumos">
      {categoriasExistentes.map(categoria => {
        const definicao = ABAS.find(item => item.categoria === categoria)
        const ativa = categoria === aba
        return <button key={categoria} type="button" onClick={() => { setAba(categoria); setBusca('') }}
          className={`inline-flex shrink-0 items-center gap-2 border-b-2 px-4 py-3.5 text-sm font-medium transition ${ativa ? 'border-blue-600 text-blue-600  ' : 'border-transparent text-slate-500 hover:text-blue-600  '}`} aria-current={ativa ? 'page' : undefined}>
          <Icone nome={definicao?.icone || 'materia'} tamanho={18}/>{definicao?.nome || categoria}<span className={`ef-insumos-tab-count ml-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${ativa ? 'bg-blue-50 text-blue-600  ' : 'ef-insumos-inactive bg-slate-100 text-slate-500  '}`}>{quantidades.get(categoria) || 0}</span>
        </button>
      })}
    </nav>

    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm  ">
      <div className="flex flex-col gap-4 border-b border-slate-100 px-5 py-5 sm:flex-row sm:items-center sm:justify-between ">
        <div><h2 className="text-lg font-semibold text-slate-900 ">{tituloAba}</h2><p className="mt-1 text-xs text-slate-500 ">Preços, referências e informações dos materiais cadastrados.</p></div>
        <div className="relative w-full sm:w-60"><Icone nome="buscar" tamanho={18} className="pointer-events-none absolute left-3 top-3 text-slate-400"/><input aria-label="Buscar material" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar..." className={`${CL_INPUT} pl-10`}/></div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[710px] text-sm"><thead className="bg-slate-50 text-left text-[11px] uppercase tracking-wide text-slate-400  "><tr><th className="px-5 py-3">Material</th><th className="px-4 py-3">Tipo / unidade</th><th className="px-4 py-3">Preço por unidade</th><th className="px-4 py-3">Atualizado em</th><th className="px-4 py-3">Status</th><th className="px-5 py-3 text-right">Editar</th></tr></thead>
          <tbody>{visiveis.map(item => <tr key={item.id} className="border-t border-slate-100 transition hover:bg-slate-50/70  ">
            <td className="px-5 py-4"><div className="flex items-center gap-3"><span className="ef-insumos-icon flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500   "><Icone nome={ABAS.find(a => a.categoria === item.categoria)?.icone || 'materia'}/></span><div className="font-semibold text-slate-800 ">{item.nome}</div></div></td>
            <td className="px-4 py-4 text-slate-500 ">{item.categoria} · {item.unidade}</td>
            <td className="px-4 py-4 font-medium text-slate-600 ">{formatarPreco(item.custo_unitario)}</td>
            <td className="px-4 py-4 text-slate-500 ">{formatarData(item.atualizada_em || item.criada_em)}</td>
            <td className="px-4 py-4"><span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${item.ativo ? 'ef-insumos-active bg-emerald-50 text-emerald-700  ' : 'ef-insumos-inactive bg-slate-100 text-slate-500  '}`}><span className="h-1.5 w-1.5 rounded-full bg-current"/>{item.ativo ? 'Ativo' : 'Inativo'}</span></td>
            <td className="px-5 py-4 text-right"><button type="button" aria-label={`Editar ${item.nome}`} title={`Editar ${item.nome}`} onClick={() => abrirEdicao(item)} className="rounded-lg p-2.5 text-slate-500 transition hover:bg-slate-100 hover:text-blue-600   "><Icone nome="editar" tamanho={18}/></button></td>
          </tr>)}</tbody></table>
      </div>
      {!carregando && visiveis.length === 0 && <div className="px-5 py-12 text-center text-sm text-slate-500 ">Nenhum material encontrado nesta categoria.</div>}
      {carregando && <div className="px-5 py-8 text-center text-sm text-slate-500">Carregando materiais...</div>}
    </section>

    {modalAberto && <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-950/60 p-3 sm:p-6" onMouseDown={e => { if (e.target === e.currentTarget) fecharModal() }}>
      <section role="dialog" aria-modal="true" aria-label={editarItem ? 'Editar insumo' : 'Novo insumo'} className="ef-insumos-modal my-auto w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl   ">
        <div className="flex items-center justify-between gap-4 border-b border-slate-100 px-5 py-5 "><div className="flex items-center gap-3"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600  "><Icone nome="embalagem" tamanho={21}/></span><div><h2 className="text-lg font-semibold text-slate-800 ">{editarItem ? 'Editar insumo' : 'Novo insumo'}</h2><p className="mt-0.5 text-xs text-slate-500 ">Cadastre o material e seu custo de referência.</p></div></div><button type="button" aria-label="Fechar" disabled={salvando} onClick={fecharModal} className="rounded-lg p-2 text-slate-400 transition hover:bg-slate-100 "><Icone nome="fechar" tamanho={19}/></button></div>
        <form className="space-y-4 px-5 py-5" onSubmit={salvar}>
          {erro && <p role="alert" className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700  ">{erro}</p>}
          <label className="block"><Rotulo>Nome do insumo *</Rotulo><input required autoFocus className={CL_INPUT} value={formulario.nome} onChange={e => setFormulario(s => ({...s, nome: e.target.value}))} placeholder="Digite uma descrição clara"/></label>
          <div className="grid gap-4 sm:grid-cols-2"><label className="block"><Rotulo>Categoria</Rotulo><select className={CL_INPUT} value={formulario.categoria} onChange={e => setFormulario(s => ({...s, categoria: e.target.value}))}>{categoriasExistentes.map(cat => <option value={cat} key={cat}>{ABAS.find(a => a.categoria === cat)?.nome || cat}</option>)}</select></label><label className="block"><Rotulo>Unidade de medida</Rotulo><select className={CL_INPUT} value={formulario.unidade} onChange={e => setFormulario(s => ({...s, unidade: e.target.value}))}>{UNIDADES.map(u => <option key={u} value={u}>{u}</option>)}</select></label></div>
          <label className="block"><Rotulo>Valor / preço (R$) *</Rotulo><input required inputMode="decimal" className={CL_INPUT} value={formulario.custo_unitario} onChange={e => setFormulario(s => ({...s, custo_unitario: e.target.value}))} placeholder="Ex.: 8,42"/></label>
          <label className="block"><Rotulo>Observação <span className="font-normal text-slate-400">Opcional</span></Rotulo><textarea rows={3} className={CL_INPUT} value={formulario.observacao} onChange={e => setFormulario(s => ({...s, observacao: e.target.value}))} placeholder="Informações adicionais..."/></label>
          <div className="flex justify-end gap-2 border-t border-slate-100 pt-4 "><button type="button" disabled={salvando} onClick={fecharModal} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50   ">Cancelar</button><button type="submit" disabled={salvando} className="rounded-xl bg-[#315cf5] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50">{salvando ? 'Salvando...' : 'Salvar registro'}</button></div>
        </form>
      </section>
    </div>}
  </div>
}
