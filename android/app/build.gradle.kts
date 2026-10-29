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

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation("androidx.webkit:webkit:1.12.1")
}
