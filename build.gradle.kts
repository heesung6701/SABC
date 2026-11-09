import org.jetbrains.kotlin.gradle.ExperimentalWasmDsl
import org.jetbrains.kotlin.gradle.plugin.KotlinPlatformType

plugins {
    kotlin("multiplatform") version "2.4.21"
    kotlin("plugin.serialization") version "2.4.21"
    kotlin("plugin.compose") version "2.4.21"
    id("org.jetbrains.compose") version "1.12.2"
}

kotlin {
    // ponytail: jvm 타깃은 공용 로직 테스트(tests/fixtures 읽기)용. 앱은 wasmJs만 배포한다.
    jvm()

    @OptIn(ExperimentalWasmDsl::class)
    wasmJs {
        outputModuleName = "sabc"
        browser {
            commonWebpackConfig { outputFileName = "sabc.js" }
        }
        binaries.executable()
    }

    sourceSets {
        commonMain.dependencies {
            implementation("org.jetbrains.kotlinx:kotlinx-serialization-json:1.12.0")
            // ponytail: Res 클래스(한글 글꼴)가 commonMain에 생성되므로 여기에 둔다. 공용 로직은 이 의존성을 쓰지 않는다.
            implementation("org.jetbrains.compose.components:components-resources:1.12.2")
        }
        wasmJsMain.dependencies {
            implementation("org.jetbrains.compose.runtime:runtime:1.12.2")
            implementation("org.jetbrains.compose.foundation:foundation:1.12.2")
            implementation("org.jetbrains.compose.material3:material3:1.9.0")
        }
        jvmTest.dependencies {
            implementation(kotlin("test"))
        }
    }
}

compose.resources {
    packageOfResClass = "sabc.resources"
}

// UI(Compose)는 wasmJs에만 있다
composeCompiler {
    targetKotlinPlatforms.set(setOf(KotlinPlatformType.wasm))
}
