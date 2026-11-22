from pydantic import BaseModel, ConfigDict, Field

class MessageRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace = True)
    message: str = Field(min_length = 1, max_length = 20_000, description = 'Message for ZUSia')
    context: str | None = Field(default = None, max_length = 20_000,
                                description = 'Data of the signed-in user and the current screen, used for this turn only')

class CreateChatRequest(BaseModel):
    persist: bool = Field(default = False, description = 'The user agreed to keep the conversation and its files')

class PersistenceRequest(BaseModel):
    persist: bool

class ChatMessage(BaseModel):
    role: str = Field(pattern = '^(user|assistant)$')
    content: str = Field(min_length = 1)

class ChatResponse(BaseModel):
    session_id: str
    reply: str
