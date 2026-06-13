const mainContainer = document.querySelector('.main-container');

let editorInstance = null;
let aiPreviewInstance = null;
let currentFilePath = "";

// DOM 요소 참조
const editorElement = document.getElementById('editor');
const aiPreviewSrcElement = document.getElementById('ai-preview-src');
const aiPreviewMdElement = document.getElementById('ai-preview-md');
const aiPromptInput = document.getElementById('ai-promptInput');

function toggleAiView(mode) {
    const mdBtn = document.getElementById('ai-btn-md');
    const srcBtn = document.getElementById('ai-btn-src');
    const mdView = document.getElementById('ai-preview-md');
    const srcView = document.getElementById('ai-preview-src');
    
    if (mode === 'md') {
        mdBtn.classList.add('active');
        srcBtn.classList.remove('active');
        mdView.style.display = 'block';
        srcView.style.display = 'none';
        if (mdView && srcView) {
            mdView.innerHTML = renderMarkdown(srcView.value);
        }
    } else {
        mdBtn.classList.remove('active');
        srcBtn.classList.add('active');
        mdView.style.display = 'none';
        srcView.style.display = 'block';
    }
}

function renderMarkdown(md) {
    if (!md) return "";
    let html = md
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    
    html = html.replace(/\x60\x60\x60([\s\S]*?)\x60\x60\x60/g, function(match, code) {
        return '<pre><code>' + code.trim() + '</code></pre>';
    });
    
    html = html.replace(/\x60([^\x60]+)\x60/g, '<code>$1</code>');
    html = html.replace(/^\s*###\s+(.*)$/gm, '<h3>$1</h3>');
    html = html.replace(/^\s*##\s+(.*)$/gm, '<h2>$1</h2>');
    html = html.replace(/^\s*#\s+(.*)$/gm, '<h1>$1</h1>');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    html = html.replace(/^\s*[-*]\s+(.*)$/gm, '<li>$1</li>');
    
    const preBlocks = [];
    html = html.replace(/<pre>[\s\S]*?<\/pre>/g, function(match) {
        preBlocks.push(match);
        return '%%PRE_BLOCK_' + (preBlocks.length - 1) + '%%';
    });
    
    html = html.replace(/\n/g, '<br>');
    html = html.replace(/%%PRE_BLOCK_(\d+)%%/g, function(match, index) {
        return preBlocks[parseInt(index)];
    });
    
    return html;
}

// 테마 초기 클래스 적용
document.body.className = 'light-theme';

// getValue / setValue 헬퍼 함수 정의
function getValue(element) {
    return element ? element.value : "";
}

// UI Title 업데이트 함수
function updateTitleDisplay(filePath) {
    const fileTitleElem = document.getElementById('file-title');
    if (filePath) {
        const parts = filePath.split('/');
        const fileName = parts[parts.length - 1];
        fileTitleElem.textContent = fileName;
        document.title = "StyledText - " + fileName;
    } else {
        fileTitleElem.textContent = "이름없는 텍스트";
        document.title = "StyledText - 이름없는 텍스트";
    }
}

function setValue(element, value) {
    if (element) {
        element.value = value;
        element.dispatchEvent(new Event('input', { bubbles: true }));
    }
}

// 새 파일 트리거 함수
function triggerNewFile() {
    currentFilePath = "noname.txt";
    setValue(editorElement, "");
    updateTitleDisplay(currentFilePath);
}

// 파일 불러오기 트리거 함수
function triggerLoadFile() {
    window.apiOpenDialog(currentFilePath)
    .then(res => {
        if (res && res.path) {
            currentFilePath = res.path.replace(/\\/g, '/');
            window.apiLoad(currentFilePath)
            .then(data => {
                setValue(editorElement, data.content);
                updateTitleDisplay(currentFilePath);
            })
            .catch(err => console.error("파일 로드 실패:", err));
        }
    })
    .catch(err => console.error("열기 창 로드 실패:", err));
}

// 파일 저장 트리거 함수 (저장 버튼 클릭 시 무조건 SaveAs Dialog를 실행)
function triggerSaveFile() {
    window.apiSaveAsDialog(currentFilePath)
    .then(res => {
        if (res && res.path) {
            currentFilePath = res.path.replace(/\\/g, '/');
            window.apiSave(currentFilePath, getValue(editorElement))
            .then(() => {
                updateTitleDisplay(currentFilePath);
            })
            .catch(err => console.error("파일 저장 실패:", err));
        }
    })
    .catch(err => console.error("저장 창 로드 실패:", err));
}

// 단어 선택 영역 텍스트 추출 함수
// 단어 해석 실행 함수
function getSelectedText() {
    let text = "";
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === "TEXTAREA" || activeEl.tagName === "INPUT")) {
        text = activeEl.value.substring(activeEl.selectionStart, activeEl.selectionEnd);
    } else {
        text = window.getSelection().toString();
    }
    return text.trim();
}

function triggerWordInterpretation() {
    const selectedText = getSelectedText();
    if (!selectedText) {
        return;
    }

    const modelSel = document.getElementById('model-select');
    const selectedModel = modelSel ? modelSel.value : '';
    if (!selectedModel) {
        alert("모델이 설정되지 않았다. API 키 설정에서 모델을 등록하라.");
        return;
    }

    const modal = document.getElementById('word-modal');
    const modalTitle = document.getElementById('word-modal-title');
    const modalContent = document.getElementById('word-modal-content');
    const modalModel = document.getElementById('word-modal-model');
    
    if (modalTitle) {
        modalTitle.textContent = "해석: " + selectedText;
    }
    if (modalContent) {
        modalContent.innerHTML = "<p>⚡ 해석 준비중...</p>";
    }
    if (modalModel) {
        let modelDisplayName = selectedModel;
        if (modelSel && modelSel.selectedIndex !== -1) {
            modelDisplayName = modelSel.options[modelSel.selectedIndex].textContent || selectedModel;
        }
        modalModel.textContent = "모델: " + modelDisplayName.replace("✨ ", "");
    }
    if (modal) {
        modal.classList.add('show');
    }

    const instruction = "선택된 단어/어구 \"" + selectedText + "\"의 뜻을 한글로 명확하고 간단하게 해석하고 설명하라.";

    let fullResponse = "";
    window.onAiChunk = (data) => {
        if (data.response) {
            fullResponse += data.response;
            if (modalContent) {
                modalContent.innerHTML = renderMarkdown(fullResponse);
            }
        }

        if (data.done && fullResponse === "") {
            const errMsg = '❌ 응답 없음: API 키 또는 네트워크 오류일 수 있다.';
            if (modalContent) {
                modalContent.innerHTML = '<p style="color:red;">' + errMsg + '</p>';
            }
        }
    };

    const mainDoc = getValue(editorElement);
    window.apiAiChat(instruction, mainDoc, selectedText, selectedModel)
    .catch(error => {
        console.error("통신 에러 발생:", error);
        const errMsg = "❌ 통신 에러 발생!\n" + error.message;
        if (modalContent) {
            modalContent.innerHTML = '<p style="color:red;">' + errMsg.replace(/\n/g, '<br>') + '</p>';
        }
    });
}

// Ctrl+O, Ctrl+S 및 F1 단축키 연동
window.addEventListener('keydown', function(e) {
    if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        triggerSaveFile();
    }
    if (e.ctrlKey && e.key === 'o') {
        e.preventDefault();
        triggerLoadFile();
    }
    if (e.key === 'F1') {
        e.preventDefault();
        triggerWordInterpretation();
    }
});

// Tab 키 처리 함수 (Undo/Redo를 보존하기 위해 document.execCommand('insertText') 사용)
function handleTabKey(e, element) {
    if (e.key === 'Tab') {
        e.preventDefault();
        if (!document.execCommand('insertText', false, '    ')) {
            const start = element.selectionStart;
            const end = element.selectionEnd;
            const value = element.value;
            element.value = value.substring(0, start) + '    ' + value.substring(end);
            element.selectionStart = element.selectionEnd = start + 4;
        }
    }
}

// Tab 키 이벤트 리스너 등록
editorElement.addEventListener('keydown', function(e) {
    handleTabKey(e, this);
});
if (aiPreviewSrcElement) {
    aiPreviewSrcElement.addEventListener('keydown', function(e) {
        handleTabKey(e, this);
    });
    aiPreviewSrcElement.addEventListener('input', function() {
        lastTextResponse = this.value;
    });
}

// 문서 저장 함수 (에디터 변경 사항 API 전송)
function saveDocumentContent(content) {
    if (!currentFilePath) return;
    window.apiSave(currentFilePath, content).catch(err => console.error("임시 저장 실패:", err));
}

// editor 입력 감지 시 자동 저장
editorElement.addEventListener('input', function() {
    saveDocumentContent(this.value);
});

// 문서 초기 로드 및 에디터 데이터 삽입
function loadDocument() {
    const loadFile = () => {
        window.apiLoad(currentFilePath)
        .then(data => {
            setValue(editorElement, data.content);
            updateTitleDisplay(currentFilePath);
        })
        .catch(err => console.error("파일 로드 실패:", err));
    };

    window.getInitData()
    .then(data => {
        if (data && data.targetFile) {
            currentFilePath = data.targetFile.replace(/\\/g, '/');
            loadFile();
        } else {
            updateTitleDisplay("");
        }
    })
    .catch(err => console.error("초기 경로 로드 실패:", err));
}

// ==========================================================
// AIWriter 관련 기능 바인딩 및 이벤트 처리
// ==========================================================

let lastTextResponse = "";
const promptHistory = [];
let historyIndex = -1;
let tempPromptInput = "";

// 위로 복사해 넣기 (ai-preview 선택 영역 -> 메인 에디터 커서 위치)
function aiInsertToMonaco() {
    const aiText = getValue(aiPreviewSrcElement);
    const start = aiPreviewSrcElement ? aiPreviewSrcElement.selectionStart : 0;
    const end = aiPreviewSrcElement ? aiPreviewSrcElement.selectionEnd : 0;
    const textToInsert = aiText.substring(start, end);

    if (!textToInsert.trim()) {
        alert("답변 에디터에서 메인 에디터로 복사할 텍스트 영역을 선택해야 한다.");
        return;
    }

    editorElement.focus();
    if (!document.execCommand('insertText', false, textToInsert)) {
        const estart = editorElement.selectionStart;
        const eend = editorElement.selectionEnd;
        const evalue = editorElement.value;
        editorElement.value = evalue.substring(0, estart) + textToInsert + evalue.substring(eend);
        editorElement.selectionStart = editorElement.selectionEnd = estart + textToInsert.length;
        saveDocumentContent(editorElement.value);
    }
}

aiPromptInput.placeholder = "AI에게 지시할 내용을 입력하세요 (Enter 전송)";

// 프롬프트 엔터 전송 및 히스토리
aiPromptInput.addEventListener('keydown', function(e) {
    if (e.key === 'ArrowUp' && !e.shiftKey) {
        const lines = aiPromptInput.value.split('\n');
        const cursorPosition = aiPromptInput.selectionStart;
        const firstLineLength = lines[0].length;

        if (cursorPosition <= firstLineLength && promptHistory.length > 0) {
            if (historyIndex === -1) {
                tempPromptInput = aiPromptInput.value;
            }
            if (historyIndex < promptHistory.length - 1) {
                e.preventDefault();
                historyIndex++;
                aiPromptInput.value = promptHistory[promptHistory.length - 1 - historyIndex];
                aiPromptInput.selectionStart = aiPromptInput.selectionEnd = aiPromptInput.value.length;
            }
        }
    }

    if (e.key === 'ArrowDown' && !e.shiftKey) {
        const lines = aiPromptInput.value.split('\n');
        const cursorPosition = aiPromptInput.selectionStart;
        const lastLineLength = lines[lines.length - 1].length;
        const textLength = aiPromptInput.value.length;

        if (cursorPosition >= textLength - lastLineLength) {
            if (historyIndex >= 0) {
                e.preventDefault();
                historyIndex--;
                if (historyIndex === -1) {
                    aiPromptInput.value = tempPromptInput;
                } else {
                    aiPromptInput.value = promptHistory[promptHistory.length - 1 - historyIndex];
                }
                aiPromptInput.selectionStart = aiPromptInput.selectionEnd = aiPromptInput.value.length;
            }
        }
    }

    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        
        if (aiPromptInput.disabled) return;

        const instruction = aiPromptInput.value.trim();
        if (!instruction) return;

        const modelSel = document.getElementById('model-select');
        const selectedModel = modelSel ? modelSel.value : '';
        if (!selectedModel) {
            alert("모델이 설정되지 않았다. API 키 설정에서 모델을 등록하라.");
            return;
        }

        const mainDoc = getValue(editorElement);

        let selectedText = "";
        const mainStart = editorElement.selectionStart;
        const mainEnd = editorElement.selectionEnd;
        if (mainStart !== mainEnd) {
            selectedText = editorElement.value.substring(mainStart, mainEnd);
        } else {
            const aiStart = aiPreviewSrcElement ? aiPreviewSrcElement.selectionStart : 0;
            const aiEnd = aiPreviewSrcElement ? aiPreviewSrcElement.selectionEnd : 0;
            if (aiStart !== aiEnd) {
                selectedText = aiPreviewSrcElement.value.substring(aiStart, aiEnd);
            }
        }

        promptHistory.push(aiPromptInput.value);
        historyIndex = -1;
        tempPromptInput = "";
        
        aiPromptInput.value = '';     
        lastTextResponse = "";

        let fullResponse = "";
        let waitingMsg = "⚡ 답변 준비중...";
        if (selectedModel.startsWith("gemini:")) {
            waitingMsg = "🔵 Gemini(" + selectedModel.slice(7) + ") 응답을 기다리고 있습니다...";
        } else if (selectedModel.startsWith("groq:")) {
            waitingMsg = "🟠 Groq(" + selectedModel.slice(5) + ") 응답을 기다리고 있습니다...";
        }
        
        toggleAiView('md');
        setValue(aiPreviewSrcElement, waitingMsg);
        if (aiPreviewMdElement) aiPreviewMdElement.innerHTML = '<p>' + waitingMsg + '</p>';

        window.onAiChunk = (data) => {
            if (data.response) {
                fullResponse += data.response;
                lastTextResponse = fullResponse;
                setValue(aiPreviewSrcElement, fullResponse);
                if (aiPreviewMdElement) aiPreviewMdElement.innerHTML = renderMarkdown(fullResponse);
                
                if (aiPreviewSrcElement) aiPreviewSrcElement.scrollTop = aiPreviewSrcElement.scrollHeight;
                if (aiPreviewMdElement) aiPreviewMdElement.scrollTop = aiPreviewMdElement.scrollHeight;
            }

            if (data.done && fullResponse === "") {
                const errMsg = '❌ 응답 없음: API 키 또는 네트워크 오류일 수 있다.';
                setValue(aiPreviewSrcElement, errMsg);
                if (aiPreviewMdElement) aiPreviewMdElement.innerHTML = '<p style="color:red;">' + errMsg + '</p>';
            }
        };

        window.apiAiChat(instruction, mainDoc, selectedText, selectedModel)
        .catch(error => {
            console.error("통신 에러 발생:", error);
            const errMsg = "❌ 통신 에러 발생!\n" + error.message;
            setValue(aiPreviewSrcElement, errMsg);
            if (aiPreviewMdElement) aiPreviewMdElement.innerHTML = '<p style="color:red;">' + errMsg.replace(/\n/g, '<br>') + '</p>';
        });
    }
});

function loadAIConfig() {
    const modelSel = document.getElementById('model-select');
    const promptInput = document.getElementById('ai-promptInput');
    if (!modelSel) return;
    window.apiGetAIConfig()
        .then(config => {
            modelSel.innerHTML = "";
            let hasAnyModel = false;

            const addGroup = (label, providerName, providerData) => {
                if (providerData && providerData.apiKey && providerData.apiKey.trim() !== "" && providerData.models && providerData.models.length > 0) {
                    const group = document.createElement('optgroup');
                    group.label = label;
                    providerData.models.forEach(model => {
                        const opt = document.createElement('option');
                        opt.value = providerName + "|" + model.name;
                        opt.textContent = "✨ " + model.alias;
                        group.appendChild(opt);
                        hasAnyModel = true;
                    });
                    modelSel.appendChild(group);
                }
            };

            addGroup("Google API", "google", config.google);
            addGroup("Groq API", "groq", config.groq);


            if (!hasAnyModel) {
                modelSel.innerHTML = '<option value="">⚠️ 모델 미설정</option>';
                if (promptInput) promptInput.disabled = true;
                return;
            }

            if (promptInput) promptInput.disabled = false;
        })
        .catch(err => console.error("API 설정 로드 실패:", err));
}

// API 키 설정 모달 제어
const apiKeyModal = document.getElementById('api-key-modal');
const apiKeySetupBtn = document.getElementById('api-key-setup-btn');
const apiKeyClose = document.getElementById('api-key-close');
const apiKeyCancel = document.getElementById('api-key-cancel');
const apiKeyConfirm = document.getElementById('api-key-confirm');

// Google
const googleApiKey = document.getElementById('google-api-key');
const googleModel1Name = document.getElementById('google-model1-name');
const googleModel1Alias = document.getElementById('google-model1-alias');
const googleModel2Name = document.getElementById('google-model2-name');
const googleModel2Alias = document.getElementById('google-model2-alias');

// Groq
const groqApiKey = document.getElementById('groq-api-key');
const groqModel1Name = document.getElementById('groq-model1-name');
const groqModel1Alias = document.getElementById('groq-model1-alias');
const groqModel2Name = document.getElementById('groq-model2-name');
const groqModel2Alias = document.getElementById('groq-model2-alias');



function closeApiKeyModal() {
    if (apiKeyModal) {
        apiKeyModal.classList.remove('show');
    }
}

if (apiKeySetupBtn) {
    apiKeySetupBtn.addEventListener('click', () => {
        window.apiGetAIConfig()
            .then(config => {
                const g = config.google || {};
                googleApiKey.value = g.apiKey || '';
                googleModel1Name.value = (g.models && g.models[0]) ? g.models[0].name : '';
                googleModel1Alias.value = (g.models && g.models[0]) ? g.models[0].alias : '';
                googleModel2Name.value = (g.models && g.models[1]) ? g.models[1].name : '';
                googleModel2Alias.value = (g.models && g.models[1]) ? g.models[1].alias : '';
                
                const gr = config.groq || {};
                groqApiKey.value = gr.apiKey || '';
                groqModel1Name.value = (gr.models && gr.models[0]) ? gr.models[0].name : '';
                groqModel1Alias.value = (gr.models && gr.models[0]) ? gr.models[0].alias : '';
                groqModel2Name.value = (gr.models && gr.models[1]) ? gr.models[1].name : '';
                groqModel2Alias.value = (gr.models && gr.models[1]) ? gr.models[1].alias : '';


                
                if (apiKeyModal) {
                    apiKeyModal.classList.add('show');
                }
            })
            .catch(err => console.error("설정 로드 에러:", err));
    });
}

if (apiKeyClose) apiKeyClose.addEventListener('click', closeApiKeyModal);
if (apiKeyCancel) apiKeyCancel.addEventListener('click', closeApiKeyModal);
if (apiKeyModal) {
    apiKeyModal.addEventListener('click', (e) => {
        if (e.target === apiKeyModal) {
            closeApiKeyModal();
        }
    });
}

if (apiKeyConfirm) {
    apiKeyConfirm.addEventListener('click', () => {
        const buildProviderPayload = (keyInput, m1Name, m1Alias, m2Name, m2Alias) => {
            const apiKeyVal = keyInput.value.trim();
            const models = [];
            if (apiKeyVal !== "") {
                const name1 = m1Name.value.trim();
                const alias1 = m1Alias.value.trim();
                if (name1 && alias1) {
                    models.push({ name: name1, alias: alias1 });
                }
                const name2 = m2Name.value.trim();
                const alias2 = m2Alias.value.trim();
                if (name2 && alias2) {
                    models.push({ name: name2, alias: alias2 });
                }
            }
            return {
                apiKey: apiKeyVal,
                models: models
            };
        };

        const payload = {
            google: buildProviderPayload(googleApiKey, googleModel1Name, googleModel1Alias, googleModel2Name, googleModel2Alias),
            groq: buildProviderPayload(groqApiKey, groqModel1Name, groqModel1Alias, groqModel2Name, groqModel2Alias),

        };

        window.apiSaveAIConfig(payload)
        .then(() => {
            closeApiKeyModal();
            loadAIConfig();
        })
        .catch(err => alert("설정 저장에 실패했다: " + err.message));
    });
}

// 단어 해석 모달 닫기 및 배경 클릭 감지
function closeWordModal() {
    const modal = document.getElementById('word-modal');
    if (modal) {
        modal.classList.remove('show');
    }
}
const wordModal = document.getElementById('word-modal');
if (wordModal) {
    wordModal.addEventListener('click', function(e) {
        if (e.target === wordModal) {
            closeWordModal();
        }
    });
}

// 초기화 호출
setValue(editorElement, "");
setValue(aiPreviewSrcElement, "");
if (aiPreviewMdElement) aiPreviewMdElement.innerHTML = "";
loadDocument();
loadAIConfig();
