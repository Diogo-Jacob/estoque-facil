import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Area, AreaChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { supabase } from '../services/supabase'

const CORES = ['#315CF5', '#12B8A6', '#F59E0B', '#8955FA', '#94A3B8', '#EF6680', '#0EA5E9']
const CATEGORIAS = [
  'Matérias-primas', 'Fretes e transportes', 'Manutenção', 'Embalagens',
  'Energia elétrica', 'Aluguel', 'Água', 'Internet', 'Operacionais', 'Outras',
]
const FORMAS = ['PIX', 'Boleto', 'Transferência', 'Dinheiro', 'Cartão de crédito', 'Cartão de débito', 'Outro']
const MOEDA = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const NUMERO = new Intl.NumberFormat('pt-BR')
const DATA = new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' })

function hojeLocal() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
function inicioMes() { return `${hojeLocal().slice(0, 7)}-01` }
function primeiroDiaMesAnterior() {
  const [a, m] = hojeLocal().slice(0, 7).split('-').map(Number)
  const d = new Date(a, m - 2, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}
function mesReferencia(offset) {
  const d = new Date()
  d.setDate(1)
  d.setMonth(d.getMonth() + offset)
  const a = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0')
  return { chave: `${a}-${m}`, label: d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '') }
}
function formatarData(s) {
  if (!s) return '—'
  return DATA.format(new Date(`${s}T12:00:00Z`))
}
function parseValor(valor) {
  const texto = String(valor ?? '').trim()
  if (!texto) return NaN
  const normalizado = texto.includes(',') ? texto.replace(/\./g, '').replace(',', '.') : texto
  return Number(normalizado)
}
function Icone({ nome, tamanho = 19, className = '' }) {
  const paths = {
    adicionar: <path d="M12 5v14M5 12h14" />,
    filtro: <path d="M4 5h16l-6.5 8v6l-3 2v-8L4 5Z" />,
    carteira: <><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 9h16M8 3h10"/></>,
    categoria: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
    tendencia: <path d="m3 6 7 7 4-4 7 7M16 16h5v-5" />,
    editar: <><path d="m15 5 4 4M4 20l4.5-1 11-11a2.8 2.8 0 0 0-4-4l-11 11L4 20Z" /></>,
    excluir: <><path d="M4 7h16M10 3h4M6 7l1 14h10l1-14M10 11v6M14 11v6" /></>,
    fechar: <path d="M5 5l14 14M19 5 5 19" />,
    calendario: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4M17 3v4M3 10h18" /></>,
    buscar: <><circle cx="10.5" cy="10.5" r="6.5"/><path d="m16 16 5 5"/></>,
  }
  return <svg className={className} width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[nome] || paths.categoria}</svg>
}
function Card({ children, className = '' }) {
  return <section className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>{children}</section>
}
const VAZIO = {
  descricao: '', categoria: 'Operacionais', valor: '', data_despesa: hojeLocal(),
  data_vencimento: '', data_pagamento: '', status: 'pendente',
  forma_pagamento: '', observacao: '',
}

/** Página restrita à SD Plásticos (a autorização real é aplicada pelo RLS). */
export default function Despesas({ empresaAtiva }) {
  const sd = empresaAtiva?.nome?.trim().toLocaleLowerCase('pt-BR') === 'sd plásticos'
  const empresaId = empresaAtiva?.id
  const [registros, setRegistros] = useState([])
  const [carregando, setCarregando] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')
  const [aviso, setAviso] = useState('')
  const [modal, setModal] = useState(false)
  const [editandoId, setEditandoId] = useState(null)
  const [form, setForm] = useState({ ...VAZIO })
  const [filtrar, setFiltrar] = useState(false)
  const [inicio, setInicio] = useState(inicioMes())
  const [fim, setFim] = useState(hojeLocal())
  const [busca, setBusca] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState('')
  const [statusFiltro, setStatusFiltro] = useState('')
  const [pagina, setPagina] = useState(1)
  const requisicaoAtual = useRef(0)

  // Cada consulta recebe um identificador, para ignorar respostas antigas
  // se a empresa mudar ou o componente for desmontado.
  const carregar = useCallback(async () => {
    const requisicao = ++requisicaoAtual.current
    if (!sd || !empresaId) {
      setRegistros([])
      setCarregando(false)
      return
    }

    setCarregando(true)
    setErro('')
    try {
      const acumulado = []
      const tamanho = 800
      for (let pos = 0; ; pos += tamanho) {
        const { data, error } = await supabase.from('despesas')
          .select('id,empresa_id,descricao,categoria,valor,data_despesa,data_vencimento,data_pagamento,status,forma_pagamento,observacao,criada_em')
          .eq('empresa_id', empresaId)
          .order('data_despesa', { ascending: false })
          .order('criada_em', { ascending: false })
          .range(pos, pos + tamanho - 1)
        if (requisicao !== requisicaoAtual.current) return
        if (error) throw error
        acumulado.push(...(data || []))
        if (!data || data.length < tamanho) break
      }
      if (requisicao === requisicaoAtual.current) setRegistros(acumulado)
    } catch (e) {
      if (requisicao === requisicaoAtual.current) {
        setErro(`Não foi possível carregar as despesas: ${e.message || 'erro inesperado'}`)
      }
    } finally {
      if (requisicao === requisicaoAtual.current) setCarregando(false)
    }
  }, [empresaId, sd])

  useEffect(() => {
    let ativo = true
    // Agenda o carregamento fora da execução síncrona do efeito.
    void Promise.resolve().then(() => {
      if (!ativo) return
      setAviso('')
      setErro('')
      setRegistros([])
      void carregar()
    })
    return () => {
      ativo = false
      requisicaoAtual.current += 1
    }
  }, [carregar])

  // A paginação volta à primeira página diretamente quando o filtro muda.
  function mudarFiltro(alterar, valor) {
    alterar(valor)
    setPagina(1)
  }

  const filtrados = useMemo(() => registros.filter(r => {
    const texto = busca.toLocaleLowerCase('pt-BR').trim()
    return (!inicio || r.data_despesa >= inicio) && (!fim || r.data_despesa <= fim) &&
      (!categoriaFiltro || r.categoria === categoriaFiltro) &&
      (!statusFiltro || r.status === statusFiltro) &&
      (!texto || `${r.descricao} ${r.categoria} ${r.observacao || ''}`.toLocaleLowerCase('pt-BR').includes(texto))
  }), [registros, inicio, fim, busca, categoriaFiltro, statusFiltro])

  const total = filtrados.reduce((s, r) => s + Number(r.valor || 0), 0)
  const categorias = useMemo(() => {
    const soma = new Map()
    filtrados.forEach(r => soma.set(r.categoria, (soma.get(r.categoria) || 0) + Number(r.valor || 0)))
    return [...soma].map(([nome, valor]) => ({ nome, valor })).sort((a, b) => b.valor - a.valor)
  }, [filtrados])
  const maior = categorias[0]
  const distribuicao = categorias.map((c, i) => ({ ...c, cor: CORES[i % CORES.length] }))
  const serieMensal = useMemo(() => Array.from({ length: 6 }, (_, i) => {
    const mes = mesReferencia(i - 5)
    return { mes: mes.label, chave: mes.chave,
      valor: registros.filter(r => r.data_despesa?.startsWith(mes.chave)).reduce((s, r) => s + Number(r.valor || 0), 0) }
  }), [registros])
  const atual = registros.filter(r => r.data_despesa?.startsWith(hojeLocal().slice(0, 7))).reduce((s, r) => s + Number(r.valor || 0), 0)
  const anterior = registros.filter(r => r.data_despesa?.startsWith(primeiroDiaMesAnterior().slice(0, 7))).reduce((s, r) => s + Number(r.valor || 0), 0)
  const variacao = anterior > 0 ? ((atual - anterior) / anterior) * 100 : null
  const diferenca = atual - anterior
  const POR_PAGINA = 10
  const paginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA))
  const paginaAtual = Math.min(pagina, paginas)
  const linhas = filtrados.slice((paginaAtual - 1) * POR_PAGINA, paginaAtual * POR_PAGINA)

  function novo() { setEditandoId(null); setForm({ ...VAZIO, data_despesa: hojeLocal() }); setErro(''); setModal(true) }
  function editar(r) {
    setEditandoId(r.id)
    setForm({ descricao: r.descricao, categoria: r.categoria, valor: String(r.valor),
      data_despesa: r.data_despesa, data_vencimento: r.data_vencimento || '',
      data_pagamento: r.data_pagamento || '', status: r.status,
      forma_pagamento: r.forma_pagamento || '', observacao: r.observacao || '' })
    setErro(''); setModal(true)
  }
  function atualizarStatus(status) {
    setForm(f => ({ ...f, status,
      data_pagamento: status === 'paga' ? (f.data_pagamento || hojeLocal()) : '' }))
  }
  async function salvar(e) {
    e.preventDefault()
    if (!sd || !empresaId || salvando) return
    const valor = parseValor(form.valor)
    if (!form.descricao.trim() || !form.categoria.trim() || !Number.isFinite(valor) || valor <= 0 || !form.data_despesa) {
      setErro('Informe descrição, categoria, data e um valor maior que zero.'); return
    }
    if (Math.round(valor * 100) !== valor * 100 && Math.abs(Math.round(valor * 100) - valor * 100) > 0.000001) {
      setErro('Informe o valor da despesa com no máximo duas casas decimais.'); return
    }
    if (form.status === 'paga' && !form.data_pagamento) { setErro('Informe a data do pagamento.'); return }
    const payload = {
      descricao: form.descricao.trim(), categoria: form.categoria.trim(), valor: Number(valor.toFixed(2)),
      data_despesa: form.data_despesa, data_vencimento: form.data_vencimento || null,
      data_pagamento: form.status === 'paga' ? form.data_pagamento : null,
      status: form.status, forma_pagamento: form.forma_pagamento || null,
      observacao: form.observacao.trim() || null,
    }
    setSalvando(true); setErro('')
    try {
      if (editandoId) {
        const { data, error } = await supabase.from('despesas').update(payload)
          .eq('id', editandoId).eq('empresa_id', empresaId).select('id')
        if (error) throw error
        if (!data?.length) throw new Error('A despesa não foi alterada. Verifique suas permissões.')
      } else {
        const { data: authData, error: authError } = await supabase.auth.getUser()
        if (authError || !authData?.user?.id) throw new Error('Sua sessão expirou. Entre novamente.')
        const { data, error } = await supabase.from('despesas')
          .insert({ ...payload, empresa_id: empresaId, criado_por: authData.user.id }).select('id')
        if (error) throw error
        if (!data?.length) throw new Error('Não foi possível confirmar o cadastro.')
      }
      setModal(false); setAviso(editandoId ? 'Despesa atualizada com sucesso.' : 'Despesa cadastrada com sucesso.')
      await carregar()
    } catch (err) { setErro(err.message || 'Não foi possível salvar a despesa.') }
    finally { setSalvando(false) }
  }
  async function excluir(r) {
    if (!window.confirm(`Excluir a despesa "${r.descricao}" (${MOEDA.format(Number(r.valor))})? Esta ação não poderá ser desfeita.`)) return
    setErro(''); setAviso('')
    try {
      const { data, error } = await supabase.from('despesas').delete()
        .eq('id', r.id).eq('empresa_id', empresaId).select('id')
      if (error) throw error
      if (!data?.length) throw new Error('A despesa não foi excluída. Verifique suas permissões.')
      setAviso('Despesa excluída.'); await carregar()
    } catch (err) { setErro(err.message || 'Não foi possível excluir.') }
  }

  if (!sd) return <div className="rounded-2xl border border-slate-200 bg-white p-8 text-slate-700">O módulo Despesas está disponível somente para a SD Plásticos.</div>

  const campo = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
  return (
    <div className="w-full space-y-5 pb-10 text-slate-900">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="min-w-0">
          <div className="mb-1 text-[10px] font-extrabold uppercase tracking-[.24em] text-blue-600">Controle financeiro</div>
          <h1 className="text-3xl font-bold tracking-tight">Despesas</h1>
          <p className="mt-1 text-sm text-slate-500">Acompanhe os gastos operacionais e a evolução financeira.</p>
        </div>
        <button type="button" onClick={novo} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#315CF5] px-5 py-3 text-sm font-semibold text-white shadow-md shadow-blue-100 hover:bg-blue-700">
          <Icone nome="adicionar" /> Nova despesa
        </button>
      </header>
      {aviso && <div role="status" className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">{aviso}</div>}
      {erro && !modal && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">{erro}</div>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <Card className="flex min-h-[148px] items-start gap-4 p-5">
          <span className="rounded-xl bg-rose-50 p-3 text-rose-500"><Icone nome="carteira" tamanho={22}/></span>
          <div><p className="text-xs text-slate-500">Despesas no período</p><p className="mt-2 text-2xl font-bold">{MOEDA.format(total)}</p><p className="mt-3 text-xs text-slate-400">{NUMERO.format(filtrados.length)} lançamentos</p></div>
        </Card>
        <Card className="flex min-h-[148px] items-start gap-4 p-5">
          <span className="rounded-xl bg-amber-50 p-3 text-amber-500"><Icone nome="categoria" tamanho={22}/></span>
          <div className="min-w-0"><p className="text-xs text-slate-500">Maior categoria</p><p className="mt-2 text-2xl font-bold">{MOEDA.format(maior?.valor || 0)}</p><p className="mt-3 truncate text-xs text-slate-400">{maior ? `${maior.nome} · ${total ? (maior.valor / total * 100).toFixed(1).replace('.', ',') : 0}%` : 'Sem lançamentos no período'}</p></div>
        </Card>
        <Card className="flex min-h-[148px] items-start gap-4 p-5">
          <span className="rounded-xl bg-emerald-50 p-3 text-emerald-500"><Icone nome="tendencia" tamanho={22}/></span>
          <div><p className="text-xs text-slate-500">Variação mensal</p><p className="mt-2 text-2xl font-bold">{variacao == null ? '—' : `${variacao > 0 ? '+' : ''}${variacao.toFixed(1).replace('.', ',')}%`}</p><p className="mt-3 text-xs text-slate-400">{variacao == null ? 'Sem base no mês anterior' : `${MOEDA.format(Math.abs(diferenca))} ${diferenca < 0 ? 'abaixo' : 'acima'} do mês anterior`}</p></div>
        </Card>
      </div>

      <div className="grid grid-cols-1 items-stretch gap-4 xl:grid-cols-2">
        <Card className="p-5">
          <h2 className="text-base font-bold">Distribuição de gastos</h2>
          <p className="mt-1 text-xs text-slate-400">Por categoria no período selecionado</p>
          {distribuicao.length ? <div className="mt-5 flex flex-col items-center gap-3 sm:flex-row">
            <div className="relative h-56 w-full shrink-0 sm:w-[52%]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart><Pie data={distribuicao} dataKey="valor" nameKey="nome" cx="50%" cy="50%" innerRadius="60%" outerRadius="83%" paddingAngle={0} stroke="none">
                  {distribuicao.map((r, i) => <Cell key={r.nome} fill={CORES[i % CORES.length]}/>)}</Pie>
                  <Tooltip formatter={v => MOEDA.format(Number(v))}/>
                </PieChart>
              </ResponsiveContainer>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center"><strong className="text-base font-extrabold sm:text-lg">{MOEDA.format(total)}</strong><span className="text-xs text-slate-400">Total</span></div>
            </div>
            <div className="w-full min-w-0 flex-1 space-y-3">
              {distribuicao.map(c => <div key={c.nome} className="flex items-start gap-2 text-xs"><span className="mt-1 h-2 w-2 shrink-0 rounded-sm" style={{ backgroundColor: c.cor }}/><span className="min-w-0 flex-1 text-slate-600">{c.nome}</span><strong className="text-slate-800">{total ? `${(c.valor / total * 100).toFixed(1).replace('.', ',')}%` : '0%'}</strong></div>)}
            </div>
          </div> : <p className="py-16 text-center text-sm text-slate-400">Nenhuma despesa encontrada neste período.</p>}
        </Card>
        <Card className="p-5">
          <h2 className="text-base font-bold">Evolução de despesas</h2><p className="mt-1 text-xs text-slate-400">Últimos seis meses · todas as categorias</p>
          <div className="mt-8 h-[240px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={serieMensal} margin={{ top: 10, right: 4, left: -18, bottom: 0 }}>
                <defs><linearGradient id="gradient-despesas" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#315CF5" stopOpacity={0.23}/><stop offset="100%" stopColor="#315CF5" stopOpacity={0}/></linearGradient></defs>
                <CartesianGrid stroke="#EDF2F7" vertical={false}/>
                <XAxis dataKey="mes" tickLine={false} axisLine={false} fontSize={11} tick={{ fill: '#94A3B8' }}/>
                <YAxis tickLine={false} axisLine={false} fontSize={10} tick={{ fill: '#94A3B8' }} tickFormatter={v => v >= 1000 ? `${Math.round(v / 1000)} mil` : String(v)}/>
                <Tooltip formatter={v => [MOEDA.format(Number(v)), 'Despesas']} labelFormatter={(x, items) => items?.[0]?.payload?.chave || x}/>
                <Area type="monotone" dataKey="valor" stroke="#315CF5" strokeWidth={3} fill="url(#gradient-despesas)"/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div><h2 className="text-base font-bold">Lançamentos recentes</h2><p className="mt-1 text-xs text-slate-400">Despesas registradas no período</p></div>
          <button type="button" onClick={() => setFiltrar(v => !v)} aria-expanded={filtrar} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold hover:bg-slate-50"><Icone nome="filtro" tamanho={17}/> Filtrar</button>
        </div>
        {filtrar && <div className="grid grid-cols-1 gap-3 border-b border-slate-100 bg-slate-50/50 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <label className="text-xs font-semibold">De<input className={`${campo} mt-1`} type="date" value={inicio} onChange={e => mudarFiltro(setInicio, e.target.value)}/></label>
          <label className="text-xs font-semibold">Até<input className={`${campo} mt-1`} type="date" value={fim} onChange={e => mudarFiltro(setFim, e.target.value)}/></label>
          <label className="text-xs font-semibold">Categoria<select className={`${campo} mt-1`} value={categoriaFiltro} onChange={e => mudarFiltro(setCategoriaFiltro, e.target.value)}><option value="">Todas</option>{[...new Set([...CATEGORIAS, ...registros.map(r => r.categoria)])].map(c => <option key={c}>{c}</option>)}</select></label>
          <label className="text-xs font-semibold">Status<select className={`${campo} mt-1`} value={statusFiltro} onChange={e => mudarFiltro(setStatusFiltro, e.target.value)}><option value="">Todos</option><option value="paga">Paga</option><option value="pendente">Pendente</option></select></label>
          <label className="text-xs font-semibold">Buscar<div className="relative mt-1"><Icone nome="buscar" tamanho={16} className="absolute left-3 top-3 text-slate-400"/><input className={`${campo} pl-9`} placeholder="Descrição..." value={busca} onChange={e => mudarFiltro(setBusca, e.target.value)}/></div></label>
          <div className="lg:col-span-5"><button className="text-xs font-semibold text-blue-600 hover:underline" type="button" onClick={() => { setInicio(inicioMes()); setFim(hojeLocal()); setBusca(''); setCategoriaFiltro(''); setStatusFiltro(''); setPagina(1) }}>Limpar filtros</button></div>
        </div>}
        <div className="w-full overflow-x-auto">
          <table className="w-full min-w-[690px] text-left text-sm">
            <thead className="bg-slate-50 text-[10px] uppercase tracking-wide text-slate-400"><tr><th className="px-5 py-4">Data</th><th className="px-5 py-4">Descrição</th><th className="px-5 py-4">Categoria</th><th className="px-5 py-4">Valor</th><th className="px-5 py-4">Status</th><th className="px-5 py-4 text-right">Ações</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {linhas.map(r => <tr key={r.id} className="hover:bg-slate-50/70"><td className="whitespace-nowrap px-5 py-4 text-xs text-slate-500">{formatarData(r.data_despesa)}</td><td className="max-w-[300px] px-5 py-4 font-semibold text-slate-800">{r.descricao}</td><td className="px-5 py-4 text-xs text-slate-500">{r.categoria}</td><td className="whitespace-nowrap px-5 py-4 font-bold">{MOEDA.format(Number(r.valor))}</td><td className="px-5 py-4"><span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${r.status === 'paga' ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>{r.status === 'paga' ? 'Paga' : 'Pendente'}</span></td><td className="px-5 py-4"><div className="flex justify-end gap-2"><button type="button" title="Editar despesa" aria-label={`Editar ${r.descricao}`} onClick={() => editar(r)} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:text-blue-600"><Icone nome="editar" tamanho={16}/></button><button type="button" title="Excluir despesa" aria-label={`Excluir ${r.descricao}`} onClick={() => excluir(r)} className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:text-red-600"><Icone nome="excluir" tamanho={16}/></button></div></td></tr>)}
              {!linhas.length && <tr><td colSpan={6} className="py-14 text-center text-sm text-slate-400">{carregando ? 'Carregando despesas...' : 'Nenhuma despesa encontrada.'}</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 text-xs text-slate-500"><span>{NUMERO.format(filtrados.length)} lançamentos · página {paginaAtual} de {paginas}</span><div className="flex gap-2"><button className="rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-30" disabled={paginaAtual <= 1} onClick={() => setPagina(p => Math.max(1, p - 1))}>Anterior</button><button className="rounded-lg border border-slate-200 px-3 py-2 disabled:opacity-30" disabled={paginaAtual >= paginas} onClick={() => setPagina(p => Math.min(paginas, p + 1))}>Próxima</button></div></div>
      </Card>

      {modal && <div className="fixed inset-0 z-[100] flex items-center justify-center overflow-y-auto bg-slate-900/50 p-3 sm:p-6" onMouseDown={e => { if (e.target === e.currentTarget && !salvando) setModal(false) }}>
        <div role="dialog" aria-modal="true" aria-label={editandoId ? 'Editar despesa' : 'Nova despesa'} className="my-auto w-full max-w-xl rounded-2xl bg-white p-5 shadow-2xl sm:p-7">
          <div className="mb-5 flex items-center justify-between"><div><h2 className="text-xl font-bold">{editandoId ? 'Editar despesa' : 'Nova despesa'}</h2><p className="mt-1 text-xs text-slate-500">Preencha as informações financeiras.</p></div><button type="button" onClick={() => setModal(false)} disabled={salvando} className="rounded-lg p-2 hover:bg-slate-100"><Icone nome="fechar"/></button></div>
          <form onSubmit={salvar} className="space-y-4">
            <label className="block text-xs font-semibold">Descrição *<input required className={`${campo} mt-1`} maxLength={200} value={form.descricao} onChange={e => setForm(f => ({ ...f, descricao: e.target.value }))} placeholder="Ex.: Energia elétrica da fábrica"/></label>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><label className="text-xs font-semibold">Categoria *<select className={`${campo} mt-1`} value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>{CATEGORIAS.map(c => <option key={c}>{c}</option>)}</select></label><label className="text-xs font-semibold">Valor (R$) *<input className={`${campo} mt-1`} required type="text" inputMode="decimal" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} placeholder="0,00" /></label></div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><label className="text-xs font-semibold">Data da despesa *<input className={`${campo} mt-1`} required type="date" value={form.data_despesa} onChange={e => setForm(f => ({ ...f, data_despesa: e.target.value }))}/></label><label className="text-xs font-semibold">Vencimento<input className={`${campo} mt-1`} type="date" value={form.data_vencimento} onChange={e => setForm(f => ({ ...f, data_vencimento: e.target.value }))}/></label></div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><label className="text-xs font-semibold">Situação<select className={`${campo} mt-1`} value={form.status} onChange={e => atualizarStatus(e.target.value)}><option value="pendente">Pendente</option><option value="paga">Paga</option></select></label><label className="text-xs font-semibold">Data do pagamento {form.status === 'paga' ? '*' : ''}<input className={`${campo} mt-1`} type="date" disabled={form.status !== 'paga'} required={form.status === 'paga'} value={form.data_pagamento} onChange={e => setForm(f => ({ ...f, data_pagamento: e.target.value }))}/></label></div>
            <label className="block text-xs font-semibold">Forma de pagamento<select className={`${campo} mt-1`} value={form.forma_pagamento} onChange={e => setForm(f => ({ ...f, forma_pagamento: e.target.value }))}><option value="">Não informado</option>{FORMAS.map(x => <option key={x}>{x}</option>)}</select></label>
            <label className="block text-xs font-semibold">Observações<textarea className={`${campo} mt-1 min-h-[72px]`} value={form.observacao} onChange={e => setForm(f => ({ ...f, observacao: e.target.value }))} placeholder="Informações opcionais"/></label>
            {erro && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end"><button type="button" onClick={() => setModal(false)} disabled={salvando} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold">Cancelar</button><button type="submit" disabled={salvando} className="rounded-xl bg-[#315CF5] px-6 py-3 text-sm font-semibold text-white disabled:opacity-60">{salvando ? 'Salvando...' : editandoId ? 'Salvar alterações' : 'Cadastrar despesa'}</button></div>
          </form>
        </div>
      </div>}
    </div>
  )
}
