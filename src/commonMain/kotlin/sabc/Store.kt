package sabc

const val STORAGE_KEY = "tier-eval-v1"
const val BACKUP_KEY = "tier-eval-v1-backup"

/** 키-값 저장소 (브라우저 localStorage 또는 테스트용 가짜). 실패하면 예외를 던질 수 있다. */
interface KeyValueStorage {
    fun getItem(key: String): String?
    fun setItem(key: String, value: String)
    fun removeItem(key: String)
}

/** storage가 null이면 저장소 없음: 빈 데이터로 시작하고 저장은 늘 실패한다. */
class Store(private val storage: KeyValueStorage?) {
    var loadFailed = false
        private set

    /** 읽을 수 없는 저장 데이터는 빈 데이터로 시작하되, 덮어쓰기 전에 원본을 백업 키에 남긴다. */
    fun load(): Workspace {
        loadFailed = false
        var raw: String? = null
        try {
            raw = storage?.getItem(STORAGE_KEY) ?: return emptyWorkspace()
            toWorkspace(json.parseToJsonElement(raw))?.let { return it }
        } catch (_: Throwable) {
            // 읽기 실패나 깨진 JSON은 아래에서 같은 방식으로 처리한다
        }
        loadFailed = true
        try {
            if (raw != null) storage?.setItem(BACKUP_KEY, raw)
        } catch (_: Throwable) {
            // 백업도 못 하면 어쩔 수 없다
        }
        return emptyWorkspace()
    }

    fun save(ws: Workspace): Boolean = try {
        if (storage == null) false
        else {
            storage.setItem(STORAGE_KEY, compactJson.encodeToString(Workspace.serializer(), ws))
            true
        }
    } catch (_: Throwable) {
        false
    }

    fun clear() {
        try {
            storage?.removeItem(STORAGE_KEY)
        } catch (_: Throwable) {
            // 저장소를 쓸 수 없으면 지울 것도 없다
        }
    }
}
