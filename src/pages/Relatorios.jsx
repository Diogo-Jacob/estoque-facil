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
  const [relatorioPorProduto, setRelatorioPorProduto] = useState([])
  const [vendasDetalhadas, setVendasDetalhadas] = useState([])
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
    const raio = 72
    const circunferencia = 2 * Math.PI * raio
    let posicaoAtual = 0

    return (
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:justify-center lg:flex-col xl:flex-row">
        <div className="relative h-52 w-52 shrink-0" role="img" aria-label={`Distribuição de ${formatarQuantidade(totalUnidadesCanais)} unidades por canal de venda`}>
          <svg viewBox="0 0 200 200" className="h-full w-full" aria-hidden="true">
            <circle cx="100" cy="100" r={raio} fill="none" stroke="#e2e8f0" strokeWidth="24" />
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
                  strokeWidth="24"
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
        <div className="w-full min-w-0 max-w-xs space-y-3">
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

  return (
    <section>
      <div>
        <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4 print:mb-6">
          <div>
            <h2 className="text-3xl font-bold text-slate-900">Relatório</h2>

            <p className="mt-1 text-sm text-slate-500">
              Período analisado: {gerarTextoPeriodo()} · Canal: {nomeCanalSelecionado}
            </p>
          </div>

          {!gerandoPdf && (
            <div className="flex flex-col sm:flex-row gap-3 print:hidden">
              <button
                onClick={salvarRelatorioPdf}
                disabled={gerandoPdf || carregandoRelatorio}
                className="rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-700 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {gerandoPdf ? 'Gerando PDF...' : 'Salvar PDF'}
              </button>

              <button
                onClick={imprimirRelatorio}
                disabled={carregandoRelatorio}
                className="rounded-xl bg-blue-600 px-5 py-3 font-semibold text-white hover:bg-blue-700"
              >
                Imprimir relatório
              </button>
            </div>
          )}
        </div>

        <div
          className={
            gerandoPdf
              ? 'mt-6 grid grid-cols-3 gap-4'
              : 'mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-5 print:grid-cols-3 print:gap-4'
          }
        >
          <div className="bg-white rounded-2xl shadow-sm p-5">
            <p className="text-sm text-slate-500">Entradas no período</p>
            <strong className="mt-2 block text-3xl text-slate-900">
              {carregandoRelatorio ? '...' : totalEntradas}
            </strong>
          </div>

          <div className="bg-white rounded-2xl shadow-sm p-5">
            <p className="text-sm text-slate-500">Saídas no período</p>
            <strong className="mt-2 block text-3xl text-slate-900">
              {carregandoRelatorio ? '...' : totalSaidas}
            </strong>
          </div>

          {!gerandoPdf && (
            <div className="bg-white rounded-2xl shadow-sm p-5 print:hidden">
              <p className="text-sm text-slate-500">Estoque baixo</p>
              <strong className="mt-2 block text-3xl text-red-600">
                {carregandoRelatorio ? '...' : produtosComEstoqueBaixo.length}
              </strong>
            </div>
          )}

          {!empresaEhDega && <div className="bg-white rounded-2xl shadow-sm p-5">
            <p className="text-sm text-slate-500">Valor total vendido</p>
            <strong className="mt-2 block whitespace-nowrap text-xl font-bold tracking-tight text-slate-900 xl:text-2xl">
              {carregandoRelatorio ? '...' : formatarMoeda(totalValorVendido)}
            </strong>
          </div>}

          <div className="bg-white rounded-2xl shadow-sm p-5">
            <p className="text-sm text-slate-500">Produto mais vendido</p>
            <strong className="mt-2 block text-lg text-slate-900">
              {carregandoRelatorio
                ? 'Carregando...'
                : produtoMaisVendido && produtoMaisVendido.saidas > 0
                  ? produtoMaisVendido.produto
                  : 'Sem vendas'}
            </strong>
          </div>
        </div>

        {!gerandoPdf && (
          <div className="mt-6 bg-white rounded-2xl shadow-sm p-5 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 print:hidden">
            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-600">
                Data inicial
              </label>

              <input
                type="date"
                value={dataInicial}
                onChange={(event) => setDataInicial(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-600">
                Data final
              </label>

              <input
                type="date"
                value={dataFinal}
                min={dataInicial}
                onChange={(event) => setDataFinal(event.target.value)}
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-600">
                Produto
              </label>

              <input
                type="text"
                value={buscaProduto}
                onChange={(event) => setBuscaProduto(event.target.value)}
                placeholder="Filtrar por produto"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>

            <div>
              <label className="mb-1 block text-sm font-semibold text-slate-600">
                Canal de venda
              </label>
              <select
                value={canalSelecionado}
                onChange={(event) => setCanalSelecionado(event.target.value)}
                className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              >
                <option value="">Todos os canais</option>
                {canaisVenda.map((canal) => (
                  <option key={canal.valor} value={canal.valor}>{canal.nome}</option>
                ))}
                <option value="__sem_canal__">Não informado</option>
              </select>
            </div>
          </div>
        )}

        <div className={`mt-6 grid grid-cols-1 gap-5 ${empresaEhDega ? '' : '2xl:grid-cols-[minmax(0,1.65fr)_minmax(350px,1fr)]'}`}>
        {!empresaEhDega && (
          <div className="min-w-0 rounded-2xl bg-white p-6 shadow-sm print:break-inside-avoid">
            <h3 className="text-xl font-bold text-slate-900">Produtos mais vendidos</h3>
            <p className="mt-1 text-xs text-slate-500">
              Produtos ordenados por quantidade de saídas · Role para baixo para ver todos.
            </p>

            {carregandoRelatorio ? (
              <div className="mt-6 flex h-40 items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 text-sm text-slate-500">
                Carregando gráfico...
              </div>
            ) : dadosGraficoMaisVendidos.length > 0 ? (
              <div className="mt-6 max-h-[600px] overflow-auto rounded-xl border border-slate-100 bg-white">
                <div className="min-w-[710px]" style={{ height: alturaGraficoVendas }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={dadosGraficoMaisVendidos}
                      layout="vertical"
                      margin={{ top: 20, right: 102, left: 10, bottom: 24 }}
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
                        width={250}
                        interval={0}
                        tickLine={false}
                        axisLine={false}
                        tick={{ fill: '#334155', fontSize: 14, fontWeight: 500 }}
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
                        maxBarSize={29}
                        background={{ fill: '#f1f5f9', radius: 7 }}
                        label={{
                          position: 'right',
                          fill: '#334155',
                          fontSize: 13,
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

        <div className="min-w-0 rounded-2xl bg-white p-6 shadow-sm print:break-inside-avoid">
          <h3 className="text-xl font-bold text-slate-900">Distribuição por canal</h3>
          <p className="mt-1 text-sm text-slate-500">Participação de cada canal na quantidade de unidades de saída.</p>
          {carregandoRelatorio ? (
            <p className="mt-6 rounded-xl bg-slate-50 p-6 text-center text-sm text-slate-500">Carregando canais...</p>
          ) : totalUnidadesCanais > 0 ? (
            <div className="mt-5"><GraficoRoscaCanais /></div>
          ) : (
            <p className="mt-6 rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
              Nenhuma saída encontrada para os filtros selecionados.
            </p>
          )}
          <p className="mt-5 text-xs text-slate-400">Considera as saídas originais não estornadas dos produtos incluídos no relatório.</p>
        </div>
        </div>

        <div className="mt-5 overflow-hidden rounded-2xl bg-white shadow-sm">
          <div className="flex flex-col gap-1 border-b border-slate-100 px-6 py-5 sm:flex-row sm:items-end sm:justify-between">
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
                    <td className="px-6 py-4 text-right">100%</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
          {!empresaEhDega && <p className="border-t border-slate-100 px-6 py-3 text-xs text-slate-500">Valor estimado com base nos preços unitários atuais dos produtos. Não representa necessariamente o faturamento histórico.</p>}
        </div>

        {!gerandoPdf && (
          <div className="mt-6 bg-white rounded-2xl shadow-sm overflow-hidden print:hidden">
            <div className="px-6 py-5 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-900">
                Detalhamento por produto
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Entradas, saídas, estoque atual e valor vendido no período selecionado.
              </p>
            </div>

            {carregandoRelatorio ? (
              <p className="px-5 py-8 text-center text-slate-500">
                Carregando relatório...
              </p>
            ) : (
              <>
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 text-slate-500">
                      <tr className="text-left">
                        <th className="px-5 py-4">Produto</th>
                        <th className="px-5 py-4">Categoria</th>
                        <th className="px-5 py-4">Entradas</th>
                        <th className="px-5 py-4">Saídas</th>
                        {!empresaEhDega && <th className="px-5 py-4">Valor total</th>}
                        <th className="px-5 py-4">Estoque atual</th>
                        <th className="px-5 py-4">Status</th>
                      </tr>
                    </thead>

                    <tbody>
                      {relatorioPorProduto.map((item) => (
                        <tr
                          key={item.produtoId}
                          className="border-t border-slate-100"
                        >
                          <td className="px-5 py-4 font-medium text-slate-900">
                            {item.produto}
                          </td>

                          <td className="px-5 py-4 text-slate-600">
                            {item.categoria}
                          </td>

                          <td className="px-5 py-4 text-slate-600">
                            {item.entradas}
                          </td>

                          <td className="px-5 py-4 text-slate-600">
                            {item.saidas}
                          </td>

                          {!empresaEhDega && <td className="px-5 py-4 font-semibold text-slate-900">
                            {formatarMoeda(item.valorTotalVendido)}
                          </td>}

                          <td className="px-5 py-4 text-slate-600">
                            {item.estoqueAtual}
                          </td>

                          <td className="px-5 py-4">
                            <StatusEstoque item={item} />
                          </td>
                        </tr>
                      ))}

                      {relatorioPorProduto.length === 0 && (
                        <tr>
                          <td
                            colSpan={empresaEhDega ? 6 : 7}
                            className="px-5 py-8 text-center text-slate-500"
                          >
                            Nenhum produto encontrado no relatório.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="md:hidden p-4 space-y-3">
                  {relatorioPorProduto.map((item) => (
                    <div
                      key={item.produtoId}
                      className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-slate-900">
                            {item.produto}
                          </p>

                          <p className="mt-1 text-sm text-slate-500">
                            {item.categoria}
                          </p>
                        </div>

                        <StatusEstoque item={item} />
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                        <div className="rounded-xl bg-slate-50 p-3">
                          <p className="text-xs text-slate-500">Entradas</p>
                          <p className="text-lg font-bold text-slate-900">
                            {item.entradas}
                          </p>
                        </div>

                        <div className="rounded-xl bg-slate-50 p-3">
                          <p className="text-xs text-slate-500">Saídas</p>
                          <p className="text-lg font-bold text-slate-900">
                            {item.saidas}
                          </p>
                        </div>

                        {!empresaEhDega && <div className="rounded-xl bg-slate-50 p-3">
                          <p className="text-xs text-slate-500">Valor</p>
                          <p className="text-sm font-bold text-slate-900">
                            {formatarMoeda(item.valorTotalVendido)}
                          </p>
                        </div>}

                        <div className="rounded-xl bg-slate-50 p-3">
                          <p className="text-xs text-slate-500">Estoque</p>
                          <p className="text-lg font-bold text-slate-900">
                            {item.estoqueAtual}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}

                  {relatorioPorProduto.length === 0 && (
                    <p className="text-center text-sm text-slate-500">
                      Nenhum produto encontrado no relatório.
                    </p>
                  )}
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </section>
  )
}

export default Relatorios