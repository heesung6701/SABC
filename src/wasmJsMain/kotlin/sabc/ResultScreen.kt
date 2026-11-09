package sabc

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.IntrinsicSize
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

@Composable
fun ResultScreen(state: AppState, data: EvalData) {
    val result = computeResults(data)
    PageHead("결과")
    when (result.status) {
        Status.EMPTY -> return Stack {
            Callout(Tone.INFORMATIVE, "대상자와 기준을 먼저 입력해 주세요")
            Box { PrimaryButton("설정으로 가기") { state.go(Screen.SETTINGS) } }
        }
        Status.LOCKED -> return Stack {
            Callout(Tone.WARNING, "미배치 ${result.missing}건이 남아 있어 결과를 볼 수 없어요", "모두 배치하면 순위가 나와요. 설정의 옵션에서 미리보기를 켜면 임시 순위를 볼 수 있어요.")
            Row {
                PrimaryButton("평가로 돌아가기") { state.go(Screen.EVALUATE) }
                Box(Modifier.width(8.dp))
                SecondaryButton("옵션 설정") { state.go(Screen.SETTINGS, "options") }
            }
        }
        Status.PREVIEW -> Stack {
            Callout(Tone.WARNING, "미리보기 결과예요", "미배치 ${result.missing}건을 0점으로 계산한 임시 순위입니다.")
            Box { SecondaryButton("평가로 돌아가기") { state.go(Screen.EVALUATE) } }
        }
        Status.READY -> Unit
    }

    // ponytail: 열 폭은 고정. 기준 이름이 길면 머리글이 줄바꿈된다.
    val columns: List<Pair<String, Dp>> = listOf("순위" to 64.dp, "대상자" to 160.dp) + data.criteria.map { it.name to 104.dp } + listOf("총점" to 88.dp, "S 개수" to 80.dp)
    val colors = MaterialTheme.colorScheme
    Box(
        Modifier.padding(top = 16.dp).fillMaxWidth()
            .clip(RoundedCornerShape(12.dp))
            .border(1.dp, colors.outlineVariant, RoundedCornerShape(12.dp))
            .horizontalScroll(rememberScrollState()),
    ) {
        Column {
            Row(Modifier.background(colors.surfaceVariant).height(IntrinsicSize.Min)) {
                columns.forEach { (label, width) -> Cell(width) { Text(label, fontWeight = FontWeight.Bold, maxLines = 2, overflow = TextOverflow.Ellipsis) } }
            }
            result.rows.forEach { row ->
                HorizontalDivider(color = colors.outlineVariant)
                Row(Modifier.height(IntrinsicSize.Min)) {
                    Cell(columns[0].second) { Text(row.rank.toString()) }
                    Cell(columns[1].second) { Text(row.name) }
                    data.criteria.forEachIndexed { i, c ->
                        val tier = row.tiers[c.id]
                        Cell(columns[2 + i].second, background = tier?.let { TierColors.getValue(it) } ?: colors.surfaceVariant, center = true) {
                            Text(tier ?: "-", color = if (tier != null) TierInk else Muted, fontWeight = FontWeight.Bold, textAlign = TextAlign.Center)
                        }
                    }
                    Cell(columns[columns.size - 2].second) { Text(fmt(row.total)) }
                    Cell(columns.last().second) { Text(row.sCount.toString()) }
                }
            }
        }
    }
}

@Composable
private fun Cell(width: Dp, background: Color = Color.Transparent, center: Boolean = false, content: @Composable () -> Unit) =
    Box(
        Modifier.width(width).fillMaxHeight().background(background).padding(horizontal = 16.dp, vertical = 12.dp),
        contentAlignment = if (center) Alignment.Center else Alignment.CenterStart,
    ) { content() }
