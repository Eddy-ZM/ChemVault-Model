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

  ${NSD_CreateLabel} 0 54u 100% 18u "Detailed installation progress is shown in English on the next page."
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
  DetailPrint "Starting ChemVault Model setup in English."
  DetailPrint "Install destination: $INSTDIR"
  DetailPrint "Waiting for packaged application extraction to begin."
FunctionEnd

!macro customFiles_x64
  SetDetailsPrint both
  DetailPrint "Extracting Windows x64 application payload into the install destination."
  DetailPrint "Copying desktop runtime, local web interface assets, and molecule viewer resources."
  ${GetSize} "$INSTDIR" "/S=0K" $ChemVaultInstallSize $ChemVaultInstallFiles $0
  DetailPrint "Current payload count: $ChemVaultInstallFiles files."
  DetailPrint "Current payload size: $ChemVaultInstallSize KB."
  ${If} ${FileExists} "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
    DetailPrint "Verified application executable: $INSTDIR\${APP_EXECUTABLE_FILENAME}"
  ${Else}
    DetailPrint "Application executable is not visible yet; setup will continue verifying later."
  ${EndIf}
  ${If} ${FileExists} "$INSTDIR\resources\app.asar"
    DetailPrint "Verified packaged application resources: $INSTDIR\resources\app.asar"
  ${Else}
    DetailPrint "Packaged application resources are not visible yet; setup will continue verifying later."
  ${EndIf}
  ${If} ${FileExists} "$INSTDIR\resources\quantum"
    DetailPrint "Verified bundled quantum resource folder: $INSTDIR\resources\quantum"
  ${EndIf}
!macroend

!macro customInstall
  SetDetailsPrint both
  DetailPrint "Writing Windows application registration entries."
  ${If} ${FileExists} "$INSTDIR\${UNINSTALL_FILENAME}"
    DetailPrint "Verified uninstaller: $INSTDIR\${UNINSTALL_FILENAME}"
  ${Else}
    DetailPrint "Uninstaller file is not visible yet; setup will continue."
  ${EndIf}

  ${If} $ChemVaultStartMenuShortcutState == ${BST_CHECKED}
    DetailPrint "User selected Start Menu shortcut creation."
    DetailPrint "Target Start Menu shortcut: $newStartMenuLink"
    ${IfNot} ${FileExists} "$newStartMenuLink"
      DetailPrint "Creating Start Menu shortcut."
      CreateShortCut "$newStartMenuLink" "$appExe" "" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
      ClearErrors
      WinShell::SetLnkAUMI "$newStartMenuLink" "${APP_ID}"
    ${Else}
      DetailPrint "Start Menu shortcut already exists; keeping current shortcut."
    ${EndIf}
    ${If} ${FileExists} "$newStartMenuLink"
      DetailPrint "Verified Start Menu shortcut: $newStartMenuLink"
    ${EndIf}
  ${Else}
    DetailPrint "User skipped Start Menu shortcut creation."
    ${If} ${FileExists} "$newStartMenuLink"
      DetailPrint "Removing existing Start Menu shortcut because the option was cleared."
      Delete "$newStartMenuLink"
      WinShell::UninstShortcut "$newStartMenuLink"
    ${EndIf}
    StrCpy $launchLink "$INSTDIR\${APP_EXECUTABLE_FILENAME}"
    DetailPrint "Start Menu shortcut was skipped by user choice."
  ${EndIf}

  ${If} $ChemVaultDesktopShortcutState == ${BST_CHECKED}
    DetailPrint "User selected desktop shortcut creation."
    DetailPrint "Target desktop shortcut: $newDesktopLink"
    ${IfNot} ${FileExists} "$newDesktopLink"
      DetailPrint "Creating desktop shortcut."
      CreateShortCut "$newDesktopLink" "$appExe" "" "$appExe" 0 "" "" "${APP_DESCRIPTION}"
      ClearErrors
      WinShell::SetLnkAUMI "$newDesktopLink" "${APP_ID}"
    ${Else}
      DetailPrint "Desktop shortcut already exists; keeping current shortcut."
    ${EndIf}
    ${If} ${FileExists} "$newDesktopLink"
      DetailPrint "Verified desktop shortcut: $newDesktopLink"
    ${EndIf}
  ${Else}
    DetailPrint "User skipped desktop shortcut creation."
    ${If} ${FileExists} "$newDesktopLink"
      DetailPrint "Removing existing desktop shortcut because the option was cleared."
      Delete "$newDesktopLink"
      WinShell::UninstShortcut "$newDesktopLink"
    ${EndIf}
    DetailPrint "Desktop shortcut was skipped by user choice."
  ${EndIf}

  ${If} $ChemVaultEngineSetupState == ${BST_CHECKED}
    DetailPrint "User selected first-launch PySCF setup prompt."
    DetailPrint "Creating ChemVault user data folder for setup request."
    CreateDirectory "$APPDATA\ChemVault Model"
    DetailPrint "Created user data folder: $APPDATA\ChemVault Model"
    DetailPrint "Opening engine setup request file for writing."
    FileOpen $0 "$APPDATA\ChemVault Model\engine-setup-request.json" w
    DetailPrint "Writing engine setup request JSON."
    FileWrite $0 "{$\"engines$\":[$\"pyscf$\"],$\"source$\":$\"installer$\",$\"message$\":$\"Installer requested local open-source engine setup.$\"}"
    FileClose $0
    DetailPrint "Closed engine setup request file."
    DetailPrint "Wrote engine setup request: $APPDATA\ChemVault Model\engine-setup-request.json"
  ${Else}
    DetailPrint "Engine setup request was not written by user choice."
  ${EndIf}
  DetailPrint "ChemVault Model setup operations completed."
!macroend
!endif
