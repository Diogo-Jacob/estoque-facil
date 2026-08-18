import { useState } from 'react'
import { supabase } from '../services/supabase'

function Login({ onLogin }) {
  const [modo, setModo] = useState('login')

  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [codigoConvite, setCodigoConvite] = useState('')

  const [carregando, setCarregando] = useState(false)
  const [erro, setErro] = useState('')
  const [sucesso, setSucesso] = useState('')
  const [mostrarSenha, setMostrarSenha] = useState(false)

  async function buscarEmpresasDoUsuario(usuarioId) {
    const { data, error } = await supabase
      .from('usuario_empresas')
      .select(`
        empresa_id,
        perfil,
        empresas (
          id,
          nome
        )
      `)
      .eq('usuario_id', usuarioId)
      .eq('ativo', true)

    if (error) {
      console.error('Erro ao buscar empresas do usuário:', error)
      return []
    }

    return data.map((item) => ({
      id: item.empresas.id,
      nome: item.empresas.nome,
      perfil: item.perfil,
    }))
  }

  async function entrar() {
    setErro('')
    setSucesso('')

    if (!email.trim()) {
      setErro('Informe seu e-mail.')
      return
    }

    if (!senha.trim()) {
      setErro('Informe sua senha.')
      return
    }

    setCarregando(true)

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    })

    if (error) {
      console.error('Erro ao fazer login:', error)
      setErro('Não foi possível entrar. Confira o e-mail, a senha e se está acessando o link correto do sistema.')
      setCarregando(false)
      return
    }

    const usuarioAuth = data.user

    const { data: usuarioSistema, error: erroUsuario } = await supabase
      .from('usuarios')
      .select('id, empresa_id, nome, email, perfil, ativo')
      .eq('id', usuarioAuth.id)
      .single()

    if (erroUsuario || !usuarioSistema) {
      setErro('Usuário não encontrado no sistema.')
      await supabase.auth.signOut()
      setCarregando(false)
      return
    }

    if (!usuarioSistema.ativo) {
      setErro('Este usuário está inativo.')
      await supabase.auth.signOut()
      setCarregando(false)
      return
    }

    const empresas = await buscarEmpresasDoUsuario(usuarioSistema.id)

    if (empresas.length === 0) {
      setErro('Nenhuma empresa vinculada a este usuário.')
      await supabase.auth.signOut()
      setCarregando(false)
      return
    }

    onLogin(usuarioSistema, empresas)
    setCarregando(false)
  }

  async function cadastrar() {
    setErro('')
    setSucesso('')

    if (!nome.trim()) {
      setErro('Informe seu nome.')
      return
    }

    if (!email.trim()) {
      setErro('Informe seu e-mail.')
      return
    }

    if (!senha.trim()) {
      setErro('Informe uma senha.')
      return
    }

    if (senha.length < 6) {
      setErro('A senha precisa ter pelo menos 6 caracteres.')
      return
    }

    if (!codigoConvite.trim()) {
      setErro('Informe o código da empresa.')
      return
    }

    setCarregando(true)

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password: senha,
    })

    if (error) {
      console.error('Erro ao criar conta:', error)
      setErro(error.message || 'Erro ao criar conta.')
      setCarregando(false)
      return
    }

    const usuarioCriado = data.user

    if (!usuarioCriado) {
      setErro('Não foi possível criar o usuário.')
      setCarregando(false)
      return
    }

    const { error: erroLogin } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    })

    if (erroLogin) {
      setErro('Conta criada, mas não foi possível entrar automaticamente. Tente fazer login.')
      setCarregando(false)
      return
    }

    const { error: erroVinculo } = await supabase.rpc(
      'vincular_usuario_por_convite',
      {
        p_nome: nome.trim(),
        p_codigo_convite: codigoConvite.trim(),
      }
    )

    if (erroVinculo) {
      console.error('Erro ao vincular usuário:', erroVinculo)
      await supabase.auth.signOut()
      setErro(erroVinculo.message || 'Código de convite inválido.')
      setCarregando(false)
      return
    }

    const { data: usuarioSistema, error: erroUsuario } = await supabase
      .from('usuarios')
      .select('id, empresa_id, nome, email, perfil, ativo')
      .eq('id', usuarioCriado.id)
      .single()

    if (erroUsuario || !usuarioSistema) {
      await supabase.auth.signOut()
      setErro('Conta criada, mas não foi possível carregar o usuário do sistema.')
      setCarregando(false)
      return
    }

    const empresas = await buscarEmpresasDoUsuario(usuarioSistema.id)

    setSucesso('Conta criada com sucesso.')
    onLogin(usuarioSistema, empresas)
    setCarregando(false)
  }

  function alternarModo(novoModo) {
    setModo(novoModo)
    setErro('')
    setSucesso('')
  }

  return (
    <main className="min-h-screen bg-slate-100 flex items-center justify-center px-4">
      <section className="w-full max-w-md bg-white rounded-2xl shadow-lg p-8">
        <div className="text-center">
          <p className="text-sm font-semibold text-blue-600 uppercase tracking-wide">
            Sistema de estoque
          </p>

          <h1 className="mt-3 text-3xl font-bold text-slate-900">
            Estoque Fácil
          </h1>

          
        </div>

        <div className="mt-8 grid grid-cols-2 gap-2 rounded-xl bg-slate-100 p-1">
          <button
            type="button"
            onClick={() => alternarModo('login')}
            className={
              modo === 'login'
                ? 'rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm'
                : 'rounded-lg px-4 py-2 text-sm font-semibold text-slate-500'
            }
          >
            Entrar
          </button>

          <button
            type="button"
            onClick={() => alternarModo('cadastro')}
            className={
              modo === 'cadastro'
                ? 'rounded-lg bg-white px-4 py-2 text-sm font-semibold text-slate-900 shadow-sm'
                : 'rounded-lg px-4 py-2 text-sm font-semibold text-slate-500'
            }
          >
            Criar conta
          </button>
        </div>

        <form className="mt-6 space-y-4">
          {modo === 'cadastro' && (
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Nome
              </label>
              <input
                type="text"
                value={nome}
                onChange={(event) => setNome(event.target.value)}
                placeholder="Digite seu nome"
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-slate-700">
              E-mail
            </label>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Digite seu e-mail"
              className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700">
              Senha
            </label>

            <div className="relative mt-1">
              <input
                type={mostrarSenha ? 'text' : 'password'}
                value={senha}
                onChange={(event) => setSenha(event.target.value)}
                placeholder="Digite sua senha"
                className="w-full rounded-xl border border-slate-300 px-4 py-3 pr-14 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />

              <button
                type="button"
                onClick={() => setMostrarSenha(!mostrarSenha)}
                className="absolute inset-y-0 right-0 flex items-center px-4 text-lg text-slate-400 hover:text-slate-700"
                aria-label={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
                title={mostrarSenha ? 'Ocultar senha' : 'Mostrar senha'}
              >
                {mostrarSenha ? '🙈' : '👁️'}
              </button>
            </div>
          </div>

          {modo === 'cadastro' && (
            <div>
              <label className="block text-sm font-medium text-slate-700">
                Código da empresa
              </label>
              <input
                type="text"
                value={codigoConvite}
                onChange={(event) => setCodigoConvite(event.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 px-4 py-3 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
              <p className="mt-1 text-xs text-slate-500">
                Use o código recebido pelo responsável da empresa.
              </p>
            </div>
          )}

          {erro && (
            <div className="rounded-xl bg-red-50 border border-red-100 px-4 py-3">
              <p className="text-sm font-medium text-red-700">
                {erro}
              </p>
            </div>
          )}

          {sucesso && (
            <div className="rounded-xl bg-green-50 border border-green-100 px-4 py-3">
              <p className="text-sm font-medium text-green-700">
                {sucesso}
              </p>
            </div>
          )}

          <button
            type="button"
            onClick={modo === 'login' ? entrar : cadastrar}
            disabled={carregando}
            className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white hover:bg-blue-700 transition disabled:cursor-not-allowed disabled:opacity-70"
          >
            {carregando
              ? modo === 'login'
                ? 'Entrando...'
                : 'Criando conta...'
              : modo === 'login'
                ? 'Entrar'
                : 'Criar conta'}
          </button>
        </form>

        
      </section>
    </main>
  )
}

export default Login