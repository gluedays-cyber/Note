# Note - Editor & AIWriter

Note is a lightweight, intuitive text editor designed for streamlined document creation and AI-assisted writing. It features a split-pane interface with a Markdown editor on the left and an AI Assistant on the right.

---

## Key Features

- **Context-Aware AI Assistant**: 
  - **Full Document Context**: If no text is selected, the AI Assistant analyzes the entire content of the left editor panel.
  - **Selection Focus**: If you select a specific block of text, the AI Assistant will narrow its focus and process only the selected text.
- **Word Interpretation Shortcut (`F1`)**: Select any word or phrase in the editor and press `F1` to instantly pop up a markdown-rendered interpretation and explanation of the word.
- **Dual AI View Modes**:
  - **MD (Markdown) Mode**: Displays the AI response beautifully rendered as Markdown.
  - **SRC (Source) Mode**: Displays the raw text response, allowing you to edit the AI's output directly before copying or inserting it.

---

## Configuration

To use the AI Assistant, you must configure your API keys and models:

1. Click the gear icon (`⚙️`) next to the model dropdown at the bottom right.
2. Configure **Google API** or **Groq API**:
   - **Google API**: Input your Google API Key, along with target model names (e.g., `gemini-2.5-flash`) and their aliases.
   - **Groq API**: Input your Groq API Key, along with target model names (e.g., `llama-3.3-70b-versatile`) and their aliases.
3. Save the configurations. Your API keys are encrypted via Windows DPAPI and stored securely in `%USERPROFILE%\Documents\.apikeys.json`.

---

## Build Instructions

To build the executable, ensure you have [Go](https://go.dev/) installed.

1. Open a terminal (PowerShell) in the project root directory.
2. Run the build command (or execute `build_instruction.ps1`):
   ```powershell
   go build -ldflags="-H windowsgui" -o Note.exe
   ```
   or
   ```
   Remove-Item *.syso -ErrorAction SilentlyContinue
   go-winres make --arch amd64 --in winres\winres.json
   go build -ldflags="-H windowsgui" -o Note.exe
   ```
4. This generates `Note.exe` directly in the project root. Keep `Note.exe` in the same folder as the assets, or place it where you intend to run it, ensuring its path contains the required build structure.

---

## Default Text Editor Association in Windows

To use **Note** as your default editor for text (`.txt`) files:

1. Right-click any `.txt` file in Windows Explorer.
2. Select **Properties** (or **Open with** > **Choose another app**).
3. Click **Change...** next to "Opens with:".
4. Choose **More apps** > **Look for another app on this PC**.
5. Navigate to your build directory and select `Note.exe`.
6. Click **OK** / **Apply**.

---

## License

This project is licensed under the [MIT License](LICENSE). Feel free to modify, distribute, and use it in your projects.
