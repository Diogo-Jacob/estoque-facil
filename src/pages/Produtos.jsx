import { useState } from 'react'
import { supabase } from '../services/supabase'

function Produtos({ produtos, setProdutos, empresaAtiva, carregandoProdutos }) {
  const [busca, setBusca] = useState('')
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [produtoEditandoId, setProdutoEditandoId] = useState(null)
  const [menuAbertoProdutoId, setMenuAbertoProdutoId] = useState(null)

  const [formProduto, setFormProduto] = useState({
    nome: '',
    codigo: '',
    categoria: '',
    estoqueAtual: '',
    estoqueMinimo: '',
    observacao: '',
    emProducao: false,
  })

  const produtosFiltrados = produtos.filter((produto) => {
    const textoBusca = busca.toLowerCase()

    return (
      produto.nome.toLowerCase().includes(textoBusca) ||
      produto.codigo.toLowerCase().includes(textoBusca) ||
      produto.categoria.toLowerCase().includes(textoBusca)
    )
  })

  const produtosAtivos = produtos.filter((produto) => produto.ativo)
  const produtosEmProducao = produtosAtivos.filter(
    (produto) => produto.emProducao
  )

  function atualizarCampo(campo, valor) {
    setFormProduto({
      ...formProduto,
      [campo]: valor,
    })
  }

  function limparFormulario() {
    setFormProduto({
      nome: '',
      codigo: '',
      categoria: '',
      estoqueAtual: '',
      estoqueMinimo: '',
      observacao: '',
      emProducao: false,
    })

    setProdutoEditandoId(null)
    setMostrarFormulario(false)
  }

  function abrirCadastro() {
    setProdutoEditandoId(null)
    setMenuAbertoProdutoId(null)

    setFormProduto({
      nome: '',
      codigo: '',
      categoria: '',
      estoqueAtual: '',
      estoqueMinimo: '',
      observacao: '',
      emProducao: false,
    })

    setMostrarFormulario(true)
  }

  function abrirEdicao(produto) {
    setProdutoEditandoId(produto.id)
    setMenuAbertoProdutoId(null)

    setFormProduto({
      nome: produto.nome,
      codigo: produto.codigo === 'Sem código' ? '' : produto.codigo,
      categoria: produto.categoria === 'Sem categoria' ? '' : produto.categoria,
      estoqueAtual: produto.estoqueAtual,
      estoqueMinimo: produto.estoqueMinimo,
      observacao: produto.observacao || '',
      emProducao: produto.emProducao || false,
    })

    setMostrarFormulario(true)
  }

  async function salvarProduto() {
    if (!empresaAtiva?.id) {
      alert('Selecione uma empresa antes de salvar produtos.')
      return
    }

    if (!formProduto.nome.trim()) {
      alert('Informe o nome do produto.')
      return
    }

    if (Number(formProduto.estoqueAtual || 0) < 0) {
      alert('O estoque atual não pode ser negativo.')
      return
    }

    if (Number(formProduto.estoqueMinimo || 0) < 0) {
      alert('O estoque mínimo não pode ser negativo.')
      return
    }

    setSalvando(true)

    const produtoParaSalvar = {
      empresa_id: empresaAtiva.id,
      nome: formProduto.nome.trim(),
      codigo: formProduto.codigo.trim() || null,
      categoria: formProduto.categoria.trim() || null,
      estoque_atual: Number(formProduto.estoqueAtual || 0),
      estoque_minimo: Number(formProduto.estoqueMinimo || 0),
      observacao: formProduto.observacao.trim() || null,
      em_producao: formProduto.emProducao,
      ativo: true,
    }

    if (produtoEditandoId) {
      const { data, error } = await supabase
        .from('produtos')
        .update(produtoParaSalvar)
        .eq('id', produtoEditandoId)
        .eq('empresa_id', empresaAtiva.id)
        .select()
        .single()

      if (error) {
        console.error('Erro ao editar produto:', error)
        alert('Erro ao editar produto.')
        setSalvando(false)
        return
      }

      const produtoFormatado = formatarProduto(data)

      const produtosAtualizados = produtos.map((produto) =>
        produto.id === produtoEditandoId ? produtoFormatado : produto
      )

      setProdutos(produtosAtualizados)
      setSalvando(false)
      limparFormulario()
      return
    }

    const { data, error } = await supabase
      .from('produtos')
      .insert(produtoParaSalvar)
      .select()
      .single()

    if (error) {
      console.error('Erro ao cadastrar produto:', error)
      alert('Erro ao cadastrar produto.')
      setSalvando(false)
      return
    }

    const produtoFormatado = formatarProduto(data)

    setProdutos([produtoFormatado, ...produtos])
    setSalvando(false)
    limparFormulario()
  }

  function formatarProduto(data) {
    return {
      id: data.id,
      empresaId: data.empresa_id,
      nome: data.nome,
      codigo: data.codigo || 'Sem código',
      categoria: data.categoria || 'Sem categoria',
      estoqueAtual: data.estoque_atual,
      estoqueMinimo: data.estoque_minimo,
      observacao: data.observacao || '',
      ativo: data.ativo,
      emProducao: data.em_producao || false,
      ordemExibicao: data.ordem_exibicao ?? 9999,
    }
  }

  async function alterarStatusProduto(produto, novoStatus) {
    const acao = novoStatus ? 'reativar' : 'inativar'
    const confirmar = confirm(`Deseja ${acao} este produto?`)

    if (!confirmar) return

    const { error } = await supabase
      .from('produtos')
      .update({ ativo: novoStatus })
      .eq('id', produto.id)
      .eq('empresa_id', empresaAtiva.id)

    if (error) {
      console.error(`Erro ao ${acao} produto:`, error)
      alert(`Erro ao ${acao} produto.`)
      return
    }

    const produtosAtualizados = produtos.map((item) => {
      if (item.id === produto.id) {
        return {
          ...item,
          ativo: novoStatus,
        }
      }

      return item
    })

    setProdutos(produtosAtualizados)
    setMenuAbertoProdutoId(null)
  }

  function alternarMenuProduto(id) {
    setMenuAbertoProdutoId(menuAbertoProdutoId === id ? null : id)
  }

  function StatusProduto({ produto }) {
    const baixoEstoque = produto.estoqueAtual < produto.estoqueMinimo

    if (!produto.ativo) {
      return (
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-600">
          Inativo
        </span>
      )
    }

    if (produto.emProducao) {
      return (
        <span className="rounded-full bg-blue-100 px-3 py-1 text-xs font-semibold text-blue-700">
          Em produção
        </span>
      )
    }

    if (baixoEstoque) {
      return (
        <span className="rounded-full bg-red-100 px-3 py-1 text-xs font-semibold text-red-700">
          Baixo estoque
        </span>
      )
    }

    return (
      <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-semibold text-green-700">
        Normal
      </span>
    )
  }

  return (
    <section>
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-3xl font-bold text-slate-900">Produtos</h2>

          <p className="mt-2 text-slate-600">
            Cadastre, edite e acompanhe o estoque dos produtos.
          </p>
        </div>

        <button
          onClick={mostrarFormulario ? limparFormulario : abrirCadastro}
          className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
        >
          {mostrarFormulario ? 'Fechar formulário' : 'Cadastrar produto'}
        </button>
      </div>

      <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-white rounded-2xl shadow-sm p-5">
          <p className="text-sm text-slate-500">Produtos cadastrados</p>
          <strong className="mt-2 block text-3xl text-slate-900">
            {produtosAtivos.length}
          </strong>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-5">
          <p className="text-sm text-slate-500">Itens em produção</p>
          <strong className="mt-2 block text-3xl text-blue-600">
            {produtosEmProducao.length}
          </strong>
        </div>

        <div className="bg-white rounded-2xl shadow-sm p-5">
          <p className="text-sm text-slate-500">Produtos inativos</p>
          <strong className="mt-2 block text-3xl text-slate-900">
            {produtos.filter((produto) => !produto.ativo).length}
          </strong>
        </div>
      </div>

      {mostrarFormulario && (
        <div className="mt-6 bg-white rounded-2xl shadow-sm p-6">
          <h3 className="text-xl font-bold text-slate-900">
            {produtoEditandoId ? 'Editar produto' : 'Novo produto'}
          </h3>

          <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-5">
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Nome do produto *
              </label>
              <input
                type="text"
                value={formProduto.nome}
                onChange={(event) => atualizarCampo('nome', event.target.value)}
                placeholder="Ex: Guia da Corrente KTM Azul"
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Código/SKU
              </label>
              <input
                type="text"
                value={formProduto.codigo}
                onChange={(event) => atualizarCampo('codigo', event.target.value)}
                placeholder="Ex: GC-KTM-AZUL"
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Categoria
              </label>
              <input
                type="text"
                value={formProduto.categoria}
                onChange={(event) =>
                  atualizarCampo('categoria', event.target.value)
                }
                placeholder="Ex: Guia de corrente"
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Estoque atual
              </label>
              <input
                type="number"
                value={formProduto.estoqueAtual}
                onChange={(event) =>
                  atualizarCampo('estoqueAtual', event.target.value)
                }
                placeholder="Ex: 100"
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Estoque mínimo
              </label>
              <input
                type="number"
                value={formProduto.estoqueMinimo}
                onChange={(event) =>
                  atualizarCampo('estoqueMinimo', event.target.value)
                }
                placeholder="Ex: 20"
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">
                Observação
              </label>
              <input
                type="text"
                value={formProduto.observacao}
                onChange={(event) =>
                  atualizarCampo('observacao', event.target.value)
                }
                placeholder="Ex: compatível com KTM, Sherco e MXF"
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div className="md:col-span-2">
              <label className="flex items-start gap-3 rounded-xl border border-blue-100 bg-blue-50 px-4 py-4 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formProduto.emProducao}
                  onChange={(event) =>
                    atualizarCampo('emProducao', event.target.checked)
                  }
                  className="mt-1 h-4 w-4"
                />

                <div>
                  <span className="block text-sm font-semibold text-slate-900">
                    Item em produção
                  </span>

                  <span className="mt-1 block text-xs text-slate-500">
                    Marque quando este produto estiver sendo produzido. Ele
                    aparecerá no card “Itens em produção” da Dashboard.
                  </span>
                </div>
              </label>
            </div>
          </div>

          <div className="mt-6 flex flex-col sm:flex-row gap-3">
            <button
              onClick={salvarProduto}
              disabled={salvando}
              className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700 disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {salvando
                ? 'Salvando...'
                : produtoEditandoId
                  ? 'Salvar alterações'
                  : 'Salvar produto'}
            </button>

            <button
              onClick={limparFormulario}
              className="rounded-xl bg-slate-100 px-5 py-3 font-semibold text-slate-700 hover:bg-slate-200"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      <div className="mt-6 bg-white rounded-2xl shadow-sm p-5">
        <input
          type="text"
          value={busca}
          onChange={(event) => setBusca(event.target.value)}
          placeholder="Buscar produto por nome, código ou categoria..."
          className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
        />
      </div>

      <div className="mt-6 bg-white rounded-2xl shadow-sm overflow-hidden">
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500">
              <tr className="text-left">
                <th className="px-5 py-4">Produto</th>
                <th className="px-5 py-4">Código</th>
                <th className="px-5 py-4">Categoria</th>
                <th className="px-5 py-4">Estoque</th>
                <th className="px-5 py-4">Mínimo</th>
                <th className="px-5 py-4">Status</th>
                <th className="px-5 py-4">Ações</th>
              </tr>
            </thead>

            <tbody>
              {carregandoProdutos && (
                <tr>
                  <td
                    colSpan="7"
                    className="px-5 py-8 text-center text-slate-500"
                  >
                    Carregando produtos...
                  </td>
                </tr>
              )}

              {!carregandoProdutos &&
                produtosFiltrados.map((produto) => (
                  <tr key={produto.id} className="border-t border-slate-100">
                    <td className="px-5 py-4 font-medium text-slate-900">
                      {produto.nome}
                    </td>

                    <td className="px-5 py-4 text-slate-600">
                      {produto.codigo}
                    </td>

                    <td className="px-5 py-4 text-slate-600">
                      {produto.categoria}
                    </td>

                    <td className="px-5 py-4 text-slate-600">
                      {produto.estoqueAtual}
                    </td>

                    <td className="px-5 py-4 text-slate-600">
                      {produto.estoqueMinimo}
                    </td>

                    <td className="px-5 py-4">
                      <StatusProduto produto={produto} />
                    </td>

                    <td className="px-5 py-4">
                      <div className="relative flex items-center gap-3">
                        <button
                          onClick={() => abrirEdicao(produto)}
                          className="text-sm font-semibold text-blue-600 hover:text-blue-800"
                        >
                          Editar
                        </button>

                        <button
                          onClick={() => alternarMenuProduto(produto.id)}
                          className="text-sm font-semibold text-slate-500 hover:text-slate-700"
                        >
                          Mais opções
                        </button>

                        {menuAbertoProdutoId === produto.id && (
                          <div className="absolute right-0 top-7 z-10 w-36 rounded-xl border border-slate-100 bg-white p-2 shadow-lg">
                            {produto.ativo ? (
                              <button
                                onClick={() =>
                                  alterarStatusProduto(produto, false)
                                }
                                className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-red-600 hover:bg-red-50"
                              >
                                Inativar
                              </button>
                            ) : (
                              <button
                                onClick={() =>
                                  alterarStatusProduto(produto, true)
                                }
                                className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-green-700 hover:bg-green-50"
                              >
                                Reativar
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

              {!carregandoProdutos && produtosFiltrados.length === 0 && (
                <tr>
                  <td
                    colSpan="7"
                    className="px-5 py-8 text-center text-slate-500"
                  >
                    Nenhum produto encontrado.
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
            produtosFiltrados.map((produto) => (
              <div
                key={produto.id}
                className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-slate-900">
                      {produto.nome}
                    </p>

                    <p className="mt-1 text-sm text-slate-500">
                      {produto.codigo}
                    </p>
                  </div>

                  <StatusProduto produto={produto} />
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">Estoque</p>
                    <p className="text-xl font-bold text-slate-900">
                      {produto.estoqueAtual}
                    </p>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs text-slate-500">Mínimo</p>
                    <p className="text-xl font-bold text-slate-900">
                      {produto.estoqueMinimo}
                    </p>
                  </div>
                </div>

                <div className="mt-3">
                  <p className="text-xs text-slate-500">Categoria</p>
                  <p className="text-sm text-slate-700">
                    {produto.categoria}
                  </p>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <button
                    onClick={() => abrirEdicao(produto)}
                    className="rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
                  >
                    Editar
                  </button>

                  <div className="relative">
                    <button
                      onClick={() => alternarMenuProduto(produto.id)}
                      className="rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-200"
                    >
                      Mais opções
                    </button>

                    {menuAbertoProdutoId === produto.id && (
                      <div className="absolute right-0 top-11 z-10 w-36 rounded-xl border border-slate-100 bg-white p-2 shadow-lg">
                        {produto.ativo ? (
                          <button
                            onClick={() => alterarStatusProduto(produto, false)}
                            className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-red-600 hover:bg-red-50"
                          >
                            Inativar
                          </button>
                        ) : (
                          <button
                            onClick={() => alterarStatusProduto(produto, true)}
                            className="w-full rounded-lg px-3 py-2 text-left text-sm font-semibold text-green-700 hover:bg-green-50"
                          >
                            Reativar
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}

          {!carregandoProdutos && produtosFiltrados.length === 0 && (
            <p className="text-center text-sm text-slate-500">
              Nenhum produto encontrado.
            </p>
          )}
        </div>
      </div>
    </section>
  )
}

export default Produtos