package server

import (
	"fmt"
	"net"
	"net/http"

	"note/pkg/assets"
)

func StartLocalServer() string {
	mux := http.NewServeMux()
	mux.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/html; charset=utf-8")
		w.Write(assets.IndexHTML)
	})
	mux.HandleFunc("/style.css", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "text/css; charset=utf-8")
		w.Write(assets.StyleCSS)
	})
	mux.HandleFunc("/script.js", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/javascript; charset=utf-8")
		w.Write(assets.ScriptJS)
	})

	listener, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		panic(err)
	}
	port := listener.Addr().(*net.TCPAddr).Port
	startURL := fmt.Sprintf("http://127.0.0.1:%d", port)

	go func() {
		_ = http.Serve(listener, mux)
	}()

	return startURL
}
