import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Area, AreaChart, CartesianGrid, Cell, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { supabase } from '../services/supabase'

const CORES = ['#315CF5', '#12B8A6', '#F59E0B', '#8955FA', '#94A3B8', '#EF6680', '#0EA5E9']
const CATEGORIAS = [
  'Matérias-primas', 'Fretes e transportes', 'Manutenção', 'Embalagens',
  'Energia elétrica', 'Aluguel', 'Água', 'Internet', 'Folha de pagamento', 'Operacionais', 'Outras',
]
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

function escaparHtml(valor) {
  return String(valor ?? '').replace(/[&<>"']/g, caractere => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[caractere])
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
    imprimir: <><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><path d="M6 14h12v7H6zM18 12h.01"/></>,
  }
  return <svg className={className} width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[nome] || paths.categoria}</svg>
}
function Card({ children, className = '' }) {
  return <section className={`rounded-2xl border border-slate-200 bg-white shadow-sm ${className}`}>{children}</section>
}
const VAZIO = { descricao: '', categoria: 'Operacionais', valor: '', data_despesa: hojeLocal() }

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
    setForm({ descricao: r.descricao, categoria: r.categoria, valor: String(r.valor), data_despesa: r.data_despesa })
    setErro(''); setModal(true)
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
    // Nas edições, preservar campos históricos que não aparecem mais no formulário.
    const payload = {
      descricao: form.descricao.trim(), categoria: form.categoria.trim(),
      valor: Number(valor.toFixed(2)), data_despesa: form.data_despesa,
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
          .insert({ ...payload, empresa_id: empresaId, criado_por: authData.user.id, status: 'paga', data_pagamento: form.data_despesa }).select('id')
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

  function imprimirRelatorio() {
    setErro('')
    if (carregando) {
      setErro('Aguarde o carregamento das despesas antes de imprimir.')
      return
    }
    if (inicio && fim && inicio > fim) {
      setErro('A data inicial não pode ser posterior à data final.')
      return
    }
    if (!filtrados.length) {
      setErro('Não há despesas para imprimir com os filtros selecionados.')
      return
    }

    // Todos os lançamentos filtrados entram no documento, independentemente da paginação.
    const categoriasRelatorio = [...categorias]
    const coresCategorias = categoriasRelatorio.map((_, i) => CORES[i % CORES.length])
    const maiorCategoria = categoriasRelatorio[0]
    let acumuladoPercentual = 0
    const fatias = categoriasRelatorio.map((item, i) => {
      const inicioFatia = acumuladoPercentual
      acumuladoPercentual += total > 0 ? item.valor / total * 100 : 0
      return `${coresCategorias[i]} ${inicioFatia.toFixed(5)}% ${acumuladoPercentual.toFixed(5)}%`
    }).join(', ')
    const fundoRosca = fatias ? `conic-gradient(${fatias})` : '#e9eef6'
    const resumoFiltros = [
      `Período: ${inicio ? formatarData(inicio) : 'início'} a ${fim ? formatarData(fim) : 'hoje'}`,
      `Categoria: ${categoriaFiltro || 'Todas'}`,
      `Situação: ${statusFiltro === 'paga' ? 'Paga' : statusFiltro === 'pendente' ? 'Pendente' : 'Todas'}`,
      ...(busca.trim() ? [`Busca: ${busca.trim()}`] : []),
    ]
    const linhasRelatorio = filtrados.map((r, indice) => `
      <tr>
        <td class="indice">${indice + 1}</td>
        <td class="nowrap">${escaparHtml(formatarData(r.data_despesa))}</td>
        <td class="descricao">${escaparHtml(r.descricao)}</td>
        <td>${escaparHtml(r.categoria)}</td>
        <td class="valor">${escaparHtml(MOEDA.format(Number(r.valor || 0)))}</td>
      </tr>`).join('')

    // O mesmo agrupamento por categoria mostrado no painel alimenta o gráfico impresso.
    // Barras em HTML/CSS imprimem sem dependências externas e não exigem canvas.
    const linhasGrafico = categoriasRelatorio.map((item, i) => {
      const percentual = total > 0 ? item.valor / total * 100 : 0
      return `<div class="grafico-linha">
        <div class="grafico-info"><span class="nome-categoria"><i style="background:${coresCategorias[i]}"></i>${escaparHtml(item.nome)}</span>
          <strong>${escaparHtml(MOEDA.format(item.valor))}<em>${percentual.toFixed(1).replace('.', ',')}%</em></strong></div>
        <div class="trilho"><div class="barra" style="width:${Math.min(100, Math.max(0, percentual))}%;background:${coresCategorias[i]}"></div></div>
      </div>`
    }).join('')

    const janela = window.open('', '_blank')
    if (!janela) {
      setErro('O navegador bloqueou a janela de impressão. Permita pop-ups para este site e tente novamente.')
      return
    }

    const conteudo = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Relatório de despesas — ${escaparHtml(empresaAtiva?.nome || 'SD Plásticos')}</title>
<style>
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  body { margin: 0; padding: 30px; font: 12px/1.5 'Segoe UI', Arial, sans-serif; color: #16233b; background: #f2f5fb; }
  .pagina { max-width: 1160px; margin: 0 auto; padding: 30px 34px; background: white; border-radius: 18px; box-shadow: 0 14px 50px #172a4b13; }
  .acoes { max-width: 1160px; margin: 0 auto 16px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
  .acoes button { border: 0; border-radius: 10px; padding: 12px 20px; font-weight: 700; color: white; background: #315cf5; cursor: pointer; }
  .acoes span { font-size: 12px; color: #56657a; }
  .topo { display: flex; justify-content: space-between; gap: 24px; align-items: flex-start; padding-bottom: 22px; border-bottom: 2px solid #e7edff; }
  .empresa { display: inline-flex; color: #315cf5; font-size: 11px; font-weight: 800; letter-spacing: 2px; text-transform: uppercase; }
  .marca { display: inline-block; width: 10px; height: 10px; border-radius: 3px; margin-right: 9px; background: #315cf5; }
  h1 { font-size: 27px; line-height: 1.15; letter-spacing: -.8px; margin: 9px 0 8px; }
  .subtitulo { color: #697b93; font-size: 12px; }
  .emissao { flex: none; text-align: right; font-size: 10px; color: #7c8aa1; }
  .emissao strong { display: block; color: #3b4a61; margin-top: 3px; font-size: 12px; }
  .filtros { display: flex; flex-wrap: wrap; gap: 7px; margin: 17px 0; }
  .filtros span { border: 1px solid #e4eaf5; border-radius: 20px; padding: 6px 11px; background: #f8faff; color: #4e5e77; font-size: 10px; }
  .resumo { display: grid; grid-template-columns: 1.2fr 1fr 1fr; gap: 12px; margin: 20px 0 24px; }
  .indicador { padding: 17px 18px; border-radius: 12px; border: 1px solid #e7ebf3; background: #fafcff; }
  .indicador.destaque { background: #315cf5; border-color: #315cf5; color: white; }
  .indicador small { display: block; font-size: 10px; opacity: .76; margin-bottom: 5px; }
  .indicador strong { display: block; font-size: 21px; letter-spacing: -.4px; white-space: nowrap; }
  .indicador:not(.destaque) strong { color: #182a47; }
  .secao { margin-top: 24px; }
  .secao-titulo { display: flex; justify-content: space-between; align-items: baseline; gap: 20px; border-bottom: 1px solid #e9eef6; margin-bottom: 16px; padding-bottom: 10px; }
  h2 { margin: 0; font-size: 15px; letter-spacing: -.2px; }
  .secao-titulo p { margin: 0; color: #8290a3; font-size: 10px; }
  .grafico { display: grid; grid-template-columns: 220px 1fr; align-items: center; gap: 28px; }
  .rosca { width: 190px; height: 190px; border-radius: 50%; position: relative; margin: 0 auto; }
  .rosca-centro { position: absolute; inset: 29px; background: white; border-radius: 50%; display: flex; flex-direction: column; align-items: center; justify-content: center; box-shadow: 0 0 0 1px #f1f4f9; }
  .rosca-centro small { color: #8290a3; font-size: 10px; }
  .rosca-centro strong { font-size: 14px; letter-spacing: -.2px; }
  @media (max-width: 600px) { .grafico { grid-template-columns: 1fr; } }
  .grafico-linha { margin-bottom: 2px; break-inside: avoid; page-break-inside: avoid; }
  .grafico-info { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 6px; font-size: 11px; }
  .grafico-info strong { font-size: 11px; white-space: nowrap; }
  .grafico-info em { font-weight: 500; font-style: normal; color: #8391a6; padding-left: 12px; }
  .nome-categoria { display: flex; align-items: center; gap: 7px; }
  .nome-categoria i { width: 9px; height: 9px; display: inline-block; border-radius: 3px; }
  .trilho { height: 10px; border-radius: 10px; background: #ecf1f8; overflow: hidden; }
  .barra { height: 100%; border-radius: 10px; min-width: 2px; }
  table { width: 100%; border-collapse: collapse; font-size: 11px; table-layout: fixed; }
  thead { display: table-header-group; }
  th { padding: 12px 12px; background: #eef3ff; color: #435671; text-transform: uppercase; letter-spacing: .5px; font-size: 9px; text-align: left; }
  th:first-child { border-radius: 7px 0 0 7px; }
  th:last-child { border-radius: 0 7px 7px 0; }
  td { padding: 11px 12px; border-bottom: 1px solid #e9eef6; vertical-align: top; overflow-wrap: anywhere; }
  tbody tr:nth-child(even) { background: #f9fbfe; }
  tr { break-inside: avoid; page-break-inside: avoid; }
  .nowrap { white-space: nowrap; }
  .indice { color: #8997ac; width: 5%; }
  .descricao { font-weight: 650; }
  .valor { text-align: right; white-space: nowrap; font-weight: 700; }
  tfoot td { background: #eef3ff; font-weight: 800; border-top: 2px solid #dae5ff; }
  .rodape { margin-top: 24px; padding-top: 12px; border-top: 1px solid #e8edf5; color: #7c8ba0; font-size: 10px; display: flex; justify-content: space-between; }
  @page { size: A4 portrait; margin: 13mm 12mm; }
  @media print {
    body { background: white; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .pagina { padding: 0; max-width: none; box-shadow: none; border-radius: 0; }
    .acoes { display: none; }
    .resumo, .topo, .secao-titulo { break-inside: avoid; page-break-inside: avoid; }
    .secao { break-inside: auto; }
    .grafico { break-inside: avoid; page-break-inside: avoid; }
  }
</style></head><body>
<div class="acoes"><span>Pré-visualização • dados dos filtros selecionados</span><button type="button" onclick="window.print()">Imprimir / Salvar em PDF</button></div>
<main class="pagina">
<header class="topo"><div><div class="empresa"><span class="marca"></span>${escaparHtml(empresaAtiva?.nome || 'SD Plásticos')}</div>
<h1>Relatório de despesas</h1><div class="subtitulo">Visão detalhada dos gastos operacionais no período</div></div>
<div class="emissao">EMITIDO EM<strong>${escaparHtml(new Date().toLocaleString('pt-BR'))}</strong></div></header>
<div class="filtros">${resumoFiltros.map(x => `<span>${escaparHtml(x)}</span>`).join('')}</div>
<div class="resumo">
<div class="indicador destaque"><small>Total de despesas</small><strong>${escaparHtml(MOEDA.format(total))}</strong></div>
<div class="indicador"><small>Quantidade de lançamentos</small><strong>${filtrados.length}</strong></div>
<div class="indicador"><small>Maior categoria</small><strong style="font-size:14px;white-space:normal">${escaparHtml(maiorCategoria?.nome || '—')}</strong></div>
</div>
<section class="secao"><div class="secao-titulo"><h2>Distribuição por categoria</h2><p>Participação de cada categoria no total de despesas</p></div>
<div class="grafico"><div class="rosca" style="background:${fundoRosca}"><div class="rosca-centro"><small>Total</small><strong>${escaparHtml(MOEDA.format(total))}</strong></div></div><div>${linhasGrafico}</div></div></section>
<section class="secao"><div class="secao-titulo"><h2>Histórico de despesas</h2><p>${filtrados.length} lançamentos · ordem mais recente primeiro</p></div>
<table><colgroup><col style="width:5%"><col style="width:15%"><col style="width:39%"><col style="width:24%"><col style="width:17%"></colgroup>
<thead><tr><th>Nº</th><th>Data</th><th>Descrição</th><th>Categoria</th><th class="valor">Valor</th></tr></thead>
<tbody>${linhasRelatorio}</tbody>
<tfoot><tr><td colspan="4">TOTAL NO PERÍODO</td><td class="valor">${escaparHtml(MOEDA.format(total))}</td></tr></tfoot></table></section>
<footer class="rodape"><span>Os valores são agrupados pela data da despesa.</span><span>Estoque Fácil • SD Plásticos</span></footer>
</main></body></html>`
    janela.document.open()
    janela.document.write(conteudo)
    janela.document.close()
    janela.focus()
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
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={imprimirRelatorio} disabled={carregando || !filtrados.length} title="Imprimir todos os lançamentos filtrados" className="inline-flex items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2.5 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:cursor-not-allowed disabled:opacity-50"><Icone nome="imprimir" tamanho={17}/> Imprimir relatório</button>
            <button type="button" onClick={() => setFiltrar(v => !v)} aria-expanded={filtrar} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold hover:bg-slate-50"><Icone nome="filtro" tamanho={17}/> Filtrar</button>
          </div>
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
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <label className="text-xs font-semibold">Categoria *<select className={`${campo} mt-1`} value={form.categoria} onChange={e => setForm(f => ({ ...f, categoria: e.target.value }))}>{[...new Set([...CATEGORIAS, ...(editandoId ? [form.categoria] : [])])].map(c => <option key={c}>{c}</option>)}</select></label>
              <label className="text-xs font-semibold">Valor (R$) *<input className={`${campo} mt-1`} required type="text" inputMode="decimal" value={form.valor} onChange={e => setForm(f => ({ ...f, valor: e.target.value }))} placeholder="0,00" /></label>
            </div>
            <label className="block text-xs font-semibold">Data da despesa *<input className={`${campo} mt-1`} required type="date" value={form.data_despesa} onChange={e => setForm(f => ({ ...f, data_despesa: e.target.value }))}/></label>
            {erro && <p role="alert" className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{erro}</p>}
            <div className="flex flex-col-reverse gap-2 pt-2 sm:flex-row sm:justify-end"><button type="button" onClick={() => setModal(false)} disabled={salvando} className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold">Cancelar</button><button type="submit" disabled={salvando} className="rounded-xl bg-[#315CF5] px-6 py-3 text-sm font-semibold text-white disabled:opacity-60">{salvando ? 'Salvando...' : editandoId ? 'Salvar alterações' : 'Cadastrar despesa'}</button></div>
          </form>
        </div>
      </div>}
    </div>
  )
}
