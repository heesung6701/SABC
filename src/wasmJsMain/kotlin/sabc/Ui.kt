package sabc

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ColumnScope
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Surface
import androidx.compose.material3.Switch
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.staticCompositionLocalOf
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

// ---- 색: SEED(당근) 브랜드 주황 + 티어 색(웹 버전과 같은 값) ----

val Brand = Color(0xFFFF6F0F)
val TierInk = Color(0xFF111111)
val TierColors = mapOf("S" to Color(0xFFFF7F7F), "A" to Color(0xFFFFBF7F), "B" to Color(0xFFFFDF7F), "C" to Color(0xFFBFFF7F))

/** 다크 모드 여부. Root가 브라우저 설정(data-theme 또는 prefers-color-scheme)을 따라 넣는다. */
val LocalDark = staticCompositionLocalOf { false }

fun sabcColors(dark: Boolean) = if (dark) {
    darkColorScheme(
        primary = Color(0xFFFF8A3D), onPrimary = Color(0xFF1A0A00),
        primaryContainer = Color(0xFF4A2410), onPrimaryContainer = Color(0xFFFFDBC8),
        background = Color(0xFF141414), onBackground = Color(0xFFECECEC),
        surface = Color(0xFF141414), onSurface = Color(0xFFECECEC),
        surfaceVariant = Color(0xFF26272A), onSurfaceVariant = Color(0xFFB0B3B8),
        surfaceContainer = Color(0xFF222326), surfaceContainerHigh = Color(0xFF26272A), surfaceContainerHighest = Color(0xFF2E2F33),
        outline = Color(0xFF6E7177), outlineVariant = Color(0xFF3A3C40),
        error = Color(0xFFFF8A80), onError = Color(0xFF2B0000),
    )
} else {
    lightColorScheme(
        primary = Brand, onPrimary = Color.White,
        primaryContainer = Color(0xFFFFF2EA), onPrimaryContainer = Color(0xFF7A2E00),
        background = Color.White, surface = Color.White,
        surfaceVariant = Color(0xFFF3F4F5), surfaceContainer = Color(0xFFF7F7F8), surfaceContainerHigh = Color(0xFFFFFFFF),
    )
}

val Muted @Composable get() = MaterialTheme.colorScheme.onSurfaceVariant

// ---- 배치 ----

/** 화면 폭 960dp까지, 양옆 16dp */
@Composable
fun Page(content: @Composable ColumnScope.() -> Unit) {
    Box(Modifier.fillMaxWidth(), contentAlignment = Alignment.TopCenter) {
        Column(Modifier.widthIn(max = 960.dp).fillMaxWidth().padding(start = 16.dp, end = 16.dp, bottom = 40.dp), content = content)
    }
}

@Composable
fun Stack(modifier: Modifier = Modifier, gap: Int = 12, content: @Composable ColumnScope.() -> Unit) =
    Column(modifier, verticalArrangement = Arrangement.spacedBy(gap.dp), content = content)

@Composable
fun Card(modifier: Modifier = Modifier, highlight: Boolean = false, content: @Composable ColumnScope.() -> Unit) {
    val colors = MaterialTheme.colorScheme
    Column(
        modifier.fillMaxWidth()
            .border(1.dp, if (highlight) colors.primary.copy(alpha = 0.3f) else colors.outlineVariant, RoundedCornerShape(16.dp))
            .background(if (highlight) colors.primaryContainer else colors.surface, RoundedCornerShape(16.dp))
            .padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
        content = content,
    )
}

@Composable
fun H1(text: String) = Text(text, fontSize = 26.sp, fontWeight = FontWeight.Bold)

@Composable
fun H2(text: String) = Text(text, fontSize = 19.sp, fontWeight = FontWeight.Bold)

@Composable
fun MutedText(text: String, modifier: Modifier = Modifier) = Text(text, modifier, color = Muted, fontSize = 14.sp)

/** 제목·부제 + 오른쪽 버튼 */
@Composable
fun PageHead(title: String, subtitle: String? = null, action: @Composable () -> Unit = {}) {
    Row(Modifier.fillMaxWidth().padding(top = 24.dp, bottom = 16.dp), verticalAlignment = Alignment.Bottom, horizontalArrangement = Arrangement.spacedBy(16.dp)) {
        Column(Modifier.weight(1f)) {
            H1(title)
            subtitle?.let { MutedText(it, Modifier.padding(top = 4.dp)) }
        }
        action()
    }
}

// ---- 버튼 ----

@Composable
fun PrimaryButton(label: String, enabled: Boolean = true, onClick: () -> Unit) =
    Button(onClick, enabled = enabled) { Text(label) }

@Composable
fun SecondaryButton(label: String, enabled: Boolean = true, onClick: () -> Unit) =
    OutlinedButton(onClick, enabled = enabled) { Text(label) }

@Composable
fun GhostButton(label: String, enabled: Boolean = true, danger: Boolean = false, small: Boolean = false, onClick: () -> Unit) =
    TextButton(
        onClick,
        enabled = enabled,
        contentPadding = if (small) PaddingValues(horizontal = 8.dp, vertical = 4.dp) else ButtonDefaults.TextButtonContentPadding,
        colors = if (danger) ButtonDefaults.textButtonColors(contentColor = MaterialTheme.colorScheme.error) else ButtonDefaults.textButtonColors(),
    ) { Text(label, fontSize = if (small) 14.sp else 15.sp) }

@Composable
fun DangerButton(label: String, enabled: Boolean = true, onClick: () -> Unit) =
    Button(onClick, enabled = enabled, colors = ButtonDefaults.buttonColors(containerColor = MaterialTheme.colorScheme.error)) { Text(label) }

// ---- 알림 상자 ----

enum class Tone { CRITICAL, WARNING, INFORMATIVE }

@Composable
fun Callout(tone: Tone, title: String?, vararg body: String) {
    val dark = LocalDark.current
    val (bg, fg) = when (tone) {
        Tone.CRITICAL -> if (dark) Color(0xFF4A1C1C) to Color(0xFFFFB4AB) else Color(0xFFFDECEC) to Color(0xFFB3261E)
        Tone.WARNING -> if (dark) Color(0xFF4A3A10) to Color(0xFFFFD780) else Color(0xFFFFF5DB) to Color(0xFF7A5300)
        Tone.INFORMATIVE -> if (dark) Color(0xFF13304D) to Color(0xFFA8CBFF) else Color(0xFFEAF3FF) to Color(0xFF0B57D0)
    }
    Column(Modifier.fillMaxWidth().background(bg, RoundedCornerShape(12.dp)).padding(horizontal = 16.dp, vertical = 12.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        title?.let { Text(it, color = fg, fontWeight = FontWeight.Bold) }
        body.forEach { Text(it, color = fg, fontSize = 14.sp) }
    }
}

/** 오류 목록: 하나면 그 문장, 여러 개면 제목 + 목록 */
@Composable
fun ErrorList(messages: List<String>, title: String = "가져오기에 실패했습니다") {
    if (messages.isEmpty()) return
    if (messages.size == 1) Callout(Tone.CRITICAL, messages[0]) else Callout(Tone.CRITICAL, title, *messages.toTypedArray())
}

// ---- 티어 ----

@Composable
fun TierPill(tier: String, text: String = tier) =
    Text(
        text,
        Modifier.background(TierColors.getValue(tier), RoundedCornerShape(50)).padding(horizontal = 8.dp, vertical = 2.dp),
        color = TierInk, fontWeight = FontWeight.Bold, fontSize = 13.sp,
    )

// ---- 입력 ----

/**
 * 저장된 값과 동기화되는 입력칸. 입력할 때마다 onChange로 저장하고, 바깥에서 값이 바뀌면(가져오기·평가 전환) 따라간다.
 * revertBlank면 비운 채로 포커스를 잃을 때 저장된 값으로 되돌린다(이름처럼 비울 수 없는 값).
 */
@Composable
fun SyncedField(
    stored: String,
    onChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    placeholder: String? = null,
    multiline: Boolean = false,
    revertBlank: Boolean = false,
) {
    var text by remember { mutableStateOf(stored) }
    LaunchedEffect(stored) { if (stored != text.trim()) text = stored }
    OutlinedTextField(
        value = text,
        onValueChange = { text = it; onChange(it) },
        modifier = modifier.fillMaxWidth().onFocusChanged { if (!it.isFocused && revertBlank && text.isBlank()) text = stored },
        label = { Text(label) },
        placeholder = placeholder?.let { { Text(it) } },
        singleLine = !multiline,
        minLines = if (multiline) 2 else 1,
    )
}

/** 로컬 상태 입력칸 (Enter로 제출 가능) */
@Composable
fun InputField(
    value: String,
    onValueChange: (String) -> Unit,
    label: String,
    modifier: Modifier = Modifier,
    placeholder: String? = null,
    multiline: Boolean = false,
    isError: Boolean = false,
    onEnter: (() -> Unit)? = null,
) = OutlinedTextField(
    value = value,
    onValueChange = onValueChange,
    modifier = modifier.fillMaxWidth(),
    label = { Text(label) },
    placeholder = placeholder?.let { { Text(it) } },
    singleLine = !multiline,
    minLines = if (multiline) 3 else 1,
    isError = isError,
    keyboardOptions = if (onEnter != null) KeyboardOptions(imeAction = ImeAction.Done) else KeyboardOptions.Default,
    keyboardActions = KeyboardActions(onDone = { onEnter?.invoke() }),
)

/** 드롭다운 선택 (평가 선택, 시작 내용) */
@Composable
fun Picker(options: List<Pair<String, String>>, selected: String?, onSelect: (String) -> Unit, modifier: Modifier = Modifier) {
    var open by remember { mutableStateOf(false) }
    Box(modifier) {
        OutlinedButton({ open = true }, contentPadding = PaddingValues(horizontal = 12.dp)) {
            Text(options.firstOrNull { it.first == selected }?.second ?: "", maxLines = 1, modifier = Modifier.widthIn(max = 200.dp))
            Text("  ▾", color = Muted)
        }
        DropdownMenu(open, { open = false }) {
            options.forEach { (key, label) ->
                DropdownMenuItem(text = { Text(label) }, onClick = { open = false; onSelect(key) })
            }
        }
    }
}

@Composable
fun SwitchRow(checked: Boolean, label: String, description: String, onToggle: (Boolean) -> Unit) {
    Row(
        Modifier.fillMaxWidth()
            .border(1.dp, MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(16.dp))
            .clickable { onToggle(!checked) }
            .padding(16.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            Text(label)
            MutedText(description)
        }
        Switch(checked, onToggle)
    }
}

@Composable
fun SurfaceBox(modifier: Modifier = Modifier, content: @Composable () -> Unit) =
    Surface(modifier, shape = RoundedCornerShape(12.dp), color = MaterialTheme.colorScheme.surfaceVariant, content = content)

/** 톱니바퀴 아이콘: SEED 아이콘(@seed-design/icon, MIT)의 setting_thin 경로 */
val GearIcon: ImageVector by lazy {
    val paths = listOf(
        "M9.10051 3.26913C9.19904 2.79014 9.61013 2.40002 10.151 2.40002H13.8537C14.3848 2.40002 14.7996 2.77894 14.9025 3.24589C14.9057 3.26065 14.9084 3.27553 14.9105 3.29049L15.1207 4.76731C15.1681 5.10039 15.4093 5.42429 15.7856 5.6414C16.1366 5.84391 16.5099 5.88489 16.815 5.76542L18.2941 5.18632C18.3014 5.18348 18.3087 5.18078 18.3161 5.17822C18.7841 5.0157 19.312 5.17883 19.5907 5.61914L19.5991 5.63275L21.4471 8.73228C21.7456 9.21327 21.5805 9.79738 21.2006 10.0996L21.1896 10.1083L19.9375 11.0571C19.6822 11.2506 19.5294 11.5891 19.5294 12C19.5294 12.3975 19.682 12.7343 19.926 12.9192L21.1895 13.8768C21.2015 13.8859 21.2131 13.8955 21.2244 13.9055C21.5628 14.2046 21.7542 14.7583 21.4471 15.2529L19.5991 18.3523L19.5907 18.3659C19.312 18.8062 18.7841 18.9694 18.3161 18.8068C18.3087 18.8043 18.3014 18.8016 18.2941 18.7987L16.8194 18.2213C16.5123 18.1011 16.1305 18.1433 15.7736 18.3473C15.4048 18.5581 15.1691 18.8776 15.1214 19.2127L14.9105 20.6946C14.9088 20.7067 14.9067 20.7189 14.9042 20.7309C14.8057 21.2099 14.3946 21.6 13.8537 21.6H10.151C9.61991 21.6 9.20518 21.2211 9.10227 20.7542C9.09901 20.7394 9.09632 20.7245 9.09419 20.7096L8.88402 19.2327C8.83662 18.8997 8.59542 18.5758 8.21913 18.3587C7.86813 18.1561 7.49484 18.1152 7.18971 18.2346L5.71059 18.8137C5.70334 18.8166 5.69603 18.8193 5.68867 18.8218C5.22061 18.9844 4.69273 18.8212 4.41404 18.3809L4.40568 18.3673L2.55766 15.2679C2.26915 14.8033 2.39691 14.2457 2.7649 13.9205C2.77618 13.9105 2.78784 13.9009 2.79984 13.8918L4.0518 12.943C4.30712 12.7495 4.45987 12.4109 4.45987 12C4.45987 11.5801 4.31082 11.2417 4.06589 11.0561L2.81527 10.1082C2.80327 10.0991 2.79161 10.0896 2.78033 10.0796C2.44192 9.78047 2.2505 9.2267 2.55767 8.73218L4.40568 5.63275L4.41404 5.61914C4.69273 5.17883 5.22061 5.0157 5.68867 5.17822C5.69603 5.18078 5.70334 5.18348 5.71059 5.18632L7.18079 5.76193C7.48822 5.8823 7.87128 5.84024 8.24051 5.6366C8.60263 5.43688 8.83536 5.12422 8.88164 4.79901L9.09419 3.30549C9.09592 3.29331 9.09803 3.28118 9.10051 3.26913ZM10.2644 3.60002L10.0697 4.96808C9.95888 5.74663 9.43418 6.34866 8.82006 6.68737C8.22311 7.01661 7.46331 7.16124 6.7433 6.87934L5.37819 6.34487L3.65337 9.23769L4.79073 10.0997C5.41901 10.5759 5.65987 11.3243 5.65987 12C5.65987 12.6913 5.39976 13.4271 4.77664 13.8993L3.64857 14.7543L5.37819 17.6552L6.75222 17.1172C7.4659 16.8378 8.22214 16.975 8.81883 17.3192C9.42486 17.6689 9.95967 18.274 10.0721 19.0637L10.2622 20.4H13.7404L13.9334 19.0436C14.0448 18.2605 14.5663 17.6551 15.1781 17.3055C15.7761 16.9636 16.5397 16.8231 17.2568 17.1039L18.6265 17.6402L20.3514 14.7474L19.2011 13.8756C18.5888 13.4115 18.3294 12.677 18.3294 12C18.3294 11.3087 18.5896 10.573 19.2127 10.1007L20.3514 9.23769L18.6265 6.34487L17.2525 6.88283C16.5388 7.16225 15.7826 7.02507 15.1859 6.6808C14.5799 6.33114 14.0451 5.72609 13.9327 4.93638L13.7425 3.60002H10.2644Z",
        "M8.35584 12C8.35584 9.98743 9.98737 8.35591 12 8.35591C14.0126 8.35591 15.6441 9.98743 15.6441 12C15.6441 14.0126 14.0126 15.6441 12 15.6441C9.98737 15.6441 8.35584 14.0126 8.35584 12ZM12 9.55591C10.6501 9.55591 9.55584 10.6502 9.55584 12C9.55584 13.3499 10.6501 14.4441 12 14.4441C13.3498 14.4441 14.4441 13.3499 14.4441 12C14.4441 10.6502 13.3498 9.55591 12 9.55591Z",
    )
    ImageVector.Builder("gear", 20.dp, 20.dp, 24f, 24f).apply {
        paths.forEach { addPath(PathParser().parsePathString(it).toNodes(), fill = SolidColor(Color.Black), pathFillType = androidx.compose.ui.graphics.PathFillType.EvenOdd) }
    }.build()
}
