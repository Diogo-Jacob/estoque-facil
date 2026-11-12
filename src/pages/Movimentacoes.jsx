import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../services/supabase'

  function Icone({ nome, size = 18, className = '' }) {
    const desenhos = {
      entrada: <><path d="m15 3-9 9"/><path d="M6 4v8h8"/></>,
      saida: <><path d="m9 15 9-9"/><path d="M10 6h8v8"/></>,
      caixa: <><path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="M3 7v10l9 5 9-5V7M12 12v10"/></>,
      calendario: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 10h18"/></>,
      carrinho: <><circle cx="9" cy="20" r="1"/><circle cx="19" cy="20" r="1"/><path d="M2 3h2l3 13h13l2-9H5"/></>,
      seta: <><path d="M4 12h16m-6-6 6 6-6 6"/></>,
      chevron: <><path d="m6 9 6 6 6-6"/></>,
      filtro: <><path d="M4 5h16l-6 7v6l-4 2v-8L4 5Z"/></>,
      busca: <><circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/></>,
      check: <><path d="m4 12 5 5L20 6"/></>,
      escudo: <><path d="M12 22c6-3 8-7 8-12V5l-8-3-8 3v5c0 5 2 9 8 12Z"/><path d="m9 12 2 2 4-4"/></>,
      esquerda: <><path d="m15 18-6-6 6-6"/></>,
      direita: <><path d="m9 18 6-6-6-6"/></>,
    }
    return <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>{desenhos[nome] || desenhos.caixa}</svg>
  }


  function BadgeTipo({ tipo }) {
    const entrada = tipo === 'entrada'
    return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${entrada ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'}`}><Icone nome={tipo} size={13}/>{entrada ? 'Entrada' : 'Saída'}</span>
  }


  function BotaoEstorno({ movimentacao, estornandoId, onEstornar }) {
    if (!(!movimentacao.estornada && !movimentacao.movimentacaoOriginalId)) return <span className="text-xs text-slate-400">Estornada / estorno</span>
    return <button type="button" disabled={estornandoId === movimentacao.id} onClick={() => onEstornar(movimentacao)} className="rounded-lg px-2 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 disabled:opacity-50">{estornandoId === movimentacao.id ? 'Estornando…' : 'Estornar'}</button>
  }


  function HistoricoTabela({
    empresaEhSdPlasticos,
    empresaUsaCanalVenda,
    listaPagina,
    precosHistoricoRecente,
    dataLegivel,
    formatarNumero,
    formatarCanalVenda,
    formatarPrecoUnitario,
    estornandoId,
    onEstornar,
  }) {
    return (
      <div className="overflow-x-auto">
        <table className={`w-full ${empresaEhSdPlasticos ? 'min-w-[900px]' : 'min-w-[720px]'} border-collapse text-left text-sm`}>
          <thead className="border-y border-slate-100 bg-slate-50/80">
            <tr className="text-[10px] uppercase tracking-wider text-slate-400">
              <th className="px-5 py-3">Data</th>
              <th className="px-5 py-3">Produto</th>
              <th className="px-5 py-3">Tipo</th>
              <th className="px-5 py-3">Quantidade</th>
              {empresaUsaCanalVenda && <th className="px-5 py-3">Canal</th>}
              {empresaEhSdPlasticos && <th className="px-5 py-3">Valor unitário</th>}
              <th className="px-5 py-3">Observação</th>
              <th className="px-5 py-3">Ações</th>
            </tr>
          </thead>
          <tbody>
            {listaPagina.map((movimentacao) => {
              // Algumas linhas recentes vêm das props da página; as da busca vêm do Supabase.
              const valorRegistrado = movimentacao.valorUnitario ?? movimentacao.valor_unitario ?? precosHistoricoRecente[movimentacao.id]
              const temValor = movimentacao.tipo === 'saida' && valorRegistrado !== null && valorRegistrado !== undefined && valorRegistrado !== '' && Number.isFinite(Number(valorRegistrado))
              return (
                <tr key={movimentacao.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70">
                  <td className="whitespace-nowrap px-5 py-3 text-slate-600">{dataLegivel(movimentacao.data ?? movimentacao.data_movimentacao)}</td>
                  <td className="px-5 py-3 font-medium text-slate-700">{movimentacao.produtoNome}</td>
                  <td className="px-5 py-3"><BadgeTipo tipo={movimentacao.tipo}/></td>
                  <td className="whitespace-nowrap px-5 py-3 font-medium text-slate-700">{formatarNumero(movimentacao.quantidade)} un.</td>
                  {empresaUsaCanalVenda && (
                    <td className="px-5 py-3 text-slate-600">{movimentacao.tipo === 'saida' ? formatarCanalVenda(movimentacao.canalVenda) : '—'}</td>
                  )}
                  {empresaEhSdPlasticos && (
                    <td className="whitespace-nowrap px-5 py-3 font-semibold text-slate-700" title={!temValor && movimentacao.tipo === 'saida' ? 'Preço histórico não registrado' : undefined}>
                      {temValor ? formatarPrecoUnitario(valorRegistrado) : '—'}
                    </td>
                  )}
                  <td className="max-w-[220px] truncate px-5 py-3 text-slate-500" title={movimentacao.observacao || ''}>{movimentacao.observacao || '—'}</td>
                  <td className="px-5 py-3"><BotaoEstorno movimentacao={movimentacao} estornandoId={estornandoId} onEstornar={onEstornar}/></td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {listaPagina.length === 0 && <p className="p-8 text-center text-sm text-slate-500">Nenhuma movimentação encontrada.</p>}
      </div>
    )
  }


const SD_PLASTICOS_ID = 'b7360df7-24af-4372-a7fb-5919d7a55b3e'
const CATEGORIAS_RECEITAS = ['Terceirização', 'Serviços', 'Aluguel de equipamentos', 'Reembolso', 'Outras']
const FORM_RECEITA_VAZIO = { descricao: '', categoria: 'Terceirização', valor: '', data_recebimento: '', observacao: '' }
const MOEDA_RECEITAS = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })

function OutrasReceitas({ empresaId, usuarioId }) {
  const [receitas, setReceitas] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [salvandoReceita, setSalvandoReceita] = useState(false)
  const [erroReceita, setErroReceita] = useState('')
  const [avisoReceita, setAvisoReceita] = useState('')
  const [editando, setEditando] = useState(null)
  const [formReceita, setFormReceita] = useState({ ...FORM_RECEITA_VAZIO })
  const [formAberto, setFormAberto] = useState(false)
  const [dataDe, setDataDe] = useState(() => `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-01`)
  const [dataAte, setDataAte] = useState(() => {
    const agora = new Date()
    return `${agora.getFullYear()}-${String(agora.getMonth() + 1).padStart(2, '0')}-${String(agora.getDate()).padStart(2, '0')}`
  })
  const [categoria, setCategoria] = useState('')
  const [busca, setBusca] = useState('')
  const [pagina, setPagina] = useState(1)
  const requisicaoRef = useRef(0)

  const carregarReceitas = useCallback(async () => {
    const requisicao = ++requisicaoRef.current
    if (empresaId !== SD_PLASTICOS_ID) return
    setCarregando(true)
    setErroReceita('')
    try {
      const linhas = []
      const tamanho = 800
      for (let pos = 0; ; pos += tamanho) {
        const { data, error } = await supabase.from('outras_receitas')
          .select('id,empresa_id,descricao,categoria,valor,data_recebimento,observacao,criada_em')
          .eq('empresa_id', empresaId)
          .order('data_recebimento', { ascending: false })
          .order('id', { ascending: true })
          .range(pos, pos + tamanho - 1)
        if (requisicao !== requisicaoRef.current) return
        if (error) throw error
        linhas.push(...(data || []))
        if (!data || data.length < tamanho) break
      }
      if (requisicao === requisicaoRef.current) setReceitas(linhas)
    } catch (e) {
      if (requisicao === requisicaoRef.current) setErroReceita(`Não foi possível consultar outras receitas: ${e.message}`)
    } finally {
      if (requisicao === requisicaoRef.current) setCarregando(false)
    }
  }, [empresaId])

  useEffect(() => {
    let ativo = true
    queueMicrotask(() => { if (ativo) void carregarReceitas() })
    return () => { ativo = false; requisicaoRef.current += 1 }
  }, [carregarReceitas])

  const filtradas = useMemo(() => receitas.filter(r =>
    (!dataDe || r.data_recebimento >= dataDe) && (!dataAte || r.data_recebimento <= dataAte) &&
    (!categoria || r.categoria === categoria) &&
    (!busca.trim() || `${r.descricao} ${r.categoria} ${r.observacao || ''}`.toLocaleLowerCase('pt-BR').includes(busca.trim().toLocaleLowerCase('pt-BR')))
  ), [receitas, dataDe, dataAte, categoria, busca])
  const total = filtradas.reduce((acc, r) => acc + Number(r.valor || 0), 0)
  const POR_PAGINA = 10
  const paginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA))
  const paginaAtual = Math.min(pagina, paginas)
  const linhasPagina = filtradas.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA)
  const categoriasPresentes = [...new Set([...CATEGORIAS_RECEITAS, ...receitas.map(r => r.categoria)])]
  const porCategoria = filtradas.reduce((mapa, r) => {
    mapa[r.categoria] = (mapa[r.categoria] || 0) + Number(r.valor || 0)
    return mapa
  }, {})
  const formatarDataReceita = (data) => data ? `${data.slice(8, 10)}/${data.slice(5, 7)}/${data.slice(0, 4)}` : '—'
  const campoReceita = 'mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none focus:border-blue-500'

  function abrirReceita(r = null) {
    setEditando(r?.id || null)
    setFormReceita(r ? {
      descricao: r.descricao, categoria: r.categoria, valor: String(r.valor),
      data_recebimento: r.data_recebimento, observacao: r.observacao || '',
    } : { ...FORM_RECEITA_VAZIO, data_recebimento: (() => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}` })() })
    setErroReceita('')
    setAvisoReceita('')
    setFormAberto(true)
  }

  async function salvarReceita(event) {
    event.preventDefault()
    if (salvandoReceita || empresaId !== SD_PLASTICOS_ID) return
    const entrada = formReceita.valor.trim()
    const normalizada = entrada.includes(',') ? entrada.replace(/\./g, '').replace(',', '.') : entrada
    const valor = Number(normalizada)
    if (!formReceita.descricao.trim() || !formReceita.categoria.trim() || !formReceita.data_recebimento ||
      !entrada || !Number.isFinite(valor) || valor <= 0 || Math.abs(valor * 100 - Math.round(valor * 100)) > 0.000001) {
      setErroReceita('Informe descrição, categoria, data e valor positivo com até duas casas decimais.')
      return
    }
    const dados = {
      descricao: formReceita.descricao.trim(), categoria: formReceita.categoria.trim(),
      valor: Number(valor.toFixed(2)), data_recebimento: formReceita.data_recebimento,
      observacao: formReceita.observacao.trim() || null,
    }
    setSalvandoReceita(true)
    setErroReceita('')
    try {
      if (editando) {
        const { data, error } = await supabase.from('outras_receitas').update(dados)
          .eq('empresa_id', empresaId).eq('id', editando).select('id')
        if (error) throw error
        if (!data?.length) throw new Error('A receita não foi alterada. Verifique suas permissões.')
      } else {
        const { data: auth, error: erroAuth } = await supabase.auth.getUser()
        if (erroAuth || !auth?.user?.id || (usuarioId && auth.user.id !== usuarioId)) throw new Error('Sessão inválida. Entre novamente.')
        const { data, error } = await supabase.from('outras_receitas')
          .insert({ ...dados, empresa_id: empresaId, criado_por: auth.user.id }).select('id')
        if (error) throw error
        if (!data?.length) throw new Error('Não foi possível confirmar o lançamento.')
      }
      setFormAberto(false)
      setAvisoReceita(editando ? 'Receita atualizada.' : 'Receita cadastrada.')
      await carregarReceitas()
    } catch (e) { setErroReceita(e.message || 'Erro ao salvar receita.') }
    finally { setSalvandoReceita(false) }
  }

  async function excluirReceita(r) {
    if (!window.confirm(`Excluir a receita "${r.descricao}" (${MOEDA_RECEITAS.format(Number(r.valor))})?`)) return
    setErroReceita(''); setAvisoReceita('')
    const { data, error } = await supabase.from('outras_receitas').delete()
      .eq('empresa_id', empresaId).eq('id', r.id).select('id')
    if (error || !data?.length) { setErroReceita(error?.message || 'Não foi possível excluir.'); return }
    setAvisoReceita('Receita excluída.'); await carregarReceitas()
  }

  return <div className="space-y-5">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h2 className="text-xl font-bold text-slate-900">Outras receitas</h2><p className="mt-1 text-sm text-slate-500">Serviços, terceirizações e recebimentos sem movimentação de estoque.</p></div>
      <button type="button" onClick={() => abrirReceita()} className="rounded-xl bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-700">+ Nova receita</button>
    </div>
    {avisoReceita && <p role="status" className="rounded-xl bg-emerald-50 p-3 text-sm text-emerald-800">{avisoReceita}</p>}
    {erroReceita && !formAberto && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{erroReceita}</p>}
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:col-span-2"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total de outras receitas no período</p><strong className="mt-2 block text-3xl font-extrabold text-blue-700">{carregando ? '...' : MOEDA_RECEITAS.format(total)}</strong><p className="mt-2 text-xs text-slate-500">{filtradas.length} lançamento(s) · não inclui vendas de produtos</p></div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"><p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Categorias no período</p><div className="mt-3 space-y-2">{Object.entries(porCategoria).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([nome, valor]) => <div key={nome} className="flex justify-between gap-2 text-xs"><span className="min-w-0 truncate text-slate-600">{nome}</span><strong className="shrink-0 text-slate-800">{MOEDA_RECEITAS.format(valor)}</strong></div>)}{!Object.keys(porCategoria).length && <p className="text-sm text-slate-400">Sem lançamentos</p>}</div></div>
    </div>
    <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="grid gap-3 border-b border-slate-100 p-4 sm:grid-cols-2 lg:grid-cols-4">
        <label className="text-xs font-semibold text-slate-700">De<input type="date" value={dataDe} onChange={e => { setDataDe(e.target.value); setPagina(1) }} className={campoReceita}/></label>
        <label className="text-xs font-semibold text-slate-700">Até<input type="date" value={dataAte} onChange={e => { setDataAte(e.target.value); setPagina(1) }} className={campoReceita}/></label>
        <label className="text-xs font-semibold text-slate-700">Categoria<select value={categoria} onChange={e => { setCategoria(e.target.value); setPagina(1) }} className={campoReceita}><option value="">Todas</option>{categoriasPresentes.map(c => <option key={c} value={c}>{c}</option>)}</select></label>
        <label className="text-xs font-semibold text-slate-700">Buscar<input value={busca} onChange={e => { setBusca(e.target.value); setPagina(1) }} placeholder="Descrição..." className={campoReceita}/></label>
      </div>
      <div className="overflow-x-auto"><table className="w-full min-w-[650px] text-left text-sm"><thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-4 py-3">Recebimento</th><th className="px-4 py-3">Descrição</th><th className="px-4 py-3">Categoria</th><th className="px-4 py-3">Valor</th><th className="px-4 py-3 text-right">Ações</th></tr></thead><tbody className="divide-y divide-slate-100">{linhasPagina.map(r => <tr key={r.id}><td className="whitespace-nowrap px-4 py-4 text-slate-600">{formatarDataReceita(r.data_recebimento)}</td><td className="px-4 py-4 font-semibold text-slate-800">{r.descricao}{r.observacao && <p className="mt-1 text-xs font-normal text-slate-400">{r.observacao}</p>}</td><td className="px-4 py-4 text-slate-600">{r.categoria}</td><td className="whitespace-nowrap px-4 py-4 font-bold text-slate-900">{MOEDA_RECEITAS.format(Number(r.valor))}</td><td className="whitespace-nowrap px-4 py-4 text-right"><button type="button" onClick={() => abrirReceita(r)} className="mr-3 text-xs font-semibold text-blue-600">Editar</button><button type="button" onClick={() => void excluirReceita(r)} className="text-xs font-semibold text-red-600">Excluir</button></td></tr>)}{!linhasPagina.length && <tr><td colSpan={5} className="p-10 text-center text-sm text-slate-400">{carregando ? 'Carregando receitas...' : 'Nenhuma receita encontrada.'}</td></tr>}</tbody></table></div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 text-xs text-slate-500"><span>{filtradas.length} registro(s) · página {paginaAtual} de {paginas}</span><div className="flex gap-2"><button type="button" disabled={paginaAtual <= 1} onClick={() => setPagina(p => Math.max(1, p - 1))} className="rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-40">Anterior</button><button type="button" disabled={paginaAtual >= paginas} onClick={() => setPagina(p => Math.min(paginas, p + 1))} className="rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-40">Próxima</button></div></div>
    </div>
    {formAberto && <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-900/60 p-3" onMouseDown={e => { if (e.target === e.currentTarget && !salvandoReceita) setFormAberto(false) }}><div role="dialog" aria-modal="true" aria-label={editando ? 'Editar receita' : 'Nova receita'} className="my-auto w-full max-w-lg rounded-2xl bg-white p-5 shadow-xl sm:p-7"><div className="mb-5 flex items-center justify-between"><h3 className="text-xl font-bold">{editando ? 'Editar receita' : 'Nova receita'}</h3><button type="button" onClick={() => setFormAberto(false)} disabled={salvandoReceita} className="rounded-lg px-2 py-1 text-xl">×</button></div><form onSubmit={salvarReceita} className="space-y-4"><label className="block text-xs font-semibold">Descrição *<input required maxLength={200} value={formReceita.descricao} onChange={e => setFormReceita(p => ({ ...p, descricao: e.target.value }))} className={campoReceita} placeholder="Ex.: Terceirização para cliente"/></label><div className="grid gap-3 sm:grid-cols-2"><label className="block text-xs font-semibold">Categoria *<select value={formReceita.categoria} onChange={e => setFormReceita(p => ({ ...p, categoria: e.target.value }))} className={campoReceita}>{categoriasPresentes.map(c => <option key={c} value={c}>{c}</option>)}</select></label><label className="block text-xs font-semibold">Valor recebido (R$) *<input required inputMode="decimal" value={formReceita.valor} onChange={e => setFormReceita(p => ({ ...p, valor: e.target.value }))} className={campoReceita} placeholder="0,00"/></label></div><label className="block text-xs font-semibold">Data do recebimento *<input required type="date" value={formReceita.data_recebimento} onChange={e => setFormReceita(p => ({ ...p, data_recebimento: e.target.value }))} className={campoReceita}/></label><label className="block text-xs font-semibold">Observações (opcional)<textarea rows={3} value={formReceita.observacao} onChange={e => setFormReceita(p => ({ ...p, observacao: e.target.value }))} className={campoReceita}/></label>{erroReceita && <p role="alert" className="rounded-lg bg-red-50 p-3 text-xs text-red-700">{erroReceita}</p>}<div className="flex justify-end gap-2"><button type="button" onClick={() => setFormAberto(false)} disabled={salvandoReceita} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold">Cancelar</button><button type="submit" disabled={salvandoReceita} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-60">{salvandoReceita ? 'Salvando...' : 'Salvar receita'}</button></div></form></div></div>}
  </div>
}

function Movimentacoes({
  produtos,
  movimentacoes,
  empresaAtiva,
  usuarioLogado,
  carregandoMovimentacoes,
  carregarProdutos,
  carregarMovimentacoes,
}) {
  const [abaMovimentacoes, setAbaMovimentacoes] = useState('estoque')
  const [salvando, setSalvando] = useState(false)
  const [arquivamento, setArquivamento] = useState({ empresaId: null, ids: new Set(), erro: '' })
  const [estornandoId, setEstornandoId] = useState(null)

  const [filtroProduto, setFiltroProduto] = useState('')
  const [buscaHistorico, setBuscaHistorico] = useState('')
  const [filtrosAvancados, setFiltrosAvancados] = useState(false)
  const [paginaHistorico, setPaginaHistorico] = useState(1)
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroCanalVenda, setFiltroCanalVenda] = useState('')
  const [dataInicial, setDataInicial] = useState('')
  const [dataFinal, setDataFinal] = useState('')

  const [historicoCompleto, setHistoricoCompleto] = useState([])
  const [consultaPrecosRecentes, setConsultaPrecosRecentes] = useState({ chave: null, dados: {} })
  const [carregandoHistoricoCompleto, setCarregandoHistoricoCompleto] =
    useState(false)
  const [historicoBuscado, setHistoricoBuscado] = useState(false)

  const [buscaProdutoMovimentacao, setBuscaProdutoMovimentacao] = useState('')
  const [mostrarSugestoesProduto, setMostrarSugestoesProduto] = useState(false)

  const [novaMovimentacao, setNovaMovimentacao] = useState({
    produtoId: '',
    tipo: 'saida',
    data: new Date().toISOString().split('T')[0],
    quantidade: '',
    canalVenda: '',
    valorLiquidoVenda: '',
    observacao: '',
  })

  const nomeEmpresaAtiva = empresaAtiva?.nome?.toLowerCase() || ''

  // IDs antigos permanecem iguais: nenhuma movimentação precisa ser migrada.
  // O nível primário é usado para agrupar; o lançamento guarda o canal exato.
  const canaisVendaDega = [
    { valor: 'dega_moto_parts', nome: 'Dega Moto Parts', tipo: 'principal' },
    { valor: 'full_dega_moto_parts', nome: 'Full Dega Moto Parts', pai: 'dega_moto_parts' },
    { valor: 'emplajoi', nome: 'Emplajoi', tipo: 'principal' },
    { valor: 'full_emplajoi', nome: 'Full Emplajoi', pai: 'emplajoi' },
    { valor: 'fecha_molde', nome: 'Fecha Molde', tipo: 'principal' },
    { valor: 'full_fecha_molde', nome: 'Full da Fecha Molde', pai: 'fecha_molde' },
    { valor: 'shopee', nome: 'Shopee', tipo: 'principal' },
  ]

  const canaisVendaSdPlasticos = [
    { valor: 'mercado_livre', nome: 'Mercado Livre' },
    { valor: 'zeca', nome: 'Zeca' },
    { valor: 'andre', nome: 'Andre' },
    { valor: 'gilmar', nome: 'Gilmar' },
  ]

  const empresaEhDega = nomeEmpresaAtiva.includes('dega')

  const empresaEhSdPlasticos =
    nomeEmpresaAtiva.includes('sd') ||
    nomeEmpresaAtiva.includes('plásticos') ||
    nomeEmpresaAtiva.includes('plasticos')

  const empresaUsaCanalVenda =
    empresaAtiva?.usa_canal_venda === true ||
    empresaAtiva?.usaCanalVenda === true ||
    empresaEhDega ||
    empresaEhSdPlasticos

  const canaisVenda = empresaEhSdPlasticos
    ? canaisVendaSdPlasticos
    : canaisVendaDega

  const todosCanaisVenda = [...canaisVendaDega, ...canaisVendaSdPlasticos]

  function formatarCanalVenda(canal) {
    if (!canal) return 'Não informado'

    const canalEncontrado = todosCanaisVenda.find(
      (item) => item.valor === canal
    )

    return canalEncontrado?.nome || canal
  }

  // Consulta o estado de arquivamento no banco, pois o Dashboard pode receber
  // produtos sem esse campo ou manter dados anteriores ao arquivamento.
  useEffect(() => {
    if (!empresaEhSdPlasticos || !empresaAtiva?.id) return
    let ativo = true
    const empresaId = empresaAtiva.id
    void Promise.resolve().then(async () => {
      if (!ativo) return
      const { data, error } = await supabase.from('produtos')
        .select('id')
        .eq('empresa_id', empresaId)
        .eq('arquivado', true)
      if (!ativo) return
      setArquivamento({
        empresaId,
        ids: new Set((data || []).map((item) => item.id)),
        erro: error ? 'Não foi possível verificar os produtos arquivados. Atualize a página.' : '',
      })
    })
    return () => { ativo = false }
  }, [empresaAtiva?.id, empresaEhSdPlasticos])

  const arquivamentoPronto = !empresaEhSdPlasticos ||
    (arquivamento.empresaId === empresaAtiva?.id && !arquivamento.erro)
  const produtosAtivos = produtos.filter((produto) =>
    produto.ativo && (!empresaEhSdPlasticos ||
      (!produto.arquivado && !arquivamento.ids.has(produto.id)))
  )

  const produtosFiltradosMovimentacao = produtosAtivos.filter((produto) => {
    const busca = buscaProdutoMovimentacao.toLowerCase().trim()

    if (!busca) return true

    return (
      produto.nome.toLowerCase().includes(busca) ||
      produto.codigo.toLowerCase().includes(busca) ||
      produto.categoria.toLowerCase().includes(busca)
    )
  })

  const movimentacoesRecentes = movimentacoes.slice(0, 10)
  const idsRecentes = movimentacoesRecentes.map((item) => item.id).filter(Boolean).join(',')
  const chavePrecosRecentes = `${empresaAtiva?.id || ''}:${idsRecentes}`
  const precosHistoricoRecente = consultaPrecosRecentes.chave === chavePrecosRecentes ? consultaPrecosRecentes.dados : {}

  // As movimentações recentes são recebidas do componente pai, que pode não
  // incluir valor_unitario. Consultamos apenas o preço das linhas visíveis.
  useEffect(() => {
    let ativo = true

    if (!empresaEhSdPlasticos || !empresaAtiva?.id || !idsRecentes) {
      return () => { ativo = false }
    }

    async function carregarPrecosRecentes() {
      const { data, error } = await supabase
        .from('movimentacoes')
        .select('id, valor_unitario')
        .eq('empresa_id', empresaAtiva.id)
        .in('id', idsRecentes.split(','))

      if (!ativo) return
      if (error) {
        console.error('Erro ao consultar preços do histórico recente:', error)
        return
      }

      setConsultaPrecosRecentes({
        chave: chavePrecosRecentes,
        dados: Object.fromEntries((data || []).map((item) => [item.id, item.valor_unitario])),
      })
    }

    carregarPrecosRecentes()
    return () => { ativo = false }
  }, [empresaAtiva?.id, empresaEhSdPlasticos, idsRecentes, chavePrecosRecentes])

  const produtoSelecionado = produtos.find(
    (produto) => produto.id === novaMovimentacao.produtoId
  )

  const quantidadeInformada = Number(novaMovimentacao.quantidade || 0)
  const precoPadrao = Number(produtoSelecionado?.valorUnitario ?? produtoSelecionado?.valor_unitario ?? 0)
  // A SD informa o valor líquido TOTAL da venda, não o preço por peça.
  // O banco já registra valor_unitario: derivamos esse valor para manter
  // a compatibilidade com os relatórios existentes.
  const valorLiquidoDigitado = novaMovimentacao.valorLiquidoVenda.trim()
  const valorLiquidoNumero = valorLiquidoDigitado === ''
    ? null
    : Number(valorLiquidoDigitado.replace(',', '.'))
  const valorTotal = valorLiquidoNumero === null
    ? quantidadeInformada * precoPadrao
    : valorLiquidoNumero
  const precoEfetivo = quantidadeInformada > 0 ? valorTotal / quantidadeInformada : 0
  const mostrarPreco = empresaEhSdPlasticos && novaMovimentacao.tipo === 'saida'
  const formatarNumero = (numero) => Number(numero || 0).toLocaleString('pt-BR')
  const formatarMoeda = (numero) => Number(numero || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  // O preço por unidade pode ter até seis casas decimais (ex.: R$ 0,003).
  // O valor total continua sendo exibido com duas casas decimais.
  const formatarPrecoUnitario = (numero) => `R$ ${Number(numero || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 6 })}`
  function dataLegivel(data) {
    if (!data) return '—'
    const [ano, mes, dia] = data.split('-')
    return ano && mes && dia ? `${dia}/${mes}/${ano}` : data
  }
  const historicoExibido = historicoBuscado ? historicoCompleto : movimentacoesRecentes
  const historicoFiltrado = historicoExibido.filter((item) =>
    !buscaHistorico.trim() || item.produtoNome.toLowerCase().includes(buscaHistorico.toLowerCase().trim()) || String(item.id).toLowerCase().includes(buscaHistorico.toLowerCase().trim())
  )
  const itensPorPagina = 10
  const paginas = Math.max(1, Math.ceil(historicoFiltrado.length / itensPorPagina))
  const paginaAtual = Math.min(paginaHistorico, paginas)
  const listaPagina = historicoFiltrado.slice((paginaAtual - 1) * itensPorPagina, paginaAtual * itensPorPagina)

  const estoqueAposMovimentacao = produtoSelecionado
    ? novaMovimentacao.tipo === 'entrada'
      ? produtoSelecionado.estoqueAtual + quantidadeInformada
      : produtoSelecionado.estoqueAtual - quantidadeInformada
    : null

  const saidaMaiorQueEstoque =
    produtoSelecionado &&
    novaMovimentacao.tipo === 'saida' &&
    quantidadeInformada > produtoSelecionado.estoqueAtual

  const ficaraAbaixoDoMinimo =
    produtoSelecionado &&
    novaMovimentacao.tipo === 'saida' &&
    quantidadeInformada > 0 &&
    estoqueAposMovimentacao < produtoSelecionado.estoqueMinimo

  function atualizarCampo(campo, valor) {
    setNovaMovimentacao((movimentacaoAtual) => ({
      ...movimentacaoAtual,
      [campo]: valor,
      ...(campo === 'tipo' && valor === 'entrada'
        ? { canalVenda: '' }
        : {}),
    }))
  }

  function selecionarProduto(produto) {
    setNovaMovimentacao({
      ...novaMovimentacao,
      produtoId: produto.id,
    })

    setBuscaProdutoMovimentacao(produto.nome)
    setMostrarSugestoesProduto(false)
  }

  function formatarMovimentacao(movimentacao) {
    return {
      id: movimentacao.id,
      empresaId: movimentacao.empresa_id,
      produtoId: movimentacao.produto_id,
      produtoNome: movimentacao.produtos?.nome || 'Produto não encontrado',
      usuarioId: movimentacao.usuario_id,
      tipo: movimentacao.tipo,
      quantidade: movimentacao.quantidade,
      data: movimentacao.data_movimentacao,
      canalVenda: movimentacao.canal_venda || '',
      valorUnitario: movimentacao.valor_unitario ?? null,
      observacao: movimentacao.observacao || '',
      criadaEm: movimentacao.criada_em,
      estornada: movimentacao.estornada,
      movimentacaoOriginalId: movimentacao.movimentacao_original_id,
    }
  }

  async function buscarHistoricoCompleto() {
    if (!empresaAtiva?.id) {
      alert('Selecione uma empresa antes de buscar o histórico.')
      return
    }

    setCarregandoHistoricoCompleto(true)
    setHistoricoBuscado(true)

    let consulta = supabase
      .from('movimentacoes')
      .select(`
        *,
        produtos!movimentacoes_produto_id_fkey (
          nome
        )
      `)
      .eq('empresa_id', empresaAtiva.id)
      .order('data_movimentacao', { ascending: false })
      .order('criada_em', { ascending: false })
      .limit(100)

    if (filtroProduto) {
      consulta = consulta.eq('produto_id', filtroProduto)
    }

    if (filtroTipo) {
      consulta = consulta.eq('tipo', filtroTipo)
    }

    if (empresaUsaCanalVenda && filtroCanalVenda) {
      // Um canal pertence a uma saída, não a uma entrada de estoque.
      consulta = consulta.eq('tipo', 'saida')

      if (filtroCanalVenda === '__sem_canal__') {
        consulta = consulta.or('canal_venda.is.null,canal_venda.eq.""')
      } else {
        const filhos = empresaEhDega
          ? canaisVendaDega.filter(c => c.pai === filtroCanalVenda).map(c => c.valor)
          : []
        consulta = filhos.length
          ? consulta.in('canal_venda', [filtroCanalVenda, ...filhos])
          : consulta.eq('canal_venda', filtroCanalVenda)
      }
    }

    if (dataInicial) {
      consulta = consulta.gte('data_movimentacao', dataInicial)
    }

    if (dataFinal) {
      consulta = consulta.lte('data_movimentacao', dataFinal)
    }

    const { data, error } = await consulta

    if (error) {
      console.error('Erro ao buscar histórico completo:', error)
      alert(error.message || 'Erro ao buscar histórico completo.')
      setCarregandoHistoricoCompleto(false)
      return
    }

    setHistoricoCompleto(data.map(formatarMovimentacao))
    setPaginaHistorico(1)
    setCarregandoHistoricoCompleto(false)
  }

  function limparFiltrosHistorico() {
    setFiltroProduto('')
    setFiltroTipo('')
    setFiltroCanalVenda('')
    setDataInicial('')
    setDataFinal('')
    setHistoricoCompleto([])
    setHistoricoBuscado(false)
    setPaginaHistorico(1)
    setBuscaHistorico('')
  }

  async function salvarMovimentacao() {
    if (!empresaAtiva?.id) {
      alert('Selecione uma empresa antes de registrar movimentações.')
      return
    }

    if (!arquivamentoPronto) {
      alert('A consulta de produtos arquivados ainda não foi concluída. Tente novamente.')
      return
    }

    if (!novaMovimentacao.produtoId) {
      alert('Selecione um produto.')
      return
    }

    if (!novaMovimentacao.data) {
      alert('Informe a data da movimentação.')
      return
    }

    const quantidade = Number(novaMovimentacao.quantidade)

    if (!quantidade || quantidade <= 0) {
      alert('Informe uma quantidade maior que zero.')
      return
    }

    if (!produtoSelecionado) {
      alert('Produto não encontrado.')
      return
    }

    if (empresaEhSdPlasticos) {
      // Confirma o estado atual imediatamente antes do INSERT.
      // A proteção definitiva contra concorrência fica no gatilho do Supabase.
      if (!arquivamentoPronto) {
        alert('A verificação dos produtos arquivados não terminou. Atualize a página.')
        return
      }
      const { data: produtoAtual, error: erroProduto } = await supabase
        .from('produtos')
        .select('ativo,arquivado')
        .eq('id', produtoSelecionado.id)
        .eq('empresa_id', empresaAtiva.id)
        .single()
      if (erroProduto || !produtoAtual) {
        alert('Não foi possível verificar o estado do produto. Tente novamente.')
        return
      }
      if (produtoAtual.arquivado || !produtoAtual.ativo) {
        alert('Este produto foi arquivado ou inativado e não aceita novas movimentações.')
        setNovaMovimentacao((anterior) => ({ ...anterior, produtoId: '' }))
        setBuscaProdutoMovimentacao('')
        return
      }
    }

    if (
      novaMovimentacao.tipo === 'saida' &&
      quantidade > produtoSelecionado.estoqueAtual
    ) {
      alert('Não há estoque suficiente para registrar esta saída.')
      return
    }

    if (!Number.isInteger(quantidade)) {
      alert('Informe uma quantidade inteira de unidades.')
      return
    }
    // Valor líquido é o total recebido pela venda, em reais e centavos.
    // O preço unitário derivado pode ter mais de seis casas decimais.
    const valorLiquidoValido = valorLiquidoDigitado === '' || /^(?:\d+(?:[.,]\d{1,2})?|[.,]\d{1,2})$/.test(valorLiquidoDigitado)
    if (mostrarPreco && (!valorLiquidoValido || !Number.isFinite(valorTotal) || valorTotal < 0 || !Number.isFinite(precoEfetivo))) {
      alert('Informe o valor líquido TOTAL da venda, com até duas casas decimais.')
      return
    }
    setSalvando(true)

    const movimentacaoParaSalvar = {
      empresa_id: empresaAtiva.id,
      produto_id: novaMovimentacao.produtoId,
      usuario_id: usuarioLogado?.id || null,
      tipo: novaMovimentacao.tipo,
      quantidade,
      data_movimentacao: novaMovimentacao.data,
      canal_venda:
        empresaUsaCanalVenda && novaMovimentacao.tipo === 'saida'
          ? novaMovimentacao.canalVenda || null
          : null,
      observacao: novaMovimentacao.observacao.trim() || null,
      valor_unitario: mostrarPreco ? precoEfetivo : null,
    }

    const { error } = await supabase
      .from('movimentacoes')
      .insert(movimentacaoParaSalvar)

    if (error) {
      console.error('Erro ao salvar movimentação:', error)
      alert(error.message || 'Erro ao salvar movimentação.')
      setSalvando(false)
      return
    }

    await carregarProdutos()
    await carregarMovimentacoes()

    if (historicoBuscado) {
      await buscarHistoricoCompleto()
    }

    if (novaMovimentacao.tipo === 'saida' && ficaraAbaixoDoMinimo) {
      alert(
        `Atenção: o produto "${produtoSelecionado.nome}" ficou abaixo do estoque mínimo. Estoque atual: ${estoqueAposMovimentacao}. Mínimo recomendado: ${produtoSelecionado.estoqueMinimo}.`
      )
    } else {
      alert('Movimentação registrada com sucesso.')
    }

    setNovaMovimentacao({
      produtoId: '',
      tipo: 'saida',
      data: new Date().toISOString().split('T')[0],
      quantidade: '',
      canalVenda: '',
      valorLiquidoVenda: '',
      observacao: '',
    })

    setBuscaProdutoMovimentacao('')
    setMostrarSugestoesProduto(false)
    setSalvando(false)
  }

  async function estornarMovimentacao(movimentacao) {
    if (movimentacao.movimentacaoOriginalId) {
      alert('Esta movimentação já é um estorno e não pode ser estornada novamente.')
      return
    }

    if (movimentacao.estornada) {
      alert('Esta movimentação já foi estornada anteriormente.')
      return
    }

    const confirmar = confirm(
      `Deseja estornar esta movimentação?\n\nProduto: ${movimentacao.produtoNome}\nTipo original: ${
        movimentacao.tipo === 'entrada' ? 'Entrada' : 'Saída'
      }\nQuantidade: ${movimentacao.quantidade}`
    )

    if (!confirmar) return

    setEstornandoId(movimentacao.id)

    const { error } = await supabase.rpc('estornar_movimentacao', {
      p_movimentacao_id: movimentacao.id,
    })

    if (error) {
      console.error('Erro ao estornar movimentação:', error)
      alert(error.message || 'Erro ao estornar movimentação.')
      setEstornandoId(null)
      return
    }

    await carregarProdutos()
    await carregarMovimentacoes()

    if (historicoBuscado) {
      await buscarHistoricoCompleto()
    }

    alert('Movimentação estornada com sucesso.')
    setEstornandoId(null)
  }

  const campo = 'mt-2 min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
  const rotulo = 'block text-xs font-semibold text-slate-700'

  return <section className="w-full min-w-0 space-y-5 pb-8">
    <header className="min-w-0 pb-1">
      <p className="mb-2 text-[10px] font-extrabold uppercase tracking-[0.24em] text-blue-600">Controle de estoque</p>
      <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Movimentações</h1>
      <p className="mt-1 max-w-full break-words text-sm leading-relaxed text-slate-500">Registre entradas e saídas com conferência automática de saldo.</p>
    </header>
    {empresaEhSdPlasticos && <nav aria-label="Seções de movimentações" className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
      <button type="button" aria-current={abaMovimentacoes === 'estoque' ? 'page' : undefined} onClick={() => setAbaMovimentacoes('estoque')} className={`rounded-xl px-5 py-3 text-sm font-semibold ${abaMovimentacoes === 'estoque' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>Entradas e saídas</button>
      <button type="button" aria-current={abaMovimentacoes === 'receitas' ? 'page' : undefined} onClick={() => setAbaMovimentacoes('receitas')} className={`rounded-xl px-5 py-3 text-sm font-semibold ${abaMovimentacoes === 'receitas' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>Outras receitas</button>
    </nav>}
    {empresaEhSdPlasticos && abaMovimentacoes === 'receitas' ?
      <OutrasReceitas empresaId={empresaAtiva?.id} usuarioId={usuarioLogado?.id}/> : <>
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.85fr)_minmax(285px,1fr)] lg:items-stretch">
      {/* O resumo aparece acima do formulário no celular. */}
      <aside className="order-1 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:order-2 lg:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-bold text-slate-900">Resumo da operação</h3><span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase ${novaMovimentacao.tipo === 'entrada' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'}`}>● {novaMovimentacao.tipo === 'entrada' ? 'Entrada' : 'Saída'}</span></div>
        {produtoSelecionado ? <>
          <div className="mt-5 flex items-center gap-3 border-b border-slate-100 pb-5"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Icone nome="caixa" size={24}/></div><div className="min-w-0"><p className="text-[11px] font-bold uppercase tracking-wide text-blue-600">{produtoSelecionado.codigo || 'Produto'}</p><p className="truncate text-sm font-bold text-slate-900">{produtoSelecionado.nome}</p><p className="text-xs text-slate-400">{produtoSelecionado.categoria || 'Estoque'}</p></div></div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-slate-100 py-5"><div className="text-center"><p className="text-[11px] text-slate-400">Estoque atual</p><p className="mt-2 text-xl font-extrabold text-slate-900 lg:text-2xl">{formatarNumero(produtoSelecionado.estoqueAtual)}</p><p className="text-[11px] text-slate-400">unidades</p></div><Icone nome="seta" size={20} className="text-slate-400"/><div className={`rounded-xl px-2 py-4 text-center ${estoqueAposMovimentacao < 0 ? 'bg-red-50' : 'bg-emerald-50'}`}><p className="text-[11px] text-slate-500">Estoque previsto</p><p className={`mt-2 text-xl font-extrabold lg:text-2xl ${estoqueAposMovimentacao < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{formatarNumero(quantidadeInformada > 0 ? estoqueAposMovimentacao : produtoSelecionado.estoqueAtual)}</p><p className="text-[11px] text-slate-400">unidades</p></div></div>
          <div className="space-y-3 py-5 text-sm"><div className="flex justify-between gap-3"><span className="text-slate-500">Quantidade</span><strong className="text-slate-800">{formatarNumero(quantidadeInformada)} un.</strong></div>{mostrarPreco && <><div className="flex justify-between gap-3"><span className="text-slate-500">Valor unitário calculado</span><strong className="text-slate-800">{formatarPrecoUnitario(precoEfetivo)}</strong></div><div className="flex justify-between gap-3 border-t border-slate-100 pt-3"><span className="text-slate-500">Valor líquido da venda</span><strong className="text-lg text-blue-600">{formatarMoeda(valorTotal)}</strong></div></>}</div>
          {mostrarPreco && <div className="flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-3 text-xs leading-relaxed text-slate-500"><Icone nome="escudo" size={18} className="shrink-0 text-blue-600"/>O valor líquido informado vale somente para esta saída. O valor unitário é calculado automaticamente dividindo o total pela quantidade, sem alterar o cadastro do produto.</div>}
          {ficaraAbaixoDoMinimo && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs font-medium text-amber-800">Atenção: a saída deixará o estoque abaixo do mínimo cadastrado.</p>}
        </> : <div className="mt-5 flex items-center gap-3 rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500"><Icone nome="caixa" size={24} className="shrink-0 text-blue-500"/>Selecione um produto para visualizar o estoque atual e a previsão da operação.</div>}
      </aside>

      <div className="order-2 min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:order-1 lg:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-base font-bold text-slate-900">Nova movimentação</h3><p className="mt-1 text-xs text-slate-400">Preencha os dados para atualizar o estoque</p></div></div>
        <div className="mt-5 grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
          {['entrada','saida'].map(tipo => <button type="button" key={tipo} onClick={() => atualizarCampo('tipo',tipo)} className={`flex items-center justify-center gap-2 rounded-lg px-3 py-3 text-sm font-semibold transition ${novaMovimentacao.tipo === tipo ? 'border border-slate-100 bg-white shadow-sm' : 'text-slate-500 hover:bg-white/60'} ${tipo === 'entrada' && novaMovimentacao.tipo === tipo ? 'text-emerald-600' : ''} ${tipo === 'saida' && novaMovimentacao.tipo === tipo ? 'text-rose-500' : ''}`}><Icone nome={tipo} size={18}/>{tipo === 'entrada' ? 'Entrada' : 'Saída'}</button>)}
        </div>
        <form onSubmit={(event) => { event.preventDefault(); if (!salvando) salvarMovimentacao() }} className="mt-5 space-y-4">
          <div><label className={rotulo}>Produto</label>{empresaEhSdPlasticos && !arquivamentoPronto && <p role="alert" className="mt-2 text-xs text-amber-700">Verificando produtos arquivados. Novos lançamentos estão temporariamente bloqueados.</p>}<div className="relative"><div className="pointer-events-none absolute left-3 top-[22px] text-slate-400"><Icone nome="caixa" size={18}/></div><input type="text" autoComplete="off" value={buscaProdutoMovimentacao} onChange={event => {setBuscaProdutoMovimentacao(event.target.value); atualizarCampo('produtoId',''); setMostrarSugestoesProduto(true)}} onFocus={()=>setMostrarSugestoesProduto(true)} placeholder="Selecione ou busque um produto" className={`${campo} pl-10 pr-10`}/><div className="pointer-events-none absolute right-3 top-[22px] text-slate-400"><Icone nome="chevron" size={17}/></div>{mostrarSugestoesProduto && <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">{produtosFiltradosMovimentacao.length ? produtosFiltradosMovimentacao.map(produto=><button type="button" key={produto.id} onClick={()=>selecionarProduto(produto)} className="w-full border-b border-slate-100 p-3 text-left last:border-0 hover:bg-blue-50"><p className="text-sm font-semibold text-slate-800">{produto.nome}</p><p className="text-xs text-slate-400">{produto.codigo || ''} · Estoque: {formatarNumero(produto.estoqueAtual)}</p></button>) : <p className="p-4 text-sm text-slate-500">Nenhum produto encontrado.</p>}</div>}</div></div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><div><label className={rotulo}>Quantidade</label><div className="relative"><input type="number" min="1" step="1" required value={novaMovimentacao.quantidade} onChange={event=>atualizarCampo('quantidade',event.target.value)} placeholder="0" className={`${campo} pr-12`}/><span className="pointer-events-none absolute right-4 top-[22px] text-xs text-slate-400">un.</span></div></div><div><label className={rotulo}>Data da movimentação</label><input type="date" required value={novaMovimentacao.data} onChange={event=>atualizarCampo('data',event.target.value)} className={campo}/></div></div>
          {novaMovimentacao.tipo === 'saida' && <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{empresaUsaCanalVenda && <div><label className={rotulo}>Canal de venda</label><div className="relative"><span className="pointer-events-none absolute left-3 top-[22px] text-slate-400"><Icone nome="carrinho" size={16}/></span><select value={novaMovimentacao.canalVenda} onChange={event=>atualizarCampo('canalVenda',event.target.value)} className={`${campo} pl-9`}><option value="">Sem canal</option>{canaisVenda.map(canal=><option key={canal.valor} value={canal.valor}>{canal.pai ? '↳ ' : ''}{canal.nome}</option>)}</select></div></div>}{empresaEhSdPlasticos && <div><label className={rotulo}>Valor líquido da venda (total) <span className="font-normal text-slate-400">Opcional</span></label><div className="relative"><span className="pointer-events-none absolute left-3 top-[22px] text-xs text-slate-400">R$</span><input type="text" inputMode="decimal" value={novaMovimentacao.valorLiquidoVenda} onChange={event=>atualizarCampo('valorLiquidoVenda',event.target.value)} placeholder={quantidadeInformada > 0 ? (quantidadeInformada * precoPadrao).toFixed(2).replace('.', ',') : '0,00'} className={`${campo} pl-10`}/></div><p className="mt-1 text-[11px] text-slate-400">Informe o total líquido recebido; o preço por peça será calculado automaticamente. Vazio usa o preço padrão do produto.</p></div>}</div>}
          <div><label className={rotulo}>Observação <span className="font-normal text-slate-400">Opcional</span></label><textarea rows={3} value={novaMovimentacao.observacao} onChange={event=>atualizarCampo('observacao',event.target.value)} placeholder="Adicione informações relevantes para esta movimentação..." className={`${campo} resize-y`}/></div>
          {saidaMaiorQueEstoque && <p className="rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700">A quantidade informada supera o estoque disponível.</p>}
          <button type="submit" disabled={salvando || saidaMaiorQueEstoque || !arquivamentoPronto} className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-blue-100 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"><Icone nome="check" size={18}/>{salvando ? 'Salvando…' : `Confirmar ${novaMovimentacao.tipo}`}</button>
        </form>
      </div>
    </div>

    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 px-5 py-5 lg:px-6"><div><h3 className="text-base font-bold text-slate-900">Histórico de movimentações</h3><p className="mt-1 text-xs text-slate-400">Acompanhe e filtre todas as operações</p></div><button type="button" onClick={()=>setFiltrosAvancados(!filtrosAvancados)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Icone nome="filtro" size={15}/>Filtros avançados</button></div>
      <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row lg:px-6"><div className="relative min-w-0 flex-1"><span className="pointer-events-none absolute left-3 top-3 text-slate-400"><Icone nome="busca" size={17}/></span><input value={buscaHistorico} onChange={event=>{setBuscaHistorico(event.target.value);setPaginaHistorico(1)}} placeholder="Buscar produto..." className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-500"/></div><select value={filtroTipo} onChange={event=>{setFiltroTipo(event.target.value);}} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700"><option value="">Todos os tipos</option><option value="entrada">Entradas</option><option value="saida">Saídas</option></select><button type="button" onClick={()=>{buscarHistoricoCompleto()}} disabled={carregandoHistoricoCompleto} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{carregandoHistoricoCompleto ? 'Buscando…' : 'Buscar histórico'}</button></div>
      {filtrosAvancados && <div className="grid grid-cols-1 gap-3 border-t border-slate-100 bg-slate-50/50 px-5 py-4 sm:grid-cols-2 lg:grid-cols-5 lg:px-6"><select value={filtroProduto} onChange={event=>setFiltroProduto(event.target.value)} className={campo}><option value="">Todos os produtos</option>{produtos.map(produto=><option key={produto.id} value={produto.id}>{produto.nome}</option>)}</select>{empresaUsaCanalVenda && <select value={filtroCanalVenda} onChange={event=>setFiltroCanalVenda(event.target.value)} className={campo}><option value="">Todos os canais</option>{canaisVenda.map(canal=><option key={canal.valor} value={canal.valor}>{canal.pai ? '↳ ' : ''}{canal.nome}</option>)}<option value="__sem_canal__">Não informado</option></select>}<input type="date" aria-label="Data inicial" value={dataInicial} onChange={event=>setDataInicial(event.target.value)} className={campo}/><input type="date" aria-label="Data final" value={dataFinal} onChange={event=>setDataFinal(event.target.value)} className={campo}/><button type="button" onClick={limparFiltrosHistorico} className="mt-2 rounded-xl bg-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700">Limpar filtros</button>{filtroCanalVenda && filtroTipo === 'entrada' && <p className="col-span-full text-xs text-amber-700">Canais de venda se aplicam somente às saídas.</p>}</div>}
      {(carregandoMovimentacoes || carregandoHistoricoCompleto) ? <p className="p-8 text-center text-sm text-slate-500">Carregando movimentações…</p> : <HistoricoTabela empresaEhSdPlasticos={empresaEhSdPlasticos} empresaUsaCanalVenda={empresaUsaCanalVenda} listaPagina={listaPagina} precosHistoricoRecente={precosHistoricoRecente} dataLegivel={dataLegivel} formatarNumero={formatarNumero} formatarCanalVenda={formatarCanalVenda} formatarPrecoUnitario={formatarPrecoUnitario} estornandoId={estornandoId} onEstornar={estornarMovimentacao}/>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 lg:px-6"><p className="text-xs text-slate-400">{historicoBuscado ? `Exibindo até 100 registros da busca · ${historicoFiltrado.length} carregados` : `Últimas ${historicoFiltrado.length} movimentações · use Buscar histórico para mais registros`}</p><div className="flex items-center gap-1"><button type="button" disabled={paginaAtual <= 1} onClick={()=>setPaginaHistorico(paginaAtual-1)} className="rounded-lg border border-slate-200 p-2 disabled:opacity-40"><Icone nome="esquerda" size={16}/></button>{Array.from({length: Math.min(paginas,5)},(_,i)=>i+1).map(pagina=><button key={pagina} type="button" onClick={()=>setPaginaHistorico(pagina)} className={`h-8 w-8 rounded-lg text-xs font-semibold ${pagina === paginaAtual ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>{pagina}</button>)}<button type="button" disabled={paginaAtual >= paginas} onClick={()=>setPaginaHistorico(paginaAtual+1)} className="rounded-lg border border-slate-200 p-2 disabled:opacity-40"><Icone nome="direita" size={16}/></button></div></div>
    </div>
    </>}
  </section>
}

export default Movimentacoes
