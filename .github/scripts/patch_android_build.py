#!/usr/bin/env python3
"""
Android release build.gradle'ini GECICI olarak (sadece bu GitHub Actions
calismasi icin) patch'ler:
  - signingConfigs.release ekler (sifreler ortam degiskenlerinden okunur,
    hicbir zaman diske/repoya yazilmaz)
  - versionCode/versionName'i workflow input'larindan gelen degerlerle
    degistirir

ONEMLI: Bu script SADECE GitHub Actions workflow'unun GECICI checkout
kopyasinda calisir. Degisiklikler COMMIT EDILMEZ, repodaki gercek
android/app/build.gradle dosyasi HICBIR ZAMAN degismez. Bu, Capawesome'in
kendi (ayri, calisir durumdaki) Android build surecini ETKILEMEMEK icin
BILEREK boyle tasarlandi.
"""
import os
import sys

BUILD_GRADLE = "android/app/build.gradle"

version_code = os.environ["VERSION_CODE"]
version_name = os.environ["VERSION_NAME"]

with open(BUILD_GRADLE, "r") as f:
    content = f.read()

# 1) versionCode / versionName override
eski_vc = "versionCode 1"
eski_vn = 'versionName "1.0"'
if eski_vc not in content or eski_vn not in content:
    print("HATA: beklenen versionCode/versionName satirlari bulunamadi.")
    print("Repo icerigi degismis olabilir, scripti guncellemek gerekebilir.")
    sys.exit(1)

content = content.replace(eski_vc, f"versionCode {version_code}")
content = content.replace(eski_vn, f'versionName "{version_name}"')

# 2) signingConfigs ekle (defaultConfig'den SONRA, buildTypes'tan ONCE)
eski_buildtypes = """    buildTypes {
        release {
            minifyEnabled false"""

yeni_buildtypes = """    signingConfigs {
        release {
            storeFile file("release.keystore")
            storePassword System.getenv("ANDROID_KEYSTORE_PASSWORD")
            keyAlias System.getenv("ANDROID_KEY_ALIAS")
            keyPassword System.getenv("ANDROID_KEY_PASSWORD")
        }
    }
    buildTypes {
        release {
            signingConfig signingConfigs.release
            minifyEnabled false"""

if eski_buildtypes not in content:
    print("HATA: beklenen buildTypes blogu bulunamadi.")
    print("Repo icerigi degismis olabilir, scripti guncellemek gerekebilir.")
    sys.exit(1)

content = content.replace(eski_buildtypes, yeni_buildtypes)

with open(BUILD_GRADLE, "w") as f:
    f.write(content)

print(f"Patch tamamlandi: versionCode={version_code}, versionName={version_name}, signingConfig eklendi.")
