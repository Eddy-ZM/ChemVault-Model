!include LogicLib.nsh
!include nsDialogs.nsh
!include WinMessages.nsh

ManifestDPIAware true

!ifndef BUILD_UNINSTALLER
Var ChemVaultEngineSetupCheckbox
Var ChemVaultEngineSetupState
Var ChemVaultEngineSetupTitle
Var ChemVaultEngineSetupBody
Var ChemVaultEngineSetupNote
Var ChemVaultEngineSetupTitleFont
Var ChemVaultEngineSetupBodyFont

!macro customPageAfterChangeDir
  Page custom ChemVaultEngineSetupPageCreate ChemVaultEngineSetupPageLeave
!macroend

Function ChemVaultEngineSetupPageCreate
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}

  CreateFont $ChemVaultEngineSetupTitleFont "Segoe UI" 12 700
  CreateFont $ChemVaultEngineSetupBodyFont "Segoe UI" 10 400

  ${NSD_CreateLabel} 0 0 100% 20u "Local quantum engine setup"
  Pop $ChemVaultEngineSetupTitle
  SendMessage $ChemVaultEngineSetupTitle ${WM_SETFONT} $ChemVaultEngineSetupTitleFont 1
  SetCtlColors $ChemVaultEngineSetupTitle 0x111827 transparent

  ${NSD_CreateLabel} 0 28u 100% 42u "ChemVault Model can scan this computer for installed quantum engines after setup. PySCF can be installed into a managed local folder from the app."
  Pop $ChemVaultEngineSetupBody
  SendMessage $ChemVaultEngineSetupBody ${WM_SETFONT} $ChemVaultEngineSetupBodyFont 1
  SetCtlColors $ChemVaultEngineSetupBody 0x1F2937 transparent

  ${NSD_CreateCheckbox} 0 78u 100% 18u "Ask to install PySCF on first launch"
  Pop $ChemVaultEngineSetupCheckbox
  SendMessage $ChemVaultEngineSetupCheckbox ${WM_SETFONT} $ChemVaultEngineSetupBodyFont 1
  ${NSD_SetState} $ChemVaultEngineSetupCheckbox ${BST_CHECKED}

  ${NSD_CreateLabel} 0 106u 100% 32u "Gaussian and ORCA are not installed by this setup. ChemVault only detects existing licensed installations and lets you choose their executable paths."
  Pop $ChemVaultEngineSetupNote
  SendMessage $ChemVaultEngineSetupNote ${WM_SETFONT} $ChemVaultEngineSetupBodyFont 1
  SetCtlColors $ChemVaultEngineSetupNote 0x374151 transparent

  nsDialogs::Show
FunctionEnd

Function ChemVaultEngineSetupPageLeave
  ${NSD_GetState} $ChemVaultEngineSetupCheckbox $ChemVaultEngineSetupState
FunctionEnd

!macro customInstall
  ${If} $ChemVaultEngineSetupState == ${BST_CHECKED}
    CreateDirectory "$APPDATA\ChemVault Model"
    FileOpen $0 "$APPDATA\ChemVault Model\engine-setup-request.json" w
    FileWrite $0 "{$\"engines$\":[$\"pyscf$\"],$\"source$\":$\"installer$\",$\"message$\":$\"Installer requested local open-source engine setup.$\"}"
    FileClose $0
  ${EndIf}
!macroend
!endif
