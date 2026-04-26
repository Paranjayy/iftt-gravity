; ==============================================================================
; GRAVITY HUB - WINDOWS GAMING SENTRY (AutoHotkey v1)
; ==============================================================================
; This script acts as a sensor on your Windows PC. It detects when you are 
; playing Valorant or CS2, blocks the Windows Key to prevent accidental 
; presses, and pings the Mac Gravity Hub to dim the room.
; ==============================================================================

#NoEnv
#Persistent
#SingleInstance Force
SendMode Input
SetWorkingDir %A_ScriptDir%

; --- CONFIGURATION ---
; Replace this with the actual IP address of your Mac running Gravity Hub
Global GravityMacIP := "192.168.29.50" 
Global GravityPort := "3030"

; State Trackers
Global CurrentState := "IDLE"

; Loop every 2 seconds to check window state
SetTimer, CheckGameState, 2000
return

; ==============================================================================
; 🛑 GAMING HOTKEY FIXES (Only active during games)
; ==============================================================================
#IfWinActive ahk_exe VALORANT-Win64-Shipping.exe
LWin::Return ; Block Left Windows Key
RWin::Return ; Block Right Windows Key
!Space::Return ; Block Alt+Space (Window Menu Freeze)
^Esc::Return ; Block Ctrl+Esc (Start Menu)
#IfWinActive

#IfWinActive ahk_exe cs2.exe
LWin::Return
RWin::Return
!Space::Return
^Esc::Return
#IfWinActive

; ==============================================================================
; 📡 GRAVITY HUB PINGER
; ==============================================================================
CheckGameState:
    If WinActive("ahk_exe VALORANT-Win64-Shipping.exe")
    {
        if (CurrentState != "VALORANT") {
            CurrentState := "VALORANT"
            TriggerGravityScene("GAME_VALO")
        }
    }
    else If WinActive("ahk_exe cs2.exe")
    {
        if (CurrentState != "CS2") {
            CurrentState := "CS2"
            TriggerGravityScene("GAME_CS2")
        }
    }
    else
    {
        if (CurrentState != "IDLE") {
            CurrentState := "IDLE"
            TriggerGravityScene("GAME_IDLE")
        }
    }
return

TriggerGravityScene(SceneName) {
    Try {
        whr := ComObjCreate("WinHttp.WinHttpRequest.5.1")
        url := "http://" . GravityMacIP . ":" . GravityPort . "/scene/" . SceneName
        whr.Open("GET", url, true) ; true = async
        whr.Send()
    } Catch e {
        ; Ignore errors if Mac is offline
    }
}
