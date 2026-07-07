import { useEffect, useState } from 'react';
import { banks as banksApi } from '../api/api';
import type { Bank } from '../types';

// Справочник банков редко меняется — кэшируем в памяти модуля, чтобы не дёргать
// /banks на каждом монтировании компонента с выбором банка.
let banksCache: Bank[] | null = null;
let inflight: Promise<Bank[]> | null = null;

function loadBanks(): Promise<Bank[]> {
  if (banksCache) return Promise.resolve(banksCache);
  if (!inflight) {
    inflight = banksApi
      .list()
      .then((r) => {
        banksCache = r.banks;
        return r.banks;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

// Возвращает список банков и функцию поиска имени по коду (fallback — сам код).
export function useBanks(): { banks: Bank[]; bankName: (code: string) => string } {
  const [banks, setBanks] = useState<Bank[]>(banksCache ?? []);

  useEffect(() => {
    let alive = true;
    if (!banksCache) {
      loadBanks().then((b) => { if (alive) setBanks(b); }).catch(() => {});
    }
    return () => { alive = false; };
  }, []);

  const bankName = (code: string) => banks.find((b) => b.code === code)?.name ?? code;
  return { banks, bankName };
}
