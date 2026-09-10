; Consistency era o Crava. Como o identificador do app mudou, o Windows trataria
; os dois como programas diferentes. Antes de instalar, desinstala o antigo em
; silêncio (os dados dele ficam: o app novo copia tudo na primeira abertura).
!macro customInit
  IfFileExists "$LOCALAPPDATA\Programs\Crava\Uninstall Crava.exe" 0 semCravaAntigo
    ExecWait '"$LOCALAPPDATA\Programs\Crava\Uninstall Crava.exe" /S _?=$LOCALAPPDATA\Programs\Crava'
    RMDir /r "$LOCALAPPDATA\Programs\Crava"
  semCravaAntigo:
!macroend
