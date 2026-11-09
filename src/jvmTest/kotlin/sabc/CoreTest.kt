package sabc

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import java.io.File
import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

// 웹(JS) 시절과 같은 공용 fixtures. Android 등 다른 구현도 같은 파일로 검증한다.
val cases: JsonArray = json.parseToJsonElement(File("tests/fixtures/scoring.json").readText()).jsonArray
fun caseRaw(name: String): JsonElement = cases.first { it.jsonObject["name"]!!.jsonPrimitive.content == name }.jsonObject["data"]!!
fun case(name: String): EvalData = json.decodeFromJsonElement(EvalData.serializer(), caseRaw(name))

/** JsonElement를 경로(키 목록)를 따라 고친다: 검증 테스트에서 "사람이 잘못 고친 파일"을 만든다. */
fun JsonElement.with(vararg path: Any, value: JsonElement?): JsonElement {
    val key = path.first()
    val rest = path.drop(1).toTypedArray()
    fun next(child: JsonElement?) = if (rest.isEmpty()) value else child!!.with(*rest, value = value)
    return when (this) {
        is JsonObject -> {
            val m = LinkedHashMap(this)
            val v = next(this[key as String])
            if (v == null) m.remove(key) else m[key] = v
            JsonObject(m)
        }
        is JsonArray -> JsonArray(mapIndexed { i, e -> if (i == key) next(e)!! else e })
        else -> error("not a container")
    }
}

fun p(v: Any?): JsonElement = when (v) {
    null -> kotlinx.serialization.json.JsonNull
    is String -> JsonPrimitive(v)
    is Number -> JsonPrimitive(v)
    is Boolean -> JsonPrimitive(v)
    is Map<*, *> -> JsonObject(v.entries.associate { (k, x) -> k as String to p(x) })
    is List<*> -> JsonArray(v.map { p(it) })
    is JsonElement -> v
    else -> error("unsupported $v")
}

class CoreTest {
    @Test
    fun computeResultsMatchesEveryFixtureCase() {
        for (c in cases) {
            val name = c.jsonObject["name"]!!.jsonPrimitive.content
            val expected = c.jsonObject["expected"]!!.jsonObject
            val result = computeResults(case(name))
            assertEquals(expected["status"]!!.jsonPrimitive.content, result.status.name.lowercase(), "$name: status")
            assertEquals(expected["missing"]!!.jsonPrimitive.int, result.missing, "$name: missing")
            val rows = expected["rows"]!!.jsonArray.map { r ->
                val o = r.jsonObject
                listOf(o["subjectId"]!!.jsonPrimitive.content, o["total"]!!.jsonPrimitive.content.toDouble(), o["sCount"]!!.jsonPrimitive.int, o["rank"]!!.jsonPrimitive.int)
            }
            assertEquals(rows, result.rows.map { listOf(it.subjectId, it.total, it.sCount, it.rank) }, "$name: rows")
        }
    }

    @Test
    fun computeResultsFillsTiersPerCriterion() {
        val rows = computeResults(case("ranking-1-1-3")).rows
        assertEquals(mapOf("c1" to "A", "c2" to "A"), rows.first { it.subjectId == "s2" }.tiers)
    }

    @Test
    fun pointsForFallsBackToTierPoints() {
        assertEquals(TIER_POINTS, pointsFor(Criterion("c1", "x")))
        val points = mapOf("S" to 10.0, "A" to 5.0, "B" to 2.0, "C" to 0.0)
        assertEquals(points, pointsFor(Criterion("c1", "x", points = points)))
    }

    @Test
    fun validatePointsAcceptsStrictlyDecreasingNonNegative() {
        assertNull(validatePoints(mapOf("S" to 4.0, "A" to 3.0, "B" to 2.0, "C" to 1.0)))
        assertNull(validatePoints(mapOf("S" to 0.3, "A" to 0.2, "B" to 0.1, "C" to 0.0)))
    }

    @Test
    fun validatePointsRejectsBadTables() {
        val bad = listOf(
            p(mapOf("S" to 1, "A" to 1, "B" to 0, "C" to 0)),
            p(mapOf("S" to 4, "A" to 3, "B" to 2, "C" to -1)),
            p(mapOf("S" to "4", "A" to 3, "B" to 2, "C" to 1)),
            p(mapOf("S" to 4, "A" to 3, "B" to 2)),
            p(mapOf("S" to 4, "A" to 3, "B" to 2, "C" to Double.NaN)),
            p(null),
            p(emptyList<Any>()),
        )
        for (points in bad) assertTrue(validatePoints(points) is String, points.toString())
    }

    @Test
    fun progressCountsOnlyExistingSubjects() {
        val data = EvalData(
            subjects = listOf(Subject("s1", "a"), Subject("s2", "b"), Subject("s3", "c")),
            criteria = listOf(Criterion("c1", "x")),
            placements = mapOf("c1" to mapOf("s1" to "S", "s9" to "A")),
        )
        assertEquals(Progress(1, 3), progress(data, "c1"))
    }

    @Test
    fun twentySubjectsSixCriteriaAllGetARank() {
        val subjects = List(20) { Subject("s${it + 1}", "대상${it + 1}") }
        val criteria = List(6) { Criterion("c${it + 1}", "기준${it + 1}") }
        val placements = criteria.mapIndexed { j, c -> c.id to subjects.mapIndexed { i, s -> s.id to TIERS[(i + j) % 4] }.toMap() }.toMap()
        val result = computeResults(EvalData(subjects = subjects, criteria = criteria, placements = placements))
        assertEquals(Status.READY, result.status)
        assertEquals(20, result.rows.size)
        assertTrue(result.rows.all { it.rank in 1..20 })
    }

    private val validBase get() = caseRaw("ranking-1-1-3")

    @Test
    fun validateDataAcceptsValidData() = assertEquals(emptyList(), validateData(validBase))

    @Test
    fun validateDataReportsTheLocationOfEachProblem() {
        val mutations = listOf<Pair<String, JsonElement>>(
            "version" to validBase.with("version", value = p(2)),
            "subjects" to validBase.with("subjects", 1, "id", value = p("s1")),
            "subjects[0].name" to validBase.with("subjects", 0, "name", value = p("")),
            "criteria" to validBase.with("criteria", 1, "id", value = p("c1")),
            "criteria[0].points" to validBase.with("criteria", 0, "points", value = p(mapOf("S" to 1, "A" to 1, "B" to 0, "C" to 0))),
            "placements.c9" to validBase.with("placements", "c9", value = p(emptyMap<String, Any>())),
            "placements.c1.s9" to validBase.with("placements", "c1", "s9", value = p("S")),
            "placements.c1.s1" to validBase.with("placements", "c1", "s1", value = p("X")),
        )
        for ((path, data) in mutations) {
            val errors = validateData(data)
            assertTrue(errors.isNotEmpty(), "$path: no errors")
            assertTrue(errors.joinToString("\n").contains(path), "$path: got ${errors.joinToString(" | ")}")
        }
    }

    @Test
    fun validateDataNeverThrowsOnGarbage() {
        for (garbage in listOf(p(null), p(emptyList<Any>()), p("x"), p(42), p(emptyMap<String, Any>()), p(mapOf("version" to 1, "subjects" to emptyMap<String, Any>())))) {
            assertTrue(validateData(garbage).isNotEmpty(), garbage.toString())
        }
    }

    @Test
    fun parseImportJsonReportsBrokenJson() {
        val result = parseImportJson("{broken")
        assertNull(result.value)
        assertTrue(result.errors[0].contains("JSON"))
    }

    @Test
    fun parseImportJsonReturnsDataForValidTextAndErrorsForInvalid() {
        assertEquals(Parsed(case("ranking-1-1-3"), emptyList()), parseImportJson(validBase.toString()))
        val bad = parseImportJson(validBase.with("version", value = p(9)).toString())
        assertNull(bad.value)
        assertTrue(bad.errors.isNotEmpty())
    }

    @Test
    fun exportThenImportKeepsDataAndResults() {
        val data = case("per-criterion-points")
        val imported = parseImportJson(exportJson(data))
        assertEquals(emptyList(), imported.errors)
        assertEquals(data, imported.value)
        assertEquals(computeResults(data), computeResults(imported.value!!))
    }

    @Test
    fun exportJsonIsIndentedAndKeepsWholeNumbers() {
        val text = exportJson(case("per-criterion-points"))
        assertTrue(text.contains("\n  \"version\""))
        assertTrue(!Regex("\\d\\.0\\b").containsMatchIn(text), text) // 30.0이 아니라 30
        assertTrue(!text.contains("null"), text) // 없는 선택 필드는 빠진다
    }

    @Test
    fun parseNamesSplitsOnNewlinesAndCommas() {
        assertEquals(listOf("가", "나", "다", "라"), parseNames("가, 나\n다\n\n  라  ,"))
        assertEquals(emptyList(), parseNames(""))
    }

    @Test
    fun previewRowsKeepNullTierForUnplacedCells() {
        val rows = computeResults(case("preview-counts-unplaced-as-zero")).rows
        assertEquals(mapOf("c1" to null), rows.first { it.subjectId == "s2" }.tiers)
    }

    @Test
    fun validateDataChecksTheSettingsBlock() {
        assertEquals(emptyList(), validateData(validBase.with("settings", value = p(mapOf("allowPreview" to true)))))
        assertTrue(validateData(validBase.with("settings", value = p(emptyList<Any>()))).joinToString().contains("settings"))
        assertTrue(validateData(validBase.with("settings", value = p(mapOf("allowPreview" to "yes")))).joinToString().contains("settings.allowPreview"))
    }

    @Test
    fun settingsDescriptionsRubricSurviveExportImport() {
        val base = case("ranking-1-1-3")
        val data = base.copy(
            settings = Settings(allowPreview = true),
            criteria = base.criteria.mapIndexed { i, c -> if (i == 1) c.copy(description = "두 번째 기준 설명", rubric = mapOf("S" to "최고", "A" to "좋음")) else c },
        )
        assertEquals(data, parseImportJson(exportJson(data)).value)
    }

    @Test
    fun validateDataChecksCriterionDescriptions() {
        assertEquals(emptyList(), validateData(validBase.with("criteria", 0, "description", value = p("설명\n둘째 줄"))))
        assertTrue(validateData(validBase.with("criteria", 0, "description", value = p(42))).joinToString().contains("criteria[0].description"))
    }

    @Test
    fun rubricIsValidated() {
        val base = p(mapOf("version" to 1, "subjects" to emptyList<Any>(), "criteria" to listOf(mapOf("id" to "c1", "name" to "x")), "placements" to emptyMap<String, Any>()))
        assertEquals(emptyList(), validateData(base))
        assertTrue(validateData(base.with("criteria", 0, "rubric", value = p(mapOf("S" to 1)))).isNotEmpty())
        assertTrue(validateData(base.with("criteria", 0, "rubric", value = p(mapOf("Z" to "a")))).isNotEmpty())
        assertTrue(validateData(base.with("criteria", 0, "rubric", value = p("a"))).isNotEmpty())
    }
}
