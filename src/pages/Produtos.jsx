import { useEffect, useRef, useState } from 'react'
import { supabase } from '../services/supabase'

function Produtos({ produtos, setProdutos, empresaAtiva, carregandoProdutos }) {
  const [busca, setBusca] = useState('')
  const [mostrarFormulario, setMostrarFormulario] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [produtoEditandoId, setProdutoEditandoId] = useState(null)
  const [estoqueOriginalEdicao, setEstoqueOriginalEdicao] = useState(null)
  const [motivoAjuste, setMotivoAjuste] = useState('')
  const [menuAbertoProdutoId, setMenuAbertoProdutoId] = useState(null)
  const [mostrarHistoricoAjustes, setMostrarHistoricoAjustes] = useState(false)
  const [historicoAjustes, setHistoricoAjustes] = useState([])
  const [carregandoHistorico, setCarregandoHistorico] = useState(false)
  const [erroHistorico, setErroHistorico] = useState('')
  const historicoRequisicao = useRef(0)

  const [formProduto, setFormProduto] = useState({
    nome: '',
    codigo: '',
    categoria: '',
    estoqueAtual: '',
    estoqueMinimo: '',
    observacao: '',
    emProducao: false,
  })

  function formatarMoeda(valor) {
    return Number(valor || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 3,
      maximumFractionDigits: 6,
    })
  }

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

  // Consultas apenas de leitura, sempre limitadas à empresa ativa.
  async function carregarHistoricoAjustes(empresaId = empresaAtiva?.id) {
    if (!empresaId) return

    const requisicao = ++historicoRequisicao.current
    setCarregandoHistorico(true)
    setErroHistorico('')

    const { data, error } = await supabase
      .from('ajustes_estoque')
      .select(`
        id, produto_id, usuario_id, estoque_anterior, estoque_novo,
        diferenca, motivo, criado_em,
        produtos!ajustes_estoque_produto_empresa_fkey(nome),
        usuarios!ajustes_estoque_usuario_fkey(nome)
      `)
      .eq('empresa_id', empresaId)
      .order('criado_em', { ascending: false })
      .limit(100)

    if (requisicao !== historicoRequisicao.current) return

    if (error) {
      console.error('Erro ao carregar histórico de ajustes:', error)
      setErroHistorico('Não foi possível carregar os ajustes. Tente novamente.')
      setHistoricoAjustes([])
    } else {
      setHistoricoAjustes(data || [])
    }
    setCarregandoHistorico(false)
  }

  useEffect(() => {
    // Invalida consultas anteriores e oculta dados ao trocar de empresa.
    historicoRequisicao.current += 1
    setHistoricoAjustes([])
    setErroHistorico('')
    setCarregandoHistorico(false)
    if (mostrarHistoricoAjustes && empresaAtiva?.id) {
      carregarHistoricoAjustes(empresaAtiva.id)
    }
  }, [empresaAtiva?.id, mostrarHistoricoAjustes])

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
      valorUnitario: '',
      observacao: '',
      emProducao: false,
    })

    setProdutoEditandoId(null)
    setEstoqueOriginalEdicao(null)
    setMotivoAjuste('')
    setMostrarFormulario(false)
  }

  function abrirCadastro() {
    setProdutoEditandoId(null)
    setEstoqueOriginalEdicao(null)
    setMotivoAjuste('')
    setMenuAbertoProdutoId(null)

    setFormProduto({
      nome: '',
      codigo: '',
      categoria: '',
      estoqueAtual: '',
      estoqueMinimo: '',
      valorUnitario: '',
      observacao: '',
      emProducao: false,
    })

    setMostrarFormulario(true)
  }

  function abrirEdicao(produto) {
    setProdutoEditandoId(produto.id)
    setEstoqueOriginalEdicao(Number(produto.estoqueAtual))
    setMotivoAjuste('')
    setMenuAbertoProdutoId(null)

    setFormProduto({
      nome: produto.nome,
      codigo: produto.codigo === 'Sem código' ? '' : produto.codigo,
      categoria: produto.categoria === 'Sem categoria' ? '' : produto.categoria,
      estoqueAtual: produto.estoqueAtual,
      estoqueMinimo: produto.estoqueMinimo,
      valorUnitario:
        produto.valorUnitario && Number(produto.valorUnitario) > 0
          ? String(produto.valorUnitario)
          : '',
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

    if (!Number.isSafeInteger(Number(formProduto.estoqueAtual || 0)) || Number(formProduto.estoqueAtual || 0) < 0) {
      alert('O estoque atual deve ser um número inteiro não negativo.')
      return
    }

    if (Number(formProduto.estoqueMinimo || 0) < 0) {
      alert('O estoque mínimo não pode ser negativo.')
      return
    }

    if (Number(formProduto.valorUnitario || 0) < 0) {
      alert('O valor unitário não pode ser negativo.')
      return
    }

    setSalvando(true)

    // Campos comuns: editar um produto não deve reenviar o saldo sem necessidade.
    const dadosProduto = {
      nome: formProduto.nome.trim(),
      codigo: formProduto.codigo.trim() || null,
      categoria: formProduto.categoria.trim() || null,
      estoque_minimo: Number(formProduto.estoqueMinimo || 0),
      valor_unitario: Number(formProduto.valorUnitario || 0),
      observacao: formProduto.observacao.trim() || null,
      em_producao: formProduto.emProducao,
    }

    if (produtoEditandoId) {
      const estoqueInformado = Number(formProduto.estoqueAtual || 0)
      const alterouEstoque = estoqueInformado !== estoqueOriginalEdicao

      if (alterouEstoque) {
        // O ajuste é atômico no banco: altera o saldo e grava o histórico juntos.
        // A comparação com o saldo anterior ocorre sob bloqueio do produto.
        const { error: erroAjuste } = await supabase.rpc('ajustar_estoque_manual', {
          p_empresa_id: empresaAtiva.id,
          p_produto_id: produtoEditandoId,
          p_estoque_esperado: estoqueOriginalEdicao,
          p_estoque_novo: estoqueInformado,
          p_motivo: motivoAjuste.trim() || null,
        })

        if (erroAjuste) {
          console.error('Erro ao ajustar estoque:', erroAjuste)
          alert(erroAjuste.message || 'Não foi possível corrigir o estoque. Nenhuma alteração cadastral foi salva.')
          setSalvando(false)
          return
        }

        if (mostrarHistoricoAjustes) {
          // Não bloqueia o salvamento enquanto o histórico é atualizado.
          void carregarHistoricoAjustes()
        }

        // Evita repetir um ajuste já concluído caso a edição cadastral falhe.
        setEstoqueOriginalEdicao(estoqueInformado)
        setMotivoAjuste('')
      }

      // Atualização cadastral separada: jamais reenvia estoque_atual.
      const { data, error } = await supabase
        .from('produtos')
        .update(dadosProduto)
        .eq('id', produtoEditandoId)
        .eq('empresa_id', empresaAtiva.id)
        .select()
        .maybeSingle()

      if (error || !data) {
        console.error('Erro ao editar dados do produto:', error)

        if (alterouEstoque) {
          // O ajuste já aconteceu; atualiza o formulário com o saldo efetivo.
          const { data: produtoAtual } = await supabase
            .from('produtos')
            .select('*')
            .eq('id', produtoEditandoId)
            .eq('empresa_id', empresaAtiva.id)
            .maybeSingle()

          if (produtoAtual) {
            setEstoqueOriginalEdicao(Number(produtoAtual.estoque_atual))
            setFormProduto((anterior) => ({
              ...anterior,
              estoqueAtual: produtoAtual.estoque_atual,
            }))
            setProdutos((anteriores) =>
              anteriores.map((produto) =>
                produto.id === produtoEditandoId ? formatarProduto(produtoAtual) : produto
              )
            )
          }
          alert('O ajuste de estoque foi realizado e registrado, mas não foi possível salvar os demais dados. Atualize a página e confira o produto antes de tentar novamente.')
        } else {
          alert('Não foi possível salvar os dados do produto. Nenhuma correção de estoque foi feita.')
        }
        setSalvando(false)
        return
      }

      const produtoFormatado = formatarProduto(data)
      setProdutos((anteriores) =>
        anteriores.map((produto) =>
          produto.id === produtoEditandoId ? produtoFormatado : produto
        )
      )
      setSalvando(false)
      limparFormulario()
      return
    }

    const { data, error } = await supabase
      .from('produtos')
      .insert({
        ...dadosProduto,
        empresa_id: empresaAtiva.id,
        estoque_atual: Number(formProduto.estoqueAtual || 0),
        ativo: true,
      })
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
      valorUnitario: Number(data.valor_unitario || 0),
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
                min="0"
                step="1"
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
              {produtoEditandoId && Number(formProduto.estoqueAtual || 0) !== estoqueOriginalEdicao && (
                <p className="mt-2 text-xs text-amber-700">
                  A alteração do saldo será registrada no histórico de ajustes, sem entrar nas entradas e saídas dos relatórios.
                </p>
              )}
            </div>

            {produtoEditandoId && Number(formProduto.estoqueAtual || 0) !== estoqueOriginalEdicao && (
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-slate-700">
                  Motivo da correção de estoque (opcional)
                </label>
                <input
                  type="text"
                  maxLength={500}
                  value={motivoAjuste}
                  onChange={(event) => setMotivoAjuste(event.target.value)}
                  placeholder="Ex: divergência na contagem física"
                  className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                />
              </div>
            )}

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
                Valor unitário
              </label>
              <input
                type="number"
                min="0"
                step="0.000001"
                value={formProduto.valorUnitario}
                onChange={(event) =>
                  atualizarCampo('valorUnitario', event.target.value)
                }
                placeholder="Ex: 49.90"
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
              <p className="mt-1 text-xs text-slate-500">
                Usado apenas para calcular o valor total vendido no relatório.
              </p>
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
                <th className="px-5 py-4">Valor</th>
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

                    <td className="px-5 py-4 text-slate-600">
                      {formatarMoeda(produto.valorUnitario)}
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
                    colSpan="8"
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

                <div className="mt-4 grid grid-cols-3 gap-3">
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

                <div className="rounded-xl bg-slate-50 p-3">
                  <p className="text-xs text-slate-500">Valor</p>
                  <p className="text-sm font-bold text-slate-900">
                    {formatarMoeda(produto.valorUnitario)}
                  </p>
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

      <div className="mt-6 overflow-hidden rounded-2xl bg-white shadow-sm">
        <div className="flex flex-col gap-3 px-5 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Histórico de ajustes de estoque</h3>
            <p className="mt-1 text-sm text-slate-500">
              Correções manuais, separadas das entradas e saídas do relatório.
            </p>
          </div>
          <div className="flex gap-2">
            {mostrarHistoricoAjustes && (
              <button
                type="button"
                onClick={() => carregarHistoricoAjustes()}
                disabled={carregandoHistorico || !empresaAtiva?.id}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                Atualizar
              </button>
            )}
            <button
              type="button"
              onClick={() => setMostrarHistoricoAjustes((anterior) => !anterior)}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700"
            >
              {mostrarHistoricoAjustes ? 'Ocultar histórico' : 'Ver histórico'}
            </button>
          </div>
        </div>

        {mostrarHistoricoAjustes && (
          <div className="border-t border-slate-100">
            {carregandoHistorico ? (
              <p className="p-6 text-sm text-slate-500">Carregando ajustes...</p>
            ) : erroHistorico ? (
              <p role="alert" className="p-6 text-sm text-red-600">{erroHistorico}</p>
            ) : historicoAjustes.length === 0 ? (
              <p className="p-6 text-sm text-slate-500">
                Nenhuma correção manual registrada para esta empresa.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[850px] text-left text-sm">
                  <thead className="bg-slate-50 text-slate-600">
                    <tr>
                      <th className="px-4 py-3">Data</th>
                      <th className="px-4 py-3">Produto</th>
                      <th className="px-4 py-3">Anterior</th>
                      <th className="px-4 py-3">Novo</th>
                      <th className="px-4 py-3">Diferença</th>
                      <th className="px-4 py-3">Responsável</th>
                      <th className="px-4 py-3">Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {historicoAjustes.map((ajuste) => (
                      <tr key={ajuste.id} className="border-t border-slate-100">
                        <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                          {new Date(ajuste.criado_em).toLocaleString('pt-BR')}
                        </td>
                        <td className="px-4 py-3 font-medium text-slate-900">
                          {ajuste.produtos?.nome || 'Produto indisponível'}
                        </td>
                        <td className="px-4 py-3">{ajuste.estoque_anterior}</td>
                        <td className="px-4 py-3">{ajuste.estoque_novo}</td>
                        <td className={`px-4 py-3 font-semibold ${ajuste.diferenca > 0 ? 'text-green-700' : 'text-red-600'}`}>
                          {ajuste.diferenca > 0 ? '+' : ''}{ajuste.diferenca}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {ajuste.usuarios?.nome || 'Usuário indisponível'}
                        </td>
                        <td className="px-4 py-3 text-slate-600">{ajuste.motivo || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                <p className="px-4 py-3 text-xs text-slate-400">
                  Exibindo até 100 ajustes mais recentes da empresa selecionada.
                </p>
              </div>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

export default Produtos