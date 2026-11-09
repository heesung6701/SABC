package sabc

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Surface
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties

@Composable
private fun SabcDialog(onDismiss: () -> Unit, content: @Composable () -> Unit) =
    Dialog(onDismiss, DialogProperties(usePlatformDefaultWidth = false)) {
        Surface(Modifier.widthIn(max = 640.dp).fillMaxWidth().padding(16.dp), shape = RoundedCornerShape(16.dp)) {
            Column(Modifier.heightIn(max = 900.dp).verticalScroll(rememberScrollState()).padding(20.dp)) { content() }
        }
    }

@Composable
private fun EndButtons(content: @Composable () -> Unit) =
    Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.End)) { content() }

private class Template(val key: String, val label: String, val hint: String, val subjects: List<String>, val criteria: List<CriterionDef>)

private class CriterionRow(val id: Int, name: String, description: String, val points: Map<String, Double>?, val rubric: Map<String, String>?) {
    var name by mutableStateOf(name)
    var description by mutableStateOf(description)
}

/** "새 평가" 양식: 이름 + 시작 내용(preset 또는 기존 평가 복사)을 고르면 대상자·기준이 채워지고, 만들기 전에 고칠 수 있다. */
@Composable
fun NewEvaluationForm(state: AppState, onDone: (() -> Unit)?) {
    val templates = remember {
        PRESETS.map { Template("preset:${it.id}", it.name, it.summary, it.subjects, it.criteria) } +
            state.ws.evaluations.map { e ->
                Template("eval:${e.id}", "복사: ${e.name}", "대상자와 기준을 가져오고 배치는 비워요", e.data.subjects.map { it.name }, e.data.criteria.map { it.toDef() })
            }
    }
    var selected by remember { mutableStateOf(templates.first { it.key == "preset:empty" }) }
    var name by remember { mutableStateOf("") }
    var autoName by remember { mutableStateOf("") } // 마지막으로 자동 입력한 이름. 사용자가 고친 이름은 덮어쓰지 않는다.
    var subjects by remember { mutableStateOf("") }
    val rows = remember { mutableStateListOf<CriterionRow>() }
    var nextRowId by remember { mutableStateOf(0) }
    val newRow = { c: CriterionDef -> CriterionRow(nextRowId++, c.name, c.description.orEmpty(), c.points, c.rubric) }

    val fill = { t: Template ->
        selected = t
        if (name.trim() == autoName) {
            autoName = if (t.key == "preset:empty") "" else t.label // 빈 평가는 비워 둬서 자동 이름(평가 N) 사용
            name = autoName
        }
        subjects = t.subjects.joinToString("\n")
        rows.clear()
        rows.addAll(t.criteria.map(newRow))
    }

    val create = {
        val criteria = rows.map { CriterionDef(it.name.trim(), it.description.trim(), it.points, it.rubric) }.filter { it.name.isNotEmpty() }
        val data = applyPreset(parseNames(subjects), criteria)
        onDone?.invoke()
        state.commitWorkspace { addEvaluation(it, name, data) }
        if (state.screen != Screen.EVALUATE) state.go(Screen.EVALUATE) // 만든 뒤에는 평가 탭으로
    }

    Stack {
        H2("새 평가")
        InputField(name, { name = it }, "이름", placeholder = "비우면 자동으로 정해요 (평가 ${state.ws.evaluations.size + 1})")
        Stack(gap = 4) {
            MutedText("시작 내용 — 고르면 아래 내용이 채워져요. 만들기 전에 자유롭게 고칠 수 있어요.")
            Picker(templates.map { it.key to it.label }, selected.key, { key -> fill(templates.first { it.key == key }) })
            MutedText(selected.hint)
        }
        InputField(subjects, { subjects = it }, "대상자", placeholder = "줄바꿈 또는 쉼표로 구분 (나중에 설정에서도 추가할 수 있어요)", multiline = true)
        MutedText("기준")
        rows.forEach { row ->
            key(row.id) {
                Card {
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        InputField(row.name, { row.name = it }, "기준 이름", Modifier.weight(1f))
                        GhostButton("삭제", danger = true) { rows.remove(row) }
                    }
                    InputField(row.description, { row.description = it }, "${row.name.ifBlank { "기준" }} 설명", placeholder = "설명 (선택)", multiline = true)
                }
            }
        }
        Box { GhostButton("+ 기준 추가", small = true) { rows.add(newRow(CriterionDef(""))) } }
        EndButtons {
            onDone?.let { SecondaryButton("취소", onClick = it) }
            PrimaryButton("만들기", onClick = create)
        }
    }
}

@Composable
fun NewEvaluationDialog(state: AppState, onClose: () -> Unit) = SabcDialog(onClose) { NewEvaluationForm(state, onClose) }

/** "평가 목록" 팝업: 이름 변경, 이동, 순서, 삭제 */
@Composable
fun EvaluationsDialog(state: AppState, onClose: () -> Unit) {
    var deleting by remember { mutableStateOf<Evaluation?>(null) }
    SabcDialog(onClose) {
        val list = state.ws.evaluations
        Stack {
            H2("평가 ${list.size}개")
            MutedText("평가마다 대상자, 기준, 배치, 옵션이 따로 저장돼요.")
            list.forEachIndexed { i, e ->
                key(e.id) {
                    val isActive = e.id == state.ws.activeId
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        SyncedField(e.name, { name -> state.commitWorkspace { renameEvaluation(it, e.id, name) } }, "평가 이름", Modifier.weight(1f), revertBlank = true)
                        if (isActive) SecondaryButton("현재", enabled = false) {} else PrimaryButton("이동") { state.commitWorkspace { switchEvaluation(it, e.id) } }
                        GhostButton("↑", enabled = i > 0) { state.commitWorkspace { moveEvaluation(it, e.id, -1) } }
                        GhostButton("↓", enabled = i < list.size - 1) { state.commitWorkspace { moveEvaluation(it, e.id, 1) } }
                        GhostButton("삭제", danger = true) { deleting = e }
                    }
                }
            }
            EndButtons { SecondaryButton("닫기", onClick = onClose) }
        }
    }
    deleting?.let { e ->
        DeleteEvaluationDialog(e, onCancel = { deleting = null }) {
            deleting = null
            if (state.ws.evaluations.size == 1) onClose() // 마지막 평가: 목록 팝업을 닫으면 평가 만들기 화면이 뜬다
            state.commitWorkspace { removeEvaluation(it, e.id) }
        }
    }
}

/** 삭제 확인: 경고를 보여주고 평가 이름을 똑같이 입력해야 지운다. */
@Composable
private fun DeleteEvaluationDialog(e: Evaluation, onCancel: () -> Unit, onConfirm: () -> Unit) = SabcDialog(onCancel) {
    var typed by remember { mutableStateOf("") }
    Stack {
        H2("평가 삭제")
        Callout(Tone.CRITICAL, "'${e.name}'을(를) 삭제합니다", "대상자, 기준, 점수표, 배치, 옵션이 모두 사라지고 되돌릴 수 없어요. 필요하면 먼저 설정에서 JSON으로 내보내 백업하세요.")
        InputField(typed, { typed = it }, "삭제하려면 평가 이름 \"${e.name}\"을(를) 그대로 입력하세요", placeholder = e.name)
        EndButtons {
            SecondaryButton("취소", onClick = onCancel)
            DangerButton("삭제", enabled = typed == e.name, onClick = onConfirm)
        }
    }
}
