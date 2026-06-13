package main

import (
	"syscall"

	"github.com/jchv/go-webview2"

	"note/pkg/api"
	"note/pkg/server"
)

// 메인 함수
func main() {
	wInstance := webview2.New(true)
	defer wInstance.Destroy()

	wInstance.SetTitle("Note - Editor & AIWriter")
	wInstance.SetSize(1280, 900, webview2.HintNone)

	hwnd := wInstance.Window()
	if hwnd != nil {
		user32 := syscall.NewLazyDLL("user32.dll")
		getSystemMetrics := user32.NewProc("GetSystemMetrics")
		moveWindow := user32.NewProc("MoveWindow")

		screenWidth, _, _ := getSystemMetrics.Call(0)
		screenHeight, _, _ := getSystemMetrics.Call(1)

		width := uintptr(1280)
		height := uintptr(900)

		if width > screenWidth {
			width = screenWidth
		}
		if height > screenHeight {
			height = screenHeight
		}

		x := (screenWidth - width) / 2
		y := (screenHeight - height) / 2

		if y > 20 {
			y = y - 20
		}

		moveWindow.Call(uintptr(hwnd), x, y, width, height, 1)

		showWindow := user32.NewProc("ShowWindow")
		showWindow.Call(uintptr(hwnd), 1)

		kernel32 := syscall.NewLazyDLL("kernel32.dll")
		getModuleHandle := kernel32.NewProc("GetModuleHandleW")
		hInst, _, _ := getModuleHandle.Call(0)

		loadImage := user32.NewProc("LoadImageW")
		hIcon, _, _ := loadImage.Call(
			hInst,
			uintptr(1),
			1,
			0,
			0,
			0x00008000|0x00000040,
		)
		if hIcon != 0 {
			sendMessage := user32.NewProc("SendMessageW")
			sendMessage.Call(uintptr(hwnd), 0x0080, 0, hIcon)
			sendMessage.Call(uintptr(hwnd), 0x0080, 1, hIcon)
		}
	}

	api.RegisterAPIs(wInstance)

	startURL := server.StartLocalServer()

	wInstance.Navigate(startURL)
	wInstance.Run()
}
