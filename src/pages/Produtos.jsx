import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '../services/supabase'

const EMPRESA_SD = 'b7360df7-24af-4372-a7fb-5919d7a55b3e'
const COMPOSICAO_VAZIA = {
  pesoGramas: '', materiaPrimaId: '', embalagemId: '', pecasPorEmbalagem: '1',
  pigmentoId: '', percentualPigmento: '',
}

function Produtos({ produtos, setProdutos, empresaAtiva, carregandoProdutos }) {
  const [busca, setBusca] = useState('')
  const [filtroCategoria, setFiltroCategoria] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('')
  const [mostrarMaisFiltros, setMostrarMaisFiltros] = useState(false)
  const [somenteEmProducao, setSomenteEmProducao] = useState(false)
  const [organizando, setOrganizando] = useState(false)
  const [ordenacao, setOrdenacao] = useState('original')
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
  const composicaoRequisicao = useRef(0)
  const empresaSd = empresaAtiva?.id === EMPRESA_SD
  const [abaFormulario, setAbaFormulario] = useState('geral')
  const [formComposicao, setFormComposicao] = useState({ ...COMPOSICAO_VAZIA })
  const [insumos, setInsumos] = useState([])
  const [carregandoInsumos, setCarregandoInsumos] = useState(false)
  const [erroInsumos, setErroInsumos] = useState('')
  const [carregandoComposicao, setCarregandoComposicao] = useState(false)
  const [erroComposicao, setErroComposicao] = useState('')
  const [composicaoExistente, setComposicaoExistente] = useState(false)
  const [composicaoAlterada, setComposicaoAlterada] = useState(false)

  const [formProduto, setFormProduto] = useState({
    nome: '',
    codigo: '',
    categoria: '',
    estoqueAtual: '',
    estoqueMinimo: '',
    valorUnitario: '',
    observacao: '',
    emProducao: false,
    ativo: true,
  })

  function formatarMoeda(valor) {
    return Number(valor || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 3,
      maximumFractionDigits: 6,
    })
  }

  const categoriasProdutos = [...new Set(produtos.map(p => p.categoria).filter(c => c && c !== 'Sem categoria'))].sort((a,b) => a.localeCompare(b, 'pt-BR'))
  const produtosFiltrados = produtos.filter((produto) => {
    const termo = busca.trim().toLowerCase()
    const nome = String(produto.nome || '').toLowerCase()
    const codigo = String(produto.codigo || '').toLowerCase()
    const categoria = String(produto.categoria || '').toLowerCase()
    const status = !produto.ativo ? 'inativo' : Number(produto.estoqueAtual || 0) === 0 ? 'zerado' : Number(produto.estoqueAtual || 0) < Number(produto.estoqueMinimo || 0) ? 'baixo' : 'normal'
    return (!termo || nome.includes(termo) || codigo.includes(termo) || categoria.includes(termo))
      && (!filtroCategoria || produto.categoria === filtroCategoria)
      && (!filtroStatus || filtroStatus === status)
      && (!somenteEmProducao || produto.emProducao)
  }).sort((a, b) => ordenacao === 'nome' ? a.nome.localeCompare(b.nome, 'pt-BR') : ordenacao === 'estoque' ? Number(a.estoqueAtual) - Number(b.estoqueAtual) : ordenacao === 'codigo' ? String(a.codigo).localeCompare(String(b.codigo), 'pt-BR') : 0)

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

  useEffect(() => {
    let ativo = true
    composicaoRequisicao.current += 1
    setInsumos([])
    setErroInsumos('')
    setFormComposicao({ ...COMPOSICAO_VAZIA })
    setComposicaoExistente(false)
    setComposicaoAlterada(false)
    setCarregandoComposicao(false)
    setErroComposicao('')
    setAbaFormulario('geral')
    setMostrarFormulario(false)
    if (!empresaSd) return () => { ativo = false }
    setCarregandoInsumos(true)
    void (async () => {
      const { data, error } = await supabase.from('insumos')
        .select('id,nome,categoria,unidade,custo_unitario,ativo')
        .eq('empresa_id', EMPRESA_SD).eq('ativo', true).order('nome')
      if (!ativo) return
      setInsumos(data || [])
      setErroInsumos(error ? 'Não foi possível carregar o catálogo de insumos.' : '')
      setCarregandoInsumos(false)
    })()
    return () => { ativo = false }
  }, [empresaAtiva?.id])

  async function carregarComposicao(produtoId) {
    const requisicao = ++composicaoRequisicao.current
    setCarregandoComposicao(true)
    setErroComposicao('')
    setComposicaoExistente(false)
    setComposicaoAlterada(false)
    setFormComposicao({ ...COMPOSICAO_VAZIA })
    const { data, error } = await supabase.from('produto_composicao')
      .select('peso_gramas,materia_prima_id,embalagem_id,pecas_por_embalagem,pigmento_id,percentual_pigmento')
      .eq('empresa_id', EMPRESA_SD).eq('produto_id', produtoId).maybeSingle()
    if (requisicao !== composicaoRequisicao.current) return
    setCarregandoComposicao(false)
    if (error) {
      setErroComposicao('Falha ao consultar a composição. Por segurança, não será possível sobrescrevê-la. Reabra a edição.')
      return
    }
    if (data) {
      setComposicaoExistente(true)
      setFormComposicao({
        pesoGramas: String(data.peso_gramas),
        materiaPrimaId: data.materia_prima_id || '',
        embalagemId: data.embalagem_id || '',
        pecasPorEmbalagem: String(data.pecas_por_embalagem || 1),
        pigmentoId: data.pigmento_id || '',
        percentualPigmento: data.pigmento_id ? String(data.percentual_pigmento) : '',
      })
    }
  }

  function atualizarComposicao(campo, valor) {
    setComposicaoAlterada(true)
    setFormComposicao((anterior) => ({
      ...anterior, [campo]: valor,
      ...(campo === 'pigmentoId' && !valor ? { percentualPigmento: '' } : {}),
    }))
  }

  const camposComposicaoPreenchidos = Object.entries(formComposicao)
    .some(([campo, valor]) => campo !== 'pecasPorEmbalagem' && String(valor).trim() !== '')
  const desejaSalvarComposicao = empresaSd && (composicaoAlterada || (!produtoEditandoId && camposComposicaoPreenchidos))

  const categoriasInsumos = useMemo(() => ({
    materias: insumos.filter((i) => i.categoria === 'Matéria-prima' && ['kg', 'g'].includes(i.unidade)),
    embalagens: insumos.filter((i) => i.categoria === 'Embalagem' && i.unidade === 'un'),
    pigmentos: insumos.filter((i) => i.categoria === 'Pigmento' && ['kg', 'g'].includes(i.unidade)),
  }), [insumos])

  const custoPrevisto = useMemo(() => {
    const peso = Number(formComposicao.pesoGramas)
    const percentual = formComposicao.pigmentoId ? Number(formComposicao.percentualPigmento) : 0
    const pecas = Number(formComposicao.pecasPorEmbalagem)
    const mp = insumos.find((i) => i.id === formComposicao.materiaPrimaId)
    const emb = insumos.find((i) => i.id === formComposicao.embalagemId)
    const pig = insumos.find((i) => i.id === formComposicao.pigmentoId)
    const porGrama = (i) => Number(i.custo_unitario) / (i.unidade === 'kg' ? 1000 : 1)
    if (!mp || !emb || !(peso > 0) || !(pecas > 0) || percentual < 0 || percentual >= 100 || (formComposicao.pigmentoId && (!pig || !(percentual > 0)))) return null
    const materia = peso * (1 - percentual / 100) * porGrama(mp)
    const pigmento = pig ? peso * percentual / 100 * porGrama(pig) : 0
    const embalagem = Number(emb.custo_unitario) / pecas
    return { materia, pigmento, embalagem, total: materia + pigmento + embalagem }
  }, [formComposicao, insumos])

  function validarComposicao() {
    if (!desejaSalvarComposicao) return true
    if (erroInsumos || carregandoInsumos || carregandoComposicao || erroComposicao) {
      alert('Os insumos ou a composição ainda não foram carregados corretamente. Tente novamente.')
      return false
    }
    const c = formComposicao
    const peso = Number(c.pesoGramas)
    const pecas = Number(c.pecasPorEmbalagem)
    const percentual = c.pigmentoId ? Number(c.percentualPigmento) : 0
    if (!c.pesoGramas || !(peso > 0) || peso > 99999999.999999 || Math.round(peso * 1e6) / 1e6 !== peso) {
      alert('Informe o peso da peça em gramas, maior que zero e com até 6 casas decimais.')
      setAbaFormulario('composicao'); return false
    }
    if (!c.materiaPrimaId || !categoriasInsumos.materias.some((i) => i.id === c.materiaPrimaId)) {
      alert('Selecione uma matéria-prima ativa, em kg ou g.'); setAbaFormulario('composicao'); return false
    }
    if (!c.embalagemId || !categoriasInsumos.embalagens.some((i) => i.id === c.embalagemId)) {
      alert('Selecione uma embalagem ativa, cadastrada por unidade.'); setAbaFormulario('composicao'); return false
    }
    if (!Number.isSafeInteger(pecas) || pecas <= 0) {
      alert('Informe quantas peças são acondicionadas em cada embalagem.'); setAbaFormulario('composicao'); return false
    }
    if ((c.pigmentoId && (!categoriasInsumos.pigmentos.some((i) => i.id === c.pigmentoId) || !(percentual > 0) || percentual >= 100 || Math.round(percentual * 1e4) / 1e4 !== percentual)) || (!c.pigmentoId && c.percentualPigmento)) {
      alert('Selecione um pigmento válido e um percentual maior que zero e inferior a 100%, ou deixe ambos vazios.'); setAbaFormulario('composicao'); return false
    }
    return true
  }

  async function salvarComposicao(produtoId) {
    if (!desejaSalvarComposicao) return true
    const c = formComposicao
    const { error } = await supabase.rpc('salvar_produto_composicao', {
      p_produto_id: produtoId,
      p_peso_gramas: Number(c.pesoGramas),
      p_materia_prima_id: c.materiaPrimaId,
      p_embalagem_id: c.embalagemId,
      p_pecas_por_embalagem: Number(c.pecasPorEmbalagem),
      p_pigmento_id: c.pigmentoId || null,
      p_percentual_pigmento: c.pigmentoId ? Number(c.percentualPigmento) : 0,
    })
    if (error) {
      console.error('Erro ao salvar composição:', error)
      alert(`O produto foi salvo, mas a composição NÃO foi salva: ${error.message}. Corrija o problema e clique em salvar novamente. Não refaça o ajuste de estoque.`)
      setAbaFormulario('composicao')
      return false
    }
    setComposicaoExistente(true)
    setComposicaoAlterada(false)
    return true
  }

  function atualizarCampo(campo, valor) {
    setFormProduto({
      ...formProduto,
      [campo]: valor,
    })
  }

  function limparFormulario() {
    composicaoRequisicao.current += 1
    setFormComposicao({ ...COMPOSICAO_VAZIA })
    setComposicaoExistente(false)
    setComposicaoAlterada(false)
    setCarregandoComposicao(false)
    setErroComposicao('')
    setAbaFormulario('geral')
    setFormProduto({
      nome: '',
      codigo: '',
      categoria: '',
      estoqueAtual: '',
      estoqueMinimo: '',
      valorUnitario: '',
      observacao: '',
      emProducao: false,
      ativo: true,
    })

    setProdutoEditandoId(null)
    setEstoqueOriginalEdicao(null)
    setMotivoAjuste('')
    setMostrarFormulario(false)
  }

  function abrirCadastro() {
    composicaoRequisicao.current += 1
    setFormComposicao({ ...COMPOSICAO_VAZIA })
    setComposicaoExistente(false)
    setComposicaoAlterada(false)
    setCarregandoComposicao(false)
    setErroComposicao('')
    setAbaFormulario('geral')
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
      ativo: true,
    })

    setMostrarFormulario(true)
  }

  function abrirEdicao(produto) {
    setAbaFormulario('geral')
    if (empresaSd) void carregarComposicao(produto.id)
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
      ativo: produto.ativo !== false,
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

    if (!validarComposicao()) return

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
      ativo: formProduto.ativo !== false,
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
      // O registro comercial e a composição são operações separadas.
      // Em caso de falha na composição, mantemos o formulário para reenvio seguro.
      const composicaoSalva = await salvarComposicao(produtoEditandoId)
      setSalvando(false)
      if (composicaoSalva) limparFormulario()
      return
    }

    const { data, error } = await supabase
      .from('produtos')
      .insert({
        ...dadosProduto,
        empresa_id: empresaAtiva.id,
        estoque_atual: Number(formProduto.estoqueAtual || 0),
        ativo: formProduto.ativo !== false,
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

    setProdutos((anteriores) => [produtoFormatado, ...anteriores])
    const composicaoSalva = await salvarComposicao(data.id)
    setSalvando(false)
    if (composicaoSalva) limparFormulario()
    else {
      setProdutoEditandoId(data.id)
      setEstoqueOriginalEdicao(Number(data.estoque_atual))
    }
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
    if (!produto.ativo) return <span className="efp-status efp-inativo"><i />Inativo</span>
    if (Number(produto.estoqueAtual || 0) === 0) return <span className="efp-status efp-zerado"><i />Sem estoque</span>
    if (Number(produto.estoqueAtual || 0) < Number(produto.estoqueMinimo || 0)) return <span className="efp-status efp-baixo"><i />Estoque baixo</span>
    return <span className="efp-status efp-normal"><i />Normal</span>
  }

  const numFormat = (v) => Number(v || 0).toLocaleString('pt-BR')
  const numPreco = (v) => Number(v || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 6 })
  const iconePacote = <svg width="21" height="21" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="m12 2 8.5 4.8v10.4L12 22l-8.5-4.8V6.8L12 2Z"/><path d="m3.5 6.8 8.5 4.9 8.5-4.9M12 11.7V22"/><path d="m8 4.3 8.4 4.9"/></svg>

  function MenuAcoes({ produto }) {
    return <div className="efp-menu-anchor">
      <button type="button" className="efp-more" aria-label={`Opções de ${produto.nome}`} onClick={() => alternarMenuProduto(produto.id)}>•••</button>
      {menuAbertoProdutoId === produto.id && <div className="efp-dropdown efp-action-dropdown">
        <button type="button" onClick={() => abrirEdicao(produto)}>Editar produto</button>
        <button type="button" onClick={() => alterarStatusProduto(produto, !produto.ativo)}>{produto.ativo ? 'Inativar produto' : 'Reativar produto'}</button>
      </div>}
    </div>
  }

  const cssProdutos = `
    .efp{--pc-bg:#f4f6fb;--pc-surface:#ffffff;--pc-text:#172744;--pc-muted:#8391a9;--pc-border:#e0e8f3;--pc-soft:#f7f9fd;--pc-blue:#3261f4;--pc-hover:#f6f9ff;color:var(--pc-text);font-family:inherit;}
    .efp .efp-kicker{font-size:10px;letter-spacing:.18em;text-transform:uppercase;font-weight:800;color:var(--pc-blue);margin-bottom:8px}
    .efp .efp-head{display:flex;justify-content:space-between;align-items:center;gap:24px;margin:0 0 35px}
    .efp .efp-title{font-size:29px;letter-spacing:-.9px;line-height:1.15;font-weight:800;color:var(--pc-text)}
    .efp .efp-subtitle{margin-top:8px;font-size:13px;color:var(--pc-muted)}
    .efp .efp-actions{display:flex;gap:9px;align-items:center;flex-wrap:wrap}
    .efp button{transition:background .15s,border-color .15s,opacity .15s}
    .efp .efp-btn{height:41px;display:inline-flex;gap:10px;align-items:center;justify-content:center;border-radius:9px;padding:0 16px;font-size:12px;font-weight:700;border:1px solid var(--pc-border);color:var(--pc-text);background:var(--pc-surface);white-space:nowrap}
    .efp .efp-btn:hover{background:var(--pc-hover)}
    .efp .efp-btn-primary{background:var(--pc-blue);border-color:var(--pc-blue);color:white;box-shadow:0 5px 12px #3261f41c}
    .efp .efp-btn-primary:hover{background:#244fdb}
    .efp .efp-sheet{border:1px solid var(--pc-border);border-radius:13px;background:var(--pc-surface);overflow:visible;box-shadow:0 7px 30px #1c3e7308}
    .efp .efp-filterrow{min-height:69px;display:flex;align-items:center;gap:9px;padding:13px 17px;flex-wrap:wrap;border-bottom:1px solid var(--pc-border)}
    .efp .efp-search{width:min(285px,100%);position:relative}
    .efp .efp-search svg{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:#9aaac1;pointer-events:none}
    .efp .efp-search input{width:100%;height:37px;padding:0 12px 0 38px;background:var(--pc-surface);border:1px solid var(--pc-border);border-radius:9px;color:var(--pc-text);font-size:11px;outline:none}
    .efp .efp-search input:focus,.efp .efp-select:focus{border-color:var(--pc-blue)}
    .efp .efp-search input::placeholder{color:#a4afc2}
    .efp .efp-select{height:37px;max-width:180px;border:1px solid var(--pc-border);border-radius:9px;padding:0 12px;background:var(--pc-surface);font-size:11px;color:var(--pc-muted);outline:none;cursor:pointer}
    .efp .efp-filterbtn{height:37px;padding:0 12px;border:1px solid var(--pc-border);border-radius:9px;background:var(--pc-surface);color:var(--pc-muted);display:flex;gap:7px;align-items:center;font-size:11px}
    .efp .efp-count{margin-left:auto;color:var(--pc-muted);font-size:11px;white-space:nowrap}
    .efp .efp-table-wrap{overflow-x:auto;border-radius:0 0 13px 13px}
    .efp .efp-table{border-collapse:collapse;width:100%;min-width:725px;table-layout:auto}
    .efp .efp-table th{text-align:left;font-size:9px;letter-spacing:.055em;font-weight:800;color:#96a3b9;text-transform:uppercase;background:var(--pc-soft);padding:13px 15px;white-space:nowrap}
    .efp .efp-table th:first-child,.efp .efp-table td:first-child{padding-left:17px}
    .efp .efp-table td{padding:11px 15px;height:58px;border-top:1px solid var(--pc-border);font-size:11px;color:var(--pc-muted);white-space:nowrap}
    .efp .efp-table tr:hover td{background:var(--pc-hover)}
    .efp .efp-namecell{display:flex;gap:11px;align-items:center;min-width:190px}
    .efp .efp-package{width:33px;height:33px;border:1px solid var(--pc-border);border-radius:9px;background:var(--pc-soft);color:#7187a8;display:grid;place-items:center;flex-shrink:0}
    .efp .efp-productname{font-size:11px;color:var(--pc-text);font-weight:750;line-height:1.35;white-space:normal}
    .efp .efp-productcode{font-size:9px;color:var(--pc-muted);margin-top:3px}
    .efp .efp-qty{font-weight:800;color:var(--pc-text)}
    .efp .efp-status{border-radius:30px;display:inline-flex;align-items:center;gap:5px;font-size:9px;padding:5px 8px;font-weight:700}
    .efp .efp-status i{height:5px;width:5px;border-radius:100%;background:currentColor}
    .efp .efp-normal{background:#e7f6f0;color:#087d5b}
    .efp .efp-baixo{background:#fff2d9;color:#bc7600}
    .efp .efp-zerado{background:#ffebee;color:#e2445c}
    .efp .efp-inativo{background:#edf0f5;color:#6e7c91}
    .efp .efp-more{font-weight:900;letter-spacing:2px;font-size:16px;color:#7c8da8;padding:6px 8px;border-radius:8px;line-height:1}
    .efp .efp-more:hover{background:var(--pc-soft)}
    .efp .efp-menu-anchor{position:relative;display:inline-flex}
    .efp .efp-dropdown{position:absolute;right:0;top:32px;z-index:25;background:var(--pc-surface);border:1px solid var(--pc-border);box-shadow:0 10px 30px #0c1a3426;border-radius:9px;padding:5px;min-width:154px}
    .efp .efp-dropdown button{width:100%;padding:10px;text-align:left;font-size:11px;color:var(--pc-text);border-radius:6px;white-space:nowrap}
    .efp .efp-dropdown button:hover{background:var(--pc-hover)}
    .efp .efp-empty{padding:42px;text-align:center;color:var(--pc-muted);font-size:13px}
    .efp .efp-mobile{display:none}
    .efp .efp-mobile-card{border-bottom:1px solid var(--pc-border);padding:16px}
    .efp .efp-mobile-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin-top:13px}
    .efp .efp-mobile-metric{background:var(--pc-soft);padding:10px;border:1px solid var(--pc-border);border-radius:9px;min-width:0}
    .efp .efp-mobile-metric small{display:block;font-size:9px;color:var(--pc-muted);margin-bottom:6px}
    .efp .efp-mobile-metric strong{font-size:11px;color:var(--pc-text);word-break:break-word}
    .efp .efp-form{background:var(--pc-surface)!important;border:1px solid var(--pc-border)!important;box-shadow:none!important;color:var(--pc-text)!important}
    .efp .efp-form input,.efp .efp-form select{background:var(--pc-surface);color:var(--pc-text);border-color:var(--pc-border)}
    .efp .efp-form h3{color:var(--pc-text)}
    .efp .efp-form label{color:var(--pc-text)}
    .efp .efp-form .text-slate-500,.efp .efp-form .text-slate-600{color:var(--pc-muted)}
    .efp .efp-history{background:var(--pc-surface)!important;border:1px solid var(--pc-border);color:var(--pc-text);box-shadow:none}
    .efp .efp-history h3{color:var(--pc-text)}
    .efp .efp-history .text-slate-500,.efp .efp-history .text-slate-600{color:var(--pc-muted)}
    .ef-dark .efp{--pc-bg:#101b2d;--pc-surface:#18263e;--pc-text:#f0f5ff;--pc-muted:#93a6c6;--pc-border:#2a3a56;--pc-soft:#1c2b44;--pc-hover:#21334f;--pc-blue:#3f6aff}
    .ef-dark .efp .efp-table th{color:#8296b7}
    .ef-dark .efp .efp-package{color:#8196b7}
    .ef-dark .efp .efp-normal{background:#243d41;color:#40c89c}
    .ef-dark .efp .efp-baixo{background:#38352d;color:#ffb94f}
    .ef-dark .efp .efp-zerado{background:#3b293b;color:#ff6277}
    .ef-dark .efp .efp-inativo{background:#2b3547;color:#b0bbce}
    .ef-dark .efp .efp-form .bg-white,.ef-dark .efp .efp-form .bg-slate-50{background:var(--pc-surface)!important}
    .ef-dark .efp .efp-form .text-slate-900,.ef-dark .efp .efp-form .text-slate-700{color:var(--pc-text)!important}
    .ef-dark .efp .efp-form .border-slate-200,.ef-dark .efp .efp-form .border-slate-300{border-color:var(--pc-border)!important}
    .ef-dark .efp .efp-history .bg-slate-50{background:var(--pc-soft)!important}
    .ef-dark .efp .efp-history .text-slate-900{color:var(--pc-text)!important}

    /* Modal de produto: referência Figma, usando a classe do tema do aplicativo. */
    .efp .efp-modal-backdrop{position:fixed;inset:0;z-index:10000;display:flex;align-items:center;justify-content:center;padding:18px;background:rgba(11,20,37,.62);backdrop-filter:blur(5px);-webkit-backdrop-filter:blur(5px)}
    .efp .efp-modal{width:min(560px,100%);max-height:min(88vh,850px);display:flex;flex-direction:column;overflow:hidden;border-radius:15px!important;background:var(--pc-surface)!important;border:1px solid var(--pc-border)!important;box-shadow:0 25px 75px rgba(7,15,33,.26)!important;padding:0!important;color:var(--pc-text)!important}
    .efp .efp-modal-header{flex-shrink:0;display:flex;align-items:center;gap:13px;padding:16px 20px;border-bottom:1px solid var(--pc-border)}
    .efp .efp-modal-symbol{height:38px;width:38px;flex-shrink:0;display:grid;place-items:center;color:var(--pc-blue);background:#eef3ff;border-radius:9px}
    .efp .efp-modal-headcopy{flex:1;min-width:0}
    .efp .efp-modal-headcopy h3{font-size:15px;line-height:1.3;color:var(--pc-text);font-weight:750;letter-spacing:-.2px}
    .efp .efp-modal-headcopy p{margin-top:3px;color:var(--pc-muted);font-size:10px}
    .efp .efp-modal-close{flex-shrink:0;width:30px;height:30px;border-radius:7px;color:var(--pc-muted);font-size:27px;font-weight:300;line-height:1}
    .efp .efp-modal-close:hover{background:var(--pc-soft);color:var(--pc-text)}
    .efp .efp-modal-body{padding:17px 20px 20px;overflow-y:auto;overscroll-behavior:contain;min-height:0;scrollbar-width:thin}
    .efp .efp-modal-body label{font-size:11px!important;font-weight:700!important;color:var(--pc-text)!important;margin-bottom:6px!important}
    .efp .efp-modal-body input:not([type=checkbox]),.efp .efp-modal-body textarea,.efp .efp-modal-body select{width:100%;height:39px;border:1px solid var(--pc-border)!important;background:var(--pc-surface)!important;border-radius:9px!important;color:var(--pc-text)!important;font-size:12px!important;padding:9px 11px!important;outline:none;box-shadow:none!important;margin-top:0!important}
    .efp .efp-modal-body textarea{height:auto;min-height:75px;resize:vertical}
    .efp .efp-modal-body input:focus,.efp .efp-modal-body textarea:focus,.efp .efp-modal-body select:focus{border-color:var(--pc-blue)!important;box-shadow:0 0 0 2px rgba(50,97,244,.13)!important}
    .efp .efp-modal-body input::placeholder,.efp .efp-modal-body textarea::placeholder{color:#aab5c7!important}
    .efp .efp-modal-fields{gap:13px 14px!important;margin-top:0!important}
    .efp .efp-modal-fields>div{min-width:0}
    .efp .efp-modal-body .text-slate-500,.efp .efp-modal-body .text-slate-600{color:var(--pc-muted)!important}
    .efp .efp-modal-body .bg-blue-50{background:var(--pc-soft)!important}
    .efp .efp-modal-body .text-slate-900,.efp .efp-modal-body .text-slate-700{color:var(--pc-text)!important}
    .efp .efp-modal-body button.bg-blue-600{background:var(--pc-blue)!important;color:white!important}
    .efp .efp-modal-body button.bg-slate-100{background:var(--pc-soft)!important;color:var(--pc-muted)!important}
    .efp .efp-modal-footer{display:flex;justify-content:flex-end;gap:8px;align-items:center;padding:12px 20px;border-top:1px solid var(--pc-border);flex-shrink:0}
    .efp .efp-modal-footer button{padding:0 16px;height:37px;border-radius:8px;font-size:11px;font-weight:750}
    .efp .efp-modal-cancel{background:var(--pc-surface);border:1px solid var(--pc-border);color:var(--pc-text)}
    .efp .efp-modal-save{background:var(--pc-blue);border:1px solid var(--pc-blue);color:white;box-shadow:0 4px 9px #3261f41a}
    .efp .efp-modal-save:disabled,.efp .efp-modal-cancel:disabled{opacity:.55;cursor:not-allowed}
    .ef-dark .efp .efp-modal-backdrop{background:rgba(1,8,20,.75)}
    .ef-dark .efp .efp-modal-symbol{background:#edf2ff}
    .ef-dark .efp .efp-modal-body .border-blue-100,.ef-dark .efp .efp-modal-body .border-slate-200{border-color:var(--pc-border)!important}
    @media(max-width:580px){.efp .efp-modal-backdrop{padding:10px;align-items:center}.efp .efp-modal{max-height:94dvh;border-radius:13px!important}.efp .efp-modal-header{padding:15px}.efp .efp-modal-body{padding:15px}.efp .efp-modal-footer{padding:12px 15px}.efp .efp-modal-footer button{flex:1}}


    /* Composição e custos — mesma linguagem visual do modal Figma. */
    .efp .efp-modal-tabs{display:flex;gap:7px;padding:0 0 13px;margin-bottom:16px;border-bottom:1px solid var(--pc-border)}
    .efp .efp-tab{padding:10px 12px;border-radius:8px;font-size:11px;font-weight:700;background:var(--pc-soft);color:var(--pc-muted);transition:background .15s,color .15s}
    .efp .efp-tab-active{background:var(--pc-blue);color:white;box-shadow:0 3px 9px rgba(54,97,244,.16)}
    .efp .efp-composition{display:flex;flex-direction:column;gap:17px}
    .efp .efp-comp-intro{display:flex;gap:10px;align-items:flex-start;padding:12px 13px;border:1px solid var(--pc-border);border-radius:10px;background:var(--pc-soft)}
    .efp .efp-comp-intro-icon{width:29px;height:29px;flex:0 0 29px;display:grid;place-items:center;border-radius:7px;background:var(--pc-surface);color:var(--pc-blue)}
    .efp .efp-comp-intro-icon svg{width:17px;height:17px}
    .efp .efp-comp-intro strong{font-size:12px;font-weight:750;color:var(--pc-text)}
    .efp .efp-comp-intro p{font-size:10px;line-height:1.6;color:var(--pc-muted);margin-top:3px}
    .efp .efp-comp-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px 14px}
    .efp .efp-comp-field{min-width:0}
    .efp .efp-comp-field label{display:block!important;font-size:10px!important;margin-bottom:6px!important;font-weight:750!important}
    .efp .efp-comp-field label span{color:var(--pc-muted);font-weight:500}
    .efp .efp-comp-field input,.efp .efp-comp-field select{font-size:11px!important;text-overflow:ellipsis}
    .efp .efp-comp-field select{padding-right:23px!important}
    .efp .efp-comp-hint{margin-top:5px;font-size:9px;line-height:1.5;color:var(--pc-muted)}
    .efp .efp-comp-cost{border:1px solid var(--pc-border);border-radius:11px;overflow:hidden;background:var(--pc-surface)}
    .efp .efp-comp-cost-head{display:flex;justify-content:space-between;gap:10px;align-items:center;padding:12px 14px;border-bottom:1px solid var(--pc-border);background:var(--pc-soft)}
    .efp .efp-comp-cost-head strong{font-size:12px;font-weight:750;color:var(--pc-text)}
    .efp .efp-comp-cost-head p{font-size:10px;color:var(--pc-muted);margin-top:3px}
    .efp .efp-comp-cost-badge{display:inline-flex;align-items:center;padding:5px 9px;border-radius:20px;background:#e8f8f0;color:#108659;font-size:9px;font-weight:750}
    .ef-dark .efp .efp-comp-cost-badge{background:#173b37;color:#49d6a0}
    .efp .efp-comp-cost-lines{padding:11px 14px 0}
    .efp .efp-comp-cost-lines>div{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:6px 0;font-size:11px;color:var(--pc-muted)}
    .efp .efp-comp-cost-lines strong{font-size:11px;color:var(--pc-text);font-weight:700;white-space:nowrap}
    .efp .efp-comp-cost-lines>.efp-comp-cost-total{border-top:1px solid var(--pc-border);margin-top:7px;padding:13px 0;color:var(--pc-text);font-weight:750}
    .efp .efp-comp-cost-total strong{font-size:15px;color:var(--pc-blue);letter-spacing:-.3px}
    .efp .efp-comp-cost-empty{font-size:11px;line-height:1.6;color:var(--pc-muted);padding:14px}
    .efp .efp-comp-footnote{font-size:10px;line-height:1.6;color:var(--pc-muted)}
    .efp .efp-comp-notice{padding:10px 12px;border-radius:9px;background:var(--pc-soft);font-size:11px;color:var(--pc-muted)}
    .efp .efp-comp-error{background:#fff0f1;color:#b72f43}
    .efp .efp-comp-warn{background:#fff7e8;color:#98600b}
    .ef-dark .efp .efp-comp-error{background:#3a2433;color:#ff9caa}
    .ef-dark .efp .efp-comp-warn{background:#3a3426;color:#f2c778}
    @media(max-width:490px){.efp .efp-comp-grid{grid-template-columns:1fr}.efp .efp-modal-tabs{flex-wrap:wrap}.efp .efp-tab{flex:1;white-space:nowrap;padding:10px 8px}}
    @media(max-width:740px){.efp .efp-head{align-items:flex-start;flex-direction:column;gap:20px;margin-bottom:23px}.efp .efp-title{font-size:26px}.efp .efp-actions{width:100%}.efp .efp-actions .efp-btn{flex:1}.efp .efp-filterrow{gap:8px}.efp .efp-search{width:100%}.efp .efp-count{margin-left:0;width:100%;text-align:right}.efp .efp-table-wrap{display:none}.efp .efp-mobile{display:block}.efp .efp-select{flex:1;max-width:none}}
  `

  return (
    <section className="efp">
      <style>{cssProdutos}</style>
      <header className="efp-head">
        <div>
          <div className="efp-kicker">Gestão de estoque</div>
          <h2 className="efp-title">Produtos</h2>
          <p className="efp-subtitle">Gerencie o catálogo, disponibilidade e composição dos seus produtos.</p>
        </div>
        <div className="efp-actions">
          <button type="button" className="efp-btn" onClick={() => setOrganizando(v => !v)} title="Organizar a exibição dos produtos">
            <span style={{fontSize:18,lineHeight:0}}>⠿</span>Organizar exibição
          </button>
          <button type="button" className="efp-btn efp-btn-primary" onClick={abrirCadastro}>
            <span style={{fontSize:22,fontWeight:400,lineHeight:0}}>+</span>Novo produto
          </button>
        </div>
      </header>
      {organizando && <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3" style={{background:'var(--pc-soft)',borderColor:'var(--pc-border)',color:'var(--pc-muted)'}}><span style={{fontSize:12,fontWeight:700}}>Ordenar visualização por:</span><select className="efp-select" value={ordenacao} onChange={e => setOrdenacao(e.target.value)}><option value="original">Ordem atual</option><option value="nome">Nome (A–Z)</option><option value="codigo">Código (A–Z)</option><option value="estoque">Menor estoque</option></select><span style={{fontSize:11}}>A ordenação é apenas visual e não altera o banco.</span></div>}

      {mostrarFormulario && (
        <div className="efp-modal-backdrop" onMouseDown={(e) => { if (e.target === e.currentTarget && !salvando) limparFormulario() }}>
        <div className="efp-form efp-modal" role="dialog" aria-modal="true" aria-labelledby="efp-modal-title">
          <div className="efp-modal-header">
            <div className="efp-modal-symbol" aria-hidden="true">{iconePacote}</div>
            <div className="efp-modal-headcopy">
              <h3 id="efp-modal-title">{produtoEditandoId ? 'Editar produto' : 'Novo produto'}</h3>
              <p>Cadastre as informações comerciais e de estoque.</p>
            </div>
            <button type="button" className="efp-modal-close" onClick={limparFormulario} disabled={salvando} aria-label="Fechar formulário">×</button>
          </div>
          <div className="efp-modal-body">

          {empresaSd && (
            <div className="efp-modal-tabs">
              <button type="button" onClick={() => setAbaFormulario('geral')}
                className={`efp-tab ${abaFormulario === 'geral' ? 'efp-tab-active' : ''}`}>
                Informações gerais
              </button>
              <button type="button" onClick={() => setAbaFormulario('composicao')}
                className={`efp-tab ${abaFormulario === 'composicao' ? 'efp-tab-active' : ''}`}>
                Composição e custos
                {composicaoExistente ? ' ✓' : ''}
              </button>
            </div>
          )}

          {(!empresaSd || abaFormulario === 'geral') && (
          <div className="efp-modal-fields mt-5 grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="md:col-span-2">
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
                placeholder="Selecione ou digite"
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
                placeholder="R$ 0,00"
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
              <p className="mt-1 text-xs text-slate-500">
                Preço de referência para as vendas e relatórios.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700">Status</label>
              <select value={formProduto.ativo ? 'ativo' : 'inativo'}
                onChange={(event) => atualizarCampo('ativo', event.target.value === 'ativo')}
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
                <option value="ativo">Ativo</option>
                <option value="inativo">Inativo</option>
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-slate-700">
                Observação
              </label>
              <input
                type="text"
                value={formProduto.observacao}
                onChange={(event) =>
                  atualizarCampo('observacao', event.target.value)
                }
                placeholder="Informações adicionais..."
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

          )}

          {empresaSd && abaFormulario === 'composicao' && (
            <div className="efp-composition">
              <div className="efp-comp-intro">
                <span className="efp-comp-intro-icon" aria-hidden="true">{iconePacote}</span>
                <div>
                  <strong>Composição da peça</strong>
                  <p>Defina os materiais utilizados. Os custos acompanham os preços atuais do catálogo de Insumos.</p>
                </div>
              </div>

              {carregandoComposicao && <p className="efp-comp-notice">Carregando composição cadastrada...</p>}
              {erroComposicao && <p role="alert" className="efp-comp-notice efp-comp-error">{erroComposicao}</p>}
              {erroInsumos && <p role="alert" className="efp-comp-notice efp-comp-error">{erroInsumos}</p>}
              {carregandoInsumos && <p className="efp-comp-notice">Carregando catálogo de insumos...</p>}

              {!carregandoInsumos && !erroInsumos && (
                <div className="efp-comp-grid">
                  <div className="efp-comp-field">
                    <label htmlFor="efp-peso">Peso da peça <span>(gramas)</span> *</label>
                    <input id="efp-peso" type="number" min="0" step="0.000001" value={formComposicao.pesoGramas}
                      onChange={(e) => atualizarComposicao('pesoGramas', e.target.value)}
                      placeholder="Ex.: 5,5" />
                  </div>
                  <div className="efp-comp-field">
                    <label htmlFor="efp-materia">Matéria-prima *</label>
                    <select id="efp-materia" value={formComposicao.materiaPrimaId} onChange={(e) => atualizarComposicao('materiaPrimaId', e.target.value)}>
                      <option value="">Selecione a matéria-prima</option>
                      {categoriasInsumos.materias.map((i) => <option key={i.id} value={i.id}>{i.nome} · {formatarMoeda(i.custo_unitario)}/{i.unidade}</option>)}
                    </select>
                  </div>
                  <div className="efp-comp-field">
                    <label htmlFor="efp-embalagem">Embalagem <span>(medida)</span> *</label>
                    <select id="efp-embalagem" value={formComposicao.embalagemId} onChange={(e) => atualizarComposicao('embalagemId', e.target.value)}>
                      <option value="">Selecione a embalagem</option>
                      {categoriasInsumos.embalagens.map((i) => <option key={i.id} value={i.id}>{i.nome} · {formatarMoeda(i.custo_unitario)}/un.</option>)}
                    </select>
                  </div>
                  <div className="efp-comp-field">
                    <label htmlFor="efp-pecas">Peças por embalagem *</label>
                    <input id="efp-pecas" type="number" min="1" step="1" value={formComposicao.pecasPorEmbalagem}
                      onChange={(e) => atualizarComposicao('pecasPorEmbalagem', e.target.value)} placeholder="Ex.: 100" />
                    <p className="efp-comp-hint">Distribui o custo da embalagem entre as peças.</p>
                  </div>
                  <div className="efp-comp-field">
                    <label htmlFor="efp-pigmento">Pigmento <span>Opcional</span></label>
                    <select id="efp-pigmento" value={formComposicao.pigmentoId} onChange={(e) => atualizarComposicao('pigmentoId', e.target.value)}>
                      <option value="">Sem pigmento</option>
                      {categoriasInsumos.pigmentos.map((i) => <option key={i.id} value={i.id}>{i.nome} · {formatarMoeda(i.custo_unitario)}/{i.unidade}</option>)}
                    </select>
                  </div>
                  {formComposicao.pigmentoId && (
                    <div className="efp-comp-field">
                      <label htmlFor="efp-percentual">Percentual de pigmento <span>(%)</span> *</label>
                      <input id="efp-percentual" type="number" min="0.0001" max="99.9999" step="0.0001" value={formComposicao.percentualPigmento}
                        onChange={(e) => atualizarComposicao('percentualPigmento', e.target.value)} placeholder="Ex.: 2" />
                    </div>
                  )}
                </div>
              )}

              <div className="efp-comp-cost">
                <div className="efp-comp-cost-head">
                  <div>
                    <strong>Resumo de custos</strong>
                    <p>Estimativa por peça · preços atuais</p>
                  </div>
                  <span className="efp-comp-cost-badge">Automático</span>
                </div>
                {custoPrevisto ? (
                  <div className="efp-comp-cost-lines">
                    <div><span>Matéria-prima</span><strong>{formatarMoeda(custoPrevisto.materia)}</strong></div>
                    <div><span>Pigmento</span><strong>{formatarMoeda(custoPrevisto.pigmento)}</strong></div>
                    <div><span>Embalagem por peça</span><strong>{formatarMoeda(custoPrevisto.embalagem)}</strong></div>
                    <div className="efp-comp-cost-total"><span>Custo total por peça</span><strong>{formatarMoeda(custoPrevisto.total)}</strong></div>
                  </div>
                ) : (
                  <p className="efp-comp-cost-empty">Preencha o peso, a matéria-prima e a embalagem para visualizar o cálculo. O pigmento é opcional.</p>
                )}
              </div>
              <p className="efp-comp-footnote">Os valores são estimativas de materiais, sem mão de obra, energia ou perdas. Nenhum estoque de insumos será movimentado.</p>
              {!composicaoExistente && !camposComposicaoPreenchidos && (
                <p className="efp-comp-notice efp-comp-warn">Você pode salvar o produto sem composição e completá-la depois, quando cadastrar as embalagens.</p>
              )}
            </div>
          )}

          </div>
          <div className="efp-modal-footer">
            <button type="button" onClick={limparFormulario} disabled={salvando} className="efp-modal-cancel">Cancelar</button>
            <button type="button" onClick={salvarProduto} disabled={salvando} className="efp-modal-save">
              {salvando ? 'Salvando...' : produtoEditandoId ? 'Salvar alterações' : 'Salvar registro'}
            </button>
          </div>
        </div>
        </div>
      )}

      <div className="efp-sheet mt-6">
        <div className="efp-filterrow">
          <div className="efp-search">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m16 16 5 5"/></svg>
            <input type="search" value={busca} onChange={e => setBusca(e.target.value)} placeholder="Buscar por nome ou código..." aria-label="Buscar produtos" />
          </div>
          <select className="efp-select" value={filtroCategoria} onChange={e => setFiltroCategoria(e.target.value)} aria-label="Filtrar categoria">
            <option value="">☷  Categoria</option>
            {categoriasProdutos.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <select className="efp-select" value={filtroStatus} onChange={e => setFiltroStatus(e.target.value)} aria-label="Filtrar status">
            <option value="">Status</option>
            <option value="normal">Normal</option>
            <option value="baixo">Estoque baixo</option>
            <option value="zerado">Sem estoque</option>
            <option value="inativo">Inativo</option>
          </select>
          <button type="button" className="efp-filterbtn" onClick={() => setMostrarMaisFiltros(v => !v)}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round"><path d="M3 5h18l-7 8v6l-4 2v-8L3 5Z"/></svg>
            Mais filtros
          </button>
          <span className="efp-count">{produtosFiltrados.length} {produtosFiltrados.length === 1 ? 'produto' : 'produtos'}</span>
          {mostrarMaisFiltros && <div style={{width:'100%',display:'flex',gap:15,alignItems:'center',paddingTop:6,flexWrap:'wrap'}}>
            <label style={{fontSize:11,color:'var(--pc-muted)',display:'flex',alignItems:'center',gap:7}}><input type="checkbox" checked={somenteEmProducao} onChange={e => setSomenteEmProducao(e.target.checked)}/> Somente em produção</label>
            <button type="button" style={{fontSize:11,color:'var(--pc-blue)',fontWeight:700}} onClick={() => {setBusca('');setFiltroCategoria('');setFiltroStatus('');setSomenteEmProducao(false)}}>Limpar filtros</button>
          </div>}
        </div>
        <div className="efp-table-wrap">
          <table className="efp-table">
            <thead><tr><th>Produto</th><th>Categoria</th><th>Estoque atual</th><th>Mínimo</th><th>Valor unitário</th><th>Status</th><th aria-label="Ações" /></tr></thead>
            <tbody>
              {carregandoProdutos ? <tr><td colSpan={7} className="efp-empty">Carregando produtos...</td></tr> : produtosFiltrados.length === 0 ? <tr><td colSpan={7} className="efp-empty">Nenhum produto encontrado.</td></tr> : produtosFiltrados.map(produto =>
                <tr key={produto.id}>
                  <td><div className="efp-namecell"><span className="efp-package">{iconePacote}</span><div><div className="efp-productname">{produto.nome}</div><div className="efp-productcode">{produto.codigo}{produto.emProducao ? ' · Em produção' : ''}</div></div></div></td>
                  <td>{produto.categoria}</td>
                  <td><span className="efp-qty">{numFormat(produto.estoqueAtual)}</span> un.</td>
                  <td>{numFormat(produto.estoqueMinimo)} un.</td>
                  <td>{empresaSd ? numPreco(produto.valorUnitario) : '—'}</td>
                  <td><StatusProduto produto={produto}/></td>
                  <td><MenuAcoes produto={produto}/></td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="efp-mobile">
          {carregandoProdutos ? <div className="efp-empty">Carregando produtos...</div> : produtosFiltrados.length === 0 ? <div className="efp-empty">Nenhum produto encontrado.</div> : produtosFiltrados.map(produto =>
            <div key={produto.id} className="efp-mobile-card">
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:8}}>
                <div className="efp-namecell"><span className="efp-package">{iconePacote}</span><div><div className="efp-productname">{produto.nome}</div><div className="efp-productcode">{produto.codigo}{produto.emProducao ? ' · Em produção' : ''}</div></div></div>
                <MenuAcoes produto={produto}/>
              </div>
              <div className="efp-mobile-grid"><div className="efp-mobile-metric"><small>Estoque</small><strong>{numFormat(produto.estoqueAtual)} un.</strong></div><div className="efp-mobile-metric"><small>Mínimo</small><strong>{numFormat(produto.estoqueMinimo)} un.</strong></div><div className="efp-mobile-metric"><small>Valor</small><strong>{empresaSd ? numPreco(produto.valorUnitario) : '—'}</strong></div></div>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:10,marginTop:13}}><span style={{fontSize:11,color:'var(--pc-muted)'}}>{produto.categoria}</span><StatusProduto produto={produto}/></div>
            </div>
          )}
        </div>
      </div>

      <div className="efp-history mt-6 overflow-hidden rounded-2xl bg-white shadow-sm">
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