from pydantic import BaseModel, ConfigDict, Field

class MessageRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace = True)
    message: str = Field(min_length = 1, max_length = 20_000, description = 'Message for ZUSia')

class ChatMessage(BaseModel):
    role: str = Field(pattern = '^(user|assistant)$')
    content: str = Field(min_length = 1)

class ChatResponse(BaseModel):
    session_id: str
    reply: str
