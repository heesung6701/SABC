package sabc

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.PrimaryTabRow
import androidx.compose.material3.Surface
import androidx.compose.material3.Tab
import androidx.compose.material3.Text
import androidx.compose.material3.Typography
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.ExperimentalComposeUiApi
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.ComposeViewport
import kotlinx.browser.document
import org.jetbrains.compose.resources.ExperimentalResourceApi
import org.jetbrains.compose.resources.preloadFont
import sabc.resources.Res
import sabc.resources.pretendard_bold
import sabc.resources.pretendard_regular

enum class Screen(val label: String) { EVALUATE("평가"), RESULT("결과"), SETTINGS("설정") }

val SETTINGS_TABS = listOf("subjects" to "대상자", "criteria" to "기준", "options" to "옵션", "data" to "데이터")

/**
 * 앱 상태: 워크스페이스 + 화면 위치. 모든 변경은 여기서 저장한다.
 * 데이터 변경은 "현재 값 -> 새 값" 함수로 받아 오래된 화면 상태가 최신 데이터를 덮어쓰지 않게 한다.
 */
class AppState(private val store: Store) {
    var ws by mutableStateOf(store.load())
        private set
    var loadFailed by mutableStateOf(store.loadFailed)
        private set
    var saveFailed by mutableStateOf(false)
        private set

    // 주소의 #result, #settings/options 등으로 화면을 기억한다 (새로고침해도 유지)
    private val initialHash = locationHash().split("/")
    var screen by mutableStateOf(Screen.entries.firstOrNull { it.name.lowercase() == initialHash[0] } ?: Screen.EVALUATE)
        private set
    var settingsTab by mutableStateOf(initialHash.getOrNull(1)?.takeIf { key -> SETTINGS_TABS.any { it.first == key } } ?: "subjects")
        private set

    val data: EvalData? get() = activeEvaluation(ws)?.data

    fun go(screen: Screen, tab: String? = null) {
        this.screen = screen
        tab?.let { settingsTab = it }
        replaceHash(
            when (screen) {
                Screen.EVALUATE -> ""
                Screen.RESULT -> "result"
                Screen.SETTINGS -> "settings/$settingsTab"
            },
        )
    }

    fun commitWorkspace(fn: (Workspace) -> Workspace) {
        ws = fn(ws)
        saveFailed = !store.save(ws)
        if (!saveFailed) loadFailed = false
    }

    /** 활성 평가의 데이터만 바꾼다 */
    fun commit(fn: (EvalData) -> EvalData) = commitWorkspace { updateActive(it, fn) }

    fun reload() {
        ws = store.load()
        loadFailed = store.loadFailed
    }
}

@OptIn(ExperimentalComposeUiApi::class)
fun main() {
    val state = AppState(Store(browserStorage()))
    onStorageChange { state.reload() } // 다른 탭이 저장하면 다시 읽는다
    ComposeViewport(document.body!!) { Root(state) }
}

@OptIn(ExperimentalResourceApi::class)
@Composable
fun Root(state: AppState) {
    // 캔버스로 그리므로 한글 글꼴을 직접 실어야 한다. 다 받기 전에는 빈 화면(index.html의 안내 문구)을 둔다.
    val regular by preloadFont(Res.font.pretendard_regular, FontWeight.Normal)
    val bold by preloadFont(Res.font.pretendard_bold, FontWeight.Bold)
    if (regular == null || bold == null) return
    val family = remember { FontFamily(regular!!, bold!!) }
    var dark by remember { mutableStateOf(isDarkTheme()) }
    LaunchedEffect(Unit) { onThemeChange { dark = isDarkTheme() } }
    MaterialTheme(colorScheme = sabcColors(dark), typography = typography(family)) {
        // Surface가 글자 기본색(onSurface)을 정해 준다. 없으면 다크 모드에서 검은 글자가 된다.
        CompositionLocalProvider(LocalDark provides dark) {
            Surface(Modifier.fillMaxSize(), color = MaterialTheme.colorScheme.surface) { App(state) }
        }
    }
}

private fun typography(family: FontFamily): Typography {
    val t = Typography()
    fun TextStyle.f() = copy(fontFamily = family)
    return Typography(
        t.displayLarge.f(), t.displayMedium.f(), t.displaySmall.f(),
        t.headlineLarge.f(), t.headlineMedium.f(), t.headlineSmall.f(),
        t.titleLarge.f(), t.titleMedium.f(), t.titleSmall.f(),
        t.bodyLarge.f().copy(fontSize = 16.sp), t.bodyMedium.f(), t.bodySmall.f(),
        t.labelLarge.f(), t.labelMedium.f(), t.labelSmall.f(),
    )
}

@Composable
fun App(state: AppState) {
    val drag = remember { DragState() }
    var dialog by remember { mutableStateOf<String?>(null) } // "new" | "list"
    Box(Modifier.fillMaxSize()) {
        Column(Modifier.fillMaxSize().verticalScroll(rememberScrollState(), enabled = drag.subject == null)) {
            Page {
                if (state.loadFailed) Callout(Tone.CRITICAL, "저장된 데이터를 읽지 못했습니다", "빈 상태로 시작했습니다. 원본은 브라우저 저장소의 $BACKUP_KEY 키에 보관했습니다.")
                if (state.saveFailed) Callout(Tone.CRITICAL, "저장에 실패했습니다", "JSON 내보내기로 백업하세요.")
                Header(state, onNew = { dialog = "new" }, onList = { dialog = "list" })
                val data = state.data
                if (data == null) {
                    // 평가가 하나도 없으면 평가 만들기 화면을 띄운다
                    Box(Modifier.padding(top = 24.dp)) { Card { NewEvaluationForm(state, onDone = null) } }
                } else when (state.screen) {
                    Screen.EVALUATE -> EvaluateScreen(state, data, drag)
                    Screen.RESULT -> ResultScreen(state, data)
                    Screen.SETTINGS -> SettingsScreen(state, data)
                }
            }
        }
        DragGhost(drag)
    }
    when (dialog) {
        "new" -> NewEvaluationDialog(state) { dialog = null }
        "list" -> EvaluationsDialog(state) { dialog = null }
    }
}

/** 모든 화면 위쪽의 공용 머리글: 서비스 이름 + 평가 선택 + 화면 이동 탭 */
@Composable
fun Header(state: AppState, onNew: () -> Unit, onList: () -> Unit) {
    val none = state.ws.evaluations.isEmpty()
    Row(Modifier.fillMaxWidth().padding(top = 16.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(
            "SABC",
            Modifier.clickable(enabled = !none) { state.go(Screen.EVALUATE) }.padding(end = 8.dp),
            color = MaterialTheme.colorScheme.primary, fontSize = 20.sp, fontWeight = FontWeight.Bold,
        )
        Box(Modifier.weight(1f))
        if (!none) {
            Picker(state.ws.evaluations.map { it.id to it.name }, state.ws.activeId, { id -> state.commitWorkspace { switchEvaluation(it, id) } })
            GhostButton("+ 새 평가", small = true, onClick = onNew)
            IconButton(onList) { Icon(GearIcon, "평가 목록 설정", tint = Muted) }
        }
    }
    PrimaryTabRow(Screen.entries.indexOf(state.screen).takeIf { !none } ?: 0, containerColor = MaterialTheme.colorScheme.surface) {
        Screen.entries.forEach { screen ->
            Tab(
                selected = !none && state.screen == screen,
                onClick = { state.go(screen) },
                enabled = !none,
                text = { Text(screen.label) },
            )
        }
    }
}
