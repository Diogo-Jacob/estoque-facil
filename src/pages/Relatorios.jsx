import { useEffect, useState } from 'react'
import jsPDF from 'jspdf'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { supabase } from '../services/supabase'

// Ícones vetoriais consistentes, sem fontes externas ou dependências adicionais.
function Icone({ nome, tamanho = 19, className = '' }) {
  const base = { size: tamanho, strokeWidth: 1.9 }
  const caminhos = {
    entrada: <><path d="m7 7 10 10M17 7v10H7" /></>,
    saida: <><path d="m7 17 10-10M7 7h10v10" /></>,
    saldo: <><path d="M3 12h4l3-7 4 14 3-7h4" /></>,
    financeiro: <><circle cx="12" cy="12" r="9" /><path d="M15 8.5c-.8-.8-1.9-1.2-3.1-1.2-1.8 0-3 .9-3 2.2 0 3.3 6.3 1.2 6.3 4.5 0 1.3-1.2 2.2-3.2 2.2-1.1 0-2.4-.4-3.3-1.4M12 5v14" /></>,
    alerta: <><path d="M12 3 2 20h20L12 3Z" /><path d="M12 9v4M12 17h.01" /></>,
    impressora: <><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><path d="M6 14h12v7H6zM18 12h.01" /></>,
    baixar: <><path d="M12 3v12m-4-4 4 4 4-4M4 17v4h16v-4" /></>,
    filtro: <><path d="M3 5h18l-7 8v6l-4 2v-8L3 5Z" /></>,
    aplicar: <><path d="M13 2 5 13h6l-1 9 9-12h-6l1-8Z" /></>,
  }
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={base.strokeWidth} strokeLinecap="round"
      strokeLinejoin="round" className={className} aria-hidden="true">
      {caminhos[nome] || caminhos.filtro}
    </svg>
  )
}

function Relatorios({ empresaAtiva }) {
  function obterDataLocal(data = new Date()) {
    const ano = data.getFullYear()
    const mes = String(data.getMonth() + 1).padStart(2, '0')
    const dia = String(data.getDate()).padStart(2, '0')

    return `${ano}-${mes}-${dia}`
  }

  function obterPrimeiroDiaDoMes() {
    const data = new Date()
    const ano = data.getFullYear()
    const mes = String(data.getMonth() + 1).padStart(2, '0')

    return `${ano}-${mes}-01`
  }

  const [dataInicial, setDataInicial] = useState(obterPrimeiroDiaDoMes())
  const [dataFinal, setDataFinal] = useState(obterDataLocal())
  const [buscaProduto, setBuscaProduto] = useState('')
  const [canalSelecionado, setCanalSelecionado] = useState('')
  const [tipoSelecionado, setTipoSelecionado] = useState('todos')
  const [relatorioDados, setRelatorioPorProduto] = useState([])
  const [vendasDados, setVendasDetalhadas] = useState([])
  const [carregandoRelatorio, setCarregandoRelatorio] = useState(false)
  const [gerandoPdf, setGerandoPdf] = useState(false)
  const empresaEhDega = empresaAtiva?.nome?.trim().toLowerCase() === 'dega'
  const canaisVenda = empresaEhDega
    ? [
        { valor: 'dega_moto_parts', nome: 'Dega Moto Parts' },
        { valor: 'emplajoi', nome: 'Emplajoi' },
        { valor: 'fecha_molde', nome: 'Fecha Molde' },
        { valor: 'shopee', nome: 'Shopee' },
      ]
    : [
        { valor: 'mercado_livre', nome: 'Mercado Livre' },
        { valor: 'zeca', nome: 'Zeca' },
      ]

  const nomeCanalSelecionado = canalSelecionado === '__sem_canal__'
    ? 'Não informado'
    : canaisVenda.find((canal) => canal.valor === canalSelecionado)?.nome || 'Todos os canais'

  // Evita carregar o canal de uma empresa ao mudar para outra.
  useEffect(() => {
    setCanalSelecionado('')
  }, [empresaAtiva?.id])

  useEffect(() => {
    if (empresaAtiva?.id && dataInicial && dataFinal) {
      carregarRelatorio()
    }
  }, [empresaAtiva?.id, dataInicial, dataFinal, buscaProduto, canalSelecionado])

  async function carregarRelatorio() {
    if (!dataInicial || !dataFinal) return

    if (dataInicial > dataFinal) {
      setRelatorioPorProduto([])
      setVendasDetalhadas([])
      alert('A data inicial não pode ser maior que a data final.')
      return
    }

    setCarregandoRelatorio(true)

    const { data, error } = await supabase.rpc('relatorio_produtos_por_canal', {
      p_empresa_id: empresaAtiva.id,
      p_data_inicial: dataInicial,
      p_data_final: dataFinal,
      p_busca: buscaProduto.trim(),
      p_canal_venda: canalSelecionado || null,
    })

    if (error) {
      console.error('Erro ao carregar relatório:', error)
      alert(error.message || 'Erro ao carregar relatório.')
      setCarregandoRelatorio(false)
      return
    }

    const relatorioFormatado = data.map((item) => ({
      produtoId: item.produto_id,
      produto: item.produto,
      categoria: item.categoria,
      entradas: Number(item.entradas),
      saidas: Number(item.saidas),
      estoqueAtual: item.estoque_atual,
      estoqueMinimo: item.estoque_minimo,
      valorUnitario: Number(item.valor_unitario || 0),
      valorTotalVendido: Number(item.valor_total_vendido || 0),
    }))

    // Paginação evita o limite padrão de 1000 registros por resposta do Supabase.
    // Apenas saídas originais e não estornadas, como na função SQL.
    const vendas = []
    let erroVendas = null
    const tamanhoPagina = 1000
    for (let inicio = 0; ; inicio += tamanhoPagina) {
      let consulta = supabase
        .from('movimentacoes')
        .select(`
          id,
          produto_id,
          quantidade,
          canal_venda,
          produtos!movimentacoes_produto_id_fkey (
            nome,
            valor_unitario
          )
        `)
        .eq('empresa_id', empresaAtiva.id)
        .eq('tipo', 'saida')
        .gte('data_movimentacao', dataInicial)
        .lte('data_movimentacao', dataFinal)
        .eq('estornada', false)
        .is('movimentacao_original_id', null)
        .order('id', { ascending: true })
        .range(inicio, inicio + tamanhoPagina - 1)

      if (canalSelecionado && canalSelecionado !== '__sem_canal__') {
        consulta = consulta.eq('canal_venda', canalSelecionado)
      }
      // No caso de "Não informado", a filtragem final também cobre strings vazias/espaços.
      const { data: pagina, error: erroPagina } = await consulta
      if (erroPagina) {
        erroVendas = erroPagina
        break
      }
      vendas.push(...(pagina || []))
      if (!pagina || pagina.length < tamanhoPagina) break
    }

    if (erroVendas) {
      console.error('Erro ao carregar vendas por canal:', erroVendas)
      alert(erroVendas.message || 'Erro ao carregar vendas por canal.')
      setRelatorioPorProduto([])
      setVendasDetalhadas([])
      setCarregandoRelatorio(false)
      return
    }

    const produtosPermitidos = new Set(
      relatorioFormatado.map((item) => item.produtoId)
    )

    const vendasFormatadas = vendas
      .filter((venda) =>
        produtosPermitidos.has(venda.produto_id) &&
        (canalSelecionado !== '__sem_canal__' || !String(venda.canal_venda || '').trim())
      )
      .map((venda) => ({
        produtoId: venda.produto_id,
        produto: venda.produtos?.nome || 'Produto não encontrado',
        quantidade: Number(venda.quantidade || 0),
        valorUnitario: Number(venda.produtos?.valor_unitario || 0),
        valorTotal:
          Number(venda.quantidade || 0) *
          Number(venda.produtos?.valor_unitario || 0),
        canalVenda: venda.canal_venda || '',
      }))

    setRelatorioPorProduto(relatorioFormatado)
    setVendasDetalhadas(vendasFormatadas)
    setCarregandoRelatorio(false)
  }

  function formatarDataBrasil(data) {
    if (!data) return '-'

    const [ano, mes, dia] = data.split('-')

    return `${dia}/${mes}/${ano}`
  }

  function formatarMoeda(valor) {
    return Number(valor || 0).toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  }

  function gerarTextoPeriodo() {
    if (!dataInicial || !dataFinal) {
      return 'Selecione um período'
    }

    if (dataInicial === dataFinal) {
      return `Dia ${formatarDataBrasil(dataInicial)}`
    }

    return `${formatarDataBrasil(dataInicial)} a ${formatarDataBrasil(dataFinal)}`
  }

  // O filtro de tipo afeta a visualização, sem alterar a consulta nem os dados originais.
  const relatorioPorProduto = tipoSelecionado === 'entrada'
    ? relatorioDados.filter((item) => item.entradas > 0).map((item) => ({ ...item, saidas: 0, valorTotalVendido: 0 }))
    : tipoSelecionado === 'saida'
      ? relatorioDados.filter((item) => item.saidas > 0).map((item) => ({ ...item, entradas: 0 }))
      : relatorioDados
  const vendasDetalhadas = tipoSelecionado === 'entrada' ? [] : vendasDados

  const totalEntradas = relatorioPorProduto.reduce(
    (total, item) => total + item.entradas,
    0
  )

  const totalSaidas = relatorioPorProduto.reduce(
    (total, item) => total + item.saidas,
    0
  )

  const totalValorVendido = relatorioPorProduto.reduce(
    (total, item) => total + item.valorTotalVendido,
    0
  )

  const produtosComEstoqueBaixo = relatorioPorProduto.filter(
    (item) => item.estoqueAtual < item.estoqueMinimo
  )

  const produtoMaisVendido = [...relatorioPorProduto].sort(
    (a, b) => b.saidas - a.saidas
  )[0]

  const dadosGraficoMaisVendidos = relatorioPorProduto
    .filter((item) => item.saidas > 0)
    .sort((a, b) => b.saidas - a.saidas)
    .map((item) => ({
      produtoId: item.produtoId,
      nomeCompleto: item.produto,
      saidas: item.saidas,
    }))

  // Uma linha por produto, sem depender de nomes parecidos ou abreviados.
  const alturaGraficoVendas = Math.max(300, dadosGraficoMaisVendidos.length * 54 + 48)
  const nomesProdutosGrafico = new Map(
    dadosGraficoMaisVendidos.map((item) => [item.produtoId, item.nomeCompleto])
  )

  function formatarCanalVenda(canal) {
    if (!canal) return 'Não informado'

    const canalEncontrado = canaisVenda.find((item) => item.valor === canal)

    return canalEncontrado?.nome || canal
  }

  const rankingProdutosVendidos = relatorioPorProduto
    .filter((item) => item.saidas > 0)
    .sort((a, b) => b.saidas - a.saidas)

  const rankingCanaisVenda = Object.values(
    vendasDetalhadas.reduce((ranking, venda) => {
      const chaveCanal = venda.canalVenda || 'nao_informado'
      const nomeCanal = formatarCanalVenda(venda.canalVenda)

      if (!ranking[chaveCanal]) {
        ranking[chaveCanal] = {
          canal: nomeCanal,
          total: 0,
          movimentacoes: 0,
          valorTotal: 0,
          produtos: {},
        }
      }

      ranking[chaveCanal].total += venda.quantidade
      ranking[chaveCanal].movimentacoes += 1
      ranking[chaveCanal].valorTotal += venda.valorTotal

      if (!ranking[chaveCanal].produtos[venda.produtoId]) {
        ranking[chaveCanal].produtos[venda.produtoId] = {
          produto: venda.produto,
          quantidade: 0,
          valorTotal: 0,
        }
      }

      ranking[chaveCanal].produtos[venda.produtoId].quantidade +=
        venda.quantidade
      ranking[chaveCanal].produtos[venda.produtoId].valorTotal +=
        venda.valorTotal

      return ranking
    }, {})
  )
    .map((canal) => ({
      ...canal,
      produtos: Object.values(canal.produtos).sort(
        (a, b) => b.quantidade - a.quantidade
      ),
    }))
    .sort((a, b) => b.total - a.total)

  const formatarQuantidade = (valor) => Number(valor || 0).toLocaleString('pt-BR')
  const totalUnidadesCanais = rankingCanaisVenda.reduce((total, canal) => total + canal.total, 0)
  const totalMovimentacoesCanais = rankingCanaisVenda.reduce(
    (total, canal) => total + canal.movimentacoes, 0
  )
  const coresCanais = ['#385cf6', '#14b8a6', '#94a3b8', '#f59e0b', '#a855f7', '#f43f5e']
  const distribuicaoCanais = rankingCanaisVenda.map((canal, index) => ({
    ...canal,
    percentual: totalUnidadesCanais ? (canal.total / totalUnidadesCanais) * 100 : 0,
    cor: coresCanais[index % coresCanais.length],
  }))

  function GraficoRoscaCanais() {
    // O gráfico usa unidades movimentadas, não faturamento nem número de lançamentos.
    const raio = 76
    const circunferencia = 2 * Math.PI * raio
    let posicaoAtual = 0

    return (
      <div className="flex flex-col items-center justify-center gap-5 sm:flex-row lg:flex-col xl:flex-row">
        <div className="relative h-36 w-36 shrink-0 sm:h-40 sm:w-40" role="img" aria-label={`Distribuição de ${formatarQuantidade(totalUnidadesCanais)} unidades por canal de venda`}>
          <svg viewBox="0 0 200 200" className="h-full w-full" aria-hidden="true">
            <circle cx="100" cy="100" r={raio} fill="none" stroke="#e2e8f0" strokeWidth="22" />
            {distribuicaoCanais.map((canal) => {
              const comprimento = (canal.percentual / 100) * circunferencia
              const deslocamento = posicaoAtual
              posicaoAtual += comprimento
              return (
                <circle
                  key={canal.canal}
                  cx="100"
                  cy="100"
                  r={raio}
                  fill="none"
                  stroke={canal.cor}
                  strokeWidth="22"
                  strokeDasharray={`${comprimento} ${circunferencia - comprimento}`}
                  strokeDashoffset={-deslocamento}
                  transform="rotate(-90 100 100)"
                >
                  <title>{`${canal.canal}: ${formatarQuantidade(canal.total)} unidades (${canal.percentual.toFixed(1)}%)`}</title>
                </circle>
              )
            })}
          </svg>
          <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
            <strong className="text-2xl font-extrabold tracking-tight text-slate-900">{formatarQuantidade(totalUnidadesCanais)}</strong>
            <span className="mt-1 text-xs font-medium text-slate-500">unidades</span>
          </div>
        </div>
        <div className="w-full min-w-0 max-w-xs space-y-3 px-2 sm:w-auto sm:flex-1 sm:px-0">
          {distribuicaoCanais.map((canal) => (
            <div key={canal.canal} className="flex items-center gap-3 text-sm">
              <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: canal.cor }} />
              <span className="min-w-0 flex-1 truncate font-medium text-slate-700" title={canal.canal}>{canal.canal}</span>
              <strong className="shrink-0 tabular-nums text-slate-900">{canal.percentual.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</strong>
            </div>
          ))}
        </div>
      </div>
    )
  }

  function StatusEstoque({ item }) {
    const baixoEstoque = item.estoqueAtual < item.estoqueMinimo

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

  function gerarPdfRelatorio() {
    const pdf = new jsPDF('p', 'mm', 'a4')

    const margem = 15
    let y = 18

    const larguraPagina = pdf.internal.pageSize.getWidth()
    const alturaPagina = pdf.internal.pageSize.getHeight()
    const larguraUtil = larguraPagina - margem * 2

    function garantirEspaco(alturaNecessaria = 12) {
      if (y + alturaNecessaria > alturaPagina - 15) {
        pdf.addPage()
        y = 18
      }
    }

    function adicionarTituloSecao(titulo) {
      garantirEspaco(14)
      pdf.setTextColor(15, 23, 42)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(14)
      pdf.text(titulo, margem, y)
      y += 9
    }

    const titulo = 'Relatório'
    const periodo = `Período analisado: ${gerarTextoPeriodo()}`
    const textoCanal = `Canal de venda: ${nomeCanalSelecionado}`

    pdf.setTextColor(15, 23, 42)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(18)
    pdf.text(titulo, margem, y)

    y += 8

    pdf.setTextColor(71, 85, 105)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(10)
    pdf.text(periodo, margem, y)
    y += 6
    pdf.text(textoCanal, margem, y)

    y += 16

    const cards = [
      {
        titulo: 'Entradas no período',
        valor: String(totalEntradas),
      },
      {
        titulo: 'Saídas no período',
        valor: String(totalSaidas),
      },
      {
        titulo: 'Produto mais vendido',
        valor:
          produtoMaisVendido && produtoMaisVendido.saidas > 0
            ? produtoMaisVendido.produto
            : 'Sem vendas',
      },
      ...(!empresaEhDega ? [{
        titulo: 'Valor total vendido',
        valor: formatarMoeda(totalValorVendido),
      }] : []),
    ]

    const larguraCard = larguraUtil / 2 - 3
    const alturaCard = 28
    const espacoEntreCards = 6

    cards.forEach((card, index) => {
      const coluna = index % 2
      const linha = Math.floor(index / 2)
      const x = margem + coluna * (larguraCard + espacoEntreCards)
      const yCard = y + linha * (alturaCard + espacoEntreCards)

      pdf.setDrawColor(226, 232, 240)
      pdf.setFillColor(255, 255, 255)
      pdf.roundedRect(x, yCard, larguraCard, alturaCard, 3, 3, 'FD')

      pdf.setTextColor(71, 85, 105)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(9)
      pdf.text(card.titulo, x + 4, yCard + 8)

      pdf.setTextColor(15, 23, 42)
      pdf.setFont('helvetica', 'bold')

      if (card.titulo === 'Produto mais vendido') {
        pdf.setFontSize(9)
      } else if (card.titulo === 'Valor total vendido') {
        pdf.setFontSize(13)
      } else {
        pdf.setFontSize(16)
      }

      const valorQuebrado = pdf.splitTextToSize(card.valor, larguraCard - 8)
      pdf.text(valorQuebrado.slice(0, 2), x + 4, yCard + 18)
    })

    y += 75

    // O gráfico integra o PDF apenas da SD Plásticos.
    if (!empresaEhDega) {
      adicionarTituloSecao('Gráfico de Vendas')

      if (dadosGraficoMaisVendidos.length === 0) {
        pdf.setTextColor(71, 85, 105)
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(10)
        pdf.text('Nenhuma saída registrada no período selecionado.', margem, y)
        y += 12
      } else {
        // Os seis mais vendidos, ordenados por quantidade, em barras horizontais.
        const dadosPdf = dadosGraficoMaisVendidos.slice(0, 6)
        const maiorValor = Math.max(...dadosPdf.map((item) => item.saidas), 1)
        const alturaLinha = 17
        const alturaTotal = dadosPdf.length * alturaLinha + 8
        garantirEspaco(alturaTotal)

        const larguraRotulo = 68
        const larguraBarras = larguraUtil - larguraRotulo - 28
        const xBarras = margem + larguraRotulo

        dadosPdf.forEach((item, index) => {
          const yLinha = y + index * alturaLinha
          const larguraBarra = (item.saidas / maiorValor) * larguraBarras

          pdf.setFont('helvetica', 'normal')
          pdf.setFontSize(9)
          pdf.setTextColor(51, 65, 85)
          const nome = pdf.splitTextToSize(item.nomeCompleto, larguraRotulo - 5)
          pdf.text(nome.slice(0, 2), margem, yLinha + 4)

          pdf.setFillColor(226, 232, 240)
          pdf.roundedRect(xBarras, yLinha + 1, larguraBarras, 7, 1.5, 1.5, 'F')
          pdf.setFillColor(37, 99, 235)
          pdf.roundedRect(xBarras, yLinha + 1, larguraBarra, 7, 1.5, 1.5, 'F')

          pdf.setFont('helvetica', 'bold')
          pdf.setFontSize(9)
          pdf.setTextColor(15, 23, 42)
          pdf.text(
            item.saidas.toLocaleString('pt-BR'),
            margem + larguraUtil,
            yLinha + 6.5,
            { align: 'right' }
          )
        })

        y += alturaTotal + 8
      }
    }

    adicionarTituloSecao('Produtos vendidos no período')

    if (rankingProdutosVendidos.length === 0) {
      pdf.setTextColor(71, 85, 105)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
      pdf.text('Nenhum produto vendido no período selecionado.', margem, y)
      y += 10
    } else {
      garantirEspaco(12)
      pdf.setFillColor(241, 245, 249)
      pdf.rect(margem, y, larguraUtil, 8, 'F')
      pdf.setTextColor(71, 85, 105)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(9)
      pdf.text('Pos.', margem + 3, y + 5.5)
      pdf.text('Produto', margem + 18, y + 5.5)
      pdf.text('Qtd. saída', margem + larguraUtil - 42, y + 5.5, {
        align: 'right',
      })
      if (!empresaEhDega) {
        pdf.text('Valor total', margem + larguraUtil - 3, y + 5.5, {
          align: 'right',
        })
      }
      y += 8

      rankingProdutosVendidos.forEach((item, index) => {
        garantirEspaco(9)
        const linhasProduto = pdf.splitTextToSize(item.produto, empresaEhDega ? larguraUtil - 55 : larguraUtil - 82)
        const alturaLinha = Math.max(8, linhasProduto.length * 4 + 3)

        pdf.setDrawColor(226, 232, 240)
        pdf.line(margem, y + alturaLinha, margem + larguraUtil, y + alturaLinha)

        pdf.setTextColor(71, 85, 105)
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(9)
        pdf.text(`${index + 1}º`, margem + 3, y + 5.5)
        pdf.text(linhasProduto, margem + 18, y + 5.5)

        pdf.setTextColor(15, 23, 42)
        pdf.setFont('helvetica', 'bold')
        pdf.text(String(item.saidas), margem + larguraUtil - 42, y + 5.5, {
          align: 'right',
        })
        if (!empresaEhDega) {
          pdf.text(
            formatarMoeda(item.valorTotalVendido),
            margem + larguraUtil - 3,
            y + 5.5,
            { align: 'right' }
          )
        }

        y += alturaLinha
      })

      y += 8
    }

    adicionarTituloSecao('Ranking dos canais de venda')

    if (rankingCanaisVenda.length === 0) {
      pdf.setTextColor(71, 85, 105)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
      pdf.text('Nenhuma venda com canal disponível no período.', margem, y)
    } else {
      rankingCanaisVenda.forEach((canal, indexCanal) => {
        garantirEspaco(22)

        pdf.setFillColor(239, 246, 255)
        pdf.roundedRect(margem, y, larguraUtil, 13, 2, 2, 'F')

        pdf.setTextColor(30, 64, 175)
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(11)
        pdf.text(`${indexCanal + 1}º — ${canal.canal}`, margem + 4, y + 5.5)

        pdf.setFontSize(9)
        pdf.text(
          empresaEhDega ? `Total: ${canal.total}` : `Total: ${canal.total} | ${formatarMoeda(canal.valorTotal)}`,
          margem + larguraUtil - 4,
          y + 5.5,
          { align: 'right' }
        )

        pdf.setTextColor(71, 85, 105)
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(8)
        pdf.text(`${canal.produtos.length} produto(s)`, margem + 4, y + 10)

        y += 16

        canal.produtos.forEach((produto) => {
          garantirEspaco(8)
          const linhasProduto = pdf.splitTextToSize(
            produto.produto,
            empresaEhDega ? larguraUtil - 55 : larguraUtil - 72
          )
          const alturaLinha = Math.max(7, linhasProduto.length * 4 + 2)

          pdf.setTextColor(51, 65, 85)
          pdf.setFont('helvetica', 'normal')
          pdf.setFontSize(9)
          pdf.text(linhasProduto, margem + 6, y + 4.5)

          pdf.setTextColor(15, 23, 42)
          pdf.setFont('helvetica', 'bold')
          pdf.text(
            String(produto.quantidade),
            margem + larguraUtil - 42,
            y + 4.5,
            { align: 'right' }
          )
          if (!empresaEhDega) {
            pdf.text(
              formatarMoeda(produto.valorTotal),
              margem + larguraUtil - 4,
              y + 4.5,
              { align: 'right' }
            )
          }

          pdf.setDrawColor(241, 245, 249)
          pdf.line(
            margem + 4,
            y + alturaLinha,
            margem + larguraUtil - 4,
            y + alturaLinha
          )

          y += alturaLinha
        })

        y += 8
      })
    }

    return pdf
  }

  function salvarRelatorioPdf() {
    try {
      setGerandoPdf(true)

      const pdf = gerarPdfRelatorio()

      const nomeArquivo = `relatorio-estoque-${canalSelecionado || 'todos'}-${dataInicial}-a-${dataFinal}.pdf`

      pdf.save(nomeArquivo)
    } catch (error) {
      console.error('Erro ao gerar PDF:', error)
      alert('Erro ao gerar PDF. Verifique o console do navegador.')
    } finally {
      setGerandoPdf(false)
    }
  }

  function imprimirRelatorio() {
    try {
      const pdf = gerarPdfRelatorio()

      pdf.autoPrint()

      const url = pdf.output('bloburl')
      window.open(url, '_blank')
    } catch (error) {
      console.error('Erro ao preparar impressão:', error)
      alert('Erro ao preparar impressão. Verifique o console do navegador.')
    }
  }

  const resumoCards = [
    { titulo: 'Total de entradas', valor: formatarQuantidade(totalEntradas), detalhe: 'unidades no período', icone: 'entrada', cor: 'text-blue-600 bg-blue-50' },
    { titulo: 'Total de saídas', valor: formatarQuantidade(totalSaidas), detalhe: 'unidades no período', icone: 'saida', cor: 'text-rose-500 bg-rose-50' },
    { titulo: 'Saldo líquido', valor: `${totalEntradas - totalSaidas >= 0 ? '+' : ''}${formatarQuantidade(totalEntradas - totalSaidas)}`, detalhe: 'entradas menos saídas', icone: 'saldo', cor: 'text-emerald-600 bg-emerald-50' },
    ...(!empresaEhDega ? [{ titulo: 'Valor estimado das saídas', valor: formatarMoeda(totalValorVendido), detalhe: 'preços atuais dos produtos', icone: 'financeiro', cor: 'text-violet-600 bg-violet-50' }] : [
      { titulo: 'Produtos com estoque baixo', valor: formatarQuantidade(produtosComEstoqueBaixo.length), detalhe: 'dos produtos encontrados', icone: 'alerta', cor: 'text-amber-600 bg-amber-50' },
    ]),
  ]

  return (
    <section className="min-w-0 bg-transparent pb-8">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Relatórios</h2>
          <p className="mt-1 max-w-full break-words text-sm leading-relaxed text-slate-500">Dados consolidados da {empresaAtiva?.nome || 'empresa'} para decisões mais seguras.</p>
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <button
            type="button"
            onClick={imprimirRelatorio}
            disabled={carregandoRelatorio || gerandoPdf}
            className="inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 disabled:opacity-60 sm:flex-none"
          >
            <Icone nome="impressora" tamanho={17} /> Imprimir
          </button>
          <button
            type="button"
            onClick={salvarRelatorioPdf}
            disabled={carregandoRelatorio || gerandoPdf}
            className="inline-flex min-w-0 flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60 sm:flex-none"
          >
            <Icone nome="baixar" tamanho={17} /> {gerandoPdf ? 'Gerando...' : 'Exportar PDF'}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h3 className="flex items-center gap-2 text-sm font-bold text-slate-900"><Icone nome="filtro" tamanho={18} /> Filtros do relatório</h3>
          <span className="text-xs text-slate-400">Combine os critérios para refinar os dados</span>
        </div>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto] xl:items-end">
          <div className="min-w-0">
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">Período</label>
            <div className="flex min-w-0 items-center gap-1 rounded-xl border border-slate-200 bg-white px-2 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
              <input type="date" aria-label="Data inicial" value={dataInicial} onChange={(event) => setDataInicial(event.target.value)} className="min-w-0 w-1/2 bg-transparent py-3 text-xs text-slate-700 outline-none" />
              <span className="shrink-0 text-xs text-slate-400">–</span>
              <input type="date" aria-label="Data final" min={dataInicial} value={dataFinal} onChange={(event) => setDataFinal(event.target.value)} className="min-w-0 w-1/2 bg-transparent py-3 text-xs text-slate-700 outline-none" />
            </div>
          </div>
          <div className="min-w-0">
            <label className="mb-1.5 block text-xs font-semibold text-slate-600" htmlFor="busca-relatorio-produto">Produto</label>
            <input id="busca-relatorio-produto" value={buscaProduto} onChange={(event) => setBuscaProduto(event.target.value)} placeholder="Todos os produtos" className="w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100" />
          </div>
          <div className="min-w-0">
            <label className="mb-1.5 block text-xs font-semibold text-slate-600" htmlFor="tipo-relatorio">Tipo</label>
            <select id="tipo-relatorio" value={tipoSelecionado} onChange={(event) => setTipoSelecionado(event.target.value)} className="w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
              <option value="todos">Entradas e saídas</option>
              <option value="entrada">Somente entradas</option>
              <option value="saida">Somente saídas</option>
            </select>
          </div>
          <div className="min-w-0">
            <label className="mb-1.5 block text-xs font-semibold text-slate-600" htmlFor="canal-relatorio">Canal de venda</label>
            <select id="canal-relatorio" value={canalSelecionado} onChange={(event) => setCanalSelecionado(event.target.value)} className="w-full min-w-0 rounded-xl border border-slate-200 bg-white px-3 py-3 text-sm text-slate-700 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100">
              <option value="">Todos os canais</option>
              {canaisVenda.map((canal) => <option key={canal.valor} value={canal.valor}>{canal.nome}</option>)}
              <option value="__sem_canal__">Não informado</option>
            </select>
          </div>
          <button type="button" onClick={carregarRelatorio} disabled={carregandoRelatorio} className="w-full whitespace-nowrap rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-blue-700 disabled:opacity-60 xl:w-auto">
            <span className="inline-flex items-center justify-center gap-2"><Icone nome="aplicar" tamanho={17} /> Aplicar filtros</span>
          </button>
        </div>
        <p className="mt-3 text-xs text-slate-400">Os filtros atualizam o relatório automaticamente. Canal de venda se aplica às saídas; entradas permanecem apenas no consolidado.</p>
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {resumoCards.map((card) => (
          <div key={card.titulo} className="min-w-0 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm sm:p-5">
            <div className={`mb-3 flex h-10 w-10 items-center justify-center rounded-xl text-lg font-bold ${card.cor}`}>{<Icone nome={card.icone} tamanho={21} />}</div>
            <p className="text-xs font-medium text-slate-500">{card.titulo}</p>
            <strong className="mt-1 block break-words text-xl font-extrabold tracking-tight text-slate-900 sm:text-2xl">{carregandoRelatorio ? '...' : card.valor}</strong>
            <p className="mt-1 text-[11px] text-slate-400">{card.detalhe}</p>
          </div>
        ))}
      </div>

        <div className={`mt-6 grid grid-cols-1 gap-5 ${empresaEhDega ? '' : 'lg:grid-cols-[minmax(0,1.65fr)_minmax(320px,1fr)]'}`}>
        {!empresaEhDega && (
          <div className="min-w-0 h-full rounded-2xl border border-slate-100 bg-white p-4 shadow-sm print:break-inside-avoid sm:p-5">
            <h3 className="text-xl font-bold text-slate-900">Produtos mais vendidos</h3>
            <p className="mt-1 text-xs text-slate-500">
              Quantidade por identificador único. Role para ver todos.
            </p>

            {carregandoRelatorio ? (
              <div className="mt-6 flex h-40 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
                Carregando gráfico...
              </div>
            ) : dadosGraficoMaisVendidos.length > 0 ? (
              <div className="mt-5 max-h-[340px] overflow-y-auto overflow-x-hidden rounded-xl bg-white pr-1">
                {/* No celular as barras usam layout nativo: sem rolagem lateral ou nomes cortados. */}
                <div className="space-y-4 p-4 sm:hidden">
                  {dadosGraficoMaisVendidos.map((item) => {
                    const maior = Math.max(dadosGraficoMaisVendidos[0]?.saidas || 0, 1)
                    return (
                      <div key={item.produtoId} className="min-w-0">
                        <div className="mb-1.5 flex items-start justify-between gap-3 text-sm">
                          <span className="min-w-0 break-words font-semibold leading-snug text-slate-700">{item.nomeCompleto}</span>
                          <strong className="shrink-0 tabular-nums text-slate-900">{formatarQuantidade(item.saidas)}</strong>
                        </div>
                        <div className="h-3.5 overflow-hidden rounded-full bg-slate-100">
                          <div className="h-full rounded-full bg-blue-600" style={{ width: `${(item.saidas / maior) * 100}%` }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="hidden w-full sm:block" style={{ height: alturaGraficoVendas }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={dadosGraficoMaisVendidos}
                      layout="vertical"
                      margin={{ top: 6, right: 73, left: 4, bottom: 8 }}
                      barCategoryGap="24%"
                    >
                      <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" horizontal={false} />
                      <XAxis
                        type="number"
                        allowDecimals={false}
                        tick={{ fill: '#475569', fontSize: 13 }}
                        axisLine={{ stroke: '#cbd5e1' }}
                        tickLine={false}
                        tickFormatter={(value) => Number(value).toLocaleString('pt-BR')}
                      />
                      <YAxis
                        type="category"
                        dataKey="produtoId"
                        width={190}
                        interval={0}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: '#334155', fontSize: 12, fontWeight: 500 }}
                        tickFormatter={(id) => nomesProdutosGrafico.get(id) || id}
                      />
                      <Tooltip
                        cursor={{ fill: '#eff6ff' }}
                        formatter={(value) => [Number(value).toLocaleString('pt-BR'), 'Saídas']}
                        labelFormatter={(id) => nomesProdutosGrafico.get(id) || ''}
                        contentStyle={{
                          borderRadius: '12px',
                          border: '1px solid #e2e8f0',
                          boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
                        }}
                      />
                      <Bar
                        dataKey="saidas"
                        name="Saídas"
                        fill="#2563eb"
                        radius={[0, 7, 7, 0]}
                        maxBarSize={22}
                        background={{ fill: '#f1f5f9', radius: 7 }}
                        label={{
                          position: 'right',
                          fill: '#334155',
                          fontSize: 12,
                          fontWeight: 600,
                          formatter: (value) => Number(value).toLocaleString('pt-BR'),
                        }}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            ) : (
              <p className="mt-6 rounded-xl border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">
                Nenhuma saída registrada no período selecionado.
              </p>
            )}
          </div>
        )}

        <div className="min-w-0 h-full rounded-2xl border border-slate-100 bg-white p-4 shadow-sm print:break-inside-avoid sm:p-5">
          <h3 className="text-xl font-bold text-slate-900">Distribuição por canal</h3>
          <p className="mt-1 text-sm text-slate-500">Participação nas saídas por canal de venda.</p>
          {carregandoRelatorio ? (
            <p className="mt-6 rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">Carregando canais...</p>
          ) : totalUnidadesCanais > 0 ? (
            <div className="mt-6 flex min-h-[230px] items-center justify-center"><GraficoRoscaCanais /></div>
          ) : (
            <p className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
              Nenhuma saída encontrada para os filtros selecionados.
            </p>
          )}

        </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm">
          <div className="flex flex-col gap-1 border-b border-slate-100 px-4 py-5 sm:flex-row sm:items-end sm:justify-between sm:px-6">
            <div>
              <h3 className="text-xl font-bold text-slate-900">Detalhamento por canal</h3>
              <p className="mt-1 text-sm text-slate-500">Consolidado por canal no período e nos filtros selecionados.</p>
            </div>
            <span className="text-sm font-medium text-slate-500">{formatarQuantidade(totalMovimentacoesCanais)} movimentações</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[650px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-6 py-4">Canal</th>
                  <th className="px-5 py-4 text-right">Movimentações</th>
                  <th className="px-5 py-4 text-right">Unidades</th>
                  {!empresaEhDega && <th className="px-5 py-4 text-right">Valor estimado</th>}
                  <th className="px-6 py-4 text-right">Participação</th>
                </tr>
              </thead>
              <tbody>
                {!carregandoRelatorio && distribuicaoCanais.map((canal) => (
                  <tr key={canal.canal} className="border-t border-slate-100 hover:bg-slate-50/70">
                    <td className="px-6 py-4 font-semibold text-slate-800">
                      <span className="mr-3 inline-block h-3 w-3 rounded-sm align-middle" style={{ backgroundColor: canal.cor }} />
                      {canal.canal}
                    </td>
                    <td className="px-5 py-4 text-right tabular-nums text-slate-600">{formatarQuantidade(canal.movimentacoes)}</td>
                    <td className="px-5 py-4 text-right tabular-nums font-semibold text-slate-900">{formatarQuantidade(canal.total)}</td>
                    {!empresaEhDega && <td className="px-5 py-4 text-right tabular-nums font-semibold text-slate-900">{formatarMoeda(canal.valorTotal)}</td>}
                    <td className="px-6 py-4 text-right tabular-nums font-bold text-blue-700">{canal.percentual.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</td>
                  </tr>
                ))}
                {!carregandoRelatorio && distribuicaoCanais.length === 0 && (
                  <tr><td colSpan={empresaEhDega ? 4 : 5} className="px-6 py-8 text-center text-slate-500">Nenhuma movimentação encontrada.</td></tr>
                )}
                {carregandoRelatorio && (
                  <tr><td colSpan={empresaEhDega ? 4 : 5} className="px-6 py-8 text-center text-slate-500">Carregando detalhamento...</td></tr>
                )}
              </tbody>
              {!carregandoRelatorio && distribuicaoCanais.length > 0 && (
                <tfoot className="border-t-2 border-slate-200 bg-slate-50 font-bold text-slate-900">
                  <tr>
                    <td className="px-6 py-4">Total</td>
                    <td className="px-5 py-4 text-right">{formatarQuantidade(totalMovimentacoesCanais)}</td>
                    <td className="px-5 py-4 text-right">{formatarQuantidade(totalUnidadesCanais)}</td>
                    {!empresaEhDega && <td className="px-5 py-4 text-right">{formatarMoeda(distribuicaoCanais.reduce((total, canal) => total + canal.valorTotal, 0))}</td>}
                    <td className="px-6 py-4 text-right">{totalUnidadesCanais > 0 ? '100%' : '0%'}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          {!empresaEhDega && <p className="border-t border-slate-100 px-6 py-3 text-xs text-slate-500">Valor estimado com base nos preços unitários atuais dos produtos. Não representa necessariamente o faturamento histórico.</p>}
        </div>

    </section>
  )
}

export default Relatorios