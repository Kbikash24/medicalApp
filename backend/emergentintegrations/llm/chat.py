"""
Mock implementation of emergentintegrations.llm.chat module using OpenAI directly
"""
import openai
import base64
from typing import List, Optional


class ImageContent:
    """Represents an image content to be sent to LLM"""
    def __init__(self, image_base64: str):
        self.image_base64 = image_base64


class UserMessage:
    """Represents a user message with optional file contents"""
    def __init__(self, text: str, file_contents: Optional[List[ImageContent]] = None):
        self.text = text
        self.file_contents = file_contents or []


class LlmChat:
    """Simple wrapper around OpenAI API"""
    
    def __init__(self, api_key: str, session_id: str, system_message: str):
        self.api_key = api_key
        self.session_id = session_id
        self.system_message = system_message
        self.model = "gpt-4o"
        self.provider = "openai"
        
    def with_model(self, provider: str, model: str):
        """Set the model and provider"""
        self.provider = provider
        self.model = model
        return self
        
    async def send_message(self, message: UserMessage) -> str:
        """Send message to OpenAI and return response"""
        client = openai.AsyncOpenAI(api_key=self.api_key)
        
        # Build messages
        messages = [
            {"role": "system", "content": self.system_message}
        ]
        
        # Handle text and images
        if message.file_contents:
            content = [
                {"type": "text", "text": message.text}
            ]
            
            for image_content in message.file_contents:
                content.append({
                    "type": "image_url",
                    "image_url": {
                        "url": f"data:image/jpeg;base64,{image_content.image_base64}"
                    }
                })
                
            messages.append({"role": "user", "content": content})
        else:
            messages.append({"role": "user", "content": message.text})
        
        # Call OpenAI API
        response = await client.chat.completions.create(
            model=self.model,
            messages=messages,
            max_tokens=4096
        )
        
        return response.choices[0].message.content
