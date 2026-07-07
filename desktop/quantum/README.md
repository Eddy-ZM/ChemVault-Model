# Optional Quantum Engine Bundle

ChemVault Model can run professional Windows desktop quantum calculations
through xTB GFN2-xTB. The web app keeps the browser-side approximate standard,
and the Apple app is not required to ship a local quantum engine at this stage.

The Windows desktop app also exposes an external engine port for user-licensed
Gaussian and ORCA installations. Those commercial engines are not bundled here;
users configure their own executable paths in the desktop calculation panel.

To bundle xTB into the Windows installer, place the complete Windows xTB
runtime under:

```text
desktop/quantum/xtb/
```

The expected executable paths are:

```text
desktop/quantum/xtb/xtb.exe
desktop/quantum/xtb/bin/xtb.exe
```

Do not commit third-party binary files unless their license and distribution
terms have been reviewed. If xTB is not bundled, the Windows desktop app will
also look for `CHEMVAULT_XTB_PATH` and then `xtb.exe` on the system `PATH`.
