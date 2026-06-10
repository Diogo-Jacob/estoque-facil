import { useEffect, useState } from 'react'
import { supabase } from '../services/supabase'
import Produtos from './Produtos'
import Movimentacoes from './Movimentacoes'
import Relatorios from './Relatorios'

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
      carregarProdutos()
      carregarMovimentacoes()
      carregarResumoDashboard()
    }
  }, [empresaAtiva])

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
        produtos (
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
      observacao: movimentacao.observacao || '',
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
        produtos (
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

  const produtosDashboard = mostrarTodosProdutosDashboard
    ? produtosFiltradosDashboard
    : produtosFiltradosDashboard.slice(0, 10)

  const produtosBaixoEstoque = produtosAtivos.filter(
    (produto) => produto.estoqueAtual < produto.estoqueMinimo
  )

  const movimentacoesValidas = movimentacoes.filter(
    (movimentacao) =>
      !movimentacao.estornada && !movimentacao.movimentacaoOriginalId
  )

  const ultimasMovimentacoes = [...movimentacoesValidas].slice(0, 5)

  function mudarTela(tela) {
    setTelaAtual(tela)

    if (tela === 'dashboard' && empresaAtiva?.id) {
      carregarProdutos()
      carregarMovimentacoes()
      carregarResumoDashboard()
    }
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

    return (
      <section>
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-slate-900">
            Painel Administrativo
          </h2>

          <p className="mt-2 text-slate-600">
            Resumo geral do estoque.
          </p>
        </div>

        <div className="mb-8 bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
              <div>
                <h3 className="text-xl font-bold text-slate-900">
                  Estoque
                </h3>

                <p className="mt-1 text-sm text-slate-500">
                  Produtos organizados conforme prioridade comercial.
                </p>
              </div>

              <input
                type="text"
                value={buscaProdutoDashboard}
                onChange={(event) => {
                  setBuscaProdutoDashboard(event.target.value)
                  setMostrarTodosProdutosDashboard(false)
                }}
                placeholder="Buscar produto..."
                className="w-full md:w-80 rounded-xl border border-slate-300 px-4 py-3 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          </div>

          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr className="text-left">
                  <th className="px-6 py-4">Produto</th>
                  <th className="px-6 py-4 text-right">Estoque</th>
                </tr>
              </thead>

              <tbody>
                {carregandoProdutos && (
                  <tr>
                    <td
                      colSpan="2"
                      className="px-6 py-8 text-center text-slate-500"
                    >
                      Carregando produtos...
                    </td>
                  </tr>
                )}

                {!carregandoProdutos &&
                  produtosDashboard.map((produto) => {
                    const baixoEstoque =
                      produto.estoqueAtual < produto.estoqueMinimo

                    return (
                      <tr key={produto.id} className="border-t border-slate-100">
                        <td className="px-6 py-4 font-medium text-slate-900">
                          {produto.nome}
                        </td>

                        <td className="px-6 py-4 text-right">
                          <span
                            className={
                              baixoEstoque
                                ? 'font-bold text-red-600'
                                : 'font-bold text-slate-900'
                            }
                          >
                            {produto.estoqueAtual}
                          </span>
                        </td>
                      </tr>
                    )
                  })}

                {!carregandoProdutos &&
                  produtosFiltradosDashboard.length === 0 && (
                    <tr>
                      <td
                        colSpan="2"
                        className="px-6 py-8 text-center text-slate-500"
                      >
                        {buscaProdutoDashboard
                          ? 'Nenhum produto encontrado para essa busca.'
                          : 'Nenhum produto ativo cadastrado.'}
                      </td>
                    </tr>
                  )}
              </tbody>
            </table>
          </div>

          <div className="md:hidden p-4 space-y-3">
            {carregandoProdutos && (
              <p className="text-center text-sm text-slate-500">
                Carregando produtos...
              </p>
            )}

            {!carregandoProdutos &&
              produtosDashboard.map((produto) => {
                const baixoEstoque =
                  produto.estoqueAtual < produto.estoqueMinimo

                return (
                  <div
                    key={produto.id}
                    className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm flex items-center justify-between gap-4"
                  >
                    <p className="font-semibold text-slate-900">
                      {produto.nome}
                    </p>

                    <span
                      className={
                        baixoEstoque
                          ? 'rounded-full bg-red-100 px-3 py-1 text-sm font-bold text-red-700'
                          : 'rounded-full bg-slate-100 px-3 py-1 text-sm font-bold text-slate-700'
                      }
                    >
                      {produto.estoqueAtual}
                    </span>
                  </div>
                )
              })}

            {!carregandoProdutos &&
              produtosFiltradosDashboard.length === 0 && (
                <p className="text-center text-sm text-slate-500">
                  {buscaProdutoDashboard
                    ? 'Nenhum produto encontrado para essa busca.'
                    : 'Nenhum produto ativo cadastrado.'}
                </p>
              )}
          </div>

          {produtosFiltradosDashboard.length > 10 && (
            <div className="px-6 py-4 border-t border-slate-100 text-center">
              <button
                onClick={() =>
                  setMostrarTodosProdutosDashboard(
                    !mostrarTodosProdutosDashboard
                  )
                }
                className="rounded-xl bg-slate-100 px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-200"
              >
                {mostrarTodosProdutosDashboard
                  ? 'Ver menos produtos'
                  : `Ver mais produtos (${produtosFiltradosDashboard.length - 10})`}
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 gap-5">
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-2">
              <div>
                <h3 className="text-lg font-bold text-slate-900">
                  Itens em produção
                </h3>
              </div>

              {produtosEmProducao.length > 5 && (
                <span className="text-xs font-semibold text-slate-400">
                  +{produtosEmProducao.length - 5} item(ns) em produção
                </span>
              )}
            </div>

            {produtosEmProducao.length > 0 ? (
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {produtosEmProducao.slice(0, 5).map((produto) => (
                  <div
                    key={produto.id}
                    className="rounded-xl border border-blue-100 bg-blue-50 p-4"
                  >
                    <strong className="block text-base text-slate-900">
                      {produto.nome}
                    </strong>

                    <p className="mt-1 text-sm text-slate-600">
                      Estoque atual: {produto.estoqueAtual}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4">
                <strong className="block text-base text-slate-700">
                  Nenhum item em produção
                </strong>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-white rounded-2xl shadow-sm p-5">
              <p className="text-sm text-slate-500">Saídas hoje</p>
              <strong className="mt-2 block text-3xl text-slate-900">
                {carregandoResumoDashboard
                  ? '...'
                  : resumoDashboard.saidasHoje}
              </strong>
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-5">
              <p className="text-sm text-slate-500">Estoque baixo</p>
              <strong className="mt-2 block text-3xl text-red-600">
                {produtosBaixoEstoque.length}
              </strong>
            </div>

            <div className="bg-white rounded-2xl shadow-sm p-5">
              <p className="text-sm text-slate-500">Mais vendido hoje</p>
              <strong className="mt-2 block text-lg text-slate-900">
                {carregandoResumoDashboard
                  ? '...'
                  : resumoDashboard.produtoMaisVendidoHoje
                    ? resumoDashboard.produtoMaisVendidoHoje.produtoNome
                    : 'Sem vendas'}
              </strong>
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h3 className="text-xl font-bold text-slate-900">
              Produtos com estoque baixo
            </h3>

            <div className="mt-4 space-y-3">
              {produtosBaixoEstoque.length > 0 ? (
                produtosBaixoEstoque.map((produto) => (
                  <div
                    key={produto.id}
                    className="rounded-xl border border-red-100 bg-red-50 p-4"
                  >
                    <p className="font-semibold text-slate-900">
                      {produto.nome}
                    </p>

                    <p className="mt-1 text-sm text-red-700">
                      Estoque atual: {produto.estoqueAtual} | Mínimo:{' '}
                      {produto.estoqueMinimo}
                    </p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-slate-500">
                  Nenhum produto abaixo do estoque mínimo.
                </p>
              )}
            </div>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-6">
            <h3 className="text-xl font-bold text-slate-900">
              Últimas movimentações
            </h3>

            <div className="mt-4 overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b text-left text-slate-500">
                    <th className="py-3">Produto</th>
                    <th className="py-3">Tipo</th>
                    <th className="py-3">Qtd.</th>
                    <th className="py-3">Data</th>
                  </tr>
                </thead>

                <tbody>
                  {ultimasMovimentacoes.map((movimentacao) => (
                    <tr key={movimentacao.id} className="border-b last:border-0">
                      <td className="py-3 text-slate-700">
                        {movimentacao.produtoNome}
                      </td>

                      <td className="py-3 text-slate-700">
                        {movimentacao.tipo === 'entrada' ? 'Entrada' : 'Saída'}
                      </td>

                      <td className="py-3 text-slate-700">
                        {movimentacao.quantidade}
                      </td>

                      <td className="py-3 text-slate-700">
                        {formatarDataBrasil(movimentacao.data)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {ultimasMovimentacoes.length === 0 && (
                <p className="mt-4 text-sm text-slate-500">
                  Nenhuma movimentação registrada.
                </p>
              )}
            </div>
          </div>
        </div>
      </section>
    )
  }

  return (
    <main className="min-h-screen bg-slate-100">
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm text-blue-600 font-semibold uppercase">
                Sistema de estoque
              </p>

              <h1 className="text-2xl font-bold text-slate-900">
                Estoque Fácil
              </h1>
            </div>

            <nav className="hidden lg:flex flex-wrap gap-2">
              {empresasUsuario.length > 1 && (
                <select
                  value={empresaAtiva?.id || ''}
                  onChange={(event) => {
                    const empresaSelecionada = empresasUsuario.find(
                      (empresa) => empresa.id === event.target.value
                    )

                    setEmpresaAtiva(empresaSelecionada)
                  }}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  {empresasUsuario.map((empresa) => (
                    <option key={empresa.id} value={empresa.id}>
                      {empresa.nome}
                    </option>
                  ))}
                </select>
              )}

              <button
                onClick={() => mudarTela('dashboard')}
                className={estiloBotaoMenu('dashboard')}
              >
                Painel Administrativo
              </button>

              <button
                onClick={() => mudarTela('produtos')}
                className={estiloBotaoMenu('produtos')}
              >
                Produtos
              </button>

              <button
                onClick={() => mudarTela('movimentacoes')}
                className={estiloBotaoMenu('movimentacoes')}
              >
                Movimentações
              </button>

              <button
                onClick={() => mudarTela('relatorios')}
                className={estiloBotaoMenu('relatorios')}
              >
                Relatórios
              </button>

              <button
                onClick={onLogout}
                className="rounded-xl px-4 py-2 text-xs font-semibold text-slate-400 hover:text-red-600"
              >
                Sair da conta
              </button>
            </nav>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 pt-8 pb-28 lg:pb-8">
        {renderizarConteudo()}
      </div>

      <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 border-t border-slate-200 bg-white px-3 py-2 shadow-[0_-8px_24px_rgba(15,23,42,0.08)]">
        <div className="grid grid-cols-4 gap-1">
          <button
            onClick={() => mudarTela('dashboard')}
            className={estiloBotaoMenuMobile('dashboard')}
          >
            <span className="block text-lg">⌂</span>
            Painel
          </button>

          <button
            onClick={() => mudarTela('produtos')}
            className={estiloBotaoMenuMobile('produtos')}
          >
            <span className="block text-lg">□</span>
            Produtos
          </button>

          <button
            onClick={() => mudarTela('movimentacoes')}
            className={estiloBotaoMenuMobile('movimentacoes')}
          >
            <span className="block text-lg">⇅</span>
            Movim.
          </button>

          <button
            onClick={() => mudarTela('relatorios')}
            className={estiloBotaoMenuMobile('relatorios')}
          >
            <span className="block text-lg">▤</span>
            Relat.
          </button>
        </div>
      </nav>
    </main>
  )
}

export default Dashboard