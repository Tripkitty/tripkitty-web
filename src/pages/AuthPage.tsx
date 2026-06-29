import { useState, type KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../hooks/useStore';
import { disp } from '../lib/format';
import { uid } from '../lib/id';
import { HeaderBand } from '../components/HeaderBand';
import { Avatar } from '../components/Avatar';
import type { User } from '../types';

const DEMO_IDS = ['u_artem', 'u_anya', 'u_danil', 'u_vika'];

export function AuthPage() {
  const { db, dispatch } = useStore();
  const navigate = useNavigate();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [handle, setHandle] = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass] = useState('');
  const [err, setErr] = useState('');

  const isRegister = mode === 'register';

  const enter = (userId: string) => {
    dispatch({ type: 'setSession', userId });
    navigate('/trips');
  };

  const login = () => {
    const e = email.trim().toLowerCase();
    const u = Object.values(db.users).find((x) => x.email === e && x.pass === pass);
    if (!u) {
      setErr('Неверная почта или пароль');
      return;
    }
    enter(u.id);
  };

  const register = () => {
    const n = name.trim();
    const h = handle.trim().replace(/^@+/, '').toLowerCase();
    const e = email.trim().toLowerCase();
    if (!n || !h || !e || !pass) return setErr('Заполни все поля');
    if (!/^[a-z0-9_]{3,20}$/.test(h)) return setErr('Логин: 3–20 символов — латиница, цифры, _');
    if (!/^\S+@\S+\.\S+$/.test(e)) return setErr('Похоже, почта неверная');
    if (pass.length < 4) return setErr('Пароль минимум 4 символа');
    if (Object.values(db.users).some((u) => u.handle === h)) return setErr('Логин @' + h + ' уже занят');
    if (Object.values(db.users).some((u) => u.email === e)) return setErr('Эта почта уже занята');
    // TODO(auth): pass передаётся в открытом виде — заменить на регистрацию через бэкенд.
    const user: User = { id: 'u_' + uid(), name: n, handle: h, email: e, pass, friends: [], incoming: [], outgoing: [] };
    dispatch({ type: 'register', user });
    navigate('/trips');
  };

  const submit = () => (isRegister ? register() : login());
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'Enter') submit();
  };
  const toggle = () => {
    setMode(isRegister ? 'login' : 'register');
    setErr('');
  };

  const demoUsers = DEMO_IDS.map((id) => db.users[id]).filter(Boolean);

  return (
    <div className="view">
      <div className="card" style={{ maxWidth: 440 }}>
        <HeaderBand eyebrow="ДЕЛИМ СЧЁТ ВМЕСТЕ" title={isRegister ? 'Регистрация' : 'С возвращением'} />

        <div className="auth-body">
          {isRegister && (
            <div className="field-group">
              <input
                className="input"
                placeholder="Имя или ФИО"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={onKey}
              />
              <div className="hint">Можно полностью — остальным показываем только имя</div>
            </div>
          )}

          {isRegister && (
            <div className="field-group">
              <div className="handle-wrap">
                <span className="at">@</span>
                <input
                  className="input"
                  placeholder="login"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  onKeyDown={onKey}
                />
              </div>
              <div className="hint">Уникальный — по нему тебя найдут друзья</div>
            </div>
          )}

          <input
            className="input"
            type="email"
            placeholder="Почта"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={onKey}
          />
          <input
            className="input"
            type="password"
            placeholder="Пароль"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            onKeyDown={onKey}
          />

          {err && <div className="error-banner">{err}</div>}

          <button type="button" className="btn" onClick={submit}>
            {isRegister ? 'Создать аккаунт' : 'Войти'}
          </button>

          <button type="button" className="link" style={{ alignSelf: 'center' }} onClick={toggle}>
            {isRegister ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться'}
          </button>

          <div className="demo-card">
            <div className="eyebrow">ДЕМО · ВОЙТИ В ОДИН КЛИК</div>
            <p className="hint" style={{ margin: 0 }}>
              Пароль у всех <b>1234</b>. Можно открыть несколько вкладок под разными аккаунтами.
            </p>
            <div className="demo-chips">
              {demoUsers.map((u) => (
                <button key={u.id} type="button" className="demo-chip" onClick={() => enter(u.id)}>
                  <Avatar id={u.id} name={u.name} size={24} />
                  {disp(u.name)}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
