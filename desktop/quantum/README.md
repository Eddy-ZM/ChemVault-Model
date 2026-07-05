# Optional Quantum Engine Bundle

ChemVault Model can run professional desktop quantum calculations through xTB.

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
terms have been reviewed. If xTB is not bundled, the desktop app will also look
for `CHEMVAULT_XTB_PATH` and then `xtb.exe` on the system `PATH`.
