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
  const dataAtual = new Date()

  const [diaSelecionado, setDiaSelecionado] = useState('')
  const [mesSelecionado, setMesSelecionado] = useState('')
  const [anoSelecionado, setAnoSelecionado] = useState(
    String(dataAtual.getFullYear())
  )
  const [buscaProduto, setBuscaProduto] = useState('')
  const [relatorioPorProduto, setRelatorioPorProduto] = useState([])
  const [carregandoRelatorio, setCarregandoRelatorio] = useState(false)
  const [gerandoPdf, setGerandoPdf] = useState(false)

  const nomesMeses = [
    { valor: '01', nome: 'Janeiro' },
    { valor: '02', nome: 'Fevereiro' },
    { valor: '03', nome: 'Março' },
    { valor: '04', nome: 'Abril' },
    { valor: '05', nome: 'Maio' },
    { valor: '06', nome: 'Junho' },
    { valor: '07', nome: 'Julho' },
    { valor: '08', nome: 'Agosto' },
    { valor: '09', nome: 'Setembro' },
    { valor: '10', nome: 'Outubro' },
    { valor: '11', nome: 'Novembro' },
    { valor: '12', nome: 'Dezembro' },
  ]

  useEffect(() => {
    if (empresaAtiva?.id) {
      carregarRelatorio()
    }
  }, [empresaAtiva, diaSelecionado, mesSelecionado, anoSelecionado, buscaProduto])

  async function carregarRelatorio() {
    setCarregandoRelatorio(true)

    const { data, error } = await supabase.rpc('relatorio_produtos_periodo', {
      p_empresa_id: empresaAtiva.id,
      p_ano: Number(anoSelecionado),
      p_mes: mesSelecionado ? Number(mesSelecionado) : null,
      p_dia: diaSelecionado ? Number(diaSelecionado) : null,
      p_busca: buscaProduto.trim(),
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
    }))

    setRelatorioPorProduto(relatorioFormatado)
    setCarregandoRelatorio(false)
  }

  function calcularQuantidadeDiasDoMes(mes, ano) {
    if (!mes) return 31

    return new Date(Number(ano), Number(mes), 0).getDate()
  }

  const quantidadeDias = calcularQuantidadeDiasDoMes(
    mesSelecionado,
    anoSelecionado
  )

  const diasDisponiveis = Array.from({ length: quantidadeDias }, (_, index) =>
    String(index + 1).padStart(2, '0')
  )

  const totalEntradas = relatorioPorProduto.reduce(
    (total, item) => total + item.entradas,
    0
  )

  const totalSaidas = relatorioPorProduto.reduce(
    (total, item) => total + item.saidas,
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
      nomeCompleto: item.produto,
      nome:
        item.produto.length > 18
          ? `${item.produto.slice(0, 18)}...`
          : item.produto,
      saidas: item.saidas,
    }))

  const larguraGraficoVendas = Math.max(
    900,
    dadosGraficoMaisVendidos.length * 170
  )

  function gerarTextoPeriodo() {
    const nomeMes = nomesMeses.find(
      (mes) => mes.valor === mesSelecionado
    )?.nome

    if (diaSelecionado && mesSelecionado) {
      return `Dia ${diaSelecionado}/${mesSelecionado}/${anoSelecionado}`
    }

    if (diaSelecionado && !mesSelecionado) {
      return `Dia ${diaSelecionado} de todos os meses de ${anoSelecionado}`
    }

    if (!diaSelecionado && mesSelecionado) {
      return `${nomeMes} de ${anoSelecionado}`
    }

    return `Ano inteiro de ${anoSelecionado}`
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

  function TickProdutoGrafico({ x, y, payload }) {
    const texto = payload.value || ''
    const partes = texto.split(' ')

    const primeiraLinha = partes.slice(0, 2).join(' ')
    const segundaLinha = partes.slice(2).join(' ')

    return (
      <g transform={`translate(${x},${y})`}>
        <text
          x={0}
          y={0}
          dy={16}
          textAnchor="middle"
          fill="#475569"
          fontSize={11}
        >
          <tspan x={0}>{primeiraLinha}</tspan>

          {segundaLinha && (
            <tspan x={0} dy={14}>
              {segundaLinha}
            </tspan>
          )}
        </text>
      </g>
    )
  }

  function gerarPdfRelatorio() {
    const pdf = new jsPDF('p', 'mm', 'a4')

    const margem = 15
    let y = 18

    const larguraPagina = pdf.internal.pageSize.getWidth()
    const larguraUtil = larguraPagina - margem * 2

    const titulo = 'Relatório'
    const periodo = `Período analisado: ${gerarTextoPeriodo()}`

    pdf.setTextColor(15, 23, 42)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(18)
    pdf.text(titulo, margem, y)

    y += 8

    pdf.setTextColor(71, 85, 105)
    pdf.setFont('helvetica', 'normal')
    pdf.setFontSize(10)
    pdf.text(periodo, margem, y)

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
    ]

    const larguraCard = larguraUtil / 3 - 4

    cards.forEach((card, index) => {
      const x = margem + index * (larguraCard + 6)

      pdf.setDrawColor(226, 232, 240)
      pdf.setFillColor(255, 255, 255)
      pdf.roundedRect(x, y, larguraCard, 28, 3, 3, 'FD')

      pdf.setTextColor(71, 85, 105)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(9)
      pdf.text(card.titulo, x + 4, y + 8)

      pdf.setTextColor(15, 23, 42)
      pdf.setFont('helvetica', 'bold')
      pdf.setFontSize(index === 2 ? 10 : 16)

      const valorQuebrado = pdf.splitTextToSize(card.valor, larguraCard - 8)
      pdf.text(valorQuebrado, x + 4, y + 18)
    })

    y += 45

    pdf.setTextColor(15, 23, 42)
    pdf.setFont('helvetica', 'bold')
    pdf.setFontSize(14)
    pdf.text('Gráfico de Vendas', margem, y)

    y += 10

    if (dadosGraficoMaisVendidos.length === 0) {
      pdf.setTextColor(71, 85, 105)
      pdf.setFont('helvetica', 'normal')
      pdf.setFontSize(10)
      pdf.text('Nenhuma saída registrada no período selecionado.', margem, y)
    } else {
      const dadosPdf = dadosGraficoMaisVendidos.slice(0, 12)
      const alturaGrafico = 80
      const larguraGrafico = larguraUtil
      const xGrafico = margem
      const yGrafico = y

      const maiorValor = Math.max(...dadosPdf.map((item) => item.saidas))

      const quantidadeBarras = dadosPdf.length
      const espacamento = 4
      const larguraBarra =
        (larguraGrafico - espacamento * (quantidadeBarras - 1)) /
        quantidadeBarras

      pdf.setDrawColor(226, 232, 240)

      for (let i = 0; i <= 4; i++) {
        const yLinha = yGrafico + (alturaGrafico / 4) * i
        pdf.line(xGrafico, yLinha, xGrafico + larguraGrafico, yLinha)
      }

      pdf.setDrawColor(148, 163, 184)
      pdf.line(
        xGrafico,
        yGrafico + alturaGrafico,
        xGrafico + larguraGrafico,
        yGrafico + alturaGrafico
      )

      dadosPdf.forEach((item, index) => {
        const alturaBarra = (item.saidas / maiorValor) * (alturaGrafico - 14)
        const x = xGrafico + index * (larguraBarra + espacamento)
        const yBarra = yGrafico + alturaGrafico - alturaBarra

        pdf.setFillColor(37, 99, 235)
        pdf.roundedRect(x, yBarra, larguraBarra, alturaBarra, 1.5, 1.5, 'F')

        pdf.setTextColor(15, 23, 42)
        pdf.setFont('helvetica', 'bold')
        pdf.setFontSize(8)
        pdf.text(String(item.saidas), x, yBarra - 2)

        pdf.setTextColor(71, 85, 105)
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(7)

        const nomeQuebrado = pdf.splitTextToSize(
          item.nomeCompleto,
          larguraBarra + 6
        )

        const linhasNome = nomeQuebrado.slice(0, 3)

        if (nomeQuebrado.length > 3) {
          linhasNome[2] = `${linhasNome[2].slice(0, 10)}...`
        }

        linhasNome.forEach((linha, linhaIndex) => {
          pdf.text(
            linha,
            x + larguraBarra / 2,
            yGrafico + alturaGrafico + 6 + linhaIndex * 4,
            {
              align: 'center',
            }
          )
        })
      })

      if (dadosGraficoMaisVendidos.length > 12) {
        y += alturaGrafico + 28

        pdf.setTextColor(71, 85, 105)
        pdf.setFont('helvetica', 'normal')
        pdf.setFontSize(9)
      }
    }

    return pdf
  }

  function salvarRelatorioPdf() {
    try {
      setGerandoPdf(true)

      const pdf = gerarPdfRelatorio()

      const nomeArquivo = `relatorio-estoque-${anoSelecionado}${
        mesSelecionado ? `-${mesSelecionado}` : ''
      }${diaSelecionado ? `-${diaSelecionado}` : ''}.pdf`

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
              Período analisado: {gerarTextoPeriodo()}
            </p>
          </div>

          {!gerandoPdf && (
            <div className="flex flex-col sm:flex-row gap-3 print:hidden">
              <button
                onClick={salvarRelatorioPdf}
                disabled={gerandoPdf}
                className="rounded-xl bg-slate-900 px-5 py-3 font-semibold text-white hover:bg-slate-700 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {gerandoPdf ? 'Gerando PDF...' : 'Salvar PDF'}
              </button>

              <button
                onClick={imprimirRelatorio}
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
              : 'mt-6 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5 print:grid-cols-3 print:gap-4'
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
          <div className="mt-6 bg-white rounded-2xl shadow-sm p-5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 print:hidden">
            <select
              value={diaSelecionado}
              onChange={(event) => setDiaSelecionado(event.target.value)}
              className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">Selecionar dia</option>

              {diasDisponiveis.map((dia) => (
                <option key={dia} value={dia}>
                  Dia {dia}
                </option>
              ))}
            </select>

            <select
              value={mesSelecionado}
              onChange={(event) => {
                const novoMes = event.target.value
                const novaQuantidadeDias = calcularQuantidadeDiasDoMes(
                  novoMes,
                  anoSelecionado
                )

                setMesSelecionado(novoMes)

                if (
                  diaSelecionado &&
                  Number(diaSelecionado) > novaQuantidadeDias
                ) {
                  setDiaSelecionado('')
                }
              }}
              className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="">Selecionar mês</option>

              {nomesMeses.map((mes) => (
                <option key={mes.valor} value={mes.valor}>
                  {mes.nome}
                </option>
              ))}
            </select>

            <select
              value={anoSelecionado}
              onChange={(event) => setAnoSelecionado(event.target.value)}
              className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            >
              <option value="2026">2026</option>
              <option value="2025">2025</option>
              <option value="2024">2024</option>
            </select>

            <input
              type="text"
              value={buscaProduto}
              onChange={(event) => setBuscaProduto(event.target.value)}
              placeholder="Filtrar por produto"
              className="rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>
        )}

        <div
          className={
            gerandoPdf
              ? 'mt-6 bg-white p-6'
              : 'mt-6 bg-white rounded-2xl shadow-sm p-6 print:break-inside-avoid'
          }
        >
          <div>
            <h3 className="text-xl font-bold text-slate-900">
              Gráfico de Vendas
            </h3>

            {!gerandoPdf && dadosGraficoMaisVendidos.length > 5 && (
              <p className="mt-1 text-xs text-slate-400">
                Arraste para o lado para visualizar todos os produtos.
              </p>
            )}
          </div>

          <div
            className={
              gerandoPdf
                ? 'mt-6 h-72'
                : 'mt-6 h-96 overflow-x-auto overflow-y-hidden print:h-72 print:overflow-visible'
            }
          >
            {carregandoRelatorio ? (
              <div className="h-full flex items-center justify-center rounded-xl bg-slate-50 border border-dashed border-slate-300 px-4 text-center">
                <p className="text-sm text-slate-500">Carregando gráfico...</p>
              </div>
            ) : dadosGraficoMaisVendidos.length > 0 ? (
              <div
                style={{
                  width: gerandoPdf ? '100%' : `${larguraGraficoVendas}px`,
                }}
                className="h-full"
              >
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={dadosGraficoMaisVendidos}
                    margin={{ top: 20, right: 24, left: 0, bottom: 80 }}
                    barCategoryGap="24%"
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />

                    <XAxis
                      dataKey="nome"
                      interval={0}
                      tick={<TickProdutoGrafico />}
                      axisLine={{ stroke: '#cbd5e1' }}
                      tickLine={false}
                      height={80}
                    />

                    <YAxis
                      tick={{ fill: '#475569', fontSize: 12 }}
                      axisLine={{ stroke: '#cbd5e1' }}
                      tickLine={false}
                    />

                    <Tooltip
                      cursor={{ fill: '#eff6ff' }}
                      formatter={(value) => [value, 'Saídas']}
                      labelFormatter={(_, payload) =>
                        payload?.[0]?.payload?.nomeCompleto || ''
                      }
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
                      radius={[8, 8, 0, 0]}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-full flex items-center justify-center rounded-xl bg-slate-50 border border-dashed border-slate-300 px-4 text-center">
                <p className="text-sm text-slate-500">
                  Nenhuma saída registrada no período selecionado.
                </p>
              </div>
            )}
          </div>
        </div>

        {!gerandoPdf && (
          <div className="mt-6 bg-white rounded-2xl shadow-sm overflow-hidden print:hidden">
            <div className="px-6 py-5 border-b border-slate-100">
              <h3 className="text-xl font-bold text-slate-900">
                Detalhamento por produto
              </h3>

              <p className="mt-1 text-sm text-slate-500">
                Entradas, saídas e estoque atual no período selecionado.
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
                            colSpan="6"
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

                      <div className="mt-4 grid grid-cols-3 gap-3">
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