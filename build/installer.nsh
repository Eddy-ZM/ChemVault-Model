!include LogicLib.nsh
!include nsDialogs.nsh
!include WinMessages.nsh

ManifestDPIAware true
ShowInstDetails show
ShowUninstDetails show

!macro customHeader
  ShowInstDetails show
  ShowUninstDetails show
!macroend

!ifndef BUILD_UNINSTALLER
Var ChemVaultEngineSetupCheckbox
Var ChemVaultEngineSetupState
Var ChemVaultDesktopShortcutCheckbox
Var ChemVaultDesktopShortcutState
Var ChemVaultStartMenuShortcutCheckbox
Var ChemVaultStartMenuShortcutState
Var ChemVaultEngineSetupTitle
Var ChemVaultEngineSetupBody
Var ChemVaultEngineSetupDetails
Var ChemVaultEngineSetupTitleFont
Var ChemVaultEngineSetupBodyFont
Var ChemVaultInstallSize
Var ChemVaultInstallFiles

!macro customPageAfterChangeDir
  Page custom ChemVaultEngineSetupPageCreate ChemVaultEngineSetupPageLeave
  !define MUI_PAGE_CUSTOMFUNCTION_SHOW ChemVaultInstFilesPageShow
!macroend

Function ChemVaultEngineSetupPageCreate
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}

  CreateFont $ChemVaultEngineSetupTitleFont "Segoe UI" 12 700
  CreateFont $ChemVaultEngineSetupBodyFont "Segoe UI" 10 400

  ${NSD_CreateLabel} 0 0 100% 18u "Install options"
  Pop $ChemVaultEngineSetupTitle
  SendMessage $ChemVaultEngineSetupTitle ${WM_SETFONT} $ChemVaultEngineSetupTitleFont 1
  SetCtlColors $ChemVaultEngineSetupTitle 0x111827 transparent

  ${NSD_CreateLabel} 0 24u 100% 24u "Choose shortcut and quantum setup preferences before installing ChemVault Model."
  Pop $ChemVaultEngineSetupBody
  SendMessage $ChemVaultEngineSetupBody ${WM_SETFONT} $ChemVaultEngineSetupBodyFont 1
  SetCtlColors $ChemVaultEngineSetupBody 0x1F2937 transparent

  ${NSD_CreateLabel} 0 54u 100% 18u "Install progress details are expanded on the next page."
  Pop $ChemVaultEngineSetupDetails
  SendMessage $ChemVaultEngineSetupDetails ${WM_SETFONT} $ChemVaultEngineSetupBodyFont 1
  SetCtlColors $ChemVaultEngineSetupDetails 0x1F2937 transparent

  ${NSD_CreateCheckbox} 0 78u 100% 16u "Create desktop shortcut"
  Pop $ChemVaultDesktopShortcutCheckbox
  SendMessage $ChemVaultDesktopShortcutCheckbox ${WM_SETFONT} $ChemVaultEngineSetupBodyFont 1
  ${NSD_SetState} $ChemVaultDesktopShortcutCheckbox ${BST_CHECKED}

  ${NSD_CreateCheckbox} 0 100u 100% 16u "Create Start Menu shortcut"
  Pop $ChemVaultStartMenuShortcutCheckbox
  SendMessage $ChemVaultStartMenuShortcutCheckbox ${WM_SETFONT} $ChemVaultEngineSetupBodyFont 1
  ${NSD_SetState} $ChemVaultStartMenuShortcutCheckbox ${BST_CHECKED}

  ${NSD_CreateCheckbox} 0 122u 100% 16u "Prompt for PySCF setup on first launch"
  Pop $ChemVaultEngineSetupCheckbox
  SendMessage $ChemVaultEngineSetupCheckbox ${WM_SETFONT} $ChemVaultEngineSetupBodyFont 1
  ${NSD_SetState} $ChemVaultEngineSetupCheckbox ${BST_CHECKED}

  nsDialogs::Show
FunctionEnd

Function ChemVaultEngineSetupPageLeave
  ${NSD_GetState} $ChemVaultDesktopShortcutCheckbox $ChemVaultDesktopShortcutState
  ${NSD_GetState} $ChemVaultStartMenuShortcutCheckbox $ChemVaultStartMenuShortcutState
  ${NSD_GetState} $ChemVaultEngineSetupCheckbox $ChemVaultEngineSetupState
FunctionEnd

Function ChemVaultInstFilesPageShow
  SetDetailsView show
  SetDetailsPrint both
  DetailPrint "Preparing ChemVault Model installation."
FunctionEnd

!macro customFiles_x64
  SetDetailsPrint both
  DetailPrint "Application archive extracted for Windows x64."
  ${GetSize} "$INSTDIR" "/S=0K" $ChemVaultInstallSize $ChemVaultInstallFiles $0
  DetailPrint "Installed application files are being copied into: $INSTDIR"
  DetailPrint "Current installed payload: $ChemVaultInstallFiles files, $ChemVaultInstallSize KB."
  ${If} ${FileExists} "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
    DetailPrint "Verified desktop executable: $INSTDIR\${APP_EXECUTABLE_FILENAME}"
  ${EndIf}
  ${If} ${FileExists} "$INSTDIR\resources\app.asar"
    DetailPrint "Verified packaged application resources: $INSTDIR\resources\app.asar"
  ${EndIf}
!macroend

!macro customInstall
  SetDetailsPrint both
  DetailPrint "Writing Windows application registration and applying shortcut choices."
  ${If} ${FileExists} "$INSTDIR\${UNINSTALL_FILENAME}"
    DetailPrint "Verified uninstaller: $INSTDIR\${UNINSTALL_FILENAME}"
  ${EndIf}

  ${If} $ChemVaultStartMenuShortcutState == ${BST_CHECKED}
    ${IfNot} ${FileExists} "$newStartMenuLink"
      CreateShortCut "$newStartMenuLink" "$appExe" "" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
      ClearErrors
      WinShell::SetLnkAUMI "$newStartMenuLink" "${APP_ID}"
    ${EndIf}
    ${If} ${FileExists} "$newStartMenuLink"
      DetailPrint "Verified Start Menu shortcut: $newStartMenuLink"
    ${EndIf}
  ${Else}
    ${If} ${FileExists} "$newStartMenuLink"
      Delete "$newStartMenuLink"
      WinShell::UninstShortcut "$newStartMenuLink"
    ${EndIf}
    StrCpy $launchLink "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
    DetailPrint "Start Menu shortcut was skipped by user choice."
  ${EndIf}

  ${If} $ChemVaultDesktopShortcutState == ${BST_CHECKED}
    ${IfNot} ${FileExists} "$newDesktopLink"
      CreateShortCut "$newDesktopLink" "$appExe" "" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
      ClearErrors
      WinShell::SetLnkAUMI "$newDesktopLink" "${APP_ID}"
    ${EndIf}
    ${If} ${FileExists} "$newDesktopLink"
      DetailPrint "Verified desktop shortcut: $newDesktopLink"
    ${EndIf}
  ${Else}
    ${If} ${FileExists} "$newDesktopLink"
      Delete "$newDesktopLink"
      WinShell::UninstShortcut "$newDesktopLink"
    ${EndIf}
    DetailPrint "Desktop shortcut was skipped by user choice."
  ${EndIf}

  ${If} $ChemVaultEngineSetupState == ${BST_CHECKED}
    CreateDirectory "$APPDATA\ChemVault Model"
    DetailPrint "Created user data folder: $APPDATA\ChemVault Model"
    FileOpen $0 "$APPDATA\ChemVault Model\engine-setup-request.json" w
    FileWrite $0 "{$\"engines$\":[$\"pyscf$\"],$\"source$\":$\"installer$\",$\"message$\":$\"Installer requested local open-source engine setup.$\"}"
    FileClose $0
    DetailPrint "Wrote engine setup request: $APPDATA\ChemVault Model\engine-setup-request.json"
  ${Else}
    DetailPrint "Engine setup request was not written by user choice."
  ${EndIf}
!macroend
!endif
