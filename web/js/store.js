import { emptyData, validateData } from './core.js';

export const STORAGE_KEY = 'tier-eval-v1';
export const BACKUP_KEY = 'tier-eval-v1-backup';

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
  let loadFailed = false;
  return {
    // 읽을 수 없는 저장 데이터는 빈 데이터로 시작하되, 덮어쓰기 전에 원본을 백업 키에 남긴다.
    load() {
      loadFailed = false;
      let raw = null;
      try {
        raw = target?.getItem(STORAGE_KEY) ?? null;
        if (raw === null) return emptyData();
        const data = JSON.parse(raw);
        if (validateData(data).length === 0) return data;
      } catch {
        // 읽기 실패나 깨진 JSON은 아래에서 같은 방식으로 처리한다
      }
      loadFailed = true;
      try {
        if (raw !== null) target.setItem(BACKUP_KEY, raw);
      } catch {
        // 백업도 못 하면 어쩔 수 없다
      }
      return emptyData();
    },
    get loadFailed() {
      return loadFailed;
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
