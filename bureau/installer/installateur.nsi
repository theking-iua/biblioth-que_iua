; =====================================================================
;  Installateur Windows de « PMB IUA Administration »
;  Compilé par scripts/installateur.js (makensis, NSIS 3) à partir de release/win-unpacked.
;  Installation pour l'utilisateur courant (pas besoin d'être administrateur),
;  raccourcis Bureau + menu Démarrer, désinstallation depuis « Applications installées ».
; =====================================================================
Unicode true
SetCompressor /SOLID lzma
SetCompressorDictSize 64

!define APP_NAME "PMB IUA Administration"
!define APP_EXE "PMB IUA Administration.exe"
!define APP_ID "ci.iua.bibliotheque.admin"
!define PUBLISHER "Institut Universitaire d'Abidjan"
!define UNINST_KEY "Software\Microsoft\Windows\CurrentVersion\Uninstall\${APP_ID}"
; APP_VERSION, SOURCE_DIR, ICON et OUTFILE sont passés par la ligne de commande (/D…)

Name "${APP_NAME}"
OutFile "${OUTFILE}"
InstallDir "$LOCALAPPDATA\Programs\${APP_NAME}"
InstallDirRegKey HKCU "${UNINST_KEY}" "InstallLocation"
RequestExecutionLevel user
BrandingText "${PUBLISHER}"

VIProductVersion "${APP_VERSION}.0"
VIAddVersionKey /LANG=1036 "ProductName" "${APP_NAME}"
VIAddVersionKey /LANG=1036 "FileDescription" "Installation de ${APP_NAME}"
VIAddVersionKey /LANG=1036 "CompanyName" "${PUBLISHER}"
VIAddVersionKey /LANG=1036 "LegalCopyright" "© ${PUBLISHER}"
VIAddVersionKey /LANG=1036 "FileVersion" "${APP_VERSION}"
VIAddVersionKey /LANG=1036 "ProductVersion" "${APP_VERSION}"

!include "MUI2.nsh"
!include "FileFunc.nsh"

!define MUI_ICON "${ICON}"
!define MUI_UNICON "${ICON}"
!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TITLE "Installation de ${APP_NAME}"
!define MUI_WELCOMEPAGE_TEXT "Cet assistant va installer l'espace d'administration de la bibliothèque de l'Institut Universitaire d'Abidjan (version ${APP_VERSION}).$\r$\n$\r$\nAu premier lancement, l'application vous demandera l'adresse du serveur de la bibliothèque.$\r$\n$\r$\nCliquez sur Suivant pour continuer."
!define MUI_FINISHPAGE_RUN "$INSTDIR\${APP_EXE}"
!define MUI_FINISHPAGE_RUN_TEXT "Lancer ${APP_NAME}"

!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH

!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES

!insertmacro MUI_LANGUAGE "French"

; Ferme l'application si elle est ouverte (mise à jour ou désinstallation)
!macro CloseApp
  nsExec::Exec 'taskkill /F /T /IM "${APP_EXE}"'
  Pop $0
  Sleep 800
!macroend

Section "Application" SecApp
  SectionIn RO
  !insertmacro CloseApp
  SetOutPath "$INSTDIR"
  ; Mise à jour : on retire l'ancienne version (les réglages, dans %APPDATA%, sont conservés)
  RMDir /r "$INSTDIR\resources"
  RMDir /r "$INSTDIR\locales"
  File /r "${SOURCE_DIR}\*.*"

  WriteUninstaller "$INSTDIR\Desinstaller ${APP_NAME}.exe"

  ; Raccourcis
  CreateDirectory "$SMPROGRAMS\IUA"
  CreateShortCut "$SMPROGRAMS\IUA\${APP_NAME}.lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\${APP_EXE}" 0
  CreateShortCut "$DESKTOP\${APP_NAME}.lnk" "$INSTDIR\${APP_EXE}" "" "$INSTDIR\${APP_EXE}" 0

  ; Entrée dans « Applications installées » (Paramètres Windows)
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayName" "${APP_NAME}"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayVersion" "${APP_VERSION}"
  WriteRegStr HKCU "${UNINST_KEY}" "Publisher" "${PUBLISHER}"
  WriteRegStr HKCU "${UNINST_KEY}" "DisplayIcon" "$INSTDIR\${APP_EXE},0"
  WriteRegStr HKCU "${UNINST_KEY}" "InstallLocation" "$INSTDIR"
  WriteRegStr HKCU "${UNINST_KEY}" "UninstallString" '"$INSTDIR\Desinstaller ${APP_NAME}.exe"'
  WriteRegStr HKCU "${UNINST_KEY}" "QuietUninstallString" '"$INSTDIR\Desinstaller ${APP_NAME}.exe" /S'
  WriteRegDWORD HKCU "${UNINST_KEY}" "NoModify" 1
  WriteRegDWORD HKCU "${UNINST_KEY}" "NoRepair" 1
  ${GetSize} "$INSTDIR" "/S=0K" $0 $1 $2
  IntFmt $0 "0x%08X" $0
  WriteRegDWORD HKCU "${UNINST_KEY}" "EstimatedSize" "$0"
SectionEnd

Section "Uninstall"
  !insertmacro CloseApp
  Delete "$DESKTOP\${APP_NAME}.lnk"
  Delete "$SMPROGRAMS\IUA\${APP_NAME}.lnk"
  RMDir "$SMPROGRAMS\IUA"
  RMDir /r "$INSTDIR"
  DeleteRegKey HKCU "${UNINST_KEY}"
  ; Les réglages (adresse du serveur) restent dans %APPDATA%\${APP_NAME} pour une réinstallation
SectionEnd
