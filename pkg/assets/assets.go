package assets

import (
	_ "embed"
)

//go:embed index.html
var IndexHTML []byte

//go:embed style.css
var StyleCSS []byte

//go:embed script.js
var ScriptJS []byte
