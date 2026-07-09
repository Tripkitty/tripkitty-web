import { useEffect, useState } from 'react';
import { useBanks } from '../../hooks/useBanks';
import { formatPhone } from '../../lib/format';
import { TripPaymentModal } from '../../components/TripPaymentModal';
import { trips as tripsApi, paymentMethods as pmApi, type ApiPaymentMethod, type ApiTripPayment } from '../../api/api';

type Props = {
  tripId: string;
  // Реквизиты влияют на toPayment во взаиморасчётах — просим родителя перезапросить их.
  onChanged?: () => void;
};

const SOURCE_LABEL: Record<ApiTripPayment['source'], string> = {
  trip: 'заданы для этой поездки',
  profile: 'из профиля (по умолчанию)',
  none: '',
};

// Мои реквизиты для перевода в конкретной поездке: показывает эффективные реквизиты
// (override поездки или дефолт профиля) и позволяет выбрать/ввести/сбросить их через модалку.
export function MyTripPayment({ tripId, onChanged }: Props) {
  const { bankName } = useBanks();

  const [state, setState] = useState<ApiTripPayment | null>(null);
  const [methods, setMethods] = useState<ApiPaymentMethod[]>([]);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    tripsApi.getMyPayment(tripId).then(setState).catch(() => {});
    pmApi.list().then((r) => setMethods(r.paymentMethods)).catch(() => {});
  }, [tripId]);

  if (!state) return null;

  return (
    <section className="trip-block">
      <label className="field-label">Мои реквизиты для перевода</label>

      {state.source === 'none' ? (
        <div className="hint">
          Реквизиты не заданы — участники не увидят, куда вернуть тебе долг. Добавь способ оплаты
          в профиле или задай реквизиты для этой поездки.
        </div>
      ) : (
        state.payment && (
          <div className="pay-current">
            <span className="pay-method-phone mono">{formatPhone(state.payment.phone)}</span>
            <span className="pay-method-banks">{state.payment.banks.map(bankName).join(' · ')}</span>
            <span className="hint" style={{ marginTop: 0 }}>{SOURCE_LABEL[state.source]}</span>
          </div>
        )
      )}

      <button type="button" className="link accent" style={{ alignSelf: 'flex-start' }} onClick={() => setModalOpen(true)}>
        {state.source === 'none' ? 'Задать реквизиты' : 'Изменить'}
      </button>

      {modalOpen && (
        <TripPaymentModal
          tripId={tripId}
          current={state}
          methods={methods}
          onClose={() => setModalOpen(false)}
          onChanged={(next) => { setState(next); onChanged?.(); }}
        />
      )}
    </section>
  );
}
