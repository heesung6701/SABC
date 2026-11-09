package sabc

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertSame
import kotlin.test.assertTrue

class ModelTest {
    private val base get() = case("ranking-1-1-3")
    private val empty = emptyData()

    @Test
    fun nextIdUsesMaxNumericSuffixPlusOne() {
        assertEquals("s4", nextId("s", listOf("s1", "s3")))
        assertEquals("c1", nextId("c", emptyList()))
    }

    @Test
    fun addSubjectTrimsAndIgnoresBlank() {
        assertEquals(listOf(Subject("s1", "가")), addSubject(empty, "  가 ").subjects)
        assertEquals(empty, addSubject(empty, "   "))
    }

    @Test
    fun sameNameSubjectsGetDistinctIds() {
        assertEquals(listOf("s1", "s2"), addSubject(addSubject(empty, "같은이름"), "같은이름").subjects.map { it.id })
    }

    @Test
    fun addSubjectsAndCriteriaAppendInOrder() {
        assertEquals(listOf("가", "나"), addSubjects(empty, listOf("가", "나")).subjects.map { it.name })
        assertEquals(listOf("c1", "c2"), addCriteria(empty, listOf("x", "y")).criteria.map { it.id })
        assertEquals(listOf(Criterion("c1", "z")), addCriterion(empty, " z ").criteria)
    }

    @Test
    fun removeSubjectDeletesItsPlacements() {
        val data = removeSubject(base, "s1")
        assertEquals(listOf("s2", "s3"), data.subjects.map { it.id })
        assertEquals(mapOf("c1" to mapOf("s2" to "A", "s3" to "B"), "c2" to mapOf("s2" to "A", "s3" to "S")), data.placements)
    }

    @Test
    fun removeCriterionDeletesItsPlacements() {
        val data = removeCriterion(base, "c1")
        assertEquals(listOf("c2"), data.criteria.map { it.id })
        assertFalse("c1" in data.placements)
    }

    @Test
    fun renameKeepsIdsAndPlacements() {
        val before = computeResults(base).rows.first { it.subjectId == "s1" }
        val after = computeResults(renameSubject(base, "s1", "새이름")).rows.first { it.subjectId == "s1" }
        assertEquals("새이름", after.name)
        assertEquals(before.total, after.total)
        assertEquals("바뀜", renameCriterion(base, "c1", "바뀜").criteria[0].name)
        assertEquals(base, renameSubject(base, "s1", "  "))
    }

    @Test
    fun moveCriterionSwapsAndIgnoresOutOfRange() {
        assertEquals(listOf("c2", "c1"), moveCriterion(base, "c2", -1).criteria.map { it.id })
        assertEquals(base, moveCriterion(base, "c1", -1))
        assertEquals(base, moveCriterion(base, "c2", 1))
    }

    @Test
    fun setPointsSetsAndRemoves() {
        val points = mapOf("S" to 10.0, "A" to 5.0, "B" to 2.0, "C" to 0.0)
        val withPoints = setPoints(base, "c1", points)
        assertEquals(points, withPoints.criteria[0].points)
        assertNull(setPoints(withPoints, "c1", null).criteria[0].points)
    }

    @Test
    fun setPlacementSetsAndRemoves() {
        val placed = setPlacement(empty, "c1", "s1", "S")
        assertEquals("S", placed.placements["c1"]!!["s1"])
        assertFalse("s1" in setPlacement(placed, "c1", "s1", null).placements["c1"]!!)
    }

    @Test
    fun applyPresetBuildsValidDataForEveryPreset() {
        for (preset in PRESETS) {
            val data = applyPreset(preset)
            assertEquals(emptyList(), validateData(data), preset.id)
            assertEquals(emptyMap(), data.placements)
            assertNull(data.settings?.allowPreview) // 미리보기는 꺼진 상태로 시작
        }
    }

    @Test
    fun sampleAndEmptyPresetsHaveTheSpecifiedContent() {
        val sample = applyPreset(PRESETS.first { it.id == "sample" })
        assertEquals(List(10) { "후보 ${it + 1}" }, sample.subjects.map { it.name })
        assertEquals(listOf("참신성", "실현 가능성", "시장성", "완성도"), sample.criteria.map { it.name })
        assertTrue(sample.criteria.all { it.description == null })
        val empty = applyPreset(PRESETS.first { it.id == "empty" })
        assertEquals(0, empty.subjects.size)
        assertEquals(0, empty.criteria.size)
    }

    @Test
    fun setAllowPreviewTogglesWithoutTouchingOtherData() {
        val on = setAllowPreview(base, true)
        assertEquals(true, on.settings?.allowPreview)
        assertEquals(false, setAllowPreview(on, false).settings?.allowPreview)
        assertEquals(base.subjects, on.subjects)
        assertEquals(true, removeSubject(on, "s1").settings?.allowPreview)
        assertEquals(true, addCriterion(on, "새 기준").settings?.allowPreview)
    }

    @Test
    fun setDescriptionTrimsAndRemovesWhenBlank() {
        val described = setDescription(base, "c1", "  설명  ")
        assertEquals("설명", described.criteria[0].description)
        assertNull(setDescription(described, "c1", "   ").criteria[0].description)
    }

    @Test
    fun hiringPresetIsFirstWithFiveDescribedCriteria() {
        assertEquals("hiring", PRESETS[0].id)
        val data = applyPreset(PRESETS[0])
        assertEquals(listOf("직무 이해도", "문제 해결 능력 및 역량", "협업과 조율", "의사소통 능력", "동기 및 성장 가능성"), data.criteria.map { it.name })
        assertTrue(data.criteria.all { !it.description.isNullOrEmpty() && it.rubric?.keys == TIERS.toSet() })
        assertEquals(0, data.subjects.size)
    }

    @Test
    fun setRubricSetsTrimsClearsAndDropsEmpty() {
        var d = applyPreset(emptyList(), listOf(CriterionDef("a", rubric = mapOf("S" to "굿"))))
        assertEquals(mapOf("S" to "굿"), d.criteria[0].rubric)
        d = setRubric(d, "c1", "A", "  보통  ")
        assertEquals(mapOf("S" to "굿", "A" to "보통"), d.criteria[0].rubric)
        assertEquals(mapOf("S" to "굿", "A" to "보통"), parseCriteriaJson(exportCriteriaJson(d)).value!![0].rubric)
        d = setRubric(setRubric(d, "c1", "S", ""), "c1", "A", "")
        assertNull(d.criteria[0].rubric)
    }

    // ---- 보정(adjustment) ----

    private val tables = listOf(TIER_POINTS, pts(4, 3, 2, 1), pts(0.3, 0.2, 0.1, 0), pts(100, 99, 10, 0))
    private fun pts(vararg v: Number) = TIERS.zip(v.map { it.toDouble() }).toMap()
    private val adjBase = EvalData(
        subjects = listOf(Subject("s1", "a"), Subject("s2", "b")),
        criteria = listOf(Criterion("c1", "x")),
        placements = mapOf("c1" to mapOf("s1" to "A", "s2" to "A")),
    )

    @Test
    fun noAllowedAdjustmentCanInvertTierOrder() {
        for (points in tables) {
            val unit = adjustmentUnit(Criterion("c1", "x", points = points))
            for (i in 0 until TIERS.size - 1) {
                assertTrue(points.getValue(TIERS[i]) - MAX_ADJUST * unit > points.getValue(TIERS[i + 1]) + MAX_ADJUST * unit, "$points ${TIERS[i]}")
            }
        }
        assertEquals(1.0, adjustmentUnit(Criterion("c1", "x")))
    }

    @Test
    fun adjustmentBreaksTiesAndAddsToTotal() {
        val rows = computeResults(setAdjustment(adjBase, "c1", "s1", 1)).rows
        assertEquals(listOf(listOf("s1", 21.0, 1), listOf("s2", 20.0, 2)), rows.map { listOf(it.subjectId, it.total, it.rank) })
        val tied = setAdjustment(setAdjustment(adjBase, "c1", "s1", 1), "c1", "s2", 1)
        assertEquals(listOf(1, 1), computeResults(tied).rows.map { it.rank })
    }

    @Test
    fun setAdjustmentRejectsOutOfRangeAndUnplaced() {
        assertSame(adjBase, setAdjustment(adjBase, "c1", "s1", MAX_ADJUST + 1))
        assertNull(setAdjustment(setPlacement(adjBase, "c1", "s1", null), "c1", "s1", 1).adjustments)
        assertSame(adjBase, setAdjustment(adjBase, "c1", "s1", 0))
    }

    @Test
    fun movingTierResetsAdjustmentSameTierKeepsIt() {
        val d = setAdjustment(adjBase, "c1", "s1", 2)
        assertEquals(2, setPlacement(d, "c1", "s1", "A").adjustments!!["c1"]!!["s1"])
        assertNull(setPlacement(d, "c1", "s1", "S").adjustments!!["c1"]!!["s1"])
    }

    @Test
    fun removingSubjectCriterionCriteriaCleansAdjustments() {
        val d = setAdjustment(adjBase, "c1", "s1", 1)
        assertNull(removeSubject(d, "s1").adjustments!!["c1"]!!["s1"])
        assertNull(removeCriterion(d, "c1").adjustments!!["c1"])
        assertNull(replaceCriteria(d, emptyList()).adjustments)
    }

    @Test
    fun validateDataChecksAdjustments() {
        val d = json.encodeToJsonElement(EvalData.serializer(), setAdjustment(adjBase, "c1", "s1", 1))
        assertEquals(emptyList(), validateData(d))
        assertEquals(emptyList(), validateData(adjBase)) // 예전 데이터
        assertTrue(validateData(d.with("adjustments", "c1", "s1", value = p(3))).isNotEmpty())
        assertTrue(validateData(d.with("adjustments", "c1", "s1", value = p(1.5))).isNotEmpty())
        assertTrue(validateData(d.with("adjustments", "c9", value = p(mapOf("s1" to 1)))).isNotEmpty())
        assertTrue(validateData(d.with("adjustments", "c1", "s9", value = p(1))).isNotEmpty())
    }
}
