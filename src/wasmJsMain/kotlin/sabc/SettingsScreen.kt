package sabc

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.PrimaryScrollableTabRow
import androidx.compose.material3.Tab
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp

/** 가져오기 오류처럼 화면 위쪽에 띄울 메시지. 무언가를 적용하면 지운다. */
private class Messages {
    var list by mutableStateOf(emptyList<String>())
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun Buttons(content: @Composable () -> Unit) =
    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp)) { content() }

/** 파일을 골라 parse한 결과에 오류가 있으면 보이고, 없으면 확인 뒤 적용한다 */
private fun <T> importFile(accept: String, messages: Messages, parse: (String) -> Parsed<T>, confirmText: String, apply: (T) -> Unit) =
    pickTextFile(accept) { text ->
        val result = parse(text)
        if (result.errors.isNotEmpty()) messages.list = result.errors
        else if (confirm(confirmText)) {
            messages.list = emptyList()
            apply(result.value!!)
        }
    }

@Composable
fun SettingsScreen(state: AppState, data: EvalData) {
    val messages = remember { Messages() }
    val apply = { fn: (EvalData) -> EvalData ->
        messages.list = emptyList()
        state.commit(fn)
    }
    val ready = data.subjects.isNotEmpty() && data.criteria.isNotEmpty()
    val isEmpty = data.subjects.isEmpty() && data.criteria.isEmpty()
    val importJson = {
        importFile("application/json,.json", messages, ::parseImportJson, "현재 데이터를 교체합니다. 계속할까요?") { next -> apply { next } }
    }

    PageHead("설정", if (ready) "대상자 ${data.subjects.size}명 · 기준 ${data.criteria.size}개" else "대상자와 기준을 1개 이상 입력하면 평가를 시작할 수 있어요") {
        PrimaryButton("평가하러 가기", enabled = ready) { state.go(Screen.EVALUATE) }
    }
    Stack {
        ErrorList(messages.list)
        if (isEmpty) {
            Card(highlight = true) {
                H2("어떻게 시작할까요?")
                // 빈 구성은 지금 상태 그대로라 목록에서 뺀다
                PRESETS.filter { it.id != "empty" }.forEachIndexed { i, preset ->
                    if (i > 0) HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Column(Modifier.weight(1f)) {
                            Text(preset.name, fontWeight = FontWeight.Bold)
                            MutedText(preset.summary)
                        }
                        SecondaryButton("시작하기") {
                            if (preset.criteria.isNotEmpty() && preset.subjects.isEmpty()) state.go(Screen.SETTINGS, "subjects")
                            apply { applyPreset(preset) }
                        }
                    }
                }
                Box { SecondaryButton("JSON 파일 가져오기", onClick = importJson) }
            }
        }
    }
    PrimaryScrollableTabRow(
        SETTINGS_TABS.indexOfFirst { it.first == state.settingsTab },
        Modifier.padding(top = 24.dp),
        edgePadding = 0.dp,
        containerColor = MaterialTheme.colorScheme.surface,
    ) {
        SETTINGS_TABS.forEach { (key, label) ->
            Tab(selected = state.settingsTab == key, onClick = { state.go(Screen.SETTINGS, key) }, text = { Text(label) })
        }
    }
    Stack(Modifier.padding(top = 20.dp), gap = 16) {
        when (state.settingsTab) {
            "subjects" -> SubjectsPanel(data, apply)
            "criteria" -> CriteriaPanel(data, apply, messages)
            "options" -> OptionsPanel(data, apply)
            "data" -> DataPanel(state, data, apply, messages, importJson)
        }
    }
}

/** 이름 목록 편집(대상자·기준 공통): 한 줄 추가 + 여러 개 붙여넣기 */
@Composable
private fun NameAdder(noun: String, placeholder: String, addOne: (String) -> Unit, addMany: (List<String>) -> Unit) {
    var single by remember { mutableStateOf("") }
    var bulkOpen by remember { mutableStateOf(false) }
    var bulk by remember { mutableStateOf("") }
    val focus = remember { FocusRequester() }
    val submit = {
        if (single.isNotBlank()) {
            addOne(single)
            single = ""
            focus.requestFocus()
        }
    }
    Stack {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            InputField(single, { single = it }, "$noun 이름", Modifier.weight(1f).focusRequester(focus), placeholder, onEnter = submit)
            PrimaryButton("추가", onClick = submit)
        }
        Box { GhostButton(if (bulkOpen) "붙여넣기 닫기" else "여러 개를 한꺼번에 붙여넣기", small = true) { bulkOpen = !bulkOpen } }
        if (bulkOpen) {
            InputField(bulk, { bulk = it }, "$noun 일괄 추가", placeholder = "줄바꿈 또는 쉼표로 구분해 여러 개를 한 번에 입력", multiline = true)
            Box {
                SecondaryButton("모두 추가") {
                    val names = parseNames(bulk)
                    if (names.isNotEmpty()) {
                        addMany(names)
                        bulk = ""
                    }
                }
            }
        }
    }
}

@Composable
private fun SubjectsPanel(data: EvalData, apply: ((EvalData) -> EvalData) -> Unit) {
    H2("대상자 ${data.subjects.size}명")
    NameAdder("대상자", "이름을 입력하고 Enter", { name -> apply { addSubject(it, name) } }, { names -> apply { addSubjects(it, names) } })
    if (data.subjects.isEmpty()) MutedText("아직 대상자가 없어요. 평가받는 사람이나 항목의 이름을 추가해 주세요.")
    data.subjects.forEach { subject ->
        androidx.compose.runtime.key(subject.id) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                SyncedField(subject.name, { name -> apply { renameSubject(it, subject.id, name) } }, "대상자 이름", Modifier.weight(1f), revertBlank = true)
                GhostButton("삭제", danger = true) {
                    if (confirm("'${subject.name}'을(를) 삭제하고 관련 배치도 지웁니다. 계속할까요?")) apply { removeSubject(it, subject.id) }
                }
            }
        }
    }
}

@Composable
private fun PointPills(points: Map<String, Double>) = Buttons { TIERS.forEach { TierPill(it, "$it ${fmt(points.getValue(it))}") } }

@Composable
private fun CriterionCard(criterion: Criterion, index: Int, total: Int, apply: ((EvalData) -> EvalData) -> Unit) {
    var editing by remember { mutableStateOf(false) }
    var rubricOpen by remember { mutableStateOf(true) }
    Card {
        Row(verticalAlignment = Alignment.CenterVertically) {
            SyncedField(criterion.name, { name -> apply { renameCriterion(it, criterion.id, name) } }, "기준 이름", Modifier.weight(1f), revertBlank = true)
            GhostButton("↑", enabled = index > 0) { apply { moveCriterion(it, criterion.id, -1) } }
            GhostButton("↓", enabled = index < total - 1) { apply { moveCriterion(it, criterion.id, 1) } }
            GhostButton("삭제", danger = true) {
                if (confirm("'${criterion.name}'을(를) 삭제하고 관련 배치도 지웁니다. 계속할까요?")) apply { removeCriterion(it, criterion.id) }
            }
        }
        SyncedField(
            criterion.description.orEmpty(), { text -> apply { setDescription(it, criterion.id, text) } }, "설명",
            placeholder = "이 기준에서 무엇을 보는지 적어 두면 평가할 때 화면에 보여요 (선택)", multiline = true,
        )
        Box { GhostButton((if (rubricOpen) "▾ " else "▸ ") + "티어별 설명 (선택) — 평가 화면에서 S/A/B/C를 누르면 보여요", small = true) { rubricOpen = !rubricOpen } }
        if (rubricOpen) TIERS.forEach { tier ->
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
                TierPill(tier)
                SyncedField(
                    criterion.rubric?.get(tier).orEmpty(), { text -> apply { setRubric(it, criterion.id, tier, text) } }, "$tier 티어 설명",
                    Modifier.weight(1f), placeholder = "${tier}는 어떤 경우인가요? (선택)", multiline = true,
                )
            }
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Stack(Modifier.weight(1f), gap = 4) {
                PointPills(pointsFor(criterion))
                MutedText(if (criterion.points != null) "이 기준만의 점수표" else "기본 점수표")
            }
            GhostButton(if (editing) "접기" else "점수 수정", small = true) { editing = !editing }
        }
        if (editing) PointsEditor(criterion, apply) { editing = false }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun PointsEditor(criterion: Criterion, apply: ((EvalData) -> EvalData) -> Unit, close: () -> Unit) {
    // 기본 점수표를 쓰는 기준도 현재 값을 채워 둔다
    val fields = remember { mutableStateListOf(*TIERS.map { fmt(pointsFor(criterion).getValue(it)) }.toTypedArray()) }
    var error by remember { mutableStateOf<String?>(null) }
    val save = save@{
        val raw = fields.map { it.trim() }
        if (raw.all { it.isEmpty() }) {
            close()
            return@save apply { setPoints(it, criterion.id, null) }
        }
        if (raw.any { it.isEmpty() }) return@save run { error = "S, A, B, C 점수를 모두 입력하거나 모두 비워 주세요" }
        val numbers = raw.map { it.toDoubleOrNull() }
        if (numbers.any { it == null }) return@save run { error = "점수는 숫자만 입력할 수 있어요" }
        val points = TIERS.zip(numbers.map { it!! }).toMap()
        validatePoints(points)?.let { return@save run { error = it } }
        close()
        // 기본 점수표와 같으면 이 기준만의 점수표로 저장하지 않는다
        apply { setPoints(it, criterion.id, if (points == TIER_POINTS) null else points) }
    }
    Stack {
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp), verticalArrangement = Arrangement.spacedBy(8.dp), maxItemsInEachRow = 4) {
            TIERS.forEachIndexed { i, tier ->
                Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    TierPill(tier)
                    OutlinedTextField(
                        fields[i], { fields[i] = it; error = null },
                        Modifier.fillMaxWidth(),
                        placeholder = { Text(fmt(TIER_POINTS.getValue(tier))) },
                        singleLine = true,
                        keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Decimal),
                    )
                }
            }
        }
        error?.let { Callout(Tone.CRITICAL, it) }
        Buttons {
            PrimaryButton("점수 적용", onClick = save)
            GhostButton("기본 점수표로 되돌리기") {
                close()
                apply { setPoints(it, criterion.id, null) }
            }
        }
        MutedText("S > A > B > C 순서여야 하고, 비워 두면 기본 점수표를 써요.")
    }
}

@Composable
private fun CriteriaPanel(data: EvalData, apply: ((EvalData) -> EvalData) -> Unit, messages: Messages) {
    H2("기준 ${data.criteria.size}개")
    NameAdder("기준", "기준 이름을 입력하고 Enter", { name -> apply { addCriterion(it, name) } }, { names -> apply { addCriteria(it, names) } })
    if (data.criteria.isEmpty()) MutedText("아직 기준이 없어요. 무엇을 기준으로 티어를 나눌지 추가해 주세요.")
    data.criteria.forEachIndexed { i, criterion ->
        androidx.compose.runtime.key(criterion.id) { CriterionCard(criterion, i, data.criteria.size, apply) }
    }
    Card {
        H2("기준 가져오기 / 내보내기 (JSON)")
        MutedText("기준의 이름, 설명, 티어 설명, 점수표만 저장해요. 가져오면 현재 기준을 교체하고 배치는 비워져요.")
        Buttons {
            SecondaryButton("기준 내보내기", enabled = data.criteria.isNotEmpty()) { download("sabc-criteria.json", exportCriteriaJson(data), "application/json") }
            SecondaryButton("기준 가져오기") {
                importFile("application/json,.json", messages, ::parseCriteriaJson, "현재 기준을 교체하고 배치를 비웁니다. 계속할까요?") { criteria ->
                    apply { replaceCriteria(it, criteria) }
                }
            }
        }
    }
}

@Composable
private fun OptionsPanel(data: EvalData, apply: ((EvalData) -> EvalData) -> Unit) {
    H2("결과 옵션")
    SwitchRow(
        data.settings?.allowPreview == true,
        "미배치가 있어도 결과 미리보기",
        "켜면 아직 티어를 정하지 않은 칸을 0점으로 계산한 임시 순위를 보여줘요. 끄면 모두 배치해야 결과가 나와요.",
    ) { allowed -> apply { setAllowPreview(it, allowed) } }
}

@Composable
private fun DataPanel(state: AppState, data: EvalData, apply: ((EvalData) -> EvalData) -> Unit, messages: Messages, importJson: () -> Unit) {
    Card {
        H2("전체 백업 (JSON)")
        MutedText("대상자, 기준, 점수표, 배치를 JSON 파일로 저장하거나 불러와요. 파일을 직접 고쳐서 다시 가져와도 돼요. 가져오면 현재 데이터를 교체합니다.")
        Buttons {
            SecondaryButton("JSON 내보내기") { download("tier-eval.json", exportJson(data), "application/json") }
            SecondaryButton("JSON 파일 가져오기", onClick = importJson)
        }
    }
    Card {
        H2("대상자·평가표 (CSV / 엑셀)")
        MutedText("첫 열은 대상자, 나머지 열은 기준 이름이고 칸에는 S/A/B/C를 적어요. 엑셀에서 열어 고친 뒤 CSV로 저장해 가져오세요. 가져오면 대상자와 배치를 교체하고, 열 이름은 현재 기준과 같아야 해요.")
        Buttons {
            SecondaryButton("CSV 내보내기") { download("sabc-sheet.csv", exportSheetCsv(data), "text/csv;charset=utf-8") }
            SecondaryButton("CSV 가져오기") {
                // 파일을 고르는 동안 데이터가 바뀔 수 있으므로 적용 시점의 최신 데이터로 다시 맞춘다
                importFile(".csv,text/csv", messages, { text -> importSheetCsv(state.data ?: data, text) }, "현재 대상자와 배치를 교체합니다. 계속할까요?") { next ->
                    apply { next }
                }
            }
        }
    }
    Card {
        H2("초기화")
        MutedText("대상자, 기준, 배치, 옵션을 모두 지우고 처음 시작 화면으로 돌아가요. 먼저 내보내기로 백업해 두세요.")
        Box { DangerButton("데이터 초기화") { if (confirm("모든 데이터를 지웁니다. 계속할까요?")) apply { emptyData() } } }
    }
}
