!include LogicLib.nsh
!include nsDialogs.nsh
!include WinMessages.nsh

ManifestDPIAware true
ShowInstDetails show
ShowUninstDetails show
!define MUI_INSTFILESPAGE_SHOWDETAILS

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

  ${NSD_CreateLabel} 0 28u 100% 30u "ChemVault Model can scan this computer for installed quantum engines after setup. PySCF can be installed into a managed local folder from the app."
  Pop $ChemVaultEngineSetupBody
  SendMessage $ChemVaultEngineSetupBody ${WM_SETFONT} $ChemVaultEngineSetupBodyFont 1
  SetCtlColors $ChemVaultEngineSetupBody 0x1F2937 transparent

  ${NSD_CreateLabel} 0 62u 100% 34u "This setup installs: ChemVault Model desktop app, local web UI assets, 3D viewer runtime, shortcuts, and the engine setup request."
  Pop $ChemVaultEngineSetupDetails
  SendMessage $ChemVaultEngineSetupDetails ${WM_SETFONT} $ChemVaultEngineSetupBodyFont 1
  SetCtlColors $ChemVaultEngineSetupDetails 0x1F2937 transparent

  ${NSD_CreateCheckbox} 0 104u 100% 18u "Ask to install PySCF on first launch"
  Pop $ChemVaultEngineSetupCheckbox
  SendMessage $ChemVaultEngineSetupCheckbox ${WM_SETFONT} $ChemVaultEngineSetupBodyFont 1
  ${NSD_SetState} $ChemVaultEngineSetupCheckbox ${BST_CHECKED}

  ${NSD_CreateLabel} 0 130u 100% 36u "Not installed here: PySCF packages, xTB, Psi4, Gaussian, or ORCA binaries. The app shows progress when PySCF is installed later."
  Pop $ChemVaultEngineSetupCommercial
  SendMessage $ChemVaultEngineSetupCommercial ${WM_SETFONT} $ChemVaultEngineSetupBodyFont 1
  SetCtlColors $ChemVaultEngineSetupCommercial 0x374151 transparent

  nsDialogs::Show
FunctionEnd

Function ChemVaultEngineSetupPageLeave
  ${NSD_GetState} $ChemVaultEngineSetupCheckbox $ChemVaultEngineSetupState
FunctionEnd

!macro customInstall
  DetailPrint "Installing ChemVault Model desktop application."
  DetailPrint "Installing local web interface, molecule viewer assets, and desktop runtime."
  DetailPrint "Installing shortcuts and application registration."
  ${If} $ChemVaultEngineSetupState == ${BST_CHECKED}
    DetailPrint "Writing first-launch request for PySCF engine setup."
    CreateDirectory "$APPDATA\ChemVault Model"
    FileOpen $0 "$APPDATA\ChemVault Model\engine-setup-request.json" w
    FileWrite $0 "{$\"engines$\":[$\"pyscf$\"],$\"source$\":$\"installer$\",$\"message$\":$\"Installer requested local open-source engine setup.$\"}"
    FileClose $0
  ${Else}
    DetailPrint "Skipping first-launch PySCF engine setup request."
  ${EndIf}
  DetailPrint "Commercial engines are not bundled. ChemVault will only detect existing licensed installations."
!macroend
!endif
