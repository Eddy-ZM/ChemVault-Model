!include LogicLib.nsh
!include nsDialogs.nsh

!ifndef BUILD_UNINSTALLER
Var ChemVaultEngineSetupCheckbox
Var ChemVaultEngineSetupState

!macro customPageAfterChangeDir
  Page custom ChemVaultEngineSetupPageCreate ChemVaultEngineSetupPageLeave
!macroend

Function ChemVaultEngineSetupPageCreate
  nsDialogs::Create 1018
  Pop $0
  ${If} $0 == error
    Abort
  ${EndIf}

  ${NSD_CreateLabel} 0 0 100% 26u "Local quantum engine setup"
  Pop $0
  ${NSD_CreateLabel} 0 28u 100% 34u "ChemVault Model can search this computer for installed quantum engines after setup. Open-source PySCF can be installed into ChemVault's managed engine folder from the app."
  Pop $0
  ${NSD_CreateCheckbox} 0 72u 100% 18u "Ask to install the local open-source PySCF engine on first launch"
  Pop $ChemVaultEngineSetupCheckbox
  ${NSD_SetState} $ChemVaultEngineSetupCheckbox ${BST_CHECKED}
  ${NSD_CreateLabel} 0 96u 100% 30u "Commercial engines such as Gaussian or ORCA are not installed by this setup. The app will only search for existing licensed installations and let you choose their executable paths."
  Pop $0

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
