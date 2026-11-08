import { useEffect, useRef, useState } from 'react'
import { supabase } from '../services/supabase'
import Produtos from './Produtos'
import Movimentacoes from './Movimentacoes'
import Relatorios from './Relatorios'
import Despesas from './Despesas'
import Insumos from './Insumos'


const NAV_TODAS = [
  { id: 'dashboard', nome: 'Visão geral', icone: 'grid' },
  { id: 'produtos', nome: 'Produtos', icone: 'box' },
  { id: 'movimentacoes', nome: 'Movimentações', icone: 'pulse' },
  { id: 'insumos', nome: 'Insumos', icone: 'boxes', exclusivoSD: true },
  { id: 'despesas', nome: 'Despesas', icone: 'receipt', exclusivoSD: true },
  { id: 'relatorios', nome: 'Relatórios', icone: 'chart' },
]

function IconeNav({ nome, tamanho = 20, className = '' }) {
  const desenhos = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
    box: <><path d="m12 2 9 5-9 5-9-5 9-5Z"/><path d="M3 7v10l9 5 9-5V7M12 12v10"/></>,
    pulse: <path d="M2 12h4l3-8 5 16 3-8h5"/>,
    boxes: <><path d="m7 3 4 2-4 2-4-2 4-2Zm0 4v5M3 5v5l4 2 4-2V5"/><path d="m17 3 4 2-4 2-4-2 4-2Zm0 4v5M13 5v5l4 2 4-2V5"/><path d="m12 12 4 2-4 2-4-2 4-2Zm0 4v6M8 14v6l4 2 4-2v-6"/></>,
    receipt: <><path d="M5 3h14v18l-3-2-4 2-4-2-3 2V3Z"/><path d="M9 8h6M9 12h6M9 16h4"/></>,
    chart: <><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 16v-4M12 16V8M16 16v-6"/></>,
    menu: <path d="M4 7h16M4 12h16M4 17h16"/>,
    close: <path d="M5 5 19 19M19 5 5 19"/>,
    logout: <><path d="M10 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h5"/><path d="m15 7 5 5-5 5M20 12H9"/></>,
    moon: <path d="M20.7 13.1A9 9 0 0 1 10.9 3.3 9 9 0 1 0 20.7 13.1Z"/>,
    sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.42 1.42m11.3 11.3 1.42 1.42M2 12h2m16 0h2M4.93 19.07l1.42-1.42m11.3-11.3 1.42-1.42"/></>,
    arrow: <path d="M5 12h14m-6-6 6 6-6 6"/>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M7 3v4m10-4v4M3 10h18"/></>,
    plus: <path d="M12 5v14M5 12h14"/>,
    alert: <><path d="m12 3 10 18H2L12 3Z"/><path d="M12 9v4m0 4h.01"/></>,
    trend: <path d="m4 16 6-6 4 4 6-7m-5 0h5v5"/>,
    sort: <><path d="M8 4v16m-3-3 3 3 3-3M16 20V4m-3 3 3-3 3 3"/></>,
    grip: <><circle cx="9" cy="5" r="1"/><circle cx="15" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="9" cy="19" r="1"/><circle cx="15" cy="19" r="1"/></>,
    up: <path d="m6 15 6-6 6 6"/>,
    down: <path d="m6 9 6 6 6-6"/>,
    money: <><circle cx="12" cy="12" r="9"/><path d="M15 8h-4a2 2 0 0 0 0 4h2a2 2 0 0 1 0 4H9m3-10v12"/></>,
    chevron: <path d="m7 10 5 5 5-5"/>,
    collapse: <><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M9 3v18m7-13-4 4 4 4"/></>,
  }
  return (
    <svg className={className} width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {desenhos[nome] || desenhos.grid}
    </svg>
  )
}

function Dashboard({
  usuarioLogado,
  empresasUsuario,
  empresaAtiva,
  setEmpresaAtiva,
  onLogout,
}) {
  const [mostrarTodosProdutosDashboard, setMostrarTodosProdutosDashboard] =
    useState(false)
  const [buscaProdutoDashboard, setBuscaProdutoDashboard] = useState('')
  const [telaAtual, setTelaAtual] = useState('dashboard')
  const [organizandoEstoque, setOrganizandoEstoque] = useState(false)
  const [salvandoOrdem, setSalvandoOrdem] = useState(false)
  const [erroOrdem, setErroOrdem] = useState('')
  const [arrastandoId, setArrastandoId] = useState(null)
  const [destinoId, setDestinoId] = useState(null)
  const arrasteRef = useRef(null)
  const [fluxo30, setFluxo30] = useState([])
  const [despesas30, setDespesas30] = useState([])
  const [carregandoIndicadores, setCarregandoIndicadores] = useState(false)
  const [erroIndicadores, setErroIndicadores] = useState('')
  const [dadosIncompletos, setDadosIncompletos] = useState(false)
  const [menuMobileAberto, setMenuMobileAberto] = useState(false)
  const [mostrarTodosAlertas, setMostrarTodosAlertas] = useState(false)
  const [seletorEmpresaAberto, setSeletorEmpresaAberto] = useState(false)
  const seletorEmpresaRef = useRef(null)
  const [menuRecolhido, setMenuRecolhido] = useState(false)
  const [modoEscuro, setModoEscuro] = useState(() => {
    try { return window.localStorage.getItem('estoquefacil-modo-escuro') === 'true' }
    catch { return false }
  })
  const podeOrganizar = ['admin', 'administrador'].includes(String(empresaAtiva?.perfil || '').toLowerCase())
  const empresaEhSD = empresaAtiva?.nome?.trim().toLocaleLowerCase('pt-BR') === 'sd plásticos'
  const paginasPermitidas = NAV_TODAS.filter((item) => !item.exclusivoSD || empresaEhSD)
  const iniciais = (usuarioLogado?.nome || 'Usuário').trim().split(/\s+/).slice(0, 2).map((parte) => parte[0]?.toUpperCase()).join('')

  useEffect(() => {
    if (!empresaEhSD && (telaAtual === 'despesas' || telaAtual === 'insumos')) {
      setTelaAtual('dashboard')
    }
    setMenuMobileAberto(false)
    setSeletorEmpresaAberto(false)
    setMostrarTodosAlertas(false)
  }, [empresaAtiva?.id, empresaEhSD, telaAtual])

  useEffect(() => {
    try { window.localStorage.setItem('estoquefacil-modo-escuro', String(modoEscuro)) } catch { /* Armazenamento indisponível */ }
  }, [modoEscuro])

  useEffect(() => {
    if (!seletorEmpresaAberto) return undefined
    const fecharSeFora = (evento) => {
      if (!seletorEmpresaRef.current?.contains(evento.target)) setSeletorEmpresaAberto(false)
    }
    const fecharComEscape = (evento) => {
      if (evento.key === 'Escape') setSeletorEmpresaAberto(false)
    }
    document.addEventListener('pointerdown', fecharSeFora)
    document.addEventListener('keydown', fecharComEscape)
    return () => {
      document.removeEventListener('pointerdown', fecharSeFora)
      document.removeEventListener('keydown', fecharComEscape)
    }
  }, [seletorEmpresaAberto])

  const [produtos, setProdutos] = useState([])
  const [carregandoProdutos, setCarregandoProdutos] = useState(false)

  const [movimentacoes, setMovimentacoes] = useState([])
  const [carregandoMovimentacoes, setCarregandoMovimentacoes] = useState(false)

  const [carregandoResumoDashboard, setCarregandoResumoDashboard] =
    useState(false)

  const [resumoDashboard, setResumoDashboard] = useState({
    saidasHoje: 0,
    produtoMaisVendidoHoje: null,
  })

  useEffect(() => {
    if (empresaAtiva?.id) {
      setMostrarTodosProdutosDashboard(false)
      setBuscaProdutoDashboard('')
      setOrganizandoEstoque(false)
      setErroOrdem('')
      arrasteRef.current = null
      setArrastandoId(null)
      setDestinoId(null)
      carregarProdutos()
      carregarMovimentacoes()
      carregarResumoDashboard()
    }
  }, [empresaAtiva])

  // Dados dos últimos 30 dias: consultas paginadas para não truncar no limite de 1.000 linhas.
  useEffect(() => {
    if (!empresaAtiva?.id || telaAtual !== 'dashboard') return
    let cancelado = false
    async function atualizarIndicadores() {
      setCarregandoIndicadores(true)
      setErroIndicadores('')
      setFluxo30([])
      setDespesas30([])
      setDadosIncompletos(false)
      try {
        const inicio = new Date()
        inicio.setHours(12, 0, 0, 0)
        inicio.setDate(inicio.getDate() - 29)
        const inicioISO = `${inicio.getFullYear()}-${String(inicio.getMonth() + 1).padStart(2, '0')}-${String(inicio.getDate()).padStart(2, '0')}`
        const movimentos = []
        let truncado = false
        for (let posicao = 0; posicao < 20000; posicao += 1000) {
          const { data, error } = await supabase.from('movimentacoes')
            .select('id, tipo, quantidade, data_movimentacao, valor_unitario, produto_id, estornada, movimentacao_original_id')
            .eq('empresa_id', empresaAtiva.id)
            .gte('data_movimentacao', inicioISO)
            .lte('data_movimentacao', obterDataLocal())
            .eq('estornada', false)
            .is('movimentacao_original_id', null)
            .order('data_movimentacao', { ascending: false })
            .order('id', { ascending: true })
            .range(posicao, posicao + 999)
          if (error) throw error
          movimentos.push(...(data || []))
          if (!data || data.length < 1000) break
          if (posicao === 19000) truncado = true
        }
        if (cancelado) return
        setFluxo30(movimentos)
        setDadosIncompletos(truncado)
        if (empresaAtiva.nome?.trim().toLocaleLowerCase('pt-BR') === 'sd plásticos') {
          const despesas = []
          for (let posicao = 0; posicao < 10000; posicao += 1000) {
            const { data, error } = await supabase.from('despesas')
              .select('id, valor, data_despesa')
              .eq('empresa_id', empresaAtiva.id)
              .gte('data_despesa', inicioISO)
              .lte('data_despesa', obterDataLocal())
              .order('data_despesa', { ascending: false })
              .order('id', { ascending: true })
              .range(posicao, posicao + 999)
            if (error) throw error
            despesas.push(...(data || []))
            if (!data || data.length < 1000) break
            if (posicao === 9000 && !cancelado) setDadosIncompletos(true)
          }
          if (!cancelado) setDespesas30(despesas)
        }
      } catch (erro) {
        if (!cancelado) { console.error('Erro ao carregar indicadores da Visão geral:', erro); setErroIndicadores('Não foi possível carregar todos os indicadores do período.') }
      } finally {
        if (!cancelado) setCarregandoIndicadores(false)
      }
    }
    atualizarIndicadores()
    return () => { cancelado = true }
  }, [empresaAtiva?.id, telaAtual])

  async function carregarProdutos() {
    setCarregandoProdutos(true)

    const { data, error } = await supabase
      .from('produtos')
      .select('*')
      .eq('empresa_id', empresaAtiva.id)
      .order('ordem_exibicao', { ascending: true })
      .order('nome', { ascending: true })

    if (error) {
      console.error('Erro ao carregar produtos:', error)
      alert('Erro ao carregar produtos.')
      setCarregandoProdutos(false)
      return
    }

    const produtosFormatados = data.map((produto) => ({
      id: produto.id,
      empresaId: produto.empresa_id,
      nome: produto.nome,
      codigo: produto.codigo || 'Sem código',
      categoria: produto.categoria || 'Sem categoria',
      estoqueAtual: produto.estoque_atual,
      estoqueMinimo: produto.estoque_minimo,
      valorUnitario: Number(produto.valor_unitario || 0),
      observacao: produto.observacao || '',
      ativo: produto.ativo,
      ordemExibicao: produto.ordem_exibicao ?? 9999,
      emProducao: produto.em_producao || false,
    }))

    setProdutos(produtosFormatados)
    setCarregandoProdutos(false)
  }

  async function carregarMovimentacoes() {
    setCarregandoMovimentacoes(true)

    const { data, error } = await supabase
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
      .limit(10)

    if (error) {
      console.error('Erro ao carregar movimentações:', error)
      alert('Erro ao carregar movimentações.')
      setCarregandoMovimentacoes(false)
      return
    }

    const movimentacoesFormatadas = data.map((movimentacao) => ({
      id: movimentacao.id,
      empresaId: movimentacao.empresa_id,
      produtoId: movimentacao.produto_id,
      produtoNome: movimentacao.produtos?.nome || 'Produto não encontrado',
      usuarioId: movimentacao.usuario_id,
      tipo: movimentacao.tipo,
      quantidade: movimentacao.quantidade,
      data: movimentacao.data_movimentacao,
      canalVenda: movimentacao.canal_venda || '',
      observacao: movimentacao.observacao || '',
      valorUnitario: movimentacao.valor_unitario ?? null,
      criadaEm: movimentacao.criada_em,
      estornada: movimentacao.estornada,
      movimentacaoOriginalId: movimentacao.movimentacao_original_id,
    }))

    setMovimentacoes(movimentacoesFormatadas)
    setCarregandoMovimentacoes(false)
  }

  function obterDataLocal(data = new Date()) {
    const ano = data.getFullYear()
    const mes = String(data.getMonth() + 1).padStart(2, '0')
    const dia = String(data.getDate()).padStart(2, '0')

    return `${ano}-${mes}-${dia}`
  }

  async function carregarResumoDashboard() {
    if (!empresaAtiva?.id) return

    setCarregandoResumoDashboard(true)

    const hoje = obterDataLocal()

    const { data, error } = await supabase
      .from('movimentacoes')
      .select(`
        id,
        produto_id,
        quantidade,
        produtos!movimentacoes_produto_id_fkey (
          nome
        )
      `)
      .eq('empresa_id', empresaAtiva.id)
      .eq('tipo', 'saida')
      .eq('data_movimentacao', hoje)
      .or('estornada.eq.false,estornada.is.null')
      .is('movimentacao_original_id', null)

    if (error) {
      console.error('Erro ao carregar resumo da dashboard:', error)
      setResumoDashboard({
        saidasHoje: 0,
        produtoMaisVendidoHoje: null,
      })
      setCarregandoResumoDashboard(false)
      return
    }

    const saidasHoje = data.reduce(
      (total, movimentacao) => total + Number(movimentacao.quantidade || 0),
      0
    )

    const rankingProdutos = data.reduce((ranking, movimentacao) => {
      const produtoExistente = ranking.find(
        (item) => item.produtoId === movimentacao.produto_id
      )

      if (produtoExistente) {
        produtoExistente.quantidade += Number(movimentacao.quantidade || 0)
      } else {
        ranking.push({
          produtoId: movimentacao.produto_id,
          produtoNome:
            movimentacao.produtos?.nome || 'Produto não encontrado',
          quantidade: Number(movimentacao.quantidade || 0),
        })
      }

      return ranking
    }, [])

    const produtoMaisVendidoHoje = rankingProdutos.sort(
      (a, b) => b.quantidade - a.quantidade
    )[0]

    setResumoDashboard({
      saidasHoje,
      produtoMaisVendidoHoje,
    })

    setCarregandoResumoDashboard(false)
  }

  const produtosAtivos = produtos
    .filter((produto) => produto.ativo)
    .sort((a, b) => {
      const ordemA = a.ordemExibicao ?? 9999
      const ordemB = b.ordemExibicao ?? 9999

      if (ordemA !== ordemB) {
        return ordemA - ordemB
      }

      return a.nome.localeCompare(b.nome, 'pt-BR')
    })

  const produtosEmProducao = produtosAtivos.filter(
    (produto) => produto.emProducao
  )

  const produtosFiltradosDashboard = produtosAtivos.filter((produto) => {
    const busca = buscaProdutoDashboard.toLowerCase().trim()

    if (!busca) return true

    return (
      produto.nome.toLowerCase().includes(busca) ||
      produto.codigo.toLowerCase().includes(busca) ||
      produto.categoria.toLowerCase().includes(busca)
    )
  })

  const produtosOrdenadosDashboard = produtosFiltradosDashboard
  const produtosDashboard = (mostrarTodosProdutosDashboard || organizandoEstoque)
    ? produtosOrdenadosDashboard
    : produtosOrdenadosDashboard.slice(0, 10)

  const produtosBaixoEstoque = produtosAtivos.filter(
    (produto) => produto.estoqueAtual < produto.estoqueMinimo
  )

  const movimentacoesValidas = movimentacoes.filter(
    (movimentacao) =>
      !movimentacao.estornada && !movimentacao.movimentacaoOriginalId
  )

  const ultimasMovimentacoes = [...movimentacoesValidas].slice(0, 5)

  function mudarTela(tela) {
    if (!paginasPermitidas.some((item) => item.id === tela)) return
    setMenuMobileAberto(false)
    setTelaAtual(tela)

    if (tela === 'dashboard' && empresaAtiva?.id) {
      carregarProdutos()
      carregarMovimentacoes()
      carregarResumoDashboard()
    }
  }

  // Reordenação manual: nenhuma alteração nas quantidades ou movimentações.
  // Os índices são gravados em produtos.ordem_exibicao, respeitando as políticas RLS.
  function iniciarOrganizacao() {
    if (!podeOrganizar || salvandoOrdem) return
    setErroOrdem('')
    setBuscaProdutoDashboard('')
    setMostrarTodosProdutosDashboard(true)
    setOrganizandoEstoque((atual) => !atual)
  }

  async function persistirOrdem(listaOrdenada) {
    if (!podeOrganizar || salvandoOrdem || !empresaAtiva?.id) return
    setSalvandoOrdem(true)
    setErroOrdem('')
    const empresaId = empresaAtiva.id
    const ordemAnterior = produtos
    const indicePorId = new Map(listaOrdenada.map((produto, indice) => [produto.id, indice + 1]))
    setProdutos((atuais) => atuais.map((produto) => indicePorId.has(produto.id)
      ? { ...produto, ordemExibicao: indicePorId.get(produto.id) }
      : produto))
    try {
      // Atualização por lotes pequenos; .select() detecta alterações barradas por RLS.
      for (let inicio = 0; inicio < listaOrdenada.length; inicio += 10) {
        const lote = listaOrdenada.slice(inicio, inicio + 10)
        const resultados = await Promise.all(lote.map((produto, indice) => supabase
          .from('produtos')
          .update({ ordem_exibicao: inicio + indice + 1 })
          .eq('id', produto.id)
          .eq('empresa_id', empresaId)
          .select('id')))
        for (const resultado of resultados) {
          if (resultado.error) throw resultado.error
          if (!resultado.data?.length) throw new Error('Sem permissão para alterar a ordem dos produtos.')
        }
      }
      // O banco é a fonte da verdade; mantém a ordem em outros dispositivos.
      await carregarProdutos()
    } catch (erro) {
      console.error('Erro ao organizar produtos:', erro)
      setErroOrdem('Não foi possível salvar toda a ordem. Recarregue a página antes de tentar novamente.')
      setProdutos(ordemAnterior)
      await carregarProdutos()
    } finally {
      setSalvandoOrdem(false)
      setArrastandoId(null)
      setDestinoId(null)
      arrasteRef.current = null
    }
  }

  function moverProduto(origemId, alvoId) {
    if (!organizandoEstoque || salvandoOrdem || !podeOrganizar || !origemId || !alvoId || origemId === alvoId) return
    const novaLista = [...produtosAtivos]
    const inicio = novaLista.findIndex((produto) => produto.id === origemId)
    const fim = novaLista.findIndex((produto) => produto.id === alvoId)
    if (inicio < 0 || fim < 0) return
    const [movido] = novaLista.splice(inicio, 1)
    novaLista.splice(fim, 0, movido)
    persistirOrdem(novaLista)
  }

  function moverUmaPosicao(produtoId, deslocamento) {
    const posicao = produtosAtivos.findIndex((produto) => produto.id === produtoId)
    const alvo = produtosAtivos[posicao + deslocamento]
    if (alvo) moverProduto(produtoId, alvo.id)
  }

  function iniciarArraste(evento, produtoId) {
    if (!organizandoEstoque || salvandoOrdem || !podeOrganizar || evento.button !== 0) return
    evento.preventDefault()
    evento.currentTarget.setPointerCapture(evento.pointerId)
    arrasteRef.current = { origem: produtoId, destino: produtoId }
    setArrastandoId(produtoId)
    setDestinoId(produtoId)
  }

  function movimentarArraste(evento) {
    if (!arrasteRef.current) return
    const elemento = document.elementFromPoint(evento.clientX, evento.clientY)
    const linha = elemento?.closest('[data-estoque-produto]')
    const alvoId = linha?.getAttribute('data-estoque-produto')
    if (alvoId && alvoId !== arrasteRef.current.destino) {
      arrasteRef.current.destino = alvoId
      setDestinoId(alvoId)
    }
  }

  function finalizarArraste(evento) {
    if (!arrasteRef.current) return
    movimentarArraste(evento)
    const { origem, destino } = arrasteRef.current
    arrasteRef.current = null
    setArrastandoId(null)
    setDestinoId(null)
    if (origem !== destino) moverProduto(origem, destino)
  }

  function formatarDataBrasil(data) {
    if (!data) return '-'

    const [ano, mes, dia] = data.split('-')

    return `${dia}/${mes}/${ano}`
  }

  function estiloBotaoMenu(tela) {
    return telaAtual === tela
      ? 'rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white'
      : 'rounded-xl px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100'
  }

  function estiloBotaoMenuMobile(tela) {
    return telaAtual === tela
      ? 'rounded-xl bg-blue-50 px-2 py-2 text-xs font-bold text-blue-700'
      : 'rounded-xl px-2 py-2 text-xs font-semibold text-slate-500'
  }

  function renderizarConteudo() {
    if (telaAtual === 'despesas' && empresaEhSD) {
      return <Despesas empresaAtiva={empresaAtiva} />
    }
    if (telaAtual === 'insumos' && empresaEhSD) {
      return <Insumos empresaAtiva={empresaAtiva} />
    }
    if (telaAtual === 'produtos') {
      return (
        <Produtos
          produtos={produtos}
          setProdutos={setProdutos}
          empresaAtiva={empresaAtiva}
          carregandoProdutos={carregandoProdutos}
        />
      )
    }

    if (telaAtual === 'movimentacoes') {
      return (
        <Movimentacoes
          produtos={produtos}
          movimentacoes={movimentacoes}
          empresaAtiva={empresaAtiva}
          usuarioLogado={usuarioLogado}
          carregandoMovimentacoes={carregandoMovimentacoes}
          carregarProdutos={carregarProdutos}
          carregarMovimentacoes={carregarMovimentacoes}
        />
      )
    }

    if (telaAtual === 'relatorios') {
      return <Relatorios empresaAtiva={empresaAtiva} />
    }

    const formatarNumero = (valor) => Number(valor || 0).toLocaleString('pt-BR')
    const formatarMoeda = (valor) => Number(valor || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    const estoqueTotal = produtosAtivos.reduce((total, produto) => total + Number(produto.estoqueAtual || 0), 0)
    const estoqueCritico = produtosAtivos.filter((produto) => Number(produto.estoqueAtual || 0) <= Number(produto.estoqueMinimo || 0))
    const listaEstoque = produtosDashboard
    const agora = new Date()
    const dias = Array.from({ length: 7 }, (_, indice) => {
      const data = new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - (6 - indice), 12)
      const dia = `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, '0')}-${String(data.getDate()).padStart(2, '0')}`
      const diaSemana = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'][data.getDay()]
      return { dia, diaSemana, entradas: 0, saidas: 0 }
    })
    const mapaDias = new Map(dias.map((dia) => [dia.dia, dia]))
    fluxo30.forEach((movimento) => {
      const dia = mapaDias.get(movimento.data_movimentacao)
      if (!dia) return
      if (movimento.tipo === 'entrada') dia.entradas += Number(movimento.quantidade || 0)
      if (movimento.tipo === 'saida') dia.saidas += Number(movimento.quantidade || 0)
    })
    const maiorMovimento = Math.max(1, ...dias.flatMap((dia) => [dia.entradas, dia.saidas]))
    const precoAtualPorProduto = new Map(produtos.map((produto) => [produto.id, Number(produto.valorUnitario || 0)]))
    const vendas30 = fluxo30.filter((movimento) => movimento.tipo === 'saida')
    const faturamentoRegistrado = vendas30.reduce((soma, item) => soma + (item.valor_unitario === null ? 0 : Number(item.valor_unitario) * Number(item.quantidade)), 0)
    const faturamentoEstimado = vendas30.reduce((soma, item) => soma + (item.valor_unitario === null ? (precoAtualPorProduto.get(item.produto_id) || 0) * Number(item.quantidade) : 0), 0)
    const saidasSemPreco = vendas30.filter((item) => item.valor_unitario === null).length
    const totalDespesas = despesas30.reduce((soma, item) => soma + Number(item.valor || 0), 0)
    const saudacao = Number(agora.getHours()) < 12 ? 'Bom dia' : Number(agora.getHours()) < 18 ? 'Boa tarde' : 'Boa noite'
    const primeiroNome = usuarioLogado?.nome?.trim().split(/\s+/)[0] || 'você'
    const statusProduto = (produto) => Number(produto.estoqueAtual || 0) <= 0 ? 'Sem estoque' : Number(produto.estoqueAtual) <= Number(produto.estoqueMinimo || 0) ? 'Estoque baixo' : 'Normal'

    return (
      <section className="space-y-5 sm:space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#315cf5]">Central de operações</p>
            <h1 className="mt-1 text-[27px] font-bold tracking-tight text-slate-900 sm:text-[31px]">{saudacao}, {primeiroNome}</h1>
            <p className="mt-1 text-sm text-slate-500">Acompanhe o desempenho do estoque e as prioridades de hoje.</p>
          </div>
          <div className="flex gap-2 sm:shrink-0">
            <span className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-xs font-semibold text-slate-700 sm:flex-none"><IconeNav nome="calendar" tamanho={17} /> Últimos 30 dias</span>
            <button type="button" onClick={() => mudarTela('movimentacoes')} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#315cf5] px-4 py-3 text-xs font-bold text-white shadow-md shadow-blue-600/15 hover:bg-blue-700 sm:flex-none"><IconeNav nome="plus" tamanho={17} /> Nova movimentação</button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4 lg:gap-4">
          {[
            { nome: 'Produtos ativos', valor: formatarNumero(produtosAtivos.length), detalhe: 'Produtos cadastrados', icone: 'box', bg: 'bg-[#eaf0ff]', cor: 'text-blue-600' },
            { nome: 'Estoque total', valor: formatarNumero(estoqueTotal), detalhe: 'Unidades disponíveis', icone: 'boxes', bg: 'bg-violet-100', cor: 'text-violet-600' },
            { nome: 'Saídas hoje', valor: carregandoResumoDashboard ? '…' : formatarNumero(resumoDashboard.saidasHoje), detalhe: 'Unidades no dia', icone: 'trend', bg: 'bg-emerald-100', cor: 'text-emerald-600' },
            { nome: 'Estoque crítico', valor: formatarNumero(estoqueCritico.length), detalhe: 'Requer sua atenção', icone: 'alert', bg: 'bg-amber-100', cor: 'text-amber-600' },
          ].map((card) => <div key={card.nome} className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className={`ef-dashboard-kpi-icon mb-3 grid h-11 w-11 place-items-center rounded-xl ${card.bg} ${card.cor}`}><IconeNav nome={card.icone} tamanho={22} /></div>
            <p className="text-xs font-semibold text-slate-500">{card.nome}</p>
            <p className="mt-1 text-2xl font-extrabold tracking-tight text-slate-900 sm:text-[27px]">{carregandoProdutos && (card.nome === 'Produtos ativos' || card.nome === 'Estoque total') ? '…' : card.valor}</p>
            <p className="mt-1.5 text-[11px] text-slate-400">{card.detalhe}</p>
          </div>)}
        </div>

        {empresaEhSD && <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="grid grid-cols-2 gap-x-4 gap-y-5 md:grid-cols-[1.3fr_repeat(4,1fr)] md:items-center md:gap-0">
            <div className="col-span-2 border-b border-slate-100 pb-4 md:col-span-1 md:border-b-0 md:pb-0 md:pr-4">
              <div className="flex items-center gap-2 text-slate-800"><IconeNav nome="money" tamanho={20} /><h2 className="text-sm font-extrabold">Resumo financeiro</h2></div>
              <p className="mt-1 text-[11px] text-slate-400">Referência: últimos 30 dias</p>
            </div>
            <div className="min-w-0 md:border-l md:border-slate-200 md:px-4"><p className="text-[11px] text-slate-400">Faturamento bruto*</p><strong className="mt-1 block break-words text-base text-slate-900 sm:text-lg">{carregandoIndicadores ? '…' : formatarMoeda(faturamentoRegistrado + faturamentoEstimado)}</strong><p className="mt-1 text-[10px] text-slate-400">Histórico + estimativas</p></div>
            <div className="min-w-0 md:border-l md:border-slate-200 md:px-4"><p className="text-[11px] text-slate-400">Custos estimados</p><strong className="mt-1 block text-lg text-slate-400">—</strong><p className="mt-1 text-[10px] text-slate-400">Aguardando custos de produção</p></div>
            <div className="min-w-0 md:border-l md:border-slate-200 md:px-4"><p className="text-[11px] text-slate-400">Despesas</p><strong className="mt-1 block break-words text-base text-slate-900 sm:text-lg">{carregandoIndicadores ? '…' : formatarMoeda(totalDespesas)}</strong><p className="mt-1 text-[10px] text-slate-400">{despesas30.length} lançamentos</p></div>
            <div className="min-w-0 md:border-l md:border-slate-200 md:px-4"><p className="text-[11px] text-slate-400">Resultado estimado</p><strong className="mt-1 block text-lg text-slate-400">—</strong><p className="mt-1 text-[10px] text-slate-400">Aguardando custos</p></div>
          </div>
          <p className="mt-4 border-t border-slate-100 pt-3 text-[11px] text-slate-400">* {saidasSemPreco} saída(s) sem preço histórico foram estimadas pelo preço atual cadastrado. Valores não representam faturamento confirmado.</p>
        </div>}

        {erroIndicadores && <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">{erroIndicadores}</p>}
        {dadosIncompletos && <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Há mais lançamentos do que o limite de leitura; os indicadores podem estar incompletos.</p>}

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.8fr)_minmax(300px,1fr)]">
          <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-start justify-between gap-3"><div><h2 className="text-base font-extrabold text-slate-900">Fluxo de movimentações</h2><p className="mt-1 text-xs text-slate-400">Entradas e saídas nos últimos 7 dias</p></div><button type="button" onClick={() => mudarTela('relatorios')} className="flex shrink-0 items-center gap-1.5 text-xs font-semibold text-[#315cf5]">Ver relatório <IconeNav nome="arrow" tamanho={16} /></button></div>
            <div className="mt-5 flex justify-end gap-4 text-[11px] text-slate-500"><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#5275ff]" />Entradas</span><span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-[#32c4ae]" />Saídas</span></div>
            <div className="mt-4 grid h-[245px] grid-cols-7 items-end gap-1 border-b border-slate-200 pb-0.5 sm:gap-3" aria-label="Gráfico de entradas e saídas por dia">
              {dias.map((dia) => <div key={dia.dia} className="flex h-full min-w-0 flex-col justify-end"><div className="flex h-[210px] items-end justify-center gap-0.5 border-b border-slate-100 bg-[repeating-linear-gradient(to_top,transparent_0px,transparent_51px,#eef2f7_52px)] sm:gap-1.5">
                <div title={`${dia.diaSemana}: ${formatarNumero(dia.entradas)} entradas`} style={{ height: `${(dia.entradas / maiorMovimento) * 92}%` }} className="w-2.5 min-h-[2px] max-w-7 rounded-t bg-[#5275ff] sm:w-5" />
                <div title={`${dia.diaSemana}: ${formatarNumero(dia.saidas)} saídas`} style={{ height: `${(dia.saidas / maiorMovimento) * 92}%` }} className="w-2.5 min-h-[2px] max-w-7 rounded-t bg-[#32c4ae] sm:w-5" />
              </div><p className="py-2 text-center text-[11px] font-medium text-slate-400">{dia.diaSemana}</p></div>)}
            </div>
          </div>
          <div className="min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-start justify-between gap-3"><div><h2 className="text-base font-extrabold text-slate-900">Requer atenção</h2><p className="mt-1 text-xs text-slate-400">Alertas de estoque mínimo</p></div><span className="rounded-lg bg-amber-50 px-3 py-1.5 text-sm font-bold text-amber-600">{estoqueCritico.length}</span></div>
            <div className="mt-4 divide-y divide-slate-100">{(mostrarTodosAlertas ? estoqueCritico : estoqueCritico.slice(0, 4)).map((produto) => <div key={produto.id} className="flex items-center gap-3 py-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-100 bg-slate-50 text-slate-500"><IconeNav nome="box" tamanho={19} /></span><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold text-slate-800">{produto.nome}</p><p className="text-[11px] text-slate-400">Mínimo: {formatarNumero(produto.estoqueMinimo)}</p></div><div className={`text-right text-sm font-bold ${Number(produto.estoqueAtual) <= 0 ? 'text-red-500' : 'text-amber-600'}`}>{formatarNumero(produto.estoqueAtual)}<p className="text-[10px] font-normal text-slate-400">un.</p></div></div>)}
              {!estoqueCritico.length && <p className="py-8 text-center text-sm text-slate-400">Nenhum alerta de estoque no momento.</p>}
            </div>
            {estoqueCritico.length > 4 && (
              <button
                type="button"
                aria-expanded={mostrarTodosAlertas}
                onClick={() => setMostrarTodosAlertas((atual) => !atual)}
                className="mt-3 flex w-full items-center justify-center gap-2 border-t border-slate-100 pt-4 text-xs font-semibold text-[#315cf5] hover:text-blue-400"
              >
                {mostrarTodosAlertas ? 'Ver menos alertas' : 'Ver todos os alertas'}
                <IconeNav nome="arrow" tamanho={16} className={mostrarTodosAlertas ? '-rotate-90' : 'rotate-90'} />
              </button>
            )}
          </div>
        </div>

        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-col gap-4 border-b border-slate-100 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-5"><div><h2 className="text-base font-extrabold text-slate-900">Visão do estoque</h2><p className="mt-1 text-xs text-slate-400">Produtos acompanhados em tempo real</p></div><div className="flex flex-wrap items-center gap-3"><>{podeOrganizar && <button type="button" disabled={salvandoOrdem} onClick={iniciarOrganizacao} className="ef-organize-button flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-60"><IconeNav nome="grip" tamanho={16} /> {salvandoOrdem ? 'Salvando…' : organizandoEstoque ? 'Concluir organização' : 'Organizar produtos'}</button>}</><button type="button" onClick={() => mudarTela('produtos')} className="flex items-center gap-1 text-xs font-semibold text-[#315cf5]">Todos os produtos <IconeNav nome="arrow" tamanho={16} /></button></div></div>
          {organizandoEstoque && <p className="border-b border-blue-100 bg-blue-50 px-5 py-3 text-xs font-medium text-blue-800">Arraste pelo ícone de seis pontos para alterar a posição. No celular, também é possível utilizar as setas. A ordem é salva para todos os usuários da empresa.</p>}
          {erroOrdem && <p role="alert" className="border-b border-red-200 bg-red-50 px-5 py-3 text-xs text-red-700">{erroOrdem}</p>}
          <div className="border-b border-slate-100 px-4 py-3 sm:px-5"><input type="search" placeholder="Buscar produto..." value={buscaProdutoDashboard} onChange={(evento) => { setBuscaProdutoDashboard(evento.target.value); setMostrarTodosProdutosDashboard(false) }} className="w-full max-w-md rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-blue-500" /></div>
          <div className="overflow-x-auto"><table className="w-full min-w-[630px] text-left text-xs sm:text-sm"><thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-400"><tr>{organizandoEstoque && <th className="w-[112px] px-3 py-4">Ordem</th>}<th className="px-4 py-4 sm:px-5">Produto</th><th className="px-4 py-4">Estoque atual</th><th className="px-4 py-4">Mínimo</th>{empresaEhSD && <th className="px-4 py-4">Valor unitário</th>}<th className="px-4 py-4">Status</th></tr></thead><tbody>
            {listaEstoque.map((produto) => <tr key={produto.id} data-estoque-produto={produto.id} className={`border-t border-slate-100 ${arrastandoId === produto.id ? 'opacity-50' : ''} ${arrastandoId && destinoId === produto.id && arrastandoId !== produto.id ? 'ring-2 ring-inset ring-blue-500' : ''}`}>
              {organizandoEstoque && <td className="px-2 py-3"><div className="flex items-center gap-1">
                <button type="button" aria-label={`Arrastar ${produto.nome}`} title="Arraste para ordenar" disabled={salvandoOrdem} onPointerDown={(e) => iniciarArraste(e, produto.id)} onPointerMove={movimentarArraste} onPointerUp={finalizarArraste} onPointerCancel={() => { arrasteRef.current = null; setArrastandoId(null); setDestinoId(null) }} className="ef-drag-handle touch-none cursor-grab rounded-lg p-2 text-slate-400 hover:bg-blue-50 hover:text-blue-600 active:cursor-grabbing disabled:opacity-50"><IconeNav nome="grip" tamanho={19}/></button>
                <div className="flex flex-col"><button type="button" title="Subir um produto" aria-label={`Subir ${produto.nome}`} disabled={salvandoOrdem || produtosAtivos[0]?.id === produto.id} onClick={() => moverUmaPosicao(produto.id, -1)} className="rounded p-0.5 text-slate-500 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-20"><IconeNav nome="up" tamanho={15}/></button><button type="button" title="Descer um produto" aria-label={`Descer ${produto.nome}`} disabled={salvandoOrdem || produtosAtivos[produtosAtivos.length - 1]?.id === produto.id} onClick={() => moverUmaPosicao(produto.id, 1)} className="rounded p-0.5 text-slate-500 hover:bg-blue-50 hover:text-blue-600 disabled:opacity-20"><IconeNav nome="down" tamanho={15}/></button></div>
              </div></td>}
              <td className="px-4 py-4 sm:px-5"><div className="flex items-center gap-3"><span className="ef-stock-product-icon grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-slate-200 bg-slate-50 text-slate-500"><IconeNav nome="box" tamanho={18} /></span><div className="min-w-0"><p className="font-bold text-slate-900">{produto.nome}</p><p className="text-[11px] text-slate-400">{produto.codigo}{produto.emProducao ? ' · Em produção' : ''}</p></div></div></td><td className="px-4 py-4 font-extrabold text-slate-800">{formatarNumero(produto.estoqueAtual)} <span className="font-normal text-slate-400">un.</span></td><td className="px-4 py-4 text-slate-500">{formatarNumero(produto.estoqueMinimo)} un.</td>{empresaEhSD && <td className="px-4 py-4 text-slate-500">{Number(produto.valorUnitario || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 6 })}</td>}<td className="px-4 py-4"><span className={`whitespace-nowrap rounded-full px-3 py-1.5 text-[11px] font-bold ${statusProduto(produto) === 'Normal' ? 'bg-emerald-50 text-emerald-700' : statusProduto(produto) === 'Sem estoque' ? 'bg-red-50 text-red-600' : 'bg-amber-50 text-amber-700'}`}>{statusProduto(produto)}</span></td></tr>)}
            {!listaEstoque.length && <tr><td colSpan={(empresaEhSD ? 5 : 4) + (organizandoEstoque ? 1 : 0)} className="px-5 py-10 text-center text-slate-400">{carregandoProdutos ? 'Carregando produtos...' : 'Nenhum produto encontrado.'}</td></tr>}
          </tbody></table></div>
          {!organizandoEstoque && produtosFiltradosDashboard.length > 10 && <div className="border-t border-slate-100 px-5 py-4 text-center"><button type="button" onClick={() => setMostrarTodosProdutosDashboard((atual) => !atual)} className="ef-stock-more-button rounded-xl bg-slate-50 px-5 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-100">{mostrarTodosProdutosDashboard ? 'Ver menos produtos' : `Ver mais produtos (${produtosFiltradosDashboard.length - 10})`}</button></div>}
        </div>
      </section>
    )
  }

  return (
    <main className={`ef-app min-h-screen bg-[#f3f6fb] text-slate-900 ${modoEscuro ? 'ef-dark' : ''}`}>
      {/* Tema escuro inspirado no Figma, aplicado sem alterar o tema claro. */}
      <style>{`
        .ef-dark { background-color: #0f1728 !important; color: #edf3ff; }
        .ef-dark .bg-white { background-color: #19263c !important; }
        .ef-dark .bg-slate-50, .ef-dark .bg-slate-100 { background-color: #202e46 !important; }
        .ef-dark .text-slate-900, .ef-dark .text-slate-800, .ef-dark .text-slate-700 { color: #f1f5ff !important; }
        .ef-dark .text-slate-600, .ef-dark .text-slate-500 { color: #b2c0d9 !important; }
        .ef-dark .text-slate-400 { color: #8ca1c4 !important; }
        .ef-dark .border-slate-100, .ef-dark .border-slate-200, .ef-dark .border-slate-300 { border-color: #2a3a55 !important; }
        .ef-dark input, .ef-dark textarea, .ef-dark select { background-color: #152238; color: #f1f5ff; border-color: #3a4c69; }
        .ef-dark input::placeholder, .ef-dark textarea::placeholder { color: #8396b6; }
        .ef-dark option { color: #f1f5ff; background-color: #19263c; }
        .ef-dark table thead { background-color: #202e46 !important; }
        .ef-dark table tbody tr:hover { background-color: rgba(82,117,255,.06); }
        .ef-dark .bg-emerald-50 { background-color: #123c35 !important; }
        .ef-dark .bg-amber-50 { background-color: #48351c !important; }
        .ef-dark .bg-red-50 { background-color: #482733 !important; }
        .ef-dark .bg-blue-50 { background-color: #19365b !important; }
        .ef-dark .text-emerald-700 { color: #57deb7 !important; }
        .ef-dark .text-amber-700, .ef-dark .text-amber-800 { color: #ffc46b !important; }
        .ef-dark .text-red-600, .ef-dark .text-red-700 { color: #ff8d9b !important; }
        .ef-dark .text-blue-800 { color: #b2cbff !important; }
        .ef-dark .bg-\[\#eaf0ff\] { background-color: #243b64 !important; }
        /* Tokens específicos da Visão Geral: não alteram os indicadores no modo claro. */
        .ef-dark .ef-dashboard-kpi-icon {
          background-color: #263957 !important;
          color: #a9c0e9 !important;
          border: 1px solid #344969;
        }
        .ef-dark .ef-dashboard-kpi-icon.text-violet-600 { background-color: #332a50 !important; color: #bcadff !important; border-color: #4a3d72; }
        .ef-dark .ef-dashboard-kpi-icon.text-emerald-600 { background-color: #183c38 !important; color: #6ce4bf !important; border-color: #2c5a52; }
        .ef-dark .ef-dashboard-kpi-icon.text-amber-600 { background-color: #44351f !important; color: #ffc16a !important; border-color: #63502e; }
        /* Seletor de empresas acompanha o Figma nos dois temas. */
        .ef-dark .ef-company-trigger:hover,
        .ef-dark .ef-company-trigger:focus-visible { background-color: #233652 !important; }
        .ef-dark .ef-company-menu {
          background-color: #19263c !important;
          border-color: #293c58 !important;
          box-shadow: 0 18px 35px rgba(0,0,0,.3);
        }
        .ef-dark .ef-company-option[aria-selected="true"],
        .ef-dark .ef-company-option:hover { background-color: #23324a !important; }
        .ef-dark .ef-user-avatar {
          background-color: #273a59 !important;
          color: #d0deff !important;
          border: 1px solid #354c70;
        }
        .ef-dark .ef-theme-toggle:hover,
        .ef-dark .ef-theme-toggle:focus-visible {
          background-color: #293c5c !important;
          color: #e5efff !important;
        }
        .ef-dark .ef-organize-button:hover,
        .ef-dark .ef-organize-button:focus-visible {
          background-color: #293c5c !important;
          border-color: #48658e !important;
          color: #edf3ff !important;
        }
        /* Elementos da tabela de estoque: fundo escuro como no Figma */
        .ef-dark .ef-stock-product-icon {
          background-color: #23324a !important;
          border-color: #30435e !important;
          color: #9db1d2 !important;
        }
        .ef-dark .ef-stock-more-button {
          background-color: #23324a !important;
          border: 1px solid #30435e !important;
          color: #d8e4fb !important;
        }
        .ef-dark .ef-stock-more-button:hover {
          background-color: #2b4060 !important;
          border-color: #47638a !important;
        }
        .ef-dark .ef-drag-handle:hover { background: #263d68 !important; }
        .ef-dark ::-webkit-scrollbar { width: 9px; height: 9px; }
        .ef-dark ::-webkit-scrollbar-track { background: #111c2e; }
        .ef-dark ::-webkit-scrollbar-thumb { background: #3c4e69; border-radius: 10px; }
      `}</style>

      {/* Desktop: sidebar permanente, recolhível. */}
      <aside className={`hidden lg:flex fixed inset-y-0 left-0 z-40 flex-col bg-[#111e34] text-[#9cadc8] transition-all duration-200 ${menuRecolhido ? 'w-[76px]' : 'w-[244px]'}`}>
        <div className={`relative flex h-[76px] shrink-0 items-center border-b border-white/10 ${menuRecolhido ? 'justify-center px-2' : 'justify-between px-3'}`}>
          <div className="flex min-w-0 items-center gap-2.5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#315cf5] text-white shadow-md shadow-blue-700/20"><IconeNav nome="boxes" tamanho={23} /></span>
            {!menuRecolhido && <div className="min-w-0"><div className="truncate text-[16px] font-bold tracking-tight text-white">Estoque<span className="text-[#5687ff]">Fácil</span></div><div className="text-[8px] font-bold tracking-[0.19em] text-[#6f85ab]">GESTÃO INTELIGENTE</div></div>}
          </div>
          <button type="button" onClick={() => setMenuRecolhido(!menuRecolhido)} title={menuRecolhido ? 'Expandir menu' : 'Recolher menu'} aria-label={menuRecolhido ? 'Expandir menu' : 'Recolher menu'} className={`z-50 rounded-lg border border-white/20 bg-[#17263e] p-1.5 text-[#9aacc9] shadow-md hover:bg-[#243b5e] ${menuRecolhido ? 'absolute -right-3 top-5' : ''}`}><IconeNav nome="collapse" tamanho={17} className={menuRecolhido ? 'rotate-180' : ''} /></button>
        </div>
        <div className="flex-1 overflow-y-auto px-3 pt-6">
          {!menuRecolhido && <p className="mb-3 pl-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#60789d]">Menu principal</p>}
          <nav aria-label="Navegação principal" className="space-y-1">
            {paginasPermitidas.map((item) => (
              <button key={item.id} type="button" onClick={() => mudarTela(item.id)} title={menuRecolhido ? item.nome : undefined} aria-current={telaAtual === item.id ? 'page' : undefined} className={`flex h-12 w-full items-center gap-3 rounded-xl text-left text-sm font-semibold transition-colors ${menuRecolhido ? 'justify-center px-0' : 'px-3'} ${telaAtual === item.id ? 'bg-[#1a3057] text-white ring-1 ring-[#244a90] shadow-[inset_3px_0_0_#5687ff]' : 'hover:bg-white/[0.06] hover:text-white'}`}>
                <IconeNav nome={item.icone} tamanho={20} className="shrink-0" />
                {!menuRecolhido && <span>{item.nome}</span>}
              </button>
            ))}
          </nav>
        </div>
        <button type="button" onClick={onLogout} title="Sair da conta" className={`mx-3 mb-5 flex h-12 items-center gap-3 rounded-xl text-left text-sm font-semibold text-[#9cadc8] hover:bg-white/[0.06] hover:text-white ${menuRecolhido ? 'justify-center px-0' : 'px-3'}`}>
          <IconeNav nome="logout" tamanho={20} /> {!menuRecolhido && 'Sair da conta'}
        </button>
      </aside>

      {/* Mobile: menu lateral com fundo escurecido. */}
      {menuMobileAberto && (
        <div className="fixed inset-0 z-[80] lg:hidden">
          <button type="button" aria-label="Fechar menu lateral" className="absolute inset-0 bg-slate-950/60" onClick={() => setMenuMobileAberto(false)} />
          <aside className="relative flex h-full w-[min(83vw,300px)] flex-col bg-[#111e34] text-[#9cadc8] shadow-2xl">
            <div className="flex h-[72px] items-center justify-between border-b border-white/10 px-4">
              <div className="flex items-center gap-2.5"><span className="grid h-10 w-10 place-items-center rounded-xl bg-[#315cf5] text-white"><IconeNav nome="boxes" tamanho={23} /></span><div><div className="text-base font-bold text-white">Estoque<span className="text-[#5687ff]">Fácil</span></div><div className="text-[8px] font-bold tracking-[0.18em] text-[#6f85ab]">GESTÃO INTELIGENTE</div></div></div>
              <button type="button" aria-label="Fechar menu" onClick={() => setMenuMobileAberto(false)} className="rounded-lg p-2 hover:bg-white/10"><IconeNav nome="close" /></button>
            </div>
            <div className="flex-1 overflow-auto px-3 pt-6"><p className="mb-3 pl-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#60789d]">Menu principal</p><nav className="space-y-1">{paginasPermitidas.map((item) => <button key={item.id} type="button" onClick={() => mudarTela(item.id)} aria-current={telaAtual === item.id ? 'page' : undefined} className={`flex h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold ${telaAtual === item.id ? 'bg-[#1a3057] text-white shadow-[inset_3px_0_0_#5687ff]' : 'hover:bg-white/10 hover:text-white'}`}><IconeNav nome={item.icone} />{item.nome}</button>)}</nav></div>
            <button type="button" onClick={onLogout} className="mx-3 mb-6 flex h-12 items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold hover:bg-white/10 hover:text-white"><IconeNav nome="logout" />Sair da conta</button>
          </aside>
        </div>
      )}

      <div className={`min-w-0 transition-[margin] duration-200 ${menuRecolhido ? 'lg:ml-[76px]' : 'lg:ml-[244px]'}`}>
        <header className="sticky top-0 z-30 flex h-[72px] items-center gap-2 border-b border-slate-200 bg-white px-3 shadow-sm sm:px-6 lg:px-7">
          <button type="button" onClick={() => setMenuMobileAberto(true)} aria-label="Abrir menu" className="rounded-lg p-2 text-slate-700 hover:bg-slate-100 lg:hidden"><IconeNav nome="menu" tamanho={22} /></button>
          <div className="flex min-w-0 flex-1 items-center">
            <div ref={seletorEmpresaRef} className="relative max-w-full">
              <button
                type="button"
                aria-label="Alterar empresa ativa"
                aria-haspopup="listbox"
                aria-expanded={seletorEmpresaAberto}
                onClick={() => empresasUsuario.length > 1 && setSeletorEmpresaAberto((aberto) => !aberto)}
                className="ef-company-trigger flex min-w-0 max-w-full items-center gap-2 rounded-xl border border-transparent px-1.5 py-1.5 text-left transition-colors hover:bg-slate-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-500 sm:gap-3 sm:px-2"
              >
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-xs font-black text-white ${empresaEhSD ? 'bg-[#315cf5]' : 'bg-[#0e9b8d]'}`}>{empresaEhSD ? 'SD' : 'DG'}</span>
                <span className="min-w-0">
                  <span className="hidden text-[10px] font-bold uppercase tracking-wider text-slate-400 sm:block">Empresa ativa</span>
                  <span className="block max-w-[135px] truncate text-xs font-bold text-slate-800 sm:max-w-[230px] sm:text-sm">{empresaAtiva?.nome || 'Empresa'}</span>
                </span>
                {empresasUsuario.length > 1 && <IconeNav nome="chevron" tamanho={15} className={`shrink-0 text-slate-500 transition-transform ${seletorEmpresaAberto ? 'rotate-180' : ''}`} />}
              </button>
              {seletorEmpresaAberto && empresasUsuario.length > 1 && (
                <div className="ef-company-menu absolute left-0 top-[calc(100%+9px)] z-[70] w-[min(300px,calc(100vw-24px))] rounded-2xl border border-slate-200 bg-white p-2 shadow-xl" role="listbox" aria-label="Selecionar empresa">
                  <p className="px-2 py-2 text-[10px] font-bold uppercase tracking-[0.13em] text-slate-400">Alternar empresa</p>
                  {empresasUsuario.map((empresa) => {
                    const ativa = empresa.id === empresaAtiva?.id
                    const ehSD = empresa.nome?.trim().toLocaleLowerCase('pt-BR') === 'sd plásticos'
                    return (
                      <button
                        key={empresa.id}
                        type="button"
                        role="option"
                        aria-selected={ativa}
                        onClick={() => {
                          setSeletorEmpresaAberto(false)
                          if (!ativa) setEmpresaAtiva(empresa)
                        }}
                        className={`ef-company-option flex w-full items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors ${ativa ? 'bg-slate-50' : 'hover:bg-slate-50'}`}
                      >
                        <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl text-xs font-black text-white ${ehSD ? 'bg-[#315cf5]' : 'bg-[#0e9b8d]'}`}>{ehSD ? 'SD' : 'DG'}</span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-sm font-semibold text-slate-800">{empresa.nome}</span>
                          <span className="block text-[11px] text-slate-400">{ehSD ? 'Produção e indústria' : 'Comércio multicanal'}</span>
                        </span>
                        {ativa && <span className="text-lg text-slate-700" aria-label="Empresa ativa">✓</span>}
                      </button>
                    )
                  })}
                  <p className="mt-1 border-t border-slate-100 px-2 pt-2 text-[10px] text-slate-400">Dados isolados e protegidos por empresa</p>
                </div>
              )}
            </div>
          </div>
          <button type="button" onClick={() => setModoEscuro(!modoEscuro)} title={modoEscuro ? 'Ativar modo claro' : 'Ativar modo escuro'} aria-label={modoEscuro ? 'Ativar modo claro' : 'Ativar modo escuro'} className="ef-theme-toggle rounded-xl p-2 text-slate-500 hover:bg-slate-100"><IconeNav nome={modoEscuro ? 'sun' : 'moon'} tamanho={20} /></button>
          <div className="mx-1 h-9 w-px bg-slate-200 sm:mx-3" />
          <div className="flex items-center gap-3" title={usuarioLogado?.nome}>
            <span className="ef-user-avatar grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#e9eeff] text-xs font-bold text-[#315cf5]">{iniciais || 'US'}</span>
            <div className="hidden min-w-0 sm:block"><p className="max-w-[180px] truncate text-sm font-bold text-slate-800">{usuarioLogado?.nome || 'Usuário'}</p><p className="text-[11px] text-slate-400">{empresaAtiva?.perfil === 'admin' || empresaAtiva?.perfil === 'administrador' ? 'Administrador' : 'Usuário'}</p></div>
          </div>
        </header>

        <div className="mx-auto w-full max-w-[1580px] px-3 pb-28 pt-6 sm:px-6 lg:px-8 lg:pb-8">
          {renderizarConteudo()}
        </div>
      </div>

      {/* Navegação inferior: Relatórios acessíveis somente pela sidebar. */}
      <nav aria-label="Navegação inferior" className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white px-1 pb-[max(env(safe-area-inset-bottom),8px)] pt-2 shadow-[0_-8px_24px_rgba(15,23,42,0.06)] lg:hidden">
        <div className={`grid ${empresaEhSD ? 'grid-cols-5' : 'grid-cols-3'} gap-1`}>
          {paginasPermitidas.filter((item) => item.id !== 'relatorios').map((item) => (
            <button type="button" key={item.id} onClick={() => mudarTela(item.id)} aria-current={telaAtual === item.id ? 'page' : undefined} className={`flex min-h-[51px] flex-col items-center justify-center gap-1 rounded-xl px-0.5 text-[10px] font-semibold ${telaAtual === item.id ? 'text-[#315cf5]' : 'text-slate-400'}`}>
              <IconeNav nome={item.icone} tamanho={21} />
              <span className="truncate">{item.id === 'dashboard' ? 'Visão geral' : item.id === 'movimentacoes' ? 'Moviment.' : item.nome}</span>
            </button>
          ))}
        </div>
      </nav>
    </main>
  )
}

export default Dashboard