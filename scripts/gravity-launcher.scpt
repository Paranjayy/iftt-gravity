-- Gravity Mission Control Launcher
-- Allows one-click access to the Dashboard and Raycast commands

set choice to choose from list {"🚀 Open Mission Dashboard", "📡 Open Mission Control (Raycast)", "🧠 Restart Hub Cortex"} with title "🪐 Gravity Mission Control" with prompt "Select a command:" default items {"🚀 Open Mission Dashboard"}

if choice is false then return

set cmd to item 1 of choice

if cmd is "🚀 Open Mission Dashboard" then
	do shell script "open http://localhost:3000/dashboard"
else if cmd is "📡 Open Mission Control (Raycast)" then
	tell application "Raycast" to activate
	-- Simulating typing "Control House" since Raycast doesn't have a deep link API for specific commands easily
	tell application "System Events"
		keystroke "Control House"
		key code 36 -- Enter
	end tell
else if cmd is "🧠 Restart Hub Cortex" then
	do shell script "/Users/paranjay/Developer/iftt/hub.sh"
	display notification "Gravity Hub Restarted" with title "Gravity Hub"
end if
