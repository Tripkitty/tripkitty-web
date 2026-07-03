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
  // nonce перемонтирует баннер через key → shake-анимация проигрывается заново,
  // даже когда текст ошибки не изменился (видно, что кнопка отработала).
  const [errNonce, setErrNonce] = useState(0);
  // Невалидные поля (подсветка рамкой); флаг снимается при вводе в поле.
  const [bad, setBad] = useState<Record<string, boolean>>({});
  const [busy, setBusy] = useState(false);

  const isRegister = mode === 'register';

  const showErr = (msg: string, fields: Record<string, boolean> = {}) => {
    setErr(msg);
    setErrNonce((n) => n + 1);
    setBad(fields);
  };
  const clearBad = (k: string) => setBad((b) => (b[k] ? { ...b, [k]: false } : b));

  const enter = async (loginEmail: string, password: string) => {
    setBusy(true);
    setErr('');
    try {
      const res = await auth.login(loginEmail, password);
      await setTokens(res.tokens.accessToken, res.tokens.refreshToken);
      await refreshSession();
      navigate('/trips');
    } catch (e) {
      if (e instanceof ApiError) {
        showErr(e.message, { email: e.field === 'email', pass: e.field === 'password' });
      } else {
        showErr('Ошибка входа');
      }
    } finally {
      setBusy(false);
    }
  };

  const login = () => {
    const e = email.trim().toLowerCase();
    if (!e || !pass) return showErr('Заполни почту и пароль', { email: !e, pass: !pass });
    if (!/^\S+@\S+\.\S+$/.test(e)) return showErr('Похоже, почта неверная', { email: true });
    // Регистрация всегда требовала ≥ 8 символов, поэтому короткий пароль заведомо неверен —
    // говорим сразу, без запроса к серверу.
    if (pass.length < 8) return showErr('Пароль минимум 8 символов', { pass: true });
    enter(e, pass);
  };

  const register = async () => {
    const n = name.trim();
    const h = handle.trim().replace(/^@+/, '').toLowerCase();
    const e = email.trim().toLowerCase();
    if (!n || !h || !e || !pass) return showErr('Заполни все поля', { name: !n, handle: !h, email: !e, pass: !pass });
    if (!/^[a-z0-9_]{3,20}$/.test(h)) return showErr('Логин: 3–20 символов — латиница, цифры, _', { handle: true });
    if (!/^\S+@\S+\.\S+$/.test(e)) return showErr('Похоже, почта неверная', { email: true });
    if (pass.length < 8) return showErr('Пароль минимум 8 символов', { pass: true });

    setBusy(true);
    setErr('');
    try {
      const res = await auth.register(n, h, e, pass);
      await setTokens(res.tokens.accessToken, res.tokens.refreshToken);
      await refreshSession();
      navigate('/trips');
    } catch (ex) {
      showErr(ex instanceof ApiError ? ex.message : 'Ошибка регистрации');
    } finally {
      setBusy(false);
    }
  };

  const submit = () => (isRegister ? register() : login());
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter') submit(); };
  const toggle = () => { setMode(isRegister ? 'login' : 'register'); setErr(''); setBad({}); };

  return (
    <div className="view">
      <div className="card" style={{ maxWidth: 440 }}>
        <HeaderBand eyebrow="ДЕЛИМ СЧЁТ ВМЕСТЕ" title={isRegister ? 'Регистрация' : 'С возвращением'} />

        <div className="auth-body">
          {isRegister && (
            <div className="field-group">
              <input className={'input' + (bad.name ? ' invalid' : '')} placeholder="Имя или ФИО" value={name} onChange={(e) => { setName(e.target.value); clearBad('name'); }} onKeyDown={onKey} />
              <div className="hint">Можно полностью — остальным показываем только имя</div>
            </div>
          )}

          {isRegister && (
            <div className="field-group">
              <div className="handle-wrap">
                <span className="at">@</span>
                <input className={'input' + (bad.handle ? ' invalid' : '')} placeholder="login" value={handle} onChange={(e) => { setHandle(e.target.value); clearBad('handle'); }} onKeyDown={onKey} />
              </div>
              <div className="hint">Уникальный — по нему тебя найдут друзья</div>
            </div>
          )}

          <input className={'input' + (bad.email ? ' invalid' : '')} type="email" placeholder="Почта" value={email} onChange={(e) => { setEmail(e.target.value); clearBad('email'); }} onKeyDown={onKey} />
          <input className={'input' + (bad.pass ? ' invalid' : '')} type="password" placeholder="Пароль" value={pass} onChange={(e) => { setPass(e.target.value); clearBad('pass'); }} onKeyDown={onKey} />

          {err && <div key={errNonce} className="error-banner">{err}</div>}

          <button type="button" className="btn" onClick={submit} disabled={busy}>
            {busy ? 'Подождите…' : isRegister ? 'Создать аккаунт' : 'Войти'}
          </button>

          <div className="auth-switch">
            {isRegister ? 'Уже есть аккаунт?' : 'Нет аккаунта?'}{' '}
            <button type="button" className="link accent auth-switch-link" onClick={toggle}>
              {isRegister ? 'Войти' : 'Зарегистрироваться'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
