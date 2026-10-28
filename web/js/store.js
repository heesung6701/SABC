import { emptyData, validateData } from './core.js';

export const STORAGE_KEY = 'tier-eval-v1';

// storage를 생략하면 브라우저 localStorage를 쓴다. 접근 자체가 막혀 있으면 저장소 없음(null)으로 취급한다.
function resolveStorage(storage) {
  if (storage !== undefined) return storage;
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function createStore(storage) {
  const target = resolveStorage(storage);
  return {
    load() {
      try {
        const raw = target?.getItem(STORAGE_KEY);
        if (raw == null) return emptyData();
        const data = JSON.parse(raw);
        return validateData(data).length === 0 ? data : emptyData();
      } catch {
        return emptyData();
      }
    },
    save(data) {
      try {
        if (!target) return false;
        target.setItem(STORAGE_KEY, JSON.stringify(data));
        return true;
      } catch {
        return false;
      }
    },
    clear() {
      try {
        target?.removeItem(STORAGE_KEY);
      } catch {
        // 저장소를 쓸 수 없으면 지울 것도 없다
      }
    },
  };
}
