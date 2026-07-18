import { useState } from 'react';
import { useAuth } from './AuthContext';
import styles from './AuthScreen.module.css';

export default function AuthScreen() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState('signin'); // 'signin' | 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setNotice('');
    setBusy(true);
    const { error: err } =
      mode === 'signin' ? await signIn(email, password) : await signUp(email, password);
    setBusy(false);
    if (err) {
      setError(translateError(err.message));
      return;
    }
    if (mode === 'signup') {
      setNotice('Conta criada. Verifique seu email para confirmar antes de entrar.');
    }
  }

  return (
    <div className={styles.page}>
      <form className={styles.card} onSubmit={handleSubmit}>
        <div className={styles.title}>Cockpit de Produtividade</div>
        <div className={styles.subtitle}>
          {mode === 'signin' ? 'Entre para acessar seus dados' : 'Crie sua conta'}
        </div>

        <label className={styles.label}>
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={styles.input}
            autoComplete="email"
          />
        </label>

        <label className={styles.label}>
          Senha
          <input
            type="password"
            required
            minLength={6}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={styles.input}
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
          />
        </label>

        {error && <div className={styles.error}>{error}</div>}
        {notice && <div className={styles.notice}>{notice}</div>}

        <button type="submit" className={styles.submit} disabled={busy}>
          {busy ? 'Aguarde...' : mode === 'signin' ? 'Entrar' : 'Criar conta'}
        </button>

        <button
          type="button"
          className={styles.switchMode}
          onClick={() => {
            setMode(mode === 'signin' ? 'signup' : 'signin');
            setError('');
            setNotice('');
          }}
        >
          {mode === 'signin' ? 'Não tem conta? Criar conta' : 'Já tem conta? Entrar'}
        </button>
      </form>
    </div>
  );
}

function translateError(message) {
  if (/invalid login credentials/i.test(message)) return 'Email ou senha incorretos.';
  if (/user already registered/i.test(message)) return 'Este email já tem uma conta.';
  if (/password should be at least/i.test(message)) return 'A senha precisa ter pelo menos 6 caracteres.';
  return message;
}
