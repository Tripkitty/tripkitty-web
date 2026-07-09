import { useEffect, useState } from 'react';
import { useToast } from '../hooks/useToast';
import { useBanks } from '../hooks/useBanks';
import { formatPhone } from '../lib/format';
import { HeaderBand } from '../components/HeaderBand';
import { PaymentMethodModal } from '../components/PaymentMethodModal';
import { paymentMethods as pmApi, type ApiPaymentMethod } from '../api/api';

// Карточка «Способы оплаты» в профиле: список реквизитов СБП + добавление/редактирование/удаление через модалку.
export function PaymentMethods() {
  const toast = useToast();
  const { bankName } = useBanks();

  const [methods, setMethods] = useState<ApiPaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);
  // null — модалка закрыта; { method: null } — добавление, { method } — редактирование.
  const [modal, setModal] = useState<{ method: ApiPaymentMethod | null } | null>(null);

  useEffect(() => {
    pmApi
      .list()
      .then((r) => setMethods(r.paymentMethods))
      .catch(() => toast.error('Не удалось загрузить способы оплаты'))
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    } catch {
      toast.error('Не удалось удалить способ оплаты');
    }
  };

  return (
    <div className="card">
      <HeaderBand eyebrow="Переводы по СБП" title="Способы оплаты" decoSize={130} titleSize="clamp(20px, 4.4vw, 26px)" />
      <div className="card-body">
        <section className="card-section">
          <label className="field-label">Мои реквизиты</label>

          {loading ? (
            <div className="hint">Загрузка…</div>
          ) : methods.length === 0 ? (
            <div className="empty">Пока нет реквизитов. Добавь способ, чтобы друзья могли перевести тебе долг по СБП.</div>
          ) : (
            methods.map((m) => (
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
                  <button type="button" className="link" onClick={() => setModal({ method: m })}>Изменить</button>
                  <button type="button" className="link danger" onClick={() => remove(m)}>Удалить</button>
                </div>
              </div>
            ))
          )}

          <button
            type="button"
            className="btn sm chip-on"
            style={{ alignSelf: 'flex-start' }}
            onClick={() => setModal({ method: null })}
          >
            + Добавить способ
          </button>
        </section>
      </div>

      {modal && (
        <PaymentMethodModal
          method={modal.method}
          isFirst={methods.length === 0}
          onClose={() => setModal(null)}
          onSaved={(pm) =>
            setMethods((prev) => (modal.method ? prev.map((x) => (x.id === pm.id ? pm : x)) : syncDefault([...prev, pm], pm)))
          }
        />
      )}
    </div>
  );
}

// Держит ровно один isDefault на клиенте: если пришедший способ дефолтный — снимаем флаг с прочих.
function syncDefault(list: ApiPaymentMethod[], changed: ApiPaymentMethod): ApiPaymentMethod[] {
  if (!changed.isDefault) return list;
  return list.map((m) => (m.id === changed.id ? m : { ...m, isDefault: false }));
}
