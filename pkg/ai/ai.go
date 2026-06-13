package ai

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"google.golang.org/genai"
)

type CustomModel struct {
	Name  string `json:"name"`
	Alias string `json:"alias"`
}

type APIProvider struct {
	APIKey string        `json:"apiKey"`
	Models []CustomModel `json:"models"`
}

type AIConfig struct {
	Google     APIProvider `json:"google"`
	Groq       APIProvider `json:"groq"`
}

func getAIConfigPath() (string, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return "", err
	}
	return filepath.Join(home, "Documents", ".apikeys.json"), nil
}

func ApiGetAIConfig(decryptFn func(string) (string, error)) (AIConfig, error) {
	var config AIConfig
	configPath, err := getAIConfigPath()
	if err != nil {
		return config, err
	}
	if _, err := os.Stat(configPath); err == nil {
		data, err := os.ReadFile(configPath)
		if err == nil {
			_ = json.Unmarshal(data, &config)
		}
	}

	if config.Google.APIKey != "" {
		if dec, err := decryptFn(config.Google.APIKey); err == nil {
			config.Google.APIKey = dec
		}
	}
	if config.Groq.APIKey != "" {
		if dec, err := decryptFn(config.Groq.APIKey); err == nil {
			config.Groq.APIKey = dec
		}
	}


	return config, nil
}

func ApiSaveAIConfig(config AIConfig, encryptFn func(string) (string, error)) error {
	// Encrypt keys before saving
	if config.Google.APIKey != "" {
		if enc, err := encryptFn(config.Google.APIKey); err == nil {
			config.Google.APIKey = enc
		}
	}
	if config.Groq.APIKey != "" {
		if enc, err := encryptFn(config.Groq.APIKey); err == nil {
			config.Groq.APIKey = enc
		}
	}


	configPath, err := getAIConfigPath()
	if err != nil {
		return err
	}

	dir := filepath.Dir(configPath)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return err
	}

	data, err := json.MarshalIndent(config, "", "  ")
	if err != nil {
		return err
	}

	return os.WriteFile(configPath, data, 0644)
}

func ApiDeleteAIConfig() error {
	configPath, err := getAIConfigPath()
	if err != nil {
		return err
	}
	if _, err := os.Stat(configPath); err == nil {
		return os.Remove(configPath)
	}
	return nil
}

func ApiAiChat(prompt, fullContent, selectedContent, model string, decryptFn func(string) (string, error), sendChunkFn func(string, string, bool)) {
	go func() {
		sysPrompt := "답변 말투는 '이다. 한다.'로 하거나, 서술어를 생략한다. 예를 들어 '적용합니다.' 라는 말 대신 '적용한다.' 라고 하거나 '적용.' 으로 줄여 말한다. 질문에 답변만 하고, 사용자에게 질문을 하지 않는다. Markdown으로 답변한다."

		var userPrompt string
		if selectedContent != "" {
			userPrompt = fmt.Sprintf("사용자의 질문은 <선택된_텍스트> %s </선택된_텍스트>에 관한 것이다. 이상의 글의 내용에 대한 다음 질문에 답하라:<질문>%s</질문>. 인공지능은 <질문> 자체를 설명해서는 안되며, <질문>을 <선택된_텍스트>에 대한 <질문>으로 처리해야 한다.", selectedContent, prompt)
		} else {
			userPrompt = fmt.Sprintf("사용자의 질문은 <선택된_텍스트> %s </선택된_텍스트>에 관한 것이다. 이상의 글의 내용에 대한 다음 질문에 답하라:<질문>%s</질문>. 인공지능은 <질문> 자체를 설명해서는 안되며, <질문>을 <선택된_텍스트>에 대한 <질문>으로 처리해야 한다.", fullContent, prompt)
		}

		parts := strings.SplitN(model, "|", 2)
		provider := "google"
		targetModel := model
		if len(parts) == 2 {
			provider = parts[0]
			targetModel = parts[1]
		}

		config, err := ApiGetAIConfig(decryptFn)
		if err != nil {
			sendChunkFn("", "❌ 설정을 불러올 수 없다.", true)
			return
		}

		switch provider {
		case "google":
			apiKey := config.Google.APIKey
			if apiKey == "" {
				sendChunkFn("", "❌ Google API 키가 설정되지 않았다.", true)
				return
			}
			geminiChatStream(apiKey, targetModel, sysPrompt, userPrompt, sendChunkFn)
		case "groq":
			apiKey := config.Groq.APIKey
			if apiKey == "" {
				sendChunkFn("", "❌ Groq API 키가 설정되지 않았다.", true)
				return
			}
			groqChatStream(apiKey, targetModel, sysPrompt, userPrompt, sendChunkFn)
		default:
			sendChunkFn("", "❌ 지원되지 않거나 알 수 없는 공급자 형식이다: "+provider, true)
		}
	}()
}

func geminiChatStream(apiKey, model, sysPrompt, userPrompt string, sendChunkFn func(string, string, bool)) {
	ctx := context.Background()
	client, err := genai.NewClient(ctx, &genai.ClientConfig{
		APIKey:  apiKey,
		Backend: genai.BackendGeminiAPI,
	})
	if err != nil {
		fmt.Println("❌ Gemini 클라이언트 생성 실패:", err)
		sendChunkFn("", "❌ Gemini 클라이언트 초기화 실패: "+err.Error(), true)
		return
	}

	todayStr := time.Now().Format("2006년 01월 02일")
	dynamicSysPrompt := fmt.Sprintf("%s\n오늘 날짜는 %s입니다. 최신 정보는 구글 검색을 활용하세요.", sysPrompt, todayStr)

	config := &genai.GenerateContentConfig{
		Temperature: genai.Ptr[float32](0.2),
		Tools: []*genai.Tool{
			{GoogleSearch: &genai.GoogleSearch{}},
		},
	}

	if strings.TrimSpace(dynamicSysPrompt) != "" {
		config.SystemInstruction = &genai.Content{
			Parts: genai.Text(dynamicSysPrompt)[0].Parts,
			Role:  "user",
		}
	}

	iter := client.Models.GenerateContentStream(
		ctx,
		model,
		genai.Text(userPrompt),
		config,
	)

	for result, err := range iter {
		if err != nil {
			fmt.Println("❌ Gemini 스트림 오류:", err)
			sendChunkFn("", "❌ 스트리밍 오류: "+err.Error(), true)
			return
		}

		thinkingText := ""
		responseText := ""
		if result != nil && len(result.Candidates) > 0 {
			c := result.Candidates[0]
			if c.Content != nil {
				for _, part := range c.Content.Parts {
					if part.Thought {
						thinkingText += part.Text
					} else if part.Text != "" {
						responseText += part.Text
					}
				}
			}
		}

		sendChunkFn(thinkingText, responseText, false)
	}

	sendChunkFn("", "", true)
}

func groqChatStream(apiKey, model, sysPrompt, userPrompt string, sendChunkFn func(string, string, bool)) {
	payload := map[string]interface{}{
		"model": model,
		"messages": []map[string]string{
			{"role": "system", "content": sysPrompt},
			{"role": "user", "content": userPrompt},
		},
		"stream":      true,
		"temperature": 0.2,
	}

	body, err := json.Marshal(payload)
	if err != nil {
		sendChunkFn("", "❌ Groq 요청 직렬화 오류: "+err.Error(), true)
		return
	}

	req, err := http.NewRequest("POST", "https://api.groq.com/openai/v1/chat/completions", bytes.NewReader(body))
	if err != nil {
		sendChunkFn("", "❌ Groq 요청 생성 오류: "+err.Error(), true)
		return
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "text/event-stream")

	httpClient := &http.Client{
		Timeout: 120 * time.Second,
		Transport: &http.Transport{
			DisableCompression: true,
		},
	}
	resp, err := httpClient.Do(req)
	if err != nil {
		sendChunkFn("", "❌ Groq 연결 오류: "+err.Error(), true)
		return
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		errBody, _ := io.ReadAll(resp.Body)
		sendChunkFn("", fmt.Sprintf("❌ Groq API 오류 (HTTP %d): %s", resp.StatusCode, string(errBody)), true)
		return
	}

	scanner := bufio.NewScanner(resp.Body)
	scanner.Buffer(make([]byte, 512*1024), 512*1024)
	for scanner.Scan() {
		line := scanner.Text()
		if !strings.HasPrefix(line, "data: ") {
			continue
		}
		data := strings.TrimPrefix(line, "data: ")
		if data == "[DONE]" {
			sendChunkFn("", "", true)
			return
		}

		var chunk struct {
			Choices []struct {
				Delta struct {
					Content string `json:"content"`
				} `json:"delta"`
			} `json:"choices"`
		}
		if err := json.Unmarshal([]byte(data), &chunk); err != nil {
			continue
		}
		if len(chunk.Choices) > 0 && chunk.Choices[0].Delta.Content != "" {
			sendChunkFn("", chunk.Choices[0].Delta.Content, false)
		}
	}

	if err := scanner.Err(); err != nil {
		sendChunkFn("", "❌ Groq 스트림 읽기 오류: "+err.Error(), true)
		return
	}
	sendChunkFn("", "", true)
}
