@file:OptIn(ExperimentalWasmJsInterop::class)

package sabc

// 브라우저 기능은 이 파일의 js() 함수로만 쓴다. 예외는 JS 쪽에서 잡아 값으로 돌려준다.

private fun storageAvailable(): Boolean = js("{ try { return !!globalThis.localStorage; } catch (e) { return false; } }")
private fun lsGet(key: String): String? = js("localStorage.getItem(key)")
private fun lsSet(key: String, value: String): Boolean = js("{ try { localStorage.setItem(key, value); return true; } catch (e) { return false; } }")
private fun lsRemove(key: String): Unit = js("{ try { localStorage.removeItem(key); } catch (e) {} }")

private object BrowserStorage : KeyValueStorage {
    override fun getItem(key: String) = lsGet(key)
    override fun setItem(key: String, value: String) = check(lsSet(key, value)) { "localStorage 저장 실패" }
    override fun removeItem(key: String) = lsRemove(key)
}

/** 접근 자체가 막혀 있으면 저장소 없음(null) */
fun browserStorage(): KeyValueStorage? = if (storageAvailable()) BrowserStorage else null

/** 다른 탭이 저장하면 알린다 */
fun onStorageChange(callback: () -> Unit): Unit =
    js("window.addEventListener('storage', (e) => { if (e.key === null || e.key === 'tier-eval-v1') callback(); })")

fun confirm(message: String): Boolean = js("window.confirm(message)")

fun download(filename: String, text: String, type: String): Unit = js(
    """{
      const url = URL.createObjectURL(new Blob([text], { type }));
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.append(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 0);
    }""",
)

/** 파일 선택 창을 열고, 고른 파일의 텍스트를 넘긴다 */
fun pickTextFile(accept: String, onText: (String) -> Unit): Unit = js(
    """{
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = accept;
      input.onchange = () => { const file = input.files[0]; if (file) file.text().then((text) => onText(text)); };
      input.click();
    }""",
)

fun locationHash(): String = js("decodeURIComponent(location.hash.slice(1))")
fun replaceHash(hash: String): Unit = js("history.replaceState(null, '', hash ? '#' + hash : location.pathname + location.search)")

/** 다크 모드: 페이지를 품은 쪽이 고른 data-theme가 있으면 그것, 없으면 시스템 설정 */
fun isDarkTheme(): Boolean = js(
    "(() => { const t = document.documentElement.dataset.theme; return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; })()",
)

/** 테마가 바뀌면 알린다 (시스템 설정 변경, data-theme 변경) */
fun onThemeChange(callback: () -> Unit): Unit = js(
    """{
      matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => callback());
      new MutationObserver(() => callback()).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    }""",
)
