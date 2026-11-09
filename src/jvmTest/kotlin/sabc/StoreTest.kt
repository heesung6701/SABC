package sabc

import kotlin.test.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertSame
import kotlin.test.assertTrue

class FakeStorage(
    private val failGet: Boolean = false,
    private val failSet: Boolean = false,
) : KeyValueStorage {
    val map = mutableMapOf<String, String>()
    override fun getItem(key: String) = if (failGet) error("denied") else map[key]
    override fun setItem(key: String, value: String) { if (failSet) error("quota") else map[key] = value }
    override fun removeItem(key: String) { map.remove(key) }
}

class StoreTest {
    private val sample = toWorkspace(caseRaw("ranking-1-1-3"))!!

    @Test
    fun loadOnEmptyStorageReturnsEmptyWorkspace() = assertEquals(emptyWorkspace(), Store(FakeStorage()).load())

    @Test
    fun saveThenLoadRoundTripsUnderTheKey() {
        val storage = FakeStorage()
        val store = Store(storage)
        assertTrue(store.save(sample))
        assertEquals("tier-eval-v1", STORAGE_KEY)
        assertTrue(STORAGE_KEY in storage.map)
        assertEquals(sample, store.load())
    }

    @Test
    fun brokenOrInvalidSavedDataFallsBackReportsAndBacksUp() {
        for (raw in listOf("{x", caseRaw("ranking-1-1-3").with("version", value = p(9)).toString())) {
            val storage = FakeStorage().apply { map[STORAGE_KEY] = raw }
            val store = Store(storage)
            assertEquals(emptyWorkspace(), store.load())
            assertTrue(store.loadFailed)
            assertEquals(raw, storage.map[BACKUP_KEY])
        }
    }

    @Test
    fun throwingStorageDegrades() {
        assertEquals(emptyWorkspace(), Store(FakeStorage(failGet = true)).load())
        assertFalse(Store(FakeStorage(failSet = true)).save(sample))
        val none = Store(null)
        assertEquals(emptyWorkspace(), none.load())
        assertFalse(none.save(sample))
    }

    @Test
    fun clearRemovesTheKey() {
        val storage = FakeStorage()
        val store = Store(storage)
        store.save(sample)
        store.clear()
        assertFalse(STORAGE_KEY in storage.map)
    }

    @Test
    fun missingDataIsNotAFailureAndLaterSuccessClearsTheFlag() {
        val store = Store(FakeStorage())
        store.load()
        assertFalse(store.loadFailed)
        val storage = FakeStorage().apply { map[STORAGE_KEY] = "{x" }
        val broken = Store(storage)
        broken.load()
        broken.save(sample)
        broken.load()
        assertFalse(broken.loadFailed)
    }

    @Test
    fun legacySingleEvaluationDataIsWrapped() {
        val storage = FakeStorage().apply { map[STORAGE_KEY] = caseRaw("ranking-1-1-3").toString() }
        val store = Store(storage)
        val ws = store.load()
        assertFalse(store.loadFailed)
        assertEquals(1, ws.evaluations.size)
        assertEquals(case("ranking-1-1-3"), ws.evaluations[0].data)
        assertEquals(ws.evaluations[0].id, ws.activeId)
    }

    // 웹(JS) 버전이 저장한 워크스페이스를 그대로 읽는다 (같은 origin의 localStorage를 이어받는다)
    @Test
    fun readsWorkspaceWrittenByTheJsVersion() {
        val raw = """{"version":2,"activeId":"e2","evaluations":[{"id":"e1","name":"평가 1","data":{"version":1,"subjects":[],"criteria":[],"placements":{}}},""" +
            """{"id":"e2","name":"B","data":{"version":1,"subjects":[{"id":"s1","name":"가"}],"criteria":[{"id":"c1","name":"x","points":{"S":9,"A":6,"B":3,"C":1.5}}],"placements":{"c1":{"s1":"S"}},"settings":{"allowPreview":false},"adjustments":{"c1":{"s1":-1}}}}]}"""
        val store = Store(FakeStorage().apply { map[STORAGE_KEY] = raw })
        val ws = store.load()
        assertFalse(store.loadFailed)
        assertEquals("e2", ws.activeId)
        assertEquals(1.5, activeEvaluation(ws)!!.data.criteria[0].points!!["C"])
        assertEquals(-1, adjustmentOf(activeEvaluation(ws)!!.data, "c1", "s1"))
    }

    @Test
    fun workspaceWithNoEvaluationsSurvivesSaveLoad() {
        val storage = FakeStorage()
        val store = Store(storage)
        val none = removeEvaluation(emptyWorkspace(), "e1")
        store.save(none)
        assertEquals(none, store.load())
        assertFalse(store.loadFailed)
    }
}

class WorkspaceTest {
    @Test
    fun addEvaluationCreatesEmptyAndSwitches() {
        val ws = addEvaluation(emptyWorkspace(), " 2분기 ")
        assertEquals(2, ws.evaluations.size)
        assertEquals("2분기", activeEvaluation(ws)!!.name)
        assertEquals(0, activeEvaluation(ws)!!.data.subjects.size)
        assertEquals("평가 2", addEvaluation(emptyWorkspace(), "").evaluations[1].name)
        assertEquals(emptyList(), validateWorkspace(ws))
    }

    @Test
    fun updateActiveOnlyTouchesTheActive() {
        var ws = updateActive(emptyWorkspace()) { addSubject(it, "철수") }
        ws = addEvaluation(ws, "B")
        ws = updateActive(ws) { addSubject(it, "영희") }
        assertEquals(listOf(listOf("철수"), listOf("영희")), ws.evaluations.map { e -> e.data.subjects.map { it.name } })
    }

    @Test
    fun switchRenameMove() {
        var ws = addEvaluation(emptyWorkspace(), "B")
        ws = switchEvaluation(ws, "e1")
        assertEquals("e1", ws.activeId)
        assertSame(ws, switchEvaluation(ws, "nope"))
        ws = renameEvaluation(ws, "e1", "A")
        assertSame(ws, renameEvaluation(ws, "e1", "  "))
        ws = moveEvaluation(ws, "e1", 1)
        assertEquals(listOf("B", "A"), ws.evaluations.map { it.name })
        assertSame(ws, moveEvaluation(ws, "e1", 1))
    }

    @Test
    fun removeEvaluationRepointsActiveAndAllowsRemovingAll() {
        val one = emptyWorkspace()
        val none = removeEvaluation(one, "e1")
        assertEquals(Workspace(2, null, emptyList()), none)
        assertEquals(emptyList(), validateWorkspace(none))
        assertNull(activeEvaluation(none))
        assertEquals("e1", addEvaluation(none, "N").activeId)
        var ws = addEvaluation(addEvaluation(one, "B"), "C") // active e3
        ws = removeEvaluation(ws, "e3")
        assertEquals("e2", ws.activeId)
        ws = removeEvaluation(ws, "e1")
        assertEquals("e2", ws.activeId)
        assertEquals(emptyList(), validateWorkspace(ws))
        // id는 지운 뒤에도 재사용하지 않는다: 마지막 번호 +1
        assertEquals("e3", addEvaluation(ws, "D").activeId)
    }

    @Test
    fun validateWorkspaceRejectsBadShapes() {
        assertTrue(validateWorkspace(Workspace(2, "x", emptyList())).isNotEmpty())
        val ws = emptyWorkspace()
        assertTrue(validateWorkspace(ws.copy(activeId = "zzz")).isNotEmpty())
        assertTrue(validateWorkspace(ws.copy(evaluations = ws.evaluations + ws.evaluations[0])).isNotEmpty())
    }

    @Test
    fun addEvaluationAcceptsInitialDataAndKeepsPoints() {
        val data = applyPreset(listOf("가"), listOf(CriterionDef("a", "d", mapOf("S" to 9.0, "A" to 6.0, "B" to 3.0, "C" to 1.0))))
        val ws = addEvaluation(emptyWorkspace(), "T", data)
        assertEquals(emptyList(), validateWorkspace(ws))
        assertEquals(9.0, activeEvaluation(ws)!!.data.criteria[0].points!!["S"])
    }
}

class SheetTest {
    private val data = EvalData(
        subjects = listOf(Subject("s1", "김,철수"), Subject("s2", "영희")),
        criteria = listOf(Criterion("c1", "참신성", "d", mapOf("S" to 9.0, "A" to 6.0, "B" to 3.0, "C" to 1.0)), Criterion("c2", "\"완성도\"")),
        placements = mapOf("c1" to mapOf("s1" to "S", "s2" to "C"), "c2" to mapOf("s1" to "A")),
    )

    @Test
    fun csvRoundTrips() {
        val csv = exportSheetCsv(data)
        assertTrue(csv.startsWith("﻿"))
        assertEquals(Parsed(data, emptyList()), importSheetCsv(data, csv))
    }

    @Test
    fun csvImportReportsErrors() {
        assertTrue(importSheetCsv(data, "대상자,없는기준\n가,S").errors[0].contains("없는기준"))
        assertTrue(importSheetCsv(data, "대상자,참신성\n가,Z").errors[0].contains("2행"))
        assertTrue(importSheetCsv(data, "대상자,참신성\n가,S\n가,A").errors[0].contains("중복"))
        assertNull(importSheetCsv(data, "").value)
    }

    @Test
    fun csvImportAcceptsLowercaseBlanksCrlf() {
        val result = importSheetCsv(data, "대상자,참신성\r\n가,s\r\n나,\r\n")
        assertEquals(emptyList(), result.errors)
        assertEquals(mapOf("c1" to mapOf("s1" to "S")), result.value!!.placements)
        assertEquals(emptyList(), validateData(result.value!!))
        assertEquals(listOf(listOf("a", "b\nc")), parseCsv("a,\"b\nc\"\n"))
    }

    @Test
    fun criteriaJsonRoundTripsAndClearsPlacements() {
        val parsed = parseCriteriaJson(exportCriteriaJson(data))
        assertEquals(emptyList(), parsed.errors)
        val next = replaceCriteria(data, parsed.value!!)
        assertEquals(emptyMap(), next.placements)
        assertEquals(emptyList(), validateData(next))
        assertEquals(9.0, next.criteria[0].points!!["S"])
        assertTrue(parseCriteriaJson("{x").errors.isNotEmpty())
        assertTrue(parseCriteriaJson("""{"version":1,"criteria":[{"name":"a"},{"name":"a"}]}""").errors.isNotEmpty())
    }
}
