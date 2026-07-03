import { useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../hooks/useStore';
import { HeaderBand } from '../components/HeaderBand';
import { auth } from '../api/api';
import { setTokens } from '../api/tokens';
import { ApiError } from '../api/http';

export function AuthPage() {
  const { refreshSession } = useStore();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const isRegister = mode === 'register';

  const enter = async (loginEmail: string, password: string) => {
    setBusy(true);
    setErr('');
    try {
      const res = await auth.login(loginEmail, password);
      await setTokens(res.tokens.accessToken, res.tokens.refreshToken);
      await refreshSession();
      navigate('/trips');
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Ошибка входа');
    } finally {
      setBusy(false);
    }
  };

  const login = () => {
    const e = email.trim().toLowerCase();
    if (!e || !pass) return setErr('Заполни почту и пароль');
    enter(e, pass);
  };

  const register = async () => {
    const n = name.trim();
    const h = handle.trim().replace(/^@+/, '').toLowerCase();
    const e = email.trim().toLowerCase();
    if (!n || !h || !e || !pass) return setErr('Заполни все поля');
    if (!/^[a-z0-9_]{3,20}$/.test(h)) return setErr('Логин: 3–20 символов — латиница, цифры, _');
    if (!/^\S+@\S+\.\S+$/.test(e)) return setErr('Похоже, почта неверная');
    if (pass.length < 8) return setErr('Пароль минимум 8 символов');

    setBusy(true);
    setErr('');
    try {
      const res = await auth.register(n, h, e, pass);
      await setTokens(res.tokens.accessToken, res.tokens.refreshToken);
      await refreshSession();
      navigate('/trips');
    } catch (ex) {
      setErr(ex instanceof ApiError ? ex.message : 'Ошибка регистрации');
    } finally {
      setBusy(false);
    }
  };

  const submit = () => (isRegister ? register() : login());
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter') submit(); };
  const toggle = () => { setMode(isRegister ? 'login' : 'register'); setErr(''); };

  return (
    <div className="view">
      <div className="card" style={{ maxWidth: 440 }}>
        <HeaderBand eyebrow="ДЕЛИМ СЧЁТ ВМЕСТЕ" title={isRegister ? 'Регистрация' : 'С возвращением'} />

        <div className="auth-body">
          {isRegister && (
            <div className="field-group">
              <input className="input" placeholder="Имя или ФИО" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={onKey} />
              <div className="hint">Можно полностью — остальным показываем только имя</div>
            </div>
          )}

          {isRegister && (
            <div className="field-group">
              <div className="handle-wrap">
                <span className="at">@</span>
                <input className="input" placeholder="login" value={handle} onChange={(e) => setHandle(e.target.value)} onKeyDown={onKey} />
              </div>
              <div className="hint">Уникальный — по нему тебя найдут друзья</div>
            </div>
          )}

          <input className="input" type="email" placeholder="Почта" value={email} onChange={(e) => setEmail(e.target.value)} onKeyDown={onKey} />
          <input className="input" type="password" placeholder="Пароль" value={pass} onChange={(e) => setPass(e.target.value)} onKeyDown={onKey} />

          {err && <div className="error-banner">{err}</div>}

          <button type="button" className="btn" onClick={submit} disabled={busy}>
            {busy ? 'Подождите…' : isRegister ? 'Создать аккаунт' : 'Войти'}
          </button>

          <button type="button" className="link" style={{ alignSelf: 'center' }} onClick={toggle}>
            {isRegister ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться'}
          </button>
        </div>
      </div>
    </div>
  );
}
