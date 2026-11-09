package sabc

import kotlin.math.abs

// 모든 함수는 새 데이터를 반환하고 입력을 변경하지 않는다.

fun nextId(prefix: String, ids: List<String>): String {
    val max = ids.filter { it.startsWith(prefix) }.mapNotNull { it.drop(prefix.length).toIntOrNull() }.maxOrNull() ?: 0
    return "$prefix${max + 1}"
}

fun addSubject(data: EvalData, name: String): EvalData {
    val trimmed = name.trim()
    if (trimmed.isEmpty()) return data
    return data.copy(subjects = data.subjects + Subject(nextId("s", data.subjects.map { it.id }), trimmed))
}

fun addCriterion(data: EvalData, name: String): EvalData {
    val trimmed = name.trim()
    if (trimmed.isEmpty()) return data
    return data.copy(criteria = data.criteria + Criterion(nextId("c", data.criteria.map { it.id }), trimmed))
}

fun addSubjects(data: EvalData, names: List<String>) = names.fold(data, ::addSubject)
fun addCriteria(data: EvalData, names: List<String>) = names.fold(data, ::addCriterion)

fun renameSubject(data: EvalData, id: String, name: String): EvalData {
    val trimmed = name.trim()
    if (trimmed.isEmpty()) return data
    return data.copy(subjects = data.subjects.map { if (it.id == id) it.copy(name = trimmed) else it })
}

private fun EvalData.mapCriterion(id: String, fn: (Criterion) -> Criterion) = copy(criteria = criteria.map { if (it.id == id) fn(it) else it })

fun renameCriterion(data: EvalData, id: String, name: String): EvalData {
    val trimmed = name.trim()
    if (trimmed.isEmpty()) return data
    return data.mapCriterion(id) { it.copy(name = trimmed) }
}

fun removeSubject(data: EvalData, id: String) = data.copy(
    subjects = data.subjects.filter { it.id != id },
    placements = data.placements.mapValues { (_, by) -> by - id },
    adjustments = data.adjustments?.mapValues { (_, by) -> by - id },
)

fun removeCriterion(data: EvalData, id: String) = data.copy(
    criteria = data.criteria.filter { it.id != id },
    placements = data.placements - id,
    adjustments = data.adjustments?.minus(id),
)

private fun <T> List<T>.swapped(from: Int, delta: Int): List<T>? {
    val to = from + delta
    if (from < 0 || to < 0 || to >= size) return null
    return toMutableList().also { it[from] = this[to]; it[to] = this[from] }
}

fun moveCriterion(data: EvalData, id: String, delta: Int): EvalData =
    data.criteria.swapped(data.criteria.indexOfFirst { it.id == id }, delta)?.let { data.copy(criteria = it) } ?: data

fun setPoints(data: EvalData, criterionId: String, points: Map<String, Double>?) = data.mapCriterion(criterionId) { it.copy(points = points) }

/** 보정을 정한다. 0이면 지운다. ±MAX_ADJUST를 넘거나 배치되지 않은 칸이면 무시한다. */
fun setAdjustment(data: EvalData, criterionId: String, subjectId: String, value: Int): EvalData {
    if (abs(value) > MAX_ADJUST) return data
    if (value != 0 && tierOf(data, criterionId, subjectId) == null) return data
    val current = data.adjustments?.get(criterionId)
    if (value == 0 && current?.get(subjectId) == null) return data
    val rest = current.orEmpty() - subjectId
    val byCriterion = if (value == 0) rest else rest + (subjectId to value)
    return data.copy(adjustments = data.adjustments.orEmpty() + (criterionId to byCriterion))
}

fun setPlacement(data: EvalData, criterionId: String, subjectId: String, tier: String?): EvalData {
    val current = data.placements[criterionId].orEmpty()
    val base = if (current[subjectId] != tier) setAdjustment(data, criterionId, subjectId, 0) else data // 티어를 옮기면 보정은 초기화
    val next = if (tier == null) current - subjectId else current + (subjectId to tier)
    return base.copy(placements = base.placements + (criterionId to next))
}

fun applyPreset(subjects: List<String>, criteria: List<CriterionDef>) = EvalData(
    subjects = subjects.mapIndexed { i, name -> Subject("s${i + 1}", name) },
    criteria = criteria.mapIndexed { i, c ->
        Criterion("c${i + 1}", c.name, c.description?.ifEmpty { null }, c.points, c.rubric?.takeIf { it.isNotEmpty() })
    },
)

fun applyPreset(preset: Preset) = applyPreset(preset.subjects, preset.criteria)

fun setAllowPreview(data: EvalData, allowed: Boolean) = data.copy(settings = (data.settings ?: Settings()).copy(allowPreview = allowed))

fun setDescription(data: EvalData, criterionId: String, text: String) =
    data.mapCriterion(criterionId) { it.copy(description = text.trim().ifEmpty { null }) }

/** 기준의 티어 설명 한 칸을 바꾼다. 비우면 그 칸을 지우고, 다 비면 rubric 필드도 없앤다. */
fun setRubric(data: EvalData, criterionId: String, tier: String, text: String) = data.mapCriterion(criterionId) {
    val trimmed = text.trim()
    val others = it.rubric.orEmpty() - tier
    val next = if (trimmed.isEmpty()) others else others + (tier to trimmed)
    it.copy(rubric = next.ifEmpty { null })
}

/** 기준 전체를 바꾼다. 기준 id가 새로 매겨지므로 기존 배치는 비운다. */
fun replaceCriteria(data: EvalData, criteria: List<Criterion>) = data.copy(adjustments = null, criteria = criteria, placements = emptyMap())

// ---- 워크스페이스(평가 여러 개) ----

fun activeEvaluation(ws: Workspace) = ws.evaluations.find { it.id == ws.activeId }

/** 활성 평가의 data만 바꾼다 */
fun updateActive(ws: Workspace, fn: (EvalData) -> EvalData) =
    ws.copy(evaluations = ws.evaluations.map { if (it.id == ws.activeId) it.copy(data = fn(it.data)) else it })

/** 새 평가를 만들고 그쪽으로 이동한다. 이름이 비면 "평가 N". */
fun addEvaluation(ws: Workspace, name: String = "", data: EvalData = emptyData()): Workspace {
    val id = nextId("e", ws.evaluations.map { it.id })
    val label = name.trim().ifEmpty { "평가 ${id.drop(1)}" }
    return ws.copy(activeId = id, evaluations = ws.evaluations + Evaluation(id, label, data))
}

fun renameEvaluation(ws: Workspace, id: String, name: String): Workspace {
    val trimmed = name.trim()
    if (trimmed.isEmpty()) return ws
    return ws.copy(evaluations = ws.evaluations.map { if (it.id == id) it.copy(name = trimmed) else it })
}

fun switchEvaluation(ws: Workspace, id: String) = if (ws.evaluations.any { it.id == id }) ws.copy(activeId = id) else ws

/** 활성 평가를 지우면 앞 평가(없으면 다음)로 옮긴다. 전부 지우면 activeId는 null. */
fun removeEvaluation(ws: Workspace, id: String): Workspace {
    val index = ws.evaluations.indexOfFirst { it.id == id }
    if (index < 0) return ws
    val evaluations = ws.evaluations.filter { it.id != id }
    val activeId = if (ws.activeId != id) ws.activeId else evaluations.getOrNull(maxOf(0, index - 1))?.id
    return ws.copy(activeId = activeId, evaluations = evaluations)
}

fun moveEvaluation(ws: Workspace, id: String, delta: Int): Workspace =
    ws.evaluations.swapped(ws.evaluations.indexOfFirst { it.id == id }, delta)?.let { ws.copy(evaluations = it) } ?: ws
