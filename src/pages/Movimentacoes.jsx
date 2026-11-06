import { useState } from 'react'
import { supabase } from '../services/supabase'

function Movimentacoes({
  produtos,
  movimentacoes,
  empresaAtiva,
  usuarioLogado,
  carregandoMovimentacoes,
  carregarProdutos,
  carregarMovimentacoes,
}) {
  const [salvando, setSalvando] = useState(false)
  const [estornandoId, setEstornandoId] = useState(null)
  const [mostrarHistoricoCompleto, setMostrarHistoricoCompleto] =
    useState(false)

  const [filtroProduto, setFiltroProduto] = useState('')
  const [buscaHistorico, setBuscaHistorico] = useState('')
  const [filtrosAvancados, setFiltrosAvancados] = useState(false)
  const [paginaHistorico, setPaginaHistorico] = useState(1)
  const [filtroTipo, setFiltroTipo] = useState('')
  const [filtroCanalVenda, setFiltroCanalVenda] = useState('')
  const [dataInicial, setDataInicial] = useState('')
  const [dataFinal, setDataFinal] = useState('')

  const [historicoCompleto, setHistoricoCompleto] = useState([])
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
    valorUnitario: '',
    observacao: '',
  })

  const nomeEmpresaAtiva = empresaAtiva?.nome?.toLowerCase() || ''

  const canaisVendaDega = [
    { valor: 'dega_moto_parts', nome: 'Dega Moto Parts' },
    { valor: 'emplajoi', nome: 'Emplajoi' },
    { valor: 'fecha_molde', nome: 'Fecha Molde' },
    { valor: 'shopee', nome: 'Shopee' },
  ]

  const canaisVendaSdPlasticos = [
    { valor: 'mercado_livre', nome: 'Mercado Livre' },
    { valor: 'zeca', nome: 'Zeca' },
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

  const produtosAtivos = produtos.filter((produto) => produto.ativo)

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

  const produtoSelecionado = produtos.find(
    (produto) => produto.id === novaMovimentacao.produtoId
  )

  const quantidadeInformada = Number(novaMovimentacao.quantidade || 0)
  const precoPadrao = Number(produtoSelecionado?.valorUnitario ?? produtoSelecionado?.valor_unitario ?? 0)
  const precoDigitado = novaMovimentacao.valorUnitario.trim()
  const precoEfetivo = precoDigitado === '' ? precoPadrao : Number(precoDigitado.replace(',', '.'))
  const valorTotal = quantidadeInformada > 0 && Number.isFinite(precoEfetivo) ? quantidadeInformada * precoEfetivo : 0
  const mostrarPreco = empresaEhSdPlasticos && novaMovimentacao.tipo === 'saida'
  const formatarNumero = (numero) => Number(numero || 0).toLocaleString('pt-BR')
  const formatarMoeda = (numero) => Number(numero || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
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
        consulta = consulta.eq('canal_venda', filtroCanalVenda)
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
    if (mostrarPreco && (!Number.isFinite(precoEfetivo) || precoEfetivo < 0 || Math.round(precoEfetivo * 100) / 100 !== precoEfetivo)) {
      alert('Informe um preço unitário válido com até duas casas decimais.')
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
      valorUnitario: '',
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

  function podeEstornar(movimentacao) {
    return !movimentacao.estornada && !movimentacao.movimentacaoOriginalId
  }

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

  const campo = 'mt-2 min-h-[44px] w-full rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100'
  const rotulo = 'block text-xs font-semibold text-slate-700'

  function BadgeTipo({ tipo }) {
    const entrada = tipo === 'entrada'
    return <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${entrada ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'}`}><Icone nome={tipo} size={13}/>{entrada ? 'Entrada' : 'Saída'}</span>
  }

  function BotaoEstorno({ movimentacao }) {
    if (!podeEstornar(movimentacao)) return <span className="text-xs text-slate-400">Estornada / estorno</span>
    return <button type="button" disabled={estornandoId === movimentacao.id} onClick={() => estornarMovimentacao(movimentacao)} className="rounded-lg px-2 py-1.5 text-xs font-semibold text-blue-600 hover:bg-blue-50 disabled:opacity-50">{estornandoId === movimentacao.id ? 'Estornando…' : 'Estornar'}</button>
  }

  function HistoricoTabela() {
    return <div className="overflow-x-auto"><table className="w-full min-w-[760px] border-collapse text-left text-sm"><thead className="border-y border-slate-100 bg-slate-50/80"><tr className="text-[10px] uppercase tracking-wider text-slate-400"><th className="px-5 py-3">Movimentação</th><th className="px-5 py-3">Produto</th><th className="px-5 py-3">Tipo</th><th className="px-5 py-3">Quantidade</th>{empresaUsaCanalVenda && <th className="px-5 py-3">Canal</th>}<th className="px-5 py-3">Observação</th><th className="px-5 py-3">Ações</th></tr></thead><tbody>{listaPagina.map((movimentacao) => <tr key={movimentacao.id} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/70"><td className="px-5 py-3"><p className="font-semibold text-slate-800">#{String(movimentacao.id).slice(0, 8).toUpperCase()}</p><p className="mt-1 text-[11px] text-slate-400">{dataLegivel(movimentacao.data)}</p></td><td className="px-5 py-3 font-medium text-slate-700">{movimentacao.produtoNome}</td><td className="px-5 py-3"><BadgeTipo tipo={movimentacao.tipo}/></td><td className="px-5 py-3 font-medium text-slate-700">{formatarNumero(movimentacao.quantidade)} un.</td>{empresaUsaCanalVenda && <td className="px-5 py-3 text-slate-600">{movimentacao.tipo === 'saida' ? formatarCanalVenda(movimentacao.canalVenda) : '—'}</td>}<td className="max-w-[220px] truncate px-5 py-3 text-slate-500" title={movimentacao.observacao || ''}>{movimentacao.observacao || '—'}</td><td className="px-5 py-3"><BotaoEstorno movimentacao={movimentacao}/></td></tr>)}</tbody></table>{listaPagina.length === 0 && <p className="p-8 text-center text-sm text-slate-500">Nenhuma movimentação encontrada.</p>}</div>
  }

  return <section className="w-full min-w-0 space-y-5 pb-8">
    <header className="min-w-0 pb-1">
      <h1 className="text-3xl font-extrabold tracking-tight text-slate-900">Movimentações</h1>
      <p className="mt-1 max-w-full break-words text-sm leading-relaxed text-slate-500">Registre entradas e saídas.</p>
    </header>
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1.85fr)_minmax(285px,1fr)] lg:items-stretch">
      {/* O resumo aparece acima do formulário no celular. */}
      <aside className="order-1 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:order-2 lg:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-sm font-bold text-slate-900">Resumo da operação</h3><span className={`rounded-full px-3 py-1 text-[11px] font-bold uppercase ${novaMovimentacao.tipo === 'entrada' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-600'}`}>● {novaMovimentacao.tipo === 'entrada' ? 'Entrada' : 'Saída'}</span></div>
        {produtoSelecionado ? <>
          <div className="mt-5 flex items-center gap-3 border-b border-slate-100 pb-5"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Icone nome="caixa" size={24}/></div><div className="min-w-0"><p className="text-[11px] font-bold uppercase tracking-wide text-blue-600">{produtoSelecionado.codigo || 'Produto'}</p><p className="truncate text-sm font-bold text-slate-900">{produtoSelecionado.nome}</p><p className="text-xs text-slate-400">{produtoSelecionado.categoria || 'Estoque'}</p></div></div>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 border-b border-slate-100 py-5"><div className="text-center"><p className="text-[11px] text-slate-400">Estoque atual</p><p className="mt-2 text-xl font-extrabold text-slate-900 lg:text-2xl">{formatarNumero(produtoSelecionado.estoqueAtual)}</p><p className="text-[11px] text-slate-400">unidades</p></div><Icone nome="seta" size={20} className="text-slate-400"/><div className={`rounded-xl px-2 py-4 text-center ${estoqueAposMovimentacao < 0 ? 'bg-red-50' : 'bg-emerald-50'}`}><p className="text-[11px] text-slate-500">Estoque previsto</p><p className={`mt-2 text-xl font-extrabold lg:text-2xl ${estoqueAposMovimentacao < 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{formatarNumero(quantidadeInformada > 0 ? estoqueAposMovimentacao : produtoSelecionado.estoqueAtual)}</p><p className="text-[11px] text-slate-400">unidades</p></div></div>
          <div className="space-y-3 py-5 text-sm"><div className="flex justify-between gap-3"><span className="text-slate-500">Quantidade</span><strong className="text-slate-800">{formatarNumero(quantidadeInformada)} un.</strong></div>{mostrarPreco && <><div className="flex justify-between gap-3"><span className="text-slate-500">Valor unitário efetivo</span><strong className="text-slate-800">{formatarMoeda(precoEfetivo)}</strong></div><div className="flex justify-between gap-3 border-t border-slate-100 pt-3"><span className="text-slate-500">Valor total</span><strong className="text-lg text-blue-600">{formatarMoeda(valorTotal)}</strong></div></>}</div>
          {mostrarPreco && <div className="flex items-start gap-2 rounded-xl bg-slate-50 px-3 py-3 text-xs leading-relaxed text-slate-500"><Icone nome="escudo" size={18} className="shrink-0 text-blue-600"/>O preço personalizado vale somente para esta saída e não altera o cadastro do produto.</div>}
          {ficaraAbaixoDoMinimo && <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs font-medium text-amber-800">Atenção: a saída deixará o estoque abaixo do mínimo cadastrado.</p>}
        </> : <div className="mt-5 flex items-center gap-3 rounded-xl border border-dashed border-slate-200 p-4 text-sm text-slate-500"><Icone nome="caixa" size={24} className="shrink-0 text-blue-500"/>Selecione um produto para visualizar o estoque atual e a previsão da operação.</div>}
      </aside>

      <div className="order-2 min-w-0 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm lg:order-1 lg:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3"><div><h3 className="text-base font-bold text-slate-900">Nova movimentação</h3><p className="mt-1 text-xs text-slate-400">Preencha os dados para atualizar o estoque</p></div></div>
        <div className="mt-5 grid grid-cols-2 gap-1 rounded-xl border border-slate-200 bg-slate-50 p-1">
          {['entrada','saida'].map(tipo => <button type="button" key={tipo} onClick={() => atualizarCampo('tipo',tipo)} className={`flex items-center justify-center gap-2 rounded-lg px-3 py-3 text-sm font-semibold transition ${novaMovimentacao.tipo === tipo ? 'border border-slate-100 bg-white shadow-sm' : 'text-slate-500 hover:bg-white/60'} ${tipo === 'entrada' && novaMovimentacao.tipo === tipo ? 'text-emerald-600' : ''} ${tipo === 'saida' && novaMovimentacao.tipo === tipo ? 'text-rose-500' : ''}`}><Icone nome={tipo} size={18}/>{tipo === 'entrada' ? 'Entrada' : 'Saída'}</button>)}
        </div>
        <form onSubmit={(event) => { event.preventDefault(); if (!salvando) salvarMovimentacao() }} className="mt-5 space-y-4">
          <div><label className={rotulo}>Produto</label><div className="relative"><div className="pointer-events-none absolute left-3 top-[22px] text-slate-400"><Icone nome="caixa" size={18}/></div><input type="text" autoComplete="off" value={buscaProdutoMovimentacao} onChange={event => {setBuscaProdutoMovimentacao(event.target.value); atualizarCampo('produtoId',''); setMostrarSugestoesProduto(true)}} onFocus={()=>setMostrarSugestoesProduto(true)} placeholder="Selecione ou busque um produto" className={`${campo} pl-10 pr-10`}/><div className="pointer-events-none absolute right-3 top-[22px] text-slate-400"><Icone nome="chevron" size={17}/></div>{mostrarSugestoesProduto && <div className="absolute z-30 mt-1 max-h-64 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">{produtosFiltradosMovimentacao.length ? produtosFiltradosMovimentacao.map(produto=><button type="button" key={produto.id} onClick={()=>selecionarProduto(produto)} className="w-full border-b border-slate-100 p-3 text-left last:border-0 hover:bg-blue-50"><p className="text-sm font-semibold text-slate-800">{produto.nome}</p><p className="text-xs text-slate-400">{produto.codigo || ''} · Estoque: {formatarNumero(produto.estoqueAtual)}</p></button>) : <p className="p-4 text-sm text-slate-500">Nenhum produto encontrado.</p>}</div>}</div></div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><div><label className={rotulo}>Quantidade</label><div className="relative"><input type="number" min="1" step="1" required value={novaMovimentacao.quantidade} onChange={event=>atualizarCampo('quantidade',event.target.value)} placeholder="0" className={`${campo} pr-12`}/><span className="pointer-events-none absolute right-4 top-[22px] text-xs text-slate-400">un.</span></div></div><div><label className={rotulo}>Data da movimentação</label><input type="date" required value={novaMovimentacao.data} onChange={event=>atualizarCampo('data',event.target.value)} className={campo}/></div></div>
          {novaMovimentacao.tipo === 'saida' && <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">{empresaUsaCanalVenda && <div><label className={rotulo}>Canal de venda</label><div className="relative"><span className="pointer-events-none absolute left-3 top-[22px] text-slate-400"><Icone nome="carrinho" size={16}/></span><select value={novaMovimentacao.canalVenda} onChange={event=>atualizarCampo('canalVenda',event.target.value)} className={`${campo} pl-9`}><option value="">Sem canal</option>{canaisVenda.map(canal=><option key={canal.valor} value={canal.valor}>{canal.nome}</option>)}</select></div></div>}{empresaEhSdPlasticos && <div><label className={rotulo}>Valor unitário personalizado <span className="font-normal text-slate-400">Opcional</span></label><div className="relative"><span className="pointer-events-none absolute left-3 top-[22px] text-xs text-slate-400">R$</span><input type="text" inputMode="decimal" value={novaMovimentacao.valorUnitario} onChange={event=>atualizarCampo('valorUnitario',event.target.value)} placeholder={precoPadrao.toFixed(2).replace('.',',')} className={`${campo} pl-10`}/></div><p className="mt-1 text-[11px] text-slate-400">Vazio utiliza o preço padrão de {formatarMoeda(precoPadrao)}</p></div>}</div>}
          <div><label className={rotulo}>Observação <span className="font-normal text-slate-400">Opcional</span></label><textarea rows={3} value={novaMovimentacao.observacao} onChange={event=>atualizarCampo('observacao',event.target.value)} placeholder="Adicione informações relevantes para esta movimentação..." className={`${campo} resize-y`}/></div>
          {saidaMaiorQueEstoque && <p className="rounded-xl bg-rose-50 p-3 text-xs font-semibold text-rose-700">A quantidade informada supera o estoque disponível.</p>}
          <button type="submit" disabled={salvando || saidaMaiorQueEstoque} className="flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-md shadow-blue-100 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"><Icone nome="check" size={18}/>{salvando ? 'Salvando…' : `Confirmar ${novaMovimentacao.tipo}`}</button>
        </form>
      </div>
    </div>

    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3 px-5 py-5 lg:px-6"><div><h3 className="text-base font-bold text-slate-900">Histórico de movimentações</h3><p className="mt-1 text-xs text-slate-400">Acompanhe e filtre todas as operações</p></div><button type="button" onClick={()=>setFiltrosAvancados(!filtrosAvancados)} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"><Icone nome="filtro" size={15}/>Filtros avançados</button></div>
      <div className="flex flex-col gap-3 border-t border-slate-100 px-5 py-4 sm:flex-row lg:px-6"><div className="relative min-w-0 flex-1"><span className="pointer-events-none absolute left-3 top-3 text-slate-400"><Icone nome="busca" size={17}/></span><input value={buscaHistorico} onChange={event=>{setBuscaHistorico(event.target.value);setPaginaHistorico(1)}} placeholder="Buscar produto..." className="w-full rounded-xl border border-slate-200 py-2.5 pl-10 pr-3 text-sm outline-none focus:border-blue-500"/></div><select value={filtroTipo} onChange={event=>{setFiltroTipo(event.target.value);setMostrarHistoricoCompleto(true)}} className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700"><option value="">Todos os tipos</option><option value="entrada">Entradas</option><option value="saida">Saídas</option></select><button type="button" onClick={()=>{setMostrarHistoricoCompleto(true);buscarHistoricoCompleto()}} disabled={carregandoHistoricoCompleto} className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-50">{carregandoHistoricoCompleto ? 'Buscando…' : 'Buscar histórico'}</button></div>
      {filtrosAvancados && <div className="grid grid-cols-1 gap-3 border-t border-slate-100 bg-slate-50/50 px-5 py-4 sm:grid-cols-2 lg:grid-cols-5 lg:px-6"><select value={filtroProduto} onChange={event=>setFiltroProduto(event.target.value)} className={campo}><option value="">Todos os produtos</option>{produtos.map(produto=><option key={produto.id} value={produto.id}>{produto.nome}</option>)}</select>{empresaUsaCanalVenda && <select value={filtroCanalVenda} onChange={event=>setFiltroCanalVenda(event.target.value)} className={campo}><option value="">Todos os canais</option>{canaisVenda.map(canal=><option key={canal.valor} value={canal.valor}>{canal.nome}</option>)}<option value="__sem_canal__">Não informado</option></select>}<input type="date" aria-label="Data inicial" value={dataInicial} onChange={event=>setDataInicial(event.target.value)} className={campo}/><input type="date" aria-label="Data final" value={dataFinal} onChange={event=>setDataFinal(event.target.value)} className={campo}/><button type="button" onClick={limparFiltrosHistorico} className="mt-2 rounded-xl bg-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-700">Limpar filtros</button>{filtroCanalVenda && filtroTipo === 'entrada' && <p className="col-span-full text-xs text-amber-700">Canais de venda se aplicam somente às saídas.</p>}</div>}
      {(carregandoMovimentacoes || carregandoHistoricoCompleto) ? <p className="p-8 text-center text-sm text-slate-500">Carregando movimentações…</p> : <HistoricoTabela/>}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-4 lg:px-6"><p className="text-xs text-slate-400">{historicoBuscado ? `Exibindo até 100 registros da busca · ${historicoFiltrado.length} carregados` : `Últimas ${historicoFiltrado.length} movimentações · use Buscar histórico para mais registros`}</p><div className="flex items-center gap-1"><button type="button" disabled={paginaAtual <= 1} onClick={()=>setPaginaHistorico(paginaAtual-1)} className="rounded-lg border border-slate-200 p-2 disabled:opacity-40"><Icone nome="esquerda" size={16}/></button>{Array.from({length: Math.min(paginas,5)},(_,i)=>i+1).map(pagina=><button key={pagina} type="button" onClick={()=>setPaginaHistorico(pagina)} className={`h-8 w-8 rounded-lg text-xs font-semibold ${pagina === paginaAtual ? 'bg-blue-600 text-white' : 'text-slate-500 hover:bg-slate-100'}`}>{pagina}</button>)}<button type="button" disabled={paginaAtual >= paginas} onClick={()=>setPaginaHistorico(paginaAtual+1)} className="rounded-lg border border-slate-200 p-2 disabled:opacity-40"><Icone nome="direita" size={16}/></button></div></div>
    </div>
  </section>
}

export default Movimentacoes
