from pydantic import BaseModel, ConfigDict, Field

class MessageRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace = True)
    message: str = Field(min_length = 1, max_length = 20_000, description = 'Message for ZUSia')
    screen: str | None = Field(default = None, max_length = 20_000,
                               description = 'What the user sees right now (page, form values) – kept in memory for the MCP tool get_current_screen')
    pue_token: str | None = Field(default = None, max_length = 200,
                                  description = "The signed-in user's PUE session token – passed to the MCP tools, never stored")

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
