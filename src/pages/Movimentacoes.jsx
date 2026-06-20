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
  const [filtroTipo, setFiltroTipo] = useState('')
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
    observacao: '',
  })

  const empresaUsaCanalVenda =
    empresaAtiva?.usa_canal_venda === true ||
    empresaAtiva?.usaCanalVenda === true ||
    empresaAtiva?.nome?.toLowerCase().includes('dega')

  const canaisVenda = [
    { valor: 'dega_moto_parts', nome: 'Dega Moto Parts' },
    { valor: 'emplajoi', nome: 'Emplajoi' },
    { valor: 'fecha_molde', nome: 'Fecha Molde' },
    { valor: 'shopee', nome: 'Shopee' },
  ]

  function formatarCanalVenda(canal) {
    if (!canal) return 'Não informado'

    const canalEncontrado = canaisVenda.find(
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
        produtos (
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
    setCarregandoHistoricoCompleto(false)
  }

  function limparFiltrosHistorico() {
    setFiltroProduto('')
    setFiltroTipo('')
    setDataInicial('')
    setDataFinal('')
    setHistoricoCompleto([])
    setHistoricoBuscado(false)
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

  function BadgeTipo({ tipo }) {
    return (
      <span
        className={
          tipo === 'entrada'
            ? 'rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700'
            : 'rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700'
        }
      >
        {tipo === 'entrada' ? 'Entrada' : 'Saída'}
      </span>
    )
  }

  function BotaoEstorno({ movimentacao, mobile = false }) {
    if (!podeEstornar(movimentacao)) {
      return mobile ? (
        <div className="rounded-xl bg-slate-50 px-4 py-3 text-center">
          <span className="text-sm font-medium text-slate-400">
            Esta movimentação é um estorno ou já foi estornada
          </span>
        </div>
      ) : (
        <span className="text-xs text-slate-400">Estorno</span>
      )
    }

    return (
      <button
        onClick={() => estornarMovimentacao(movimentacao)}
        disabled={estornandoId === movimentacao.id}
        className={
          mobile
            ? 'w-full rounded-xl bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-60 disabled:cursor-not-allowed'
            : 'text-sm font-semibold text-blue-600 hover:text-blue-800 disabled:opacity-60 disabled:cursor-not-allowed'
        }
      >
        {estornandoId === movimentacao.id
          ? 'Estornando...'
          : mobile
            ? 'Estornar movimentação'
            : 'Estornar'}
      </button>
    )
  }

  function TabelaMovimentacoes({ lista }) {
    return (
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500">
            <tr className="text-left">
              <th className="px-5 py-4">Produto</th>
              <th className="px-5 py-4">Tipo</th>
              <th className="px-5 py-4">Quantidade</th>
              <th className="px-5 py-4">Data</th>
              {empresaUsaCanalVenda && (
                <th className="px-5 py-4">Canal</th>
              )}
              <th className="px-5 py-4">Observação</th>
              <th className="px-5 py-4">Ações</th>
            </tr>
          </thead>

          <tbody>
            {lista.map((movimentacao) => (
              <tr key={movimentacao.id} className="border-t border-slate-100">
                <td className="px-5 py-4 font-medium text-slate-900">
                  {movimentacao.produtoNome}
                </td>

                <td className="px-5 py-4">
                  <BadgeTipo tipo={movimentacao.tipo} />
                </td>

                <td className="px-5 py-4 text-slate-600">
                  {movimentacao.quantidade}
                </td>

                <td className="px-5 py-4 text-slate-600">
                  {movimentacao.data}
                </td>

                {empresaUsaCanalVenda && (
                  <td className="px-5 py-4 text-slate-600">
                    {movimentacao.tipo === 'saida'
                      ? formatarCanalVenda(movimentacao.canalVenda)
                      : '-'}
                  </td>
                )}

                <td className="px-5 py-4 text-slate-600">
                  {movimentacao.observacao || '-'}
                </td>

                <td className="px-5 py-4">
                  <BotaoEstorno movimentacao={movimentacao} />
                </td>
              </tr>
            ))}

            {lista.length === 0 && (
              <tr>
                <td
                  colSpan={empresaUsaCanalVenda ? 7 : 6}
                  className="px-5 py-8 text-center text-slate-500"
                >
                  Nenhuma movimentação encontrada.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    )
  }

  function CardsMovimentacoes({ lista }) {
    return (
      <div className="md:hidden p-4 space-y-3">
        {lista.map((movimentacao) => (
          <div
            key={movimentacao.id}
            className="rounded-xl border border-slate-100 bg-white p-4 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-semibold text-slate-900">
                  {movimentacao.produtoNome}
                </p>

                <p className="mt-1 text-sm text-slate-500">
                  {movimentacao.data}
                </p>
              </div>

              <BadgeTipo tipo={movimentacao.tipo} />
            </div>

            <div
              className={
                empresaUsaCanalVenda && movimentacao.tipo === 'saida'
                  ? 'mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3'
                  : 'mt-3 grid grid-cols-2 gap-3'
              }
            >
              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Quantidade</p>
                <p className="text-lg font-bold text-slate-900">
                  {movimentacao.quantidade}
                </p>
              </div>

              {empresaUsaCanalVenda && movimentacao.tipo === 'saida' && (
                <div className="rounded-lg bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Canal</p>
                  <p className="text-sm font-semibold text-slate-700">
                    {formatarCanalVenda(movimentacao.canalVenda)}
                  </p>
                </div>
              )}

              <div className="rounded-lg bg-slate-50 p-3">
                <p className="text-xs text-slate-500">Observação</p>
                <p className="text-sm text-slate-700">
                  {movimentacao.observacao || '-'}
                </p>
              </div>
            </div>

            <div className="mt-4">
              <BotaoEstorno movimentacao={movimentacao} mobile />
            </div>
          </div>
        ))}

        {lista.length === 0 && (
          <p className="text-center text-sm text-slate-500">
            Nenhuma movimentação encontrada.
          </p>
        )}
      </div>
    )
  }

  return (
    <section>
      <div>
        <h2 className="text-3xl font-bold text-slate-900">Movimentações</h2>

        <p className="mt-2 text-slate-600">
          Registre entradas e saídas de produtos no estoque.
        </p>
      </div>

      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl shadow-sm p-6">
          <h3 className="text-xl font-bold text-slate-900">
            Nova movimentação
          </h3>

          <p className="mt-1 text-sm text-slate-500">
            Preencha os dados para atualizar o estoque.
          </p>

          <form className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700">
                Produto
              </label>

              <div className="relative mt-1">
                <input
                  type="text"
                  value={buscaProdutoMovimentacao}
                  onChange={(event) => {
                    setBuscaProdutoMovimentacao(event.target.value)
                    atualizarCampo('produtoId', '')
                    setMostrarSugestoesProduto(true)
                  }}
                  onFocus={() => setMostrarSugestoesProduto(true)}
                  placeholder="Digite para buscar um produto"
                  className="w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />

                {mostrarSugestoesProduto && (
                  <div className="absolute z-30 mt-2 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg">
                    {produtosFiltradosMovimentacao.length > 0 ? (
                      produtosFiltradosMovimentacao.map((produto) => (
                        <button
                          key={produto.id}
                          type="button"
                          onClick={() => selecionarProduto(produto)}
                          className="w-full border-b border-slate-100 px-4 py-3 text-left hover:bg-slate-50 last:border-b-0"
                        >
                          <p className="font-semibold text-slate-900">
                            {produto.nome}
                          </p>

                          <p className="mt-1 text-xs text-slate-500">
                            Estoque atual: {produto.estoqueAtual}
                          </p>
                        </button>
                      ))
                    ) : (
                      <p className="px-4 py-3 text-sm text-slate-500">
                        Nenhum produto encontrado.
                      </p>
                    )}
                  </div>
                )}

                {novaMovimentacao.produtoId && (
                  <p className="mt-2 text-xs font-medium text-green-700">
                    Produto selecionado.
                  </p>
                )}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Tipo
              </label>

              <div className="mt-1 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => atualizarCampo('tipo', 'entrada')}
                  className={
                    novaMovimentacao.tipo === 'entrada'
                      ? 'rounded-xl bg-green-600 px-4 py-3 text-base font-semibold text-white'
                      : 'rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-700 hover:bg-slate-50'
                  }
                >
                  Entrada
                </button>

                <button
                  type="button"
                  onClick={() => atualizarCampo('tipo', 'saida')}
                  className={
                    novaMovimentacao.tipo === 'saida'
                      ? 'rounded-xl bg-red-600 px-4 py-3 text-base font-semibold text-white'
                      : 'rounded-xl border border-slate-300 bg-white px-4 py-3 text-base font-semibold text-slate-700 hover:bg-slate-50'
                  }
                >
                  Saída
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Data
              </label>

              <input
                type="date"
                value={novaMovimentacao.data}
                onChange={(event) => atualizarCampo('data', event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Quantidade
              </label>

              <input
                type="number"
                min="1"
                value={novaMovimentacao.quantidade}
                onChange={(event) =>
                  atualizarCampo('quantidade', event.target.value)
                }
                placeholder="Ex: 10"
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            {empresaUsaCanalVenda && novaMovimentacao.tipo === 'saida' && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700">
                  Canal de venda <span className="font-normal text-slate-400">(opcional)</span>
                </label>

                <select
                  value={novaMovimentacao.canalVenda}
                  onChange={(event) =>
                    atualizarCampo('canalVenda', event.target.value)
                  }
                  className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                >
                  <option value="">Selecione o canal de venda</option>

                  {canaisVenda.map((canal) => (
                    <option key={canal.valor} value={canal.valor}>
                      {canal.nome}
                    </option>
                  ))}
                </select>

                <p className="mt-2 text-xs text-slate-500">
                  Se informado, o canal será incluído no ranking do relatório.
                </p>
              </div>
            )}

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700">
                Observação
              </label>

              <textarea
                value={novaMovimentacao.observacao}
                onChange={(event) =>
                  atualizarCampo('observacao', event.target.value)
                }
                placeholder="Ex: venda do dia, compra de fornecedor..."
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 text-base outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                rows="3"
              />
            </div>

            {saidaMaiorQueEstoque && (
              <div className="md:col-span-2 rounded-xl bg-red-50 border border-red-100 p-4">
                <p className="text-sm font-medium text-red-700">
                  A quantidade informada é maior que o estoque disponível.
                </p>
              </div>
            )}

            {ficaraAbaixoDoMinimo && !saidaMaiorQueEstoque && (
              <div className="md:col-span-2 rounded-xl bg-yellow-50 border border-yellow-100 p-4">
                <p className="text-sm font-medium text-yellow-800">
                  Atenção: essa saída deixará o produto abaixo do estoque mínimo.
                </p>
              </div>
            )}

            <div className="md:col-span-2">
              <button
                type="button"
                onClick={salvarMovimentacao}
                disabled={salvando || saidaMaiorQueEstoque}
                className="w-full sm:w-auto rounded-xl bg-blue-600 px-6 py-4 font-semibold text-white hover:bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {salvando ? 'Salvando...' : 'Salvar movimentação'}
              </button>
            </div>
          </form>
        </div>

        <aside className="bg-white rounded-2xl shadow-sm p-6">
          <h3 className="text-xl font-bold text-slate-900">
            Produto selecionado
          </h3>

          {produtoSelecionado ? (
            <div className="mt-4 space-y-4">
              <div>
                <p className="text-sm text-slate-500">Produto</p>
                <p className="font-semibold text-slate-900">
                  {produtoSelecionado.nome}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs text-slate-500">Estoque atual</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">
                    {produtoSelecionado.estoqueAtual}
                  </p>
                </div>

                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="text-xs text-slate-500">Estoque mínimo</p>
                  <p className="mt-1 text-2xl font-bold text-slate-900">
                    {produtoSelecionado.estoqueMinimo}
                  </p>
                </div>
              </div>

              <div className="rounded-xl bg-blue-50 border border-blue-100 p-4">
                <p className="text-xs text-blue-700">
                  Estoque após movimentação
                </p>

                <p className="mt-1 text-2xl font-bold text-blue-900">
                  {quantidadeInformada > 0
                    ? estoqueAposMovimentacao
                    : produtoSelecionado.estoqueAtual}
                </p>
              </div>

              {produtoSelecionado.observacao && (
                <div>
                  <p className="text-sm text-slate-500">Observação</p>
                  <p className="text-sm text-slate-700">
                    {produtoSelecionado.observacao}
                  </p>
                </div>
              )}
            </div>
          ) : (
            <div className="mt-4 rounded-xl bg-slate-50 border border-dashed border-slate-300 p-4">
              <p className="text-sm text-slate-500">
                Selecione um produto para visualizar estoque atual, mínimo e
                previsão após a movimentação.
              </p>
            </div>
          )}
        </aside>
      </div>

      <div className="mt-6 bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h3 className="text-xl font-bold text-slate-900">
              Últimas movimentações
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              As 10 movimentações mais recentes. Para corrigir um lançamento,
              use a opção de estorno.
            </p>
          </div>

          <button
            onClick={() =>
              setMostrarHistoricoCompleto(!mostrarHistoricoCompleto)
            }
            className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-200"
          >
            {mostrarHistoricoCompleto
              ? 'Ocultar histórico completo'
              : 'Ver histórico completo'}
          </button>
        </div>

        {carregandoMovimentacoes ? (
          <p className="px-5 py-8 text-center text-slate-500">
            Carregando movimentações...
          </p>
        ) : (
          <>
            <TabelaMovimentacoes lista={movimentacoesRecentes} />
            <CardsMovimentacoes lista={movimentacoesRecentes} />
          </>
        )}
      </div>

      {mostrarHistoricoCompleto && (
        <div className="mt-6 bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-slate-100">
            <h3 className="text-xl font-bold text-slate-900">
              Histórico completo
            </h3>

            <p className="mt-1 text-sm text-slate-500">
              Use os filtros e clique em buscar. A consulta retorna até 100
              movimentações por vez.
            </p>
          </div>

          <div className="p-5 grid grid-cols-1 md:grid-cols-5 gap-4 border-b border-slate-100">
            <select
              value={filtroProduto}
              onChange={(event) => setFiltroProduto(event.target.value)}
              className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">Todos os produtos</option>

              {produtos.map((produto) => (
                <option key={produto.id} value={produto.id}>
                  {produto.nome}
                </option>
              ))}
            </select>

            <select
              value={filtroTipo}
              onChange={(event) => setFiltroTipo(event.target.value)}
              className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">Todos os tipos</option>
              <option value="entrada">Entrada</option>
              <option value="saida">Saída</option>
            </select>

            <input
              type="date"
              value={dataInicial}
              onChange={(event) => setDataInicial(event.target.value)}
              className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />

            <input
              type="date"
              value={dataFinal}
              onChange={(event) => setDataFinal(event.target.value)}
              className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />

            <button
              onClick={limparFiltrosHistorico}
              className="rounded-xl bg-slate-100 px-4 py-3 font-semibold text-slate-700 hover:bg-slate-200"
            >
              Limpar filtros
            </button>

            <button
              onClick={buscarHistoricoCompleto}
              disabled={carregandoHistoricoCompleto}
              className="md:col-span-5 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {carregandoHistoricoCompleto
                ? 'Buscando histórico...'
                : 'Buscar histórico'}
            </button>
          </div>

          <div className="px-6 py-4 border-b border-slate-100">
            <p className="text-sm text-slate-500">
              {!historicoBuscado
                ? 'Nenhuma busca realizada ainda.'
                : `${historicoCompleto.length} movimentação(ões) encontrada(s).`}
            </p>
          </div>

          {carregandoHistoricoCompleto ? (
            <p className="px-5 py-8 text-center text-slate-500">
              Carregando histórico completo...
            </p>
          ) : (
            <>
              <TabelaMovimentacoes lista={historicoCompleto} />
              <CardsMovimentacoes lista={historicoCompleto} />
            </>
          )}
        </div>
      )}
    </section>
  )
}

export default Movimentacoes