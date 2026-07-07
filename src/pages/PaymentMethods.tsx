import { useEffect, useState } from 'react';
import { useToast } from '../hooks/useToast';
import { useBanks } from '../hooks/useBanks';
import { formatPhone, formatRuPhoneInput, ruPhoneDigits } from '../lib/format';
import { BankPicker } from '../components/BankPicker';
import { PhoneInput } from '../components/PhoneInput';
import { HeaderBand } from '../components/HeaderBand';
import { paymentMethods as pmApi, type ApiPaymentMethod } from '../api/api';
import { ApiError } from '../api/http';

type FormState = { phone: string; banks: string[]; label: string };
const emptyForm: FormState = { phone: '', banks: [], label: '' };

// Карточка «Способы оплаты» в профиле: список реквизитов СБП + добавление/редактирование/удаление.
export function PaymentMethods() {
  const toast = useToast();
  const { banks, bankName } = useBanks();

  const [methods, setMethods] = useState<ApiPaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  // 'new' — добавление; иначе id редактируемого способа; null — форма закрыта.
  const [editing, setEditing] = useState<string | 'new' | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm);
  const [bad, setBad] = useState<{ phone?: boolean; banks?: boolean }>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    pmApi
      .list()
      .then((r) => setMethods(r.paymentMethods))
      .catch(() => toast.error('Не удалось загрузить способы оплаты'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startAdd = () => {
    setForm(emptyForm);
    setBad({});
    setEditing('new');
  };
  const startEdit = (m: ApiPaymentMethod) => {
    setForm({ phone: formatRuPhoneInput(m.phone), banks: m.banks, label: m.label ?? '' });
    setBad({});
    setEditing(m.id);
  };
  const cancel = () => {
    setEditing(null);
    setBad({});
  };

  const save = async () => {
    const digits = ruPhoneDigits(form.phone);
    const phoneOk = digits.length === 10;
    if (!phoneOk || form.banks.length === 0) {
      setBad({ phone: !phoneOk, banks: form.banks.length === 0 });
      return toast.error('Укажи телефон и хотя бы один банк');
    }
    const phone = '+7' + digits;

    setBusy(true);
    try {
      const label = form.label.trim() || null;
      if (editing === 'new') {
        const isDefault = methods.length === 0; // первый способ станет дефолтным и на сервере
        const { paymentMethod } = await pmApi.create({ phone, banks: form.banks, label, isDefault });
        setMethods((prev) => syncDefault([...prev, paymentMethod], paymentMethod));
      } else if (editing) {
        const { paymentMethod } = await pmApi.patch(editing, { phone, banks: form.banks, label });
        setMethods((prev) => prev.map((m) => (m.id === paymentMethod.id ? paymentMethod : m)));
      }
      setEditing(null);
      toast.success('Реквизиты сохранены');
    } catch (e) {
      if (e instanceof ApiError && e.code === 'INVALID_PHONE') {
        setBad({ phone: true });
        toast.error('Неверный номер телефона (нужен российский)');
      } else if (e instanceof ApiError && e.code === 'INVALID_BANK') {
        setBad({ banks: true });
        toast.error('Выбран недопустимый банк');
      } else if (e instanceof ApiError) {
        toast.error(e.message);
      } else {
        toast.error('Не удалось сохранить реквизиты');
      }
    } finally {
      setBusy(false);
    }
  };

  const makeDefault = async (m: ApiPaymentMethod) => {
    try {
      const { paymentMethod } = await pmApi.patch(m.id, { isDefault: true });
      setMethods((prev) => syncDefault(prev.map((x) => (x.id === paymentMethod.id ? paymentMethod : x)), paymentMethod));
    } catch {
      toast.error('Не удалось назначить способ по умолчанию');
    }
  };

  const remove = async (m: ApiPaymentMethod) => {
    if (!confirm('Удалить этот способ оплаты?')) return;
    try {
      await pmApi.remove(m.id);
      // Сервер сам переназначает дефолт — перезапрашиваем актуальный список.
      const { paymentMethods } = await pmApi.list();
      setMethods(paymentMethods);
      if (editing === m.id) setEditing(null);
    } catch {
      toast.error('Не удалось удалить способ оплаты');
    }
  };

  const renderForm = () => (
    <div className="pay-form">
      <input
        className="input"
        placeholder="Метка (напр. «Основной»)"
        value={form.label}
        onChange={(e) => setForm((f) => ({ ...f, label: e.target.value }))}
      />
      <PhoneInput
        value={form.phone}
        invalid={bad.phone}
        onChange={(v) => { setForm((f) => ({ ...f, phone: v })); setBad((b) => ({ ...b, phone: false })); }}
      />
      <div className="pay-banks-field">
        <span className="field-label">Банки для перевода</span>
        <BankPicker
          banks={banks}
          selected={form.banks}
          onChange={(codes) => { setForm((f) => ({ ...f, banks: codes })); setBad((b) => ({ ...b, banks: false })); }}
          invalid={bad.banks}
        />
      </div>
      <div className="row" style={{ gap: 10 }}>
        <button type="button" className="btn sm" onClick={save} disabled={busy}>
          {busy ? '…' : 'Сохранить'}
        </button>
        <button type="button" className="link" onClick={cancel}>Отмена</button>
      </div>
    </div>
  );

  return (
    <div className="card">
      <HeaderBand eyebrow="Переводы по СБП" title="Способы оплаты" decoSize={130} titleSize="clamp(20px, 4.4vw, 26px)" />
      <div className="card-body">
        <section className="card-section">
          <label className="field-label">Мои реквизиты</label>

          {loading ? (
            <div className="hint">Загрузка…</div>
          ) : methods.length === 0 && editing !== 'new' ? (
            <div className="empty">Пока нет реквизитов. Добавь способ, чтобы друзья могли перевести тебе долг по СБП.</div>
          ) : (
            methods.map((m) =>
              editing === m.id ? (
                <div key={m.id}>{renderForm()}</div>
              ) : (
                <div key={m.id} className="pay-method-row">
                  <div className="pay-method-meta">
                    <div className="pay-method-title">
                      {m.label || 'Без метки'}
                      {m.isDefault && <span className="pay-badge">по умолчанию</span>}
                    </div>
                    <div className="pay-method-phone mono">{formatPhone(m.phone)}</div>
                    <div className="pay-method-banks">{m.banks.map(bankName).join(' · ')}</div>
                  </div>
                  <div className="pay-method-actions">
                    {!m.isDefault && (
                      <button type="button" className="link accent" onClick={() => makeDefault(m)}>По умолчанию</button>
                    )}
                    <button type="button" className="link" onClick={() => startEdit(m)}>Изменить</button>
                    <button type="button" className="link danger" onClick={() => remove(m)}>Удалить</button>
                  </div>
                </div>
              ),
            )
          )}

          {editing === 'new' ? (
            renderForm()
          ) : (
            <button type="button" className="btn sm chip-on" style={{ alignSelf: 'flex-start' }} onClick={startAdd}>
              + Добавить способ
            </button>
          )}
        </section>
      </div>
    </div>
  );
}

// Держит ровно один isDefault на клиенте: если пришедший способ дефолтный — снимаем флаг с прочих.
function syncDefault(list: ApiPaymentMethod[], changed: ApiPaymentMethod): ApiPaymentMethod[] {
  if (!changed.isDefault) return list;
  return list.map((m) => (m.id === changed.id ? m : { ...m, isDefault: false }));
}
