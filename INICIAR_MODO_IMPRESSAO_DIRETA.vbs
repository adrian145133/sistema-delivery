Set WshShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

edgePath = "C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe"
chromePath = "C:\Program Files\Google\Chrome\Application\chrome.exe"
appData = WshShell.ExpandEnvironmentStrings("%LOCALAPPDATA%")
targetUrl = "https://sistema-delivery-xi.vercel.app/pedidos.html"

If fso.FileExists(edgePath) Then
    WshShell.Run """" & edgePath & """ --app=""" & targetUrl & """ --kiosk-printing --user-data-dir=""" & appData & "\DeliveryKioskProfile""", 1, False
ElseIf fso.FileExists(chromePath) Then
    WshShell.Run """" & chromePath & """ --app=""" & targetUrl & """ --kiosk-printing --user-data-dir=""" & appData & "\DeliveryKioskProfile""", 1, False
Else
    WshShell.Run targetUrl, 1, False
End If
