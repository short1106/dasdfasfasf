plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "com.dulidanstudios.web"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.dulidanstudios.web"
        minSdk = 26
        targetSdk = 35
        /* Im GitHub-Build zählt die Nummer mit jedem Lauf hoch (Updates über die alte Version) */
        val code = System.getenv("DW_VERSION_CODE")?.toIntOrNull() ?: 1
        versionCode = code
        versionName = "0.2.$code"
    }

    /* Signierschlüssel kommt ausschließlich aus der Umgebung (GitHub-Secret oder im Build erzeugt) – nie aus dem Repo */
    val ks = System.getenv("DW_KEYSTORE_FILE")
    signingConfigs {
        if (ks != null) create("release") {
            storeFile = file(ks)
            storePassword = System.getenv("DW_KEYSTORE_PASS")
            keyAlias = System.getenv("DW_KEY_ALIAS") ?: "dulidan"
            keyPassword = System.getenv("DW_KEYSTORE_PASS")
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = false
            signingConfig = if (ks != null) signingConfigs.getByName("release") else signingConfigs.getByName("debug")
        }
    }

    /* Eigene Ergebnisseite + Rechner-Parser teilen sich Desktop und Android: ../../shared → assets/search, assets/calc.js */
    sourceSets["main"].assets.srcDir("../../shared")
    /* Dulidan Maps + Übersetzer brauchen MapLibre und die Bergamot-Engine aus node_modules → assets/vendor/… (Task copyVendor) */
    sourceSets["main"].assets.srcDir(layout.buildDirectory.dir("vendor-assets"))

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

/* Gleiche Versionen wie am Desktop (package-lock.json). Vorher im Repo-Ordner: npm ci --ignore-scripts */
val nodeModules = rootProject.file("../node_modules")
val copyVendor by tasks.registering(Copy::class) {
    doFirst {
        if (!nodeModules.resolve("maplibre-gl/dist/maplibre-gl.js").exists() || !nodeModules.resolve("@browsermt/bergamot-translator/translator.js").exists())
            throw GradleException("node_modules fehlt: im Repo-Ordner zuerst 'npm ci --ignore-scripts' ausführen")
    }
    from(nodeModules.resolve("maplibre-gl/dist")) { include("maplibre-gl.js", "maplibre-gl.css", "LICENSE.txt"); into("vendor/maplibre") }
    from(nodeModules.resolve("@browsermt/bergamot-translator")) { include("translator.js", "worker/*.js", "worker/*.wasm", "package.json", "README.md"); into("vendor/bergamot") }
    into(layout.buildDirectory.dir("vendor-assets"))
}
tasks.named("preBuild") { dependsOn(copyVendor) }
/* Alles, was Assets liest (Merge, Lint), ausdrücklich danach – sonst meckert Gradle über eine verdeckte Abhängigkeit */
tasks.matching { it.name != "copyVendor" && (it.name.contains("Assets") || it.name.startsWith("lint")) }.configureEach { dependsOn(copyVendor) }

dependencies {
    implementation("androidx.webkit:webkit:1.12.1")
}
