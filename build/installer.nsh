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
Var ChemVaultEngineSetupTitle
Var ChemVaultEngineSetupBody
Var ChemVaultEngineSetupDetails
Var ChemVaultEngineSetupCommercial
Var ChemVaultEngineSetupTitleFont
Var ChemVaultEngineSetupBodyFont

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

  ${NSD_CreateLabel} 0 0 100% 18u "Install details and quantum setup"
  Pop $ChemVaultEngineSetupTitle
  SendMessage $ChemVaultEngineSetupTitle ${WM_SETFONT} $ChemVaultEngineSetupTitleFont 1
  SetCtlColors $ChemVaultEngineSetupTitle 0x111827 transparent

  ${NSD_CreateLabel} 0 24u 100% 28u "This setup installs ChemVault Model, the local desktop interface, molecular viewer assets, shortcuts, and update metadata."
  Pop $ChemVaultEngineSetupBody
  SendMessage $ChemVaultEngineSetupBody ${WM_SETFONT} $ChemVaultEngineSetupBodyFont 1
  SetCtlColors $ChemVaultEngineSetupBody 0x1F2937 transparent

  ${NSD_CreateLabel} 0 58u 100% 18u "Install progress details are expanded on the next page."
  Pop $ChemVaultEngineSetupDetails
  SendMessage $ChemVaultEngineSetupDetails ${WM_SETFONT} $ChemVaultEngineSetupBodyFont 1
  SetCtlColors $ChemVaultEngineSetupDetails 0x1F2937 transparent

  ${NSD_CreateLabel} 0 82u 100% 18u "Not included: PySCF, xTB, Psi4, Gaussian, or ORCA binaries."
  Pop $ChemVaultEngineSetupCommercial
  SendMessage $ChemVaultEngineSetupCommercial ${WM_SETFONT} $ChemVaultEngineSetupBodyFont 1
  SetCtlColors $ChemVaultEngineSetupCommercial 0x374151 transparent

  ${NSD_CreateCheckbox} 0 106u 100% 18u "Prompt for PySCF setup on first launch"
  Pop $ChemVaultEngineSetupCheckbox
  SendMessage $ChemVaultEngineSetupCheckbox ${WM_SETFONT} $ChemVaultEngineSetupBodyFont 1
  ${NSD_SetState} $ChemVaultEngineSetupCheckbox ${BST_CHECKED}

  nsDialogs::Show
FunctionEnd

Function ChemVaultEngineSetupPageLeave
  ${NSD_GetState} $ChemVaultEngineSetupCheckbox $ChemVaultEngineSetupState
FunctionEnd

Function ChemVaultInstFilesPageShow
  SetDetailsView show
  SetDetailsPrint both
FunctionEnd

!macro customInstall
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
