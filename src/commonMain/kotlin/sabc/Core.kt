package sabc

import kotlinx.serialization.KSerializer
import kotlinx.serialization.Serializable
import kotlinx.serialization.descriptors.PrimitiveKind
import kotlinx.serialization.descriptors.PrimitiveSerialDescriptor
import kotlinx.serialization.encoding.Decoder
import kotlinx.serialization.encoding.Encoder
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonEncoder
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.longOrNull
import kotlin.math.abs
import kotlin.math.floor
import kotlin.math.round

val TIERS = listOf("S", "A", "B", "C")
val TIER_POINTS: Map<String, Double> = mapOf("S" to 30.0, "A" to 20.0, "B" to 15.0, "C" to 10.0)

// 티어 안 보정(±). 한 단계 = 기준의 가장 좁은 티어 간격 / 5, 최대 ±2단계.
// 어느 방향으로 최대로 줘도 2 * 2 * 단위 = 간격의 80% 이하라서 티어 순서가 뒤집히지 않는다.
const val MAX_ADJUST = 2

// ---- 데이터 모델 (웹 JS 버전과 같은 JSON 형식. 없는 선택 필드는 null로 두고 저장할 때 빠진다) ----

/** 정수인 점수는 30.0이 아니라 30으로 저장해 예전 파일·사람이 고친 파일과 같은 모양을 유지한다. */
object NumSerializer : KSerializer<Double> {
    override val descriptor = PrimitiveSerialDescriptor("sabc.Num", PrimitiveKind.DOUBLE)
    override fun deserialize(decoder: Decoder) = decoder.decodeDouble()
    override fun serialize(encoder: Encoder, value: Double) {
        val json = encoder as? JsonEncoder ?: return encoder.encodeDouble(value)
        json.encodeJsonElement(if (isWhole(value)) JsonPrimitive(value.toLong()) else JsonPrimitive(value))
    }
}

typealias Points = Map<String, @Serializable(with = NumSerializer::class) Double>

@Serializable
data class Subject(val id: String, val name: String)

@Serializable
data class Criterion(
    val id: String,
    val name: String,
    val description: String? = null,
    val points: Points? = null,
    val rubric: Map<String, String>? = null,
)

@Serializable
data class Settings(val allowPreview: Boolean? = null)

@Serializable
data class EvalData(
    val version: Int = 1,
    val subjects: List<Subject> = emptyList(),
    val criteria: List<Criterion> = emptyList(),
    val placements: Map<String, Map<String, String>> = emptyMap(),
    val settings: Settings? = null,
    val adjustments: Map<String, Map<String, Int>>? = null,
)

@Serializable
data class Evaluation(val id: String, val name: String, val data: EvalData)

@Serializable
data class Workspace(val version: Int = 2, val activeId: String?, val evaluations: List<Evaluation>)

/** 기준 정의(id 없음): 기준 JSON 파일, preset, 새 평가 양식이 같이 쓴다. */
@Serializable
data class CriterionDef(
    val name: String,
    val description: String? = null,
    val points: Points? = null,
    val rubric: Map<String, String>? = null,
)

data class Parsed<T>(val value: T?, val errors: List<String>)

/** localStorage용: 들여쓰기 없이 */
val compactJson = Json {
    explicitNulls = false
    encodeDefaults = true
    ignoreUnknownKeys = true
}

/** 내보내기 파일용: 사람이 고치기 쉽게 2칸 들여쓰기 */
val json = Json(compactJson) {
    prettyPrint = true
    prettyPrintIndent = "  "
}

fun isWhole(value: Double) = value.isFinite() && value == floor(value) && abs(value) < 1e15

/** 화면 표시용 숫자: 30.0 → "30" */
fun fmt(value: Double): String = if (isWhole(value)) value.toLong().toString() else value.toString()

fun emptyData() = EvalData()

fun pointsFor(criterion: Criterion): Map<String, Double> = criterion.points ?: TIER_POINTS

private fun JsonElement?.asObject() = this as? JsonObject
private fun JsonElement?.asString() = (this as? JsonPrimitive)?.takeIf { it.isString }?.content
private fun JsonElement?.asNumber() = (this as? JsonPrimitive)?.takeIf { !it.isString }?.doubleOrNull

fun validatePoints(points: Map<String, Double>): String? = validatePoints(JsonObject(points.mapValues { JsonPrimitive(it.value) }))

fun validatePoints(points: JsonElement?): String? {
    val obj = points.asObject() ?: return "점수표는 S/A/B/C 값을 가진 객체여야 합니다"
    val values = TIERS.map { tier ->
        val value = obj[tier].asNumber()
        if (value == null || !value.isFinite()) return "$tier 점수는 숫자여야 합니다"
        if (value < 0) return "$tier 점수는 0 이상이어야 합니다"
        value
    }
    for (i in 0 until TIERS.size - 1) {
        if (!(values[i] > values[i + 1])) return "${TIERS[i]} 점수는 ${TIERS[i + 1]} 점수보다 커야 합니다"
    }
    return null
}

fun adjustmentUnit(criterion: Criterion): Double {
    val points = pointsFor(criterion)
    val gap = (0 until TIERS.size - 1).minOf { points.getValue(TIERS[it]) - points.getValue(TIERS[it + 1]) }
    return gap / (2 * MAX_ADJUST + 1)
}

fun adjustmentOf(data: EvalData, criterionId: String, subjectId: String): Int = data.adjustments?.get(criterionId)?.get(subjectId) ?: 0

fun tierOf(data: EvalData, criterionId: String, subjectId: String): String? =
    data.placements[criterionId]?.get(subjectId)?.takeIf { it in TIERS }

enum class Status { EMPTY, LOCKED, PREVIEW, READY }

data class ResultRow(
    val subjectId: String,
    val name: String,
    val total: Double,
    val sCount: Int,
    val tiers: Map<String, String?>,
    val rank: Int = 0,
)

data class Results(val status: Status, val missing: Int, val rows: List<ResultRow>)

fun computeResults(data: EvalData): Results {
    if (data.subjects.isEmpty() || data.criteria.isEmpty()) return Results(Status.EMPTY, 0, emptyList())
    var missing = 0
    val rows = data.subjects.map { subject ->
        var total = 0.0
        var sCount = 0
        val tiers = LinkedHashMap<String, String?>()
        for (criterion in data.criteria) {
            val tier = tierOf(data, criterion.id, subject.id)
            tiers[criterion.id] = tier
            if (tier == null) {
                missing++
                continue
            }
            total += pointsFor(criterion).getValue(tier) + adjustmentUnit(criterion) * adjustmentOf(data, criterion.id, subject.id)
            if (tier == "S") sCount++
        }
        // 소수 점수표의 부동소수점 오차로 동점이 갈리지 않게 반올림해서 비교한다
        ResultRow(subject.id, subject.name, round(total * 1e6) / 1e6, sCount, tiers)
    }
    // 미리보기를 켜면 미배치 칸은 0점으로 계산한 임시 결과를 낸다
    if (missing > 0 && data.settings?.allowPreview != true) return Results(Status.LOCKED, missing, emptyList())

    fun better(a: ResultRow, b: ResultRow) = a.total > b.total || (a.total == b.total && a.sCount > b.sCount)
    val ranked = rows.map { row -> row.copy(rank = 1 + rows.count { better(it, row) }) }.sortedBy { it.rank }
    return Results(if (missing > 0) Status.PREVIEW else Status.READY, missing, ranked)
}

data class Progress(val placed: Int, val total: Int)

fun progress(data: EvalData, criterionId: String): Progress {
    val placements = data.placements[criterionId].orEmpty()
    return Progress(data.subjects.count { placements[it.id] in TIERS }, data.subjects.size)
}

// ---- 검증: 가져온 JSON(사람이 고친 파일 포함)을 데이터 클래스로 읽기 전에 위치별 오류를 모은다 ----

fun validateData(data: JsonElement?): List<String> {
    val obj = data.asObject() ?: return listOf("data: 객체여야 합니다")
    val errors = mutableListOf<String>()
    if ((obj["version"] as? JsonPrimitive)?.takeIf { !it.isString }?.longOrNull != 1L) errors += "version: 1이어야 합니다"
    obj["settings"]?.let { settings ->
        val s = settings.asObject()
        if (s == null) errors += "settings: 객체여야 합니다"
        else s["allowPreview"]?.let {
            if ((it as? JsonPrimitive)?.takeIf { p -> !p.isString }?.booleanOrNull == null) errors += "settings.allowPreview: true 또는 false여야 합니다"
        }
    }

    val ids = mapOf("subjects" to mutableSetOf<String>(), "criteria" to mutableSetOf())
    for (key in listOf("subjects", "criteria")) {
        val items = obj[key] as? JsonArray
        if (items == null) {
            errors += "$key: 배열이어야 합니다"
            continue
        }
        items.forEachIndexed { i, element ->
            val path = "$key[$i]"
            val item = element.asObject()
            if (item == null) {
                errors += "$path: 객체여야 합니다"
                return@forEachIndexed
            }
            val id = item["id"].asString()
            when {
                id.isNullOrEmpty() -> errors += "$path.id: 비어 있지 않은 문자열이어야 합니다"
                id in ids.getValue(key) -> errors += "$path.id: 중복된 id입니다 ($id)"
                else -> ids.getValue(key).add(id)
            }
            if (item["name"].asString().isNullOrBlank()) errors += "$path.name: 비어 있지 않은 문자열이어야 합니다"
            if (key != "criteria") return@forEachIndexed
            item["description"]?.let { if (it.asString() == null) errors += "$path.description: 문자열이어야 합니다" }
            item["rubric"]?.let { rubric ->
                val r = rubric.asObject()
                if (r == null) errors += "$path.rubric: 객체여야 합니다"
                else for ((tier, text) in r) {
                    if (tier !in TIERS) errors += "$path.rubric.$tier: S/A/B/C 중 하나여야 합니다"
                    else if (text.asString() == null) errors += "$path.rubric.$tier: 문자열이어야 합니다"
                }
            }
            item["points"]?.let { points -> validatePoints(points)?.let { errors += "$path.points: $it" } }
        }
    }

    val placements = obj["placements"].asObject()
    if (placements == null) {
        errors += "placements: 객체여야 합니다"
        return errors
    }
    val subjectIds = ids.getValue("subjects")
    val criterionIds = ids.getValue("criteria")
    obj["adjustments"]?.let { adjustments ->
        val a = adjustments.asObject()
        if (a == null) errors += "adjustments: 객체여야 합니다"
        else for ((criterionId, byCriterion) in a) {
            if (criterionId !in criterionIds) errors += "adjustments.$criterionId: 존재하지 않는 기준입니다"
            else if (byCriterion.asObject() == null) errors += "adjustments.$criterionId: 객체여야 합니다"
            else for ((subjectId, value) in byCriterion.jsonObject) {
                val n = (value as? JsonPrimitive)?.takeIf { !it.isString }?.intOrNull
                if (subjectId !in subjectIds) errors += "adjustments.$criterionId.$subjectId: 존재하지 않는 대상자입니다"
                else if (n == null || abs(n) > MAX_ADJUST) errors += "adjustments.$criterionId.$subjectId: -$MAX_ADJUST~$MAX_ADJUST 사이 정수여야 합니다"
            }
        }
    }
    for ((criterionId, byCriterion) in placements) {
        if (criterionId !in criterionIds) {
            errors += "placements.$criterionId: 존재하지 않는 기준입니다"
            continue
        }
        val b = byCriterion.asObject()
        if (b == null) {
            errors += "placements.$criterionId: 객체여야 합니다"
            continue
        }
        for ((subjectId, tier) in b) {
            if (subjectId !in subjectIds) errors += "placements.$criterionId.$subjectId: 존재하지 않는 대상자입니다"
            else if (tier.asString() !in TIERS) errors += "placements.$criterionId.$subjectId: 티어는 S/A/B/C 중 하나여야 합니다"
        }
    }
    return errors
}

fun validateData(data: EvalData): List<String> = validateData(json.encodeToJsonElement(EvalData.serializer(), data))

private fun parseJson(text: String): Pair<JsonElement?, String?> = try {
    json.parseToJsonElement(text) to null
} catch (e: Exception) {
    null to "JSON 형식이 올바르지 않습니다: ${e.message}"
}

fun parseImportJson(text: String): Parsed<EvalData> {
    val (parsed, error) = parseJson(text)
    if (error != null) return Parsed(null, listOf(error))
    val errors = validateData(parsed)
    return if (errors.isNotEmpty()) Parsed(null, errors) else Parsed(json.decodeFromJsonElement(EvalData.serializer(), parsed!!), emptyList())
}

fun exportJson(data: EvalData): String = json.encodeToString(EvalData.serializer(), data)

fun parseNames(text: String): List<String> = text.split(Regex("[\n,]+")).map { it.trim() }.filter { it.isNotEmpty() }

// ---- 워크스페이스: 평가(대상자+기준+배치) 여러 개를 담는 최상위 저장 형식 ----

fun emptyWorkspace() = Workspace(2, "e1", listOf(Evaluation("e1", "평가 1", emptyData())))

/** 저장된 값을 워크스페이스로 바꾼다. 예전 단일 평가 데이터(version 1)는 평가 하나로 감싼다. 못 읽으면 null. */
fun toWorkspace(raw: JsonElement?): Workspace? {
    val obj = raw.asObject()
    if (obj != null && (obj["version"] as? JsonPrimitive)?.longOrNull == 1L && "evaluations" !in obj) {
        if (validateData(raw).isNotEmpty()) return null
        return Workspace(2, "e1", listOf(Evaluation("e1", "평가 1", json.decodeFromJsonElement(EvalData.serializer(), raw!!))))
    }
    return if (validateWorkspace(raw).isEmpty()) json.decodeFromJsonElement(Workspace.serializer(), raw!!) else null
}

fun validateWorkspace(ws: Workspace): List<String> = validateWorkspace(json.encodeToJsonElement(Workspace.serializer(), ws))

fun validateWorkspace(raw: JsonElement?): List<String> {
    val ws = raw.asObject() ?: return listOf("workspace: 객체여야 합니다")
    val errors = mutableListOf<String>()
    if ((ws["version"] as? JsonPrimitive)?.takeIf { !it.isString }?.longOrNull != 2L) errors += "version: 2여야 합니다"
    val evaluations = ws["evaluations"] as? JsonArray ?: return errors + "evaluations: 배열이어야 합니다"
    // 저장할 때 null 필드는 빠지므로 activeId가 없으면 null로 본다
    val activeId = ws["activeId"] ?: JsonNull
    // 평가를 모두 지운 상태: 목록이 비어 있고 activeId가 null
    if (evaluations.isEmpty()) return if (activeId == JsonNull) errors else errors + "activeId: 평가가 없으면 null이어야 합니다"
    val ids = mutableSetOf<String>()
    evaluations.forEachIndexed { i, element ->
        val path = "evaluations[$i]"
        val ev = element.asObject()
        if (ev == null) {
            errors += "$path: 객체여야 합니다"
            return@forEachIndexed
        }
        val id = ev["id"].asString()
        if (id.isNullOrEmpty() || id in ids) errors += "$path.id: 비어 있지 않은 고유 문자열이어야 합니다" else ids += id
        if (ev["name"].asString().isNullOrBlank()) errors += "$path.name: 비어 있지 않은 문자열이어야 합니다"
        for (message in validateData(ev["data"])) errors += "$path.data.$message"
    }
    if (activeId.asString() !in ids) errors += "activeId: 존재하는 평가 id여야 합니다"
    return errors
}

// ---- 대상자+평가표 CSV (엑셀에서 열고 저장 가능) ----
// 첫 열은 대상자 이름, 나머지 열은 기준 이름이고 칸에는 S/A/B/C 또는 빈칸을 쓴다.

private fun csvCell(value: String) = if (value.any { it == '"' || it == ',' || it == '\r' || it == '\n' }) "\"${value.replace("\"", "\"\"")}\"" else value

/** 엑셀이 한글 UTF-8로 인식하도록 맨 앞에 BOM을 붙인다 */
fun exportSheetCsv(data: EvalData): String {
    val lines = listOf(listOf("대상자") + data.criteria.map { it.name }) +
        data.subjects.map { s -> listOf(s.name) + data.criteria.map { c -> data.placements[c.id]?.get(s.id) ?: "" } }
    return "﻿" + lines.joinToString("\r\n") { row -> row.joinToString(",") { csvCell(it) } } + "\r\n"
}

/** 따옴표·줄바꿈·구분자를 지원하는 최소 CSV 파서. 엑셀의 세미콜론/탭 구분은 지원하지 않는다. */
fun parseCsv(text: String): List<List<String>> {
    val rows = mutableListOf<List<String>>()
    var row = mutableListOf<String>()
    val cell = StringBuilder()
    var quoted = false
    val src = text.removePrefix("﻿")
    var i = 0
    while (i < src.length) {
        val ch = src[i]
        if (quoted) {
            if (ch == '"' && src.getOrNull(i + 1) == '"') { cell.append('"'); i++ }
            else if (ch == '"') quoted = false
            else cell.append(ch)
        } else if (ch == '"') quoted = true
        else if (ch == ',') { row += cell.toString(); cell.clear() }
        else if (ch == '\n' || ch == '\r') {
            if (ch == '\r' && src.getOrNull(i + 1) == '\n') i++
            row += cell.toString(); rows += row; row = mutableListOf(); cell.clear()
        } else cell.append(ch)
        i++
    }
    if (cell.isNotEmpty() || row.isNotEmpty()) { row += cell.toString(); rows += row }
    return rows.filter { r -> r.any { it.isNotBlank() } }
}

/** CSV로 대상자와 배치를 교체한다. 기준은 현재 기준과 이름으로 맞춘다. 오류가 있으면 value는 null. */
fun importSheetCsv(data: EvalData, text: String): Parsed<EvalData> {
    val rows = parseCsv(text)
    if (rows.isEmpty()) return Parsed(null, listOf("비어 있는 파일입니다"))
    val errors = mutableListOf<String>()
    val header = rows.first()
    val columns = header.drop(1).map { it.trim() }
    val byName = data.criteria.associateBy { it.name }
    val seen = mutableSetOf<String>()
    columns.forEachIndexed { i, name ->
        if (name !in byName) errors += "${i + 2}열 '$name': 현재 기준에 없는 이름입니다. 기준을 먼저 설정하거나 가져오세요"
        else if (name in seen) errors += "${i + 2}열 '$name': 중복된 기준 열입니다"
        seen += name
    }
    val subjects = mutableListOf<Subject>()
    val placements = LinkedHashMap<String, Map<String, String>>()
    val names = mutableSetOf<String>()
    rows.drop(1).forEachIndexed { r, cells ->
        val name = cells.getOrElse(0) { "" }.trim()
        if (name.isEmpty()) { errors += "${r + 2}행: 대상자 이름이 비어 있습니다"; return@forEachIndexed }
        if (name in names) { errors += "${r + 2}행 '$name': 중복된 대상자입니다"; return@forEachIndexed }
        names += name
        val id = "s${subjects.size + 1}"
        subjects += Subject(id, name)
        columns.forEachIndexed { i, column ->
            val raw = cells.getOrElse(i + 1) { "" }.trim()
            val tier = raw.uppercase()
            val criterion = byName[column]
            if (tier.isEmpty() || criterion == null) return@forEachIndexed
            if (tier !in TIERS) { errors += "${r + 2}행 '$name', '$column': 티어는 S/A/B/C 또는 빈칸이어야 합니다 ($raw)"; return@forEachIndexed }
            placements[criterion.id] = placements[criterion.id].orEmpty() + (id to tier)
        }
    }
    return if (errors.isNotEmpty()) Parsed(null, errors) else Parsed(data.copy(adjustments = null, subjects = subjects, placements = placements), emptyList())
}

// ---- 평가 기준 JSON (이름·설명·점수표만. 대상자와 배치는 빠진다) ----

@Serializable
private data class CriteriaFile(val version: Int = 1, val criteria: List<CriterionDef>)

fun Criterion.toDef() = CriterionDef(name, description?.ifEmpty { null }, points, rubric)

fun exportCriteriaJson(data: EvalData): String =
    json.encodeToString(CriteriaFile.serializer(), CriteriaFile(1, data.criteria.map { it.toDef() }))

fun parseCriteriaJson(text: String): Parsed<List<Criterion>> {
    val (parsed, error) = parseJson(text)
    if (error != null) return Parsed(null, listOf(error))
    val obj = parsed.asObject()
    val list = obj?.get("criteria") as? JsonArray
    if (obj == null || (obj["version"] as? JsonPrimitive)?.longOrNull != 1L || list == null) {
        return Parsed(null, listOf("{ \"version\": 1, \"criteria\": [...] } 형식이어야 합니다"))
    }
    // 임시 id를 붙여 기존 데이터 검증을 재사용한다
    val criteria = list.mapIndexed { i, c -> c.asObject()?.let { JsonObject(it + ("id" to JsonPrimitive("c${i + 1}"))) } ?: c }
    val errors = validateData(
        JsonObject(mapOf("version" to JsonPrimitive(1), "subjects" to JsonArray(emptyList()), "criteria" to JsonArray(criteria), "placements" to JsonObject(emptyMap()))),
    ).toMutableList()
    if (criteria.map { it.asObject()?.get("name") }.toSet().size != criteria.size) errors += "criteria: 기준 이름이 중복되었습니다"
    return if (errors.isNotEmpty()) Parsed(null, errors) else Parsed(criteria.map { json.decodeFromJsonElement(Criterion.serializer(), it) }, emptyList())
}
