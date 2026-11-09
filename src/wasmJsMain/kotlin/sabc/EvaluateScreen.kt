package sabc

import androidx.compose.animation.animateContentSize
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectDragGestures
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.PrimaryScrollableTabRow
import androidx.compose.material3.Tab
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.alpha
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned
import androidx.compose.ui.layout.positionInRoot
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.IntOffset
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import kotlin.math.roundToInt

private const val POOL = "pool"

/** 칩 끌어서 놓기. 칩 대신 화면 맨 위에 그리는 유령 칩을 움직이고, 놓은 위치의 구역(티어/미배치)에 배치한다. */
class DragState {
    var subject by mutableStateOf<Subject?>(null)
        private set
    var pointer by mutableStateOf(Offset.Zero)
        private set
    var grab = Offset.Zero
        private set
    val zones = mutableMapOf<String, Rect>() // 구역 키(S/A/B/C/pool) -> 화면 위치
    val hover: String? get() = subject?.let { zones.entries.firstOrNull { (_, rect) -> rect.contains(pointer) }?.key }

    fun start(subject: Subject, chipTopLeft: Offset, at: Offset) {
        this.subject = subject
        grab = at
        pointer = chipTopLeft + at
    }

    fun move(delta: Offset) { pointer += delta }

    /** 놓은 구역 키를 돌려준다 (구역 밖이면 null) */
    fun end(): String? = hover.also { subject = null }

    fun cancel() { subject = null }
}

@Composable
fun DragGhost(drag: DragState) {
    val subject = drag.subject ?: return
    val topLeft = drag.pointer - drag.grab
    Box(Modifier.offset { IntOffset(topLeft.x.roundToInt(), topLeft.y.roundToInt()) }) {
        ChipFrame(highlight = true) { Text(subject.name) }
    }
}

@Composable
private fun ChipFrame(highlight: Boolean = false, modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    val colors = MaterialTheme.colorScheme
    Row(
        modifier.height(32.dp)
            .background(colors.surface, CircleShape)
            .border(1.dp, if (highlight) colors.primary else colors.outlineVariant, CircleShape)
            .animateContentSize()
            .padding(horizontal = 12.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) { content() }
}

@Composable
fun EvaluateScreen(state: AppState, data: EvalData, drag: DragState) {
    if (data.subjects.isEmpty() || data.criteria.isEmpty()) {
        PageHead("평가")
        Stack {
            Callout(Tone.INFORMATIVE, "먼저 대상자와 기준을 설정해 주세요", "설정에서 preset으로 바로 시작하거나 직접 입력할 수 있어요.")
            Box { PrimaryButton("설정으로 가기") { state.go(Screen.SETTINGS) } }
        }
        return
    }
    var currentId by rememberSaveable { mutableStateOf<String?>(null) }
    val criterion = data.criteria.firstOrNull { it.id == currentId } ?: data.criteria[0]
    val perCriterion = data.criteria.map { it to progress(data, it.id) }
    val totalCells = perCriterion.sumOf { it.second.total }
    val placedCells = perCriterion.sumOf { it.second.placed }
    val current = progress(data, criterion.id)
    val done = placedCells == totalCells

    PageHead("평가", "전체 $placedCells/$totalCells 배치") {
        if (done) PrimaryButton("결과 보기") { state.go(Screen.RESULT) } else SecondaryButton("결과 미리 보기") { state.go(Screen.RESULT) }
    }
    LinearProgressIndicator(
        progress = { if (totalCells == 0) 0f else placedCells.toFloat() / totalCells },
        modifier = Modifier.fillMaxWidth().height(6.dp),
        trackColor = MaterialTheme.colorScheme.surfaceVariant,
        gapSize = 0.dp,
        drawStopIndicator = {},
    )
    PrimaryScrollableTabRow(data.criteria.indexOf(criterion), edgePadding = 0.dp, containerColor = MaterialTheme.colorScheme.surface) {
        perCriterion.forEach { (c, p) ->
            Tab(selected = c.id == criterion.id, onClick = { currentId = c.id }, text = { Text("${c.name} ${p.placed}/${p.total}") })
        }
    }
    Stack(Modifier.padding(top = 12.dp)) {
        criterion.description?.let { DescBox { Text(it, color = Muted) } }
        val rubricTiers = TIERS.filter { !criterion.rubric?.get(it).isNullOrEmpty() }
        if (rubricTiers.isNotEmpty()) {
            var open by remember(criterion.id) { mutableStateOf(false) }
            GhostButton(if (open) "▾ 티어 설명" else "▸ 티어 설명", small = true) { open = !open }
            if (open) rubricTiers.forEach { tier ->
                DescBox {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        TierPill(tier)
                        Text(criterion.rubric!!.getValue(tier), color = Muted)
                    }
                }
            }
        }
        MutedText("${criterion.name} · ${current.placed}/${current.total} 배치 — 대상자를 끌어서 티어에 놓으세요")
    }

    // 티어 라벨(S/A/B/C)을 누르면 그 기준의 티어 설명을 보여준다. 다시 누르면 닫힌다.
    var openTier by remember(criterion.id) { mutableStateOf<String?>(null) }
    Column(Modifier.padding(top = 16.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
        TIERS.forEach { tier ->
            Row(Modifier.fillMaxWidth().height(IntrinsicSize.Min).heightIn(min = 64.dp)) {
                Box(
                    Modifier.width(64.dp).fillMaxHeight()
                        .background(TierColors.getValue(tier), RoundedCornerShape(topStart = 12.dp, bottomStart = 12.dp))
                        .clickable { openTier = if (openTier == tier) null else tier },
                    contentAlignment = Alignment.Center,
                ) { Text(tier, color = TierInk, fontSize = 30.sp, fontWeight = FontWeight.Bold) }
                Zone(tier, state, data, criterion, drag, RoundedCornerShape(topEnd = 12.dp, bottomEnd = 12.dp), Modifier.weight(1f))
            }
            if (openTier == tier) {
                Row(
                    Modifier.fillMaxWidth().padding(start = 72.dp)
                        .border(1.dp, MaterialTheme.colorScheme.outlineVariant, RoundedCornerShape(12.dp))
                        .padding(horizontal = 16.dp, vertical = 12.dp),
                    horizontalArrangement = Arrangement.spacedBy(8.dp),
                ) {
                    TierPill(tier)
                    val text = criterion.rubric?.get(tier)
                    if (text.isNullOrEmpty()) MutedText("${criterion.name}의 $tier 설명이 아직 없어요. 설정 > 기준에서 적을 수 있어요.") else Text(text)
                }
            }
        }
    }
    Column(Modifier.padding(top = 20.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        MutedText("미배치")
        Zone(null, state, data, criterion, drag, RoundedCornerShape(12.dp), Modifier.fillMaxWidth().heightIn(min = 72.dp))
    }
}

@Composable
private fun DescBox(content: @Composable () -> Unit) =
    SurfaceBox(Modifier.fillMaxWidth()) { Box(Modifier.padding(horizontal = 16.dp, vertical = 12.dp)) { content() } }

/** tier가 null이면 미배치 풀 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun Zone(
    tier: String?,
    state: AppState,
    data: EvalData,
    criterion: Criterion,
    drag: DragState,
    shape: RoundedCornerShape,
    modifier: Modifier,
) {
    val key = tier ?: POOL
    val colors = MaterialTheme.colorScheme
    val over = drag.hover == key
    FlowRow(
        modifier.fillMaxHeight()
            .onGloballyPositioned { drag.zones[key] = it.boundsInRoot() }
            .background(if (over) colors.primaryContainer else colors.surfaceVariant, shape)
            .then(if (over) Modifier.border(2.dp, colors.primary, shape) else Modifier)
            .padding(8.dp),
        horizontalArrangement = Arrangement.spacedBy(6.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        data.subjects.filter { tierOf(data, criterion.id, it.id) == tier }.forEach { subject ->
            Chip(subject, state, data, criterion, drag)
        }
    }
}

// 펼친 칩 `기준id:대상자id`. 화면을 다시 그려도 유지
private val expandedChips = mutableStateMapOf<String, Boolean>()

/**
 * 대상자 칩. 끌어서 다른 구역에 놓는다.
 * 배치된 칩은 길게 누르거나 두 번 누르면 펼쳐져 −/+ 보정 버튼이 나온다. 접힌 칩은 0이 아닌 보정 값만 보여준다.
 */
@Composable
private fun Chip(subject: Subject, state: AppState, data: EvalData, criterion: Criterion, drag: DragState) {
    val place = { tier: String? -> state.commit { setPlacement(it, criterion.id, subject.id, tier) } }
    val adjust = { value: Int -> state.commit { setAdjustment(it, criterion.id, subject.id, value) } }
    val key = "${criterion.id}:${subject.id}"
    val placed = tierOf(data, criterion.id, subject.id) != null
    val expanded = placed && expandedChips[key] == true
    val toggle = { if (expanded) expandedChips.remove(key) else expandedChips[key] = true }
    var coords by remember { mutableStateOf<LayoutCoordinates?>(null) }

    ChipFrame(
        highlight = expanded,
        modifier = Modifier
            .alpha(if (drag.subject?.id == subject.id) 0.3f else 1f)
            .onGloballyPositioned { coords = it }
            .pointerInput(key) {
                detectDragGestures(
                    onDragStart = { at -> drag.start(subject, coords?.positionInRoot() ?: Offset.Zero, at) },
                    onDrag = { change, delta -> change.consume(); drag.move(delta) },
                    onDragEnd = {
                        when (val zone = drag.end()) {
                            null -> Unit
                            POOL -> place(null)
                            else -> place(zone)
                        }
                    },
                    onDragCancel = { drag.cancel() },
                )
            }
            .then(if (placed) Modifier.pointerInput(key, expanded) { detectTapGestures(onDoubleTap = { toggle() }, onLongPress = { toggle() }) } else Modifier),
    ) {
        Text(subject.name, maxLines = 1)
        if (!placed) return@ChipFrame
        val value = adjustmentOf(data, criterion.id, subject.id)
        if (expanded) AdjButton("−", value > -MAX_ADJUST) { adjust(value - 1) }
        if (expanded || value != 0) {
            Text(
                if (value > 0) "+$value" else "$value",
                fontWeight = FontWeight.Bold, fontSize = 14.sp,
                color = if (value != 0) MaterialTheme.colorScheme.primary else Muted,
            )
        }
        if (expanded) AdjButton("+", value < MAX_ADJUST) { adjust(value + 1) }
        Text("×", Modifier.clickable { place(null) }, color = Muted)
    }
}

@Composable
private fun AdjButton(label: String, enabled: Boolean, onClick: () -> Unit) {
    val colors = MaterialTheme.colorScheme
    Box(
        Modifier.size(24.dp)
            .alpha(if (enabled) 1f else 0.3f)
            .background(colors.surfaceVariant, CircleShape)
            .border(1.dp, colors.outlineVariant, CircleShape)
            .clickable(enabled = enabled, onClick = onClick),
        contentAlignment = Alignment.Center,
    ) { Text(label, fontSize = 15.sp, color = colors.onSurface) }
}
