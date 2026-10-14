Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
strPath = fso.GetParentFolderName(WScript.ScriptFullName)

' Inicia o servidor local 100% invisivel em segundo plano (flag 0 = janela oculta)
WshShell.Run "cmd /c node """ & strPath & "\server.js""", 0, False

WScript.Sleep 1000

' Abre o Microsoft Edge no modo de impressao direta
edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
If fso.FileExists(edgePath) Then
    WshShell.Run """" & edgePath & """ --kiosk-printing --user-data-dir=""" & strPath & "\edge_profile"" ""http://localhost:3000/pedidos.html""", 1, False
Else
    WshShell.Run "http://localhost:3000/pedidos.html", 1, False
End If
